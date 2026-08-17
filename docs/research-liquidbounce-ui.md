# Research: LiquidBounce UI Architecture (Svelte + CEF/MCEF)

Ngày: 2026-08-17
Nguồn: https://github.com/CCBlueX/LiquidBounce (clone `--depth 1` tại
`/Users/zvwgvx/Project/opus-research/liquidbounce`)

## 1. Mục đích

Tài liệu này tóm tắt cách CCBlueX/LiquidBounce dựng toàn bộ UI bằng một
frontend application (Svelte) render qua Chromium (JCEF/MCEF), rồi đối chiếu
với Opus Client 1.8.9/Forge để xác định phần kế thừa được, phần phải điều
chỉnh, và rủi ro.

## 2. Bức tranh tổng thể

```text
Minecraft / Fabric client (Kotlin)
  ├── BrowserBackendManager  ── chọn backend: CEF | external | none
  │     ├── CefBrowserBackend     (MCEF = JCEF fork cho Minecraft)
  │     │     └── CefBrowser      (offscreen render -> OpenGL texture)
  │     └── ExternalSystemBrowserBackend (mở tab trình duyệt ngoài, dành cho dev)
  ├── BrowserRenderer        ── vẽ texture vào framebuffer game theo GUI scale
  ├── InputListener          ── forward mouse/keyboard/char vào CEF
  ├── ScreenManager          ── virtual screen + acknowledgement (chống desync)
  ├── ThemeManager           ── quản lý theme (resource/local/marketplace/remote)
  └── ClientInteropServer    ── Ktor server 127.0.0.1:port ngẫu nhiên
        ├── REST /api/v1     ── actions/state (modules, accounts, screens...)
        ├── WebSocket /      ── realtime events + ping 15s
        ├── AuthPlugin       ── cookie lb_auth + query lb_code
        └── singlePageApplication ── serve bản build Svelte từ resources

src-theme (Svelte 5 + TS + SCSS + Vite, svelte-spa-router #/route)
  ├── integration/rest.ts, ws.ts, events.ts, host.ts
  ├── routes/ (title, multiplayer, singleplayer, altmanager, clickgui, hud...)
  └── colors.scss (design tokens: --accent-color, --surface-color...)
```

## 3. Những mảnh quan trọng nhất trong source

### 3.1 Browser abstraction (backend có thể thay)

`integration/backend/BrowserBackend.kt` định nghĩa interface backend; có hai
hiện thực:

- `CefBrowserBackend`: dùng **MCEF** (`net.ccbluex:mcef`, JCEF fork), khởi tạo
  phải nằm trên render thread; download binaries JCEF/CEF qua
  `ResourceManager` (từ `https://api.liquidbounce.net/`), có hash validation,
  cache theo thời gian, cleanup sau 7 ngày.
- `ExternalSystemBrowserBackend`: chỉ mở URL bằng trình duyệt ngoài. Rất hữu
  ích cho dev: không cần JCEF vẫn dùng được toàn bộ frontend + bridge.

Chọn backend qua env `LB_BROWSER_BACKEND=cef|external|none`.

### 3.2 Render pipeline

`CefBrowser.kt`:

- Tạo browser offscreen với kích thước = viewport * quality
  (`BrowserViewport.getScaledDimensions`, quality 0.5..1.0).
- `BrowserTexture` chứa `TextureSetup` (texture GL), `bgra` flag; CEF paint
  listener kiểm tra kích thước khớp viewport, lệch thì `invalidate()`.
- `BrowserRenderer` vẽ texture theo `mc.window.guiScale`, dùng blend
  premultiplied alpha (`JCEF_COMPATIBLE_BLEND`), hỗ trợ BGRA và RGBA.
- `GlobalBrowserSettings.quality` đổi độ phân giải render (không đổi logical
  size) — đúng ý tưởng "Browser Quality Scale" trong tài liệu Opus.

### 3.3 Input forwarding

`InputListener` bắt `MouseButtonEvent`, `MouseScrollEvent`, `MouseCursorEvent`,
`KeyboardKeyEvent`, `KeyboardCharEvent`; chuyển toạ độ window -> framebuffer ->
viewport, rồi gọi `sendMousePress/Move/Wheel`, `sendKeyPress/Release/Typed`.
`InputAcceptor` quyết định browser nào được nhận input (vd: không nhận khi
đang chat). Có workaround clipboard Cmd+C/V/X/A cho macOS.

### 3.4 Interop server (REST + WS + auth)

`ClientInteropServer.kt`:

