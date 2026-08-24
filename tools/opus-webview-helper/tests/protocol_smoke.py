#!/usr/bin/env python3
"""End-to-end smoke test for the Opus web-view helper.

Drives the real compiled Swift helper through the real loopback protocol
against the real built Svelte SPA, so it proves the runtime behaviors the Java
client depends on rather than just that the code compiles:

  1. The helper renders the offscreen WKWebView and streams BGRA FRAMEs.
  2. A route change (URL fragment only) switches in place via the SPA hash
     router instead of reloading the whole page -- the fix for the multi-second
     stall on every click. The next distinct frame must arrive quickly.
  3. Identical consecutive frames are suppressed (a settled menu goes quiet).
  4. INPUT is accepted without tearing down the stream.

Serves ui/dist with the interop server's query contract
(?code=..&port=..#/route). Requires a macOS GUI session (WindowServer); if the
helper cannot start there, the test reports it clearly instead of hanging.
"""

from __future__ import annotations

import base64
import http.server
import json
import socket
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DIST = REPO / "ui" / "dist"
def _resolve_helper() -> Path:
    """Locate the compiled helper for whichever arch swift built it under."""
    base = REPO / "runtime/legacy/1.8.9/client/native/opus-webview-helper/.build"
    for arch in ("arm64-apple-macosx", "x86_64-apple-macosx"):
        candidate = base / arch / "release" / "opus-webview-helper"
        if candidate.exists():
            return candidate
    # Fall back to the plugin's own build output if the runtime copy is absent.
    tool = REPO / "tools/opus-webview-helper/.build"
    for arch in ("arm64-apple-macosx", "x86_64-apple-macosx"):
        candidate = tool / arch / "release" / "opus-webview-helper"
        if candidate.exists():
            return candidate
    return base / "arm64-apple-macosx" / "release" / "opus-webview-helper"


HELPER = _resolve_helper()
TOKEN = "opus-smoke-token"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def serve_dist():
    handler = lambda *a, **k: QuietHandler(*a, directory=str(DIST), **k)  # noqa: E731
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class HelperClient:
    def __init__(self, sock: socket.socket):
        self.sock = sock
        self.buf = b""

    def send_line(self, line: str) -> None:
        self.sock.sendall((line + "\n").encode("utf-8"))

    def _fill(self) -> None:
        chunk = self.sock.recv(65536)
        if not chunk:
            raise ConnectionError("helper closed the connection")
        self.buf += chunk

    def read_line(self, deadline: float) -> str:
        while b"\n" not in self.buf:
            self.sock.settimeout(max(0.05, deadline - time.monotonic()))
            self._fill()
        line, self.buf = self.buf.split(b"\n", 1)
        return line.decode("utf-8").rstrip("\r")

    def read_exact(self, count: int, deadline: float) -> bytes:
        while len(self.buf) < count:
            self.sock.settimeout(max(0.05, deadline - time.monotonic()))
            self._fill()
        out, self.buf = self.buf[:count], self.buf[count:]
        return out

    def next_frame(self, deadline: float):
        while True:
            line = self.read_line(deadline)
            if line in ("READY", "PONG"):
                continue
            if line.startswith("FRAME "):
                _, w, h, n = line.split(" ")
                w, h, n = int(w), int(h), int(n)
                return w, h, self.read_exact(n, deadline)


