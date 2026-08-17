# Phase B Spike: JCEF trên macOS arm64 + Java 8/21

Ngày: 2026-08-17

## Mục tiêu

Chứng minh web UI Opus (SPA + interop server) render được bằng JCEF offscreen
trước khi ghép GL texture vào Minecraft 1.8.9.

## Những gì đã thử

### 1. Tải JCEF binaries

- Lấy `jcef.jar` + natives từ API download của MCEF CCBlueX:
  `https://api.liquidbounce.net/api/v3/resource/mcef-cef/<commit>/<platform>`
- Commit java-cef: `9bd969a508d52a150f42ac1baebece2c7cdcf66d`
- Đã tải được **macos_amd64** (141MB) và **macos_arm64** (134MB), checksum
  SHA-256 khớp.
- `jcef.jar` class major = 52 → **Java 8 compatible** (API thuần).

### 2. Chạy thử trên Java 8 (JRE 8u74/8u502, x86_64 qua Rosetta)

- `CefApp.startup` load `libjcef.dylib` → **crash trong `libawt_lwawt.dylib
  JNI_OnLoad`** (SIGSEGV).
- Lý do: natives này được build cho Java 21; JNI/AWT không tương thích Java 8.
- Kiểm tra phụ: `java.awt.Toolkit` trên Java 8 chạy bình thường, nên lỗi do
  chính libjcef kéo AWT theo.

Kết luận: **không dùng JCEF hiện tại với JVM Java 8 của game**.

### 3. Chạy thử trên JDK 25 arm64 (native)

- CefApp khởi tạo OK (log `initialize ... library path .../Contents/Java`).
- Browser load OK (`isLoading=false`), resize 1440x900 OK.
- Nhưng **không nhận paint event nào**, screenshot không hoàn thành; helper
  process (renderer/GPU/network) chết sau 15s:
  `Terminating current process after 15 seconds with no connection`.
- Có crash lúc thoát: `libsystem_c: Must only be used from the main thread`
  (SIGTRAP) → vấn đề main-thread/AppKit khi dispose.

Kết luận: **CEF helper IPC không hoạt động trong môi trường này** (chạy từ
terminal / bundle qua JavaAppLauncher đều thử; cả data: URL lẫn HTTP đều không
vẽ được).

## Chẩn đoán

- JVM game là x86_64 (Rosetta); JDK 25 hệ thống là arm64 → phải chọn đúng
  bộ natives theo JVM.
- JCEF hiện tại (Chromium 122, build cho Java 21) không chạy trên Java 8.
- Bản JCEF Java 8 + macOS (Chromium 100, CinemaMod old-1.12.2) có binaries ở
  mirror ds58 **đã chết** (config2.json 404, không có archive).
- Helper IPC fail có thể do macOS 26 + Chromium 122 sandbox/Mach rendezvous
  hoặc do thiếu `NSApplication`/main-thread setup chuẩn của JCEF test app.

## Kết luận & hướng đi

1. **Phase A (external browser) là con đường chắc chắn nhất** cho UI web hiện
   tại: đã chạy thật trong game (bridge + SPA + virtual screen).
2. Muốn UI web **trong cửa sổ game** mà giữ JVM Java 8, hướng khả thi là
   **render helper process**: một process Java 21/25 (arm64) chạy JCEF
   offscreen, stream frame qua localhost vào game; game chỉ upload GL texture.
   - Helper phải chạy như app bundle đúng cách + init trên main thread +
     `NSApplication` (giống `jcef_app.app`/tests), và cần Chromium mới hơn nếu
     macOS 26 không tương thích Chromium 122.
3. Hoặc nâng JVM game lên Java 21+ (rủi ro Forge 1.8.9 reflection) rồi dùng
   JCEF trực tiếp như LiquidBounce.

Không có hướng nào hoàn thành ngay trong một phiên; Phase A vẫn là bản chính
để anh dùng được ngay.