- Ktor Netty, chỉ bind `127.0.0.1`, port random (`ServerSocket(0)`), auth code
  16 ký tự ngẫu nhiên mỗi phiên.
- `AuthPlugin`: request hợp lệ nếu cookie `lb_auth` khớp, hoặc query
  `lb_code` khớp (lần đầu thì server set cookie httpOnly).
- WS endpoint `/` yêu cầu cùng auth; ping 15s; frontend tự reconnect sau 1s.
- REST dưới `/api/v1/client`: modules, settings, accounts, proxy, screen,
  localStorage, theme, marketplace, player, worlds, servers...
- Frontend đọc `port` từ hash params khi dùng external backend, nếu không thì
  dùng `window.location.origin` (CEF mở trực tiếp server).

### 3.5 Virtual screen + acknowledgement

`ScreenManager` + `ScreenAcknowledgement`:

- Mỗi screen Minecraft được map sang `CustomScreenType` (title, multiplayer,
  singleplayer, options, game_menu, inventory, container, disconnected...)
  bằng recognizer predicate.
- Khi screen thay đổi: reset ack -> `VirtualScreenEvent` -> WS -> frontend
  router chuyển `#/route`.
- Frontend gọi `POST /api/v1/client/virtualScreen` (confirm) sau khi route đã
  mở; nếu quá 1 giây chưa confirm -> coi là desync -> reload browser.
- Replace dùng `CustomStandaloneMinecraftScreen`/`CustomSharedMinecraftScreen`;
  overlay dùng `CustomOverlay` (HUD, inventory...).

### 3.6 Theme: đóng gói và mở rộng

- `src-theme` build bằng Vite; `processResources` phụ thuộc `buildTheme`, copy
  `src-theme/dist` vào `resources/liquidbounce/themes/liquidbounce`.
- Theme có `metadata.json` khai báo `screens`, `overlays`, `components`,
  `fonts`, `backgrounds`, `colors`.
- Client cũng load theme từ thư mục local `themes/` và marketplace; theme
  remote được phép dùng khi `ThemeManager.isThemeExternal` (bỏ qua auth).
- Màu accent/tint đẩy từ client xuống frontend qua REST + WS
  (`themeColorChange`), frontend set CSS variables.

## 4. Đối chiếu với Opus 1.8.9 / Forge

### 4.1 Kiến trúc kế thừa được gần như nguyên vẹn

- `BrowserBackend` interface + `External` backend để phát triển ngoài game.
- `BrowserRenderer` + texture upload theo GUI scale (1.8.9 dùng LWJGL2/GL11
  nhưng logic tương đương).
- `InputListener` forward mouse/keyboard/char.
- Ktor interop server hoặc tương đương (port random + auth cookie + WS).
- Virtual screen + ack chống desync.
- Svelte frontend: Opus UI đã có sẵn `ui/` (tokens, primitives, routes) —
  cần thêm `integration/rest.ts`, `ws.ts`, router hash `#/route`.

### 4.2 Điểm khác biệt lớn và rủi ro

| Vấn đề | LiquidBounce | Opus 1.8.9 | Ảnh hưởng |
| --- | --- | --- | --- |
| Nền tảng mod | Fabric, MC mới (1.21.x), Kotlin | Forge 1.8.9, Java 8, LWJGL2 | Phải port backend sang Forge coremod/mod, dùng Java 8 API |
| JCEF hiện tại | MCEF `3.3.x-1.21.x` (Chromium 122) | Chưa có | MCEF mới nhắm Java 21+/Fabric; cần JCEF tương thích Java 8 (dòng montoyo/CinemaMod MCEF vốn hỗ trợ Forge 1.8.x) hoặc build riêng |
| Download binaries | Tự download từ api.liquidbounce.net + Cloudflare, có hash | Opus cần tự bundle hoặc host riêng | Không được phụ thuộc hạ tầng LiquidBounce |
| GPU acceleration | JCEF accelerated paint có beta flag | macOS + LWJGL2 + Java 8 | Cần PoC; fallback CPU + `--disable-gpu` phải luôn có |
| Mac OS | macOS 11+, x86_64/arm64 (Chromium 122) | Máy anh đang chạy JRE 8 x64 | Phải test JCEF cũ trên macOS mới; khả năng cao cần JCEF bản cũ hơn |
| Render thread | RenderSystem.assertOnRenderThread() | Render thread 1.8.9 | Chuẩn hoá tương tự |
| Licensing | LiquidBounce GPL-3.0 | Opus license riêng | Chỉ học kiến trúc; không copy code (GPL sẽ ép toàn bộ Opus mở GPL) |