def main() -> int:
    # This Swift/WKWebView helper is retained only as historical research. The
    # shipped client uses the CEF OSR helper and forwards native mouse/key
    # events directly; this prototype's removed DOM-synthesis bridge must not
    # become a second product or input path. Use `harnessWebView` for the
    # production gate instead.
    if "--legacy" not in sys.argv:
        print("SKIP: legacy WKWebView prototype; run `./gradlew harnessWebView` for production CEF")
        return 0
    if sys.platform != "darwin":
        print("SKIP: helper is macOS only")
        return 0
    if not HELPER.exists():
        print(f"FAIL: helper binary not built at {HELPER}")
        return 1
    if not (DIST / "index.html").exists():
        print(f"FAIL: SPA not built at {DIST} (run npm run build)")
        return 1

    httpd, http_port = serve_dist()
    port = free_port()
    # Drive the SPA in standalone mode (no ?port=): this exercises the exact
    # hash router and input bridge the helper uses in-game, with mock data so
    # pages render without the loopback REST/WS server. (In-game the real interop
    # server serves those; here we isolate the helper + SPA + hover pipeline.)
    base = f"http://127.0.0.1:{http_port}/"
    url_title = f"{base}#/title"
    url_settings = f"{base}#/settings"

    proc = subprocess.Popen(
        [str(HELPER), "--port", str(port), "--token", TOKEN],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    failures = 0

    def check(ok: bool, label: str, detail: str = "") -> None:
        nonlocal failures
        if ok:
            print(f"PASS {label} {detail}".rstrip())
        else:
            failures += 1
            print(f"FAIL {label} {detail}".rstrip())

    sock = None
    try:
        connect_deadline = time.monotonic() + 6.0
        while time.monotonic() < connect_deadline:
            if proc.poll() is not None:
                print(f"FAIL helper exited early rc={proc.returncode}")
                return 1
            try:
                sock = socket.create_connection(("127.0.0.1", port), timeout=0.5)
                break
            except OSError:
                time.sleep(0.1)
        check(sock is not None, "helper.connect")
        if sock is None:
            return 1

        client = HelperClient(sock)
        client.send_line(f"HELLO {TOKEN}")
        deadline = time.monotonic() + 5.0
        ready = client.read_line(deadline)
        check(ready == "READY", "helper.ready", ready)

        client.send_line("SIZE 960 540")
        client.send_line(f"URL {url_title}")

        t0 = time.monotonic()
        deadline = t0 + 15.0
        w, h, frame = client.next_frame(deadline)
        ttff = time.monotonic() - t0
        check(len(frame) == w * h * 4, "frame.size", f"{w}x{h} {len(frame)}B")
        check(w > 0 and h > 0, "frame.nonempty", f"{w}x{h}")
        check(w >= 960 and h >= 540, "frame.resolution", f"{w}x{h} (logical 960x540)")
        check(ttff < 12.0, "frame.first_arrives", f"{ttff*1000:.0f}ms")

        client.send_line(f"URL {url_settings}")
        t1 = time.monotonic()
        deadline = t1 + 8.0
        prev = frame
        changed_at = None
        while time.monotonic() < deadline:
            _, _, f = client.next_frame(deadline)
            if f != prev:
                changed_at = time.monotonic() - t1
                break
            prev = f
        check(
            changed_at is not None and changed_at < 3.0,
            "route.switch_in_place",
            f"{(changed_at or 0)*1000:.0f}ms (no full reload)",
        )

        settle = frame
        quiet = False
        gap_deadline = time.monotonic() + 4.0
        last_distinct = time.monotonic()
        while time.monotonic() < gap_deadline:
            try:
                _, _, f = client.next_frame(time.monotonic() + 0.8)
                if f != settle:
                    settle = f
                    last_distinct = time.monotonic()
            except (socket.timeout, ConnectionError):
                quiet = True
                break
        if not quiet and (time.monotonic() - last_distinct) > 0.6:
            quiet = True
        check(quiet, "frame.dedupe_quiet", "static page stops re-sending")

        payload = base64.b64encode(
            json.dumps({"type": "move", "x": 120, "y": 80, "button": 0, "deltaY": 0}).encode()
        ).decode()
        client.send_line(f"INPUT {payload}")
        client.send_line("PING")
        deadline = time.monotonic() + 4.0
        got_pong = False
        while time.monotonic() < deadline:
            line = client.read_line(deadline)
            if line == "PONG":
                got_pong = True
                break
            if line.startswith("FRAME "):
                _, _w, _h, n2 = line.split(" ")
                client.read_exact(int(n2), deadline)
        check(got_pong, "input.accepted_stream_alive")

        # (5) Hover follows the cursor end to end: sweeping a forwarded pointer
        # down the centered title menu must synthesize mouseenter and repaint the
        # highlight. This proves the embedded-input hover rewrite + Svelte
        # onmouseenter fire through the real pipeline -- the fix for "menu does
        # not react to the mouse". We compare each frame to the previous one so a
        # missing baseline can never mask a real repaint.
        client.send_line(f"URL {url_title}")
        # Settle to a stable baseline after the route switch.
        prev = None
        settle_deadline = time.monotonic() + 4.0
        while time.monotonic() < settle_deadline:
            try:
                _, _, prev = client.next_frame(time.monotonic() + 0.6)
            except (socket.timeout, ConnectionError):
                break
        # Sweep the pointer down the vertical menu band (logical 960x540) and
        # count how many positions repaint. Crossing menu items must synthesize
        # mouseenter and repaint the highlight; a single frame could be a stray
        # transition, so we require at least two distinct repaints across the
        # sweep to prove hover genuinely tracks the cursor.
        repaints = 0
        for y in range(60, 520, 20):
            move = base64.b64encode(
                json.dumps({"type": "move", "x": 480, "y": y, "button": 0, "deltaY": 0}).encode()
            ).decode()
            client.send_line(f"INPUT {move}")
            try:
                _, _, f = client.next_frame(time.monotonic() + 0.8)
                if prev is not None and f != prev:
                    repaints += 1
                prev = f
            except (socket.timeout, ConnectionError):
                continue
        check(repaints >= 2, "hover.follows_cursor", f"{repaints} highlight repaints across menu")

        client.send_line("BYE")
    finally:
        try:
            if sock is not None:
                sock.close()
        except OSError:
            pass
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        httpd.shutdown()

    if failures:
        print(f"\nSMOKE: {failures} check(s) failed")
        return 1
    print("\nSMOKE: ALL PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
