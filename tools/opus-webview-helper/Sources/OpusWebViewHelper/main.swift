import Cocoa
import CoreGraphics
import Network
import WebKit

// Opus WebView Helper
//
// Renders the Opus web UI in an offscreen WKWebView (JCEF does not work with
// the game's Java 8 / macOS arm64 runtime) and streams BGRA frames to the
// Java 8 Minecraft process over a loopback socket. Java only uploads the frame
// to an OpenGL texture; it owns no AppKit/WebKit state.
//
// Protocol (see PROTOCOL.md):
//   Java   -> HELLO <token>\n | SIZE w h\n | URL <url>\n | INPUT <b64>\n | PING\n | BYE\n
//   helper -> READY\n | FRAME w h byteCount\n + <byteCount> BGRA bytes | PONG\n

final class Connection {
    let nw: NWConnection
    var buffer = Data()
    var authenticated = false
    init(_ nw: NWConnection) { self.nw = nw }
}

final class FrameServer: NSObject, WKNavigationDelegate {
    private let listener: NWListener
    private let token: String
    private var connections: [ObjectIdentifier: Connection] = [:]

    private var width = 1280
    private var height = 720
    private var url = "about:blank"
    private var webView: WKWebView!
    private var window: NSWindow!
    private var loaded = false
    private var timer: Timer?
    private var capturing = false
    // Native-overlay prototype (see docs/research-native-overlay.md). When true
    // the WebKit view is composited on-screen over the game window instead of
    // being snapshotted and streamed as BGRA. Additive: `MODE stream` (default)
    // keeps the original offscreen pipeline untouched as a fallback.
    private var overlayMode = false
    private var alignLoggedFound = false
    // The game asked the overlay to be visible (an Opus screen is open). Actual
    // on-screen visibility is ALSO gated on the game being the frontmost app so
    // the overlay never floats over other apps the user switched to.
    private var overlayShouldShow = false
    private let gamePid: pid_t = getppid()
    private var activationObservers: [NSObjectProtocol] = []
    // Last frame actually broadcast. A settled, static menu produces
    // identical snapshots; skipping them keeps the loopback socket and the
    // game's GL upload idle instead of re-uploading the same pixels every
    // tick, which was a real source of perceived lag. Any visual change is
    // still sent on the next tick.
    private var lastFrameData: Data?

    init?(port: UInt16, token: String) {
        self.token = token
        guard let nwPort = NWEndpoint.Port(rawValue: port) else { return nil }
        let params = NWParameters.tcp
        params.requiredInterfaceType = .loopback
        guard let listener = try? NWListener(using: params, on: nwPort) else { return nil }
        self.listener = listener
        super.init()
        listener.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
    }