### 4.3 Phát hiện quan trọng từ tiền lệ cũ

MCEF gốc (`montoyo/mcef`) chính là JCEF cho **Forge 1.8.x / Java 8**, từng
được dùng cho WebDisplays — nghĩa là tiền lệ "Chromium trong 1.8.9" đã tồn
tại. Hướng khả thi nhất cho Opus:

1. Dùng dòng MCEF/JCEF tương thích Java 8 (montoyo/CinemaMod cũ) làm backend
   CEF, hoặc
2. Port interface `BrowserBackend` của LiquidBounce sang coremod Opus, và
   trước mắt chạy backend `external` để hoàn thiện frontend + bridge trước.

## 5. Đề xuất lộ trình áp dụng cho Opus

### Phase A — Bridge & Virtual Screen (không cần JCEF)

- Thêm Ktor (hoặc NanoHTTPD/Jetty nhẹ hơn cho Java 8) vào runtime:
  bind 127.0.0.1, port random, auth code, REST `/api/v1/client` + WS.
- `VirtualScreenManager`: map screen 1.8.9 -> route + ack 1 giây + reload.
- Frontend `ui/`: thêm `host.ts`, `rest.ts`, `ws.ts`, router hash, confirm
  screen; dev chạy `external` backend mở Chrome.

### Phase B — Texture renderer (PoC CEF)

- Thử dòng MCEF Java 8/Forge cũ hoặc JCEF build tương thích; đưa texture
  BGRA/RGBA vào GL11, blend premultiplied, scale theo `guiScale`.
- Kiểm tra: macOS hiện tại, Retina, GUI scale 1/1.5/2, GPU vs CPU.
- Nếu JCEF cũ không ổn -> giữ `external` làm bản chính, CEF là optional.

### Phase C — Screen replace/overlay

- Replace title/multiplayer/singleplayer/options/pause; overlay cho HUD.
- Cân nhắc tương tác với `OpusVanillaTerminalOverlay` hiện tại (giữ làm
  fallback khi browser crash/không khởi động được).

## 6. Kết luận

LiquidBounce đã chứng minh kiến trúc mà tài liệu OPUS_UI_ARCHITECTURE đề xuất
là hoàn toàn có thật và chạy production: Svelte SPA + Chromium texture + REST/
WS bridge + virtual screen. Với Opus 1.8.9, phần lớn thiết kế kế thừa được,
nhưng **backend Chromium là rủi ro duy nhất cần PoC sớm** vì khác Java/Fabric
thế hệ. Lộ trình an toàn: hoàn thiện frontend + bridge + virtual screen trước
(dùng external browser), sau đó mới ghép JCEF/MCEF tương thích Java 8.

## 7. Tham chiếu source đã đọc

- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/BrowserBackend.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/backends/cef/CefBrowserBackend.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/backends/cef/CefBrowser.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/browser/BrowserRenderer.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/browser/BrowserViewport.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/backend/input/InputListener.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/interop/ClientInteropServer.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/interop/middleware/AuthPlugin.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/screen/ScreenManager.kt`
- `src/main/kotlin/net/ccbluex/liquidbounce/integration/theme/Theme.kt` / `ThemeManager.kt`
- `src-theme/src/App.svelte`, `src-theme/src/integration/{host,rest,ws,events}.ts`
- `src-theme/src/colors.scss`, `src-theme/public/metadata.json`
- `build.gradle.kts` (phần `buildTheme`, `processResources`)

## 8. Deep-dive MCEF/JCEF (clone thêm 2 repo)

Để trả lời câu hỏi "JCEF chạy được trên Opus 1.8.9/Java 8 không?", em clone thêm:

- `/Users/zvwgvx/Project/opus-research/mcef-montoyo` — MCEF gốc (Forge, Java 8)
- `/Users/zvwgvx/Project/opus-research/mcef-ccbluex` — MCEF hiện tại của CCBlueX

### 8.1 MCEF hiện tại (CCBlueX) — KHÔNG dùng trực tiếp được

`mcef-ccbluex/build.gradle`:

- `tasks.withType(JavaCompile) { options.release = 21 }`
- `sourceCompatibility = JavaVersion.VERSION_21`
- Là Fabric mod cho Minecraft 1.21.x; Chromium 122.
- Download JCEF/CEF binaries từ `https://api.liquidbounce.net/` + Cloudflare,
  có hash validation (`HashValidator`).

Kết luận: bản này không chạy trên JRE 8 của Opus; chỉ tham khảo kiến trúc.