    func start() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.suppressesIncrementalRendering = false
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height), configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        // A borderless, fully transparent, offscreen window keeps WebKit's
        // compositor alive (snapshots are blank without an attached window)
        // without ever showing UI to the user.
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: width, height: height),
                          styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = webView
        window.isOpaque = false
        window.backgroundColor = .clear
        window.alphaValue = 0.0
        window.ignoresMouseEvents = true
        window.hasShadow = false
        // Critical: never bring this window to the front. orderFront on macOS
        // contends with the game's window for the WindowServer and freezes the
        // whole desktop. A window below the desktop level, ordered back only,
        // still keeps WebKit's compositor alive so snapshots are non-blank.
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) - 1)
        window.collectionBehavior = [.stationary, .ignoresCycle, .canJoinAllSpaces]
        window.setFrameOrigin(NSPoint(x: 0, y: 0))
        window.orderBack(nil)

        listener.start(queue: .main)

        // ~20 fps capture loop. Snapshots are only encoded/sent while at least
        // one client is connected and the page has finished its first load.
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 20.0, repeats: true) { [weak self] _ in
            self?.captureAndBroadcast()
        }
        RunLoop.main.add(timer!, forMode: .common)
    }

    // MARK: - Networking

    private func accept(_ nw: NWConnection) {
        let conn = Connection(nw)
        connections[ObjectIdentifier(nw)] = conn
        nw.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed, .cancelled:
                self?.remove(nw)
            default:
                break
            }
        }
        nw.start(queue: .main)
        receive(conn)
    }

    private func receive(_ conn: Connection) {
        conn.nw.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) {
            [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                conn.buffer.append(data)
                self.consume(conn)
            }
            if isComplete || error != nil {
                self.remove(conn.nw)
            } else {
                self.receive(conn)
            }
        }
    }

    private func consume(_ conn: Connection) {
        while let nl = conn.buffer.firstIndex(of: 0x0a) {
            let lineData = conn.buffer[conn.buffer.startIndex..<nl]
            conn.buffer.removeSubrange(conn.buffer.startIndex...nl)
            let line = String(decoding: lineData, as: UTF8.self)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\r"))
            handle(line, on: conn)
        }
    }

    private func handle(_ line: String, on conn: Connection) {
        if line.isEmpty { return }
        let parts = line.split(separator: " ", maxSplits: 2).map(String.init)
        guard let command = parts.first else { return }

        if !conn.authenticated {
            if command == "HELLO", parts.count >= 2, parts[1] == token {
                conn.authenticated = true
                sendLine("READY", to: conn)
            } else {
                remove(conn.nw)
            }
            return
        }

        switch command {
        case "SIZE" where parts.count == 3:
            let w = max(1, Int(parts[1]) ?? width)
            let h = max(1, Int(parts[2]) ?? height)
            if w != width || h != height {
                width = w
                height = h
                window.setContentSize(NSSize(width: w, height: h))
                webView.frame = NSRect(x: 0, y: 0, width: w, height: h)
                // Force the next capture to be sent even if the page content
                // hashes equal to the pre-resize frame.
                lastFrameData = nil
            }
        case "URL" where parts.count == 2:
            navigate(to: parts[1])
        case "INPUT" where parts.count == 2:
            forwardInput(parts[1])
        case "PING":
            sendLine("PONG", to: conn)
        case "RELOAD":
            // Desync recovery: force a genuine reload of the current document.
            loaded = false
            lastFrameData = nil
            if let dest = URL(string: url) { webView.load(URLRequest(url: dest)) }
        case "MODE" where parts.count == 2:
            setMode(parts[1])
        case "SHOW":
            showOverlay()
        case "HIDE":
            hideOverlay()
        case "TRACK":
            // TRACK x y w h — game window frame in GLOBAL screen coords, TOP-LEFT
            // origin, POINTS. IMPORTANT: the shared `parts` above uses
            // maxSplits:2 (to keep URL/INPUT intact), which collapses these four
            // numbers into one string and made this command silently no-op. Re-
            // split the raw line so all coordinates are parsed.
            let t = line.split(separator: " ").map(String.init)
            if t.count >= 5 {
                trackFrame(x: Double(t[1]) ?? 0,
                           y: Double(t[2]) ?? 0,
                           w: Double(t[3]) ?? Double(width),
                           h: Double(t[4]) ?? Double(height))
            }
        case "CLICKTHROUGH" where parts.count == 2:
            window.ignoresMouseEvents = (parts[1] == "1")
        case "BYE":
            remove(conn.nw)
        default:
            break
        }
    }

    /// Navigates the web view. When only the URL fragment (the SPA route)
    /// changed and the document is already loaded, the route is switched in
    /// place through the hash router instead of reloading the whole page. A
    /// full reload on every screen change caused the 1-3 second stall per click.
    private func navigate(to newURL: String) {
        guard let dest = URL(string: newURL) else { return }
        if loaded, sameDocument(url, newURL) {
            url = newURL
            let fragment = dest.fragment ?? ""
            let safe = fragment
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            webView.evaluateJavaScript("location.hash='#\(safe)';", completionHandler: nil)
            return
        }
        url = newURL
        loaded = false
        lastFrameData = nil
        webView.load(URLRequest(url: dest))
    }

    /// Two URLs address the same document when everything but the fragment
    /// matches, so a route change never needs a network reload.
    private func sameDocument(_ lhs: String, _ rhs: String) -> Bool {
        guard let a = URLComponents(string: lhs), let b = URLComponents(string: rhs) else {
            return false
        }
        return a.scheme == b.scheme
            && a.host == b.host
            && a.port == b.port
            && a.path == b.path
            && a.percentEncodedQuery == b.percentEncodedQuery
    }

    private func sendLine(_ text: String, to conn: Connection) {
        conn.nw.send(content: (text + "\n").data(using: .utf8), completion: .contentProcessed { _ in })
    }

    private func remove(_ nw: NWConnection) {
        if let conn = connections.removeValue(forKey: ObjectIdentifier(nw)) {
            conn.nw.cancel()
        }
        // The game owns exactly one client. Once it disconnects (screen closed
        // or game exited) there is no reason to keep a headless WebKit process
        // alive, so shut down promptly instead of lingering.
        if connections.isEmpty {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                if self.connections.isEmpty {
                    exit(0)
                }
            }
        }
    }

    private var activeClients: [Connection] {
        connections.values.filter { $0.authenticated }
    }

    // MARK: - Native overlay (prototype)

    /// Switches between the on-screen overlay compositor and the legacy stream.
    private func setMode(_ mode: String) {
        let wantOverlay = (mode == "overlay")
        if wantOverlay == overlayMode { return }
        overlayMode = wantOverlay
        if wantOverlay {
            // Allow the process to own visible windows (no Dock icon, no menu).
            NSApp.setActivationPolicy(.accessory)
            // Raise above normal windows and float over fullscreen Spaces. The
            // window starts HIDDEN; the game sends SHOW when UI opens.
            window.alphaValue = 1.0
            window.level = .floating
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
            window.ignoresMouseEvents = true
            window.orderOut(nil)
            lastFrameData = nil
            registerActivationObservers()
        } else {
            // Return to the offscreen-behind-desktop configuration.
            unregisterActivationObservers()
            window.orderOut(nil)
            window.alphaValue = 0.0
            window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) - 1)
            window.collectionBehavior = [.stationary, .ignoresCycle, .canJoinAllSpaces]
            window.ignoresMouseEvents = true
            window.orderBack(nil)
        }
    }

    // The overlay belongs to the game window: it must be visible ONLY while the
    // game is the frontmost app. Otherwise, because it is a floating all-spaces
    // window, it would sit on top of whatever app the user switched to and — as
    // it is click-through — block their content without being dismissable.
    private func registerActivationObservers() {
        let wsc = NSWorkspace.shared.notificationCenter
        let onChange: (Notification) -> Void = { [weak self] _ in self?.reconcileOverlayVisibility() }
        activationObservers.append(
            wsc.addObserver(forName: NSWorkspace.didActivateApplicationNotification,
                            object: nil, queue: .main, using: onChange))
        activationObservers.append(
            wsc.addObserver(forName: NSWorkspace.didDeactivateApplicationNotification,
                            object: nil, queue: .main, using: onChange))
    }

    private func unregisterActivationObservers() {
        let wsc = NSWorkspace.shared.notificationCenter
        for o in activationObservers { wsc.removeObserver(o) }
        activationObservers.removeAll()
    }

    private func gameIsFrontmost() -> Bool {
        return NSWorkspace.shared.frontmostApplication?.processIdentifier == gamePid
    }

    /// Reconciles actual window visibility with (shouldShow AND game frontmost).
    private func reconcileOverlayVisibility() {
        guard overlayMode else { return }
        if overlayShouldShow && gameIsFrontmost() {
            window.orderFrontRegardless()
            if !window.ignoresMouseEvents { window.makeKey() }
        } else {
            window.orderOut(nil)
        }
    }

    private func showOverlay() {
        guard overlayMode else { return }
        overlayShouldShow = true
        reconcileOverlayVisibility()
    }

    private func hideOverlay() {
        guard overlayMode else { return }
        overlayShouldShow = false
        window.orderOut(nil)
    }

    private func applyOverlayFrame(topLeft: CGRect, source: String) {
        // The game reports its window in GLOBAL screen coordinates with a
        // TOP-LEFT origin (points). AppKit uses a BOTTOM-LEFT origin whose Y is
        // measured from the bottom of the PRIMARY (menu-bar) screen, which is
        // NSScreen.screens[0]. Flip against that height.
        let primaryHeight = NSScreen.screens.first?.frame.height
            ?? NSScreen.main?.frame.height ?? 0
        let frame = NSRect(x: topLeft.origin.x,
                           y: primaryHeight - (topLeft.origin.y + topLeft.height),
                           width: topLeft.width, height: topLeft.height)
        window.setFrame(frame, display: true)
        webView.frame = NSRect(x: 0, y: 0, width: frame.width, height: frame.height)
    }

    /// Writes a diagnostic line to stderr; the game JVM drains it into the
    /// Minecraft log so overlay behaviour is visible without attaching a debugger.
    private func logLine(_ msg: String) {
        FileHandle.standardError.write(("[opus-helper] " + msg + "\n").data(using: .utf8)!)
    }

    /// Aligns the overlay window with the game window. The game sends its own
    /// window rect in GLOBAL screen coordinates, TOP-LEFT origin, in POINTS
    /// (LWJGL Display.getX/getY/getWidth/getHeight report logical points on
    /// macOS — e.g. 533,271 854x480 — which is exactly what AppKit needs). We
    /// use those values directly; the flip to bottom-left happens in
    /// applyOverlayFrame.
    private func trackFrame(x: Double, y: Double, w: Double, h: Double) {
        guard overlayMode else { return }
        let topLeft = CGRect(x: CGFloat(x), y: CGFloat(y),
                             width: CGFloat(max(1, w)), height: CGFloat(max(1, h)))
        if !alignLoggedFound {
            alignLoggedFound = true
            logLine("trackFrame: pin overlay to game window (\(Int(x)),\(Int(y)) \(Int(w))x\(Int(h)))")
        }
        applyOverlayFrame(topLeft: topLeft, source: "track")
    }

    // MARK: - Capture

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
    }

    private func captureAndBroadcast() {
        // Overlay mode composites on-screen; never snapshot/stream in that mode.
        guard !overlayMode else { return }
        guard loaded, !capturing, !activeClients.isEmpty else { return }
        capturing = true
        let cfg = WKSnapshotConfiguration()
        cfg.rect = CGRect(x: 0, y: 0, width: width, height: height)
        webView.takeSnapshot(with: cfg) { [weak self] image, error in
            guard let self = self else { return }
            defer { self.capturing = false }
            guard let image = image, error == nil,
                  let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
                  cg.width > 0, cg.height > 0,
                  let bgra = self.bgra(cg) else { return }
            // A settled menu produces byte-identical snapshots; skip them so
            // the loopback socket and the game GL upload stay idle until
            // something actually changes.
            if let last = self.lastFrameData, last == bgra { return }
            self.lastFrameData = bgra
            // Send the CGImage's true pixel size (Retina backing is 2x the
            // logical SIZE), so the game texture is crisp when drawn over the
            // logical viewport.
            let header = "FRAME \(cg.width) \(cg.height) \(bgra.count)\n"
            let headerData = header.data(using: .utf8)!
            for conn in self.activeClients {
                conn.nw.send(content: headerData, completion: .contentProcessed { _ in })
                conn.nw.send(content: bgra, completion: .contentProcessed { _ in })
            }
        }
    }

    private func bgra(_ image: CGImage) -> Data? {
        let w = image.width
        let h = image.height
        var data = Data(count: w * h * 4)
        let ok = data.withUnsafeMutableBytes { raw -> Bool in
            guard let base = raw.baseAddress,
                  let ctx = CGContext(
                    data: base, width: w, height: h,
                    bitsPerComponent: 8, bytesPerRow: w * 4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                        | CGBitmapInfo.byteOrder32Little.rawValue) else { return false }
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        return ok ? data : nil
    }

    // MARK: - Input forwarding (synthetic DOM events)

    private func forwardInput(_ base64: String) {
        guard let data = Data(base64Encoded: base64),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String else { return }
        let x = (obj["x"] as? Double) ?? 0
        let y = (obj["y"] as? Double) ?? 0
        let button = (obj["button"] as? Int) ?? 0
        let deltaY = (obj["deltaY"] as? Double) ?? 0
        let key = (obj["key"] as? String) ?? ""

        var js = ""
        switch type {
        case "move":
            js = "window.__opusDispatch && window.__opusDispatch('mousemove',\(x),\(y),\(button),0);"
        case "down":
            js = "window.__opusDispatch && window.__opusDispatch('mousedown',\(x),\(y),\(button),0);"
        case "up":
            js = "window.__opusDispatch && window.__opusDispatch('mouseup',\(x),\(y),\(button),0);"
                + "window.__opusDispatch && window.__opusDispatch('click',\(x),\(y),\(button),0);"
        case "scroll":
            js = "window.__opusScroll && window.__opusScroll(\(x),\(y),\(deltaY));"
        case "key":
            let safe = key.replacingOccurrences(of: "'", with: "\\'")
            js = "window.__opusKey && window.__opusKey('\(safe)');"
        default:
            return
        }
        if !js.isEmpty {
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// MARK: - Entry point

let args = CommandLine.arguments
func argValue(_ name: String) -> String? {
    guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
    return args[i + 1]
}
let port = UInt16(argValue("--port") ?? "49880") ?? 49880
let token = argValue("--token") ?? "opus-dev"

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
guard let server = FrameServer(port: port, token: token) else {
    FileHandle.standardError.write("unable to bind helper on \(port)\n".data(using: .utf8)!)
    exit(2)
}
server.start()
app.run()