### 8.2 MCEF gốc (montoyo) — tiền lệ Forge + Java 8 thật sự

`mcef-montoyo/build.gradle`:

- ForgeGradle 2.3, Minecraft 1.12.2, `sourceCompatibility = targetCompatibility = '1.8'`.
- Là coremod: manifest `FMLCorePlugin: net.montoyo.mcef.coremod.ShutdownPatcher`
  (patch `Minecraft.run()` để shutdown JCEF đúng cách, tránh treo JVM).

Cách khởi tạo CEF (`ClientProxy.onInit`):

- CEF args mặc định có `--disable-gpu` (render CPU, an toàn trên Java 8).
- `CefSettings`: `windowless_rendering_enabled = true`, `locales_dir_path`,
  `cache_path`, `browser_subprocess_path = jcef_helper`.
- Load native libs trực tiếp bằng `System.load` (libcef.so/libjcef.so hoặc
  dll), thêm thư mục game vào `java.library.path` qua reflection.
- Download binaries từ mirror (`RemoteConfig` + `ResourceList`), nếu lỗi thì
  chuyển sang **virtual mode** (UI không hiện nhưng game không crash).

Cách render texture (`org/cef/browser/CefRenderer.java`):

- JCEF paint callback trả `ByteBuffer` BGRA + `dirtyRects`.
- `glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, EXTBgra.GL_BGRA_EXT, ...)`
  khi resize/complete render; `glTexSubImage2D` cho từng dirty rect
  (`GL_UNPACK_ROW_LENGTH/SKIP_PIXELS/SKIP_ROWS`).
- Filter `GL_LINEAR`, env `GL_MODULATE`.
- Vẽ bằng `Tessellator` quad + flip Y (toạ độ webview khác toạ độ Minecraft).

Cách input (example `BrowserScreen`):

- `browser.injectMouseMove/Button/Wheel` với toạ độ framebuffer, flip Y;
- `injectKeyPressedByKeyCode/Released/Typed` từ LWJGL keyboard.

Lưu ý quan trọng: **bản montoyo README ghi chỉ hỗ trợ Windows/Linux, không
compile native cho Mac**. Nghĩa là với máy anh (macOS x86_64) cần tìm bản
JCEF có macOS natives tương thích Java 8 — đây là mục tiêu của PoC, chưa chắc
chắn 100%.

### 8.3 Cách áp dụng cho Opus

- Port mô hình montoyo sang Forge 1.8.9: coremod shutdown patcher, CefSettings,
  CefRenderer (Tessellator 1.8.9 API tương đương 1.12.2), input inject.
- Bundle/download JCEF bản Java 8 + macOS x64; không phụ thuộc hạ tầng CCBlueX.
- Giữ kiến trúc LiquidBounce ở tầng trên: `BrowserBackend` abstraction,
  external backend, interop server, virtual screen, Svelte theme.
- Giữ TUI hiện tại làm fallback khi JCEF không khởi động được.

### 8.4 CinemaMod/mcef old-1.12.2 — ứng viên JCEF cho PoC macOS

Đã clone thêm `/Users/zvwgvx/Project/opus-research/mcef-cinemamod-1.12`:

- **Fork của CinemaMod (ds58) từ montoyo/mcef**, nhánh `old-1.12.2`.
- Forge 1.12.2, Java 8 (`sourceCompatibility = '1.8'`).
- Chromium **100.0.4896** (cập nhật hơn bản gốc).
- **Hỗ trợ macOS Intel & Apple Silicon (Rosetta 2)** — platform ID `mac` trong
  `RemoteConfig.java`, macOS unzip handling trong `Util.java`.
- Mirror JCEF: `https://ds58-mcef-mirror.ewr1.vultrobjects.com/` — có thể
  dùng để test PoC, hoặc tự build từ JCEF source.

Kết luận: **đã có đủ cơ sở để PoC JCEF trên Java 8 + macOS + Forge 1.8.9**.
Beta test có thể dùng mirror của ds58; production thì tự build/host binaries.

### 8.5 Lưu ý về license

- `org.cef.*` (JCEF Java classes): **BSD** — dùng được.
- MCEF code (montoyo, CinemaMod): không có LICENSE file rõ ràng, mặc định
  "All rights reserved". **Không copy code**; chỉ tham khảo kiến trúc.
- LiquidBounce (GPL-3.0): chỉ học cách tổ chức, không copy.
- Opus code tự viết hoàn toàn mới, không sao chép từ các repo này.
