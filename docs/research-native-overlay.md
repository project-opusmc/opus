# Nghiên cứu: Native Overlay Compositing (bỏ pipeline stream BGRA)

> **Rejected/historical (2026-08-19).** The native overlay/WKWebView proposal
> below is not an approved Opus architecture. Production uses one in-game CEF
> OSR compositor rendered as a Minecraft texture. Do not implement the overlay,
> keep it in parallel, or reuse its fallback language. See
> [`ui-game-goal-and-plan.md`](ui-game-goal-and-plan.md).

Ngày: 2026-08-18
Trạng thái: đề xuất kiến trúc + kế hoạch prototype (chưa build/test trên máy thật)

## 1. Vấn đề

Kiến trúc hiện tại render web UI vào game theo đường:

```
Svelte SPA  →  WKWebView offscreen (helper Swift)  →  chụp snapshot 20fps
            →  BGRA qua loopback TCP  →  Java upload GL texture  →  vẽ full-screen
```

Ba điểm đau:

1. **Bất ổn.** Đường snapshot→stream→GL là nhiều mắt xích IPC dễ vỡ; chính
   `docs/research-jcef-spike.md` đã ghi nhận paint/IPC không đáng tin. Snapshot
   20fps + so sánh byte để bỏ frame trùng là workaround, không phải nền tảng.
2. **Chậm & mờ.** Chụp `takeSnapshot` tốn CPU/GPU, trễ theo tick; chữ qua
   texture không sắc bằng compositing native; Retina phải nhân đôi thủ công.
3. **Vòng lặp dev.** Mỗi lần đổi UI phải vào game mới thấy — nhưng đây là vấn đề
   riêng, giải bằng browser-first + screenshot harness (xem §9), không cần
   động tới game.

Mục tiêu: **Minecraft chỉ còn là engine 3D**; web layer chiếm 100% phần 2D,
render **native** trực tiếp lên trên cửa sổ game, không stream pixel.

## 2. Ràng buộc đã phát hiện (đọc kỹ trước khi code)

**2.1 — Cú treo WindowServer (nghiêm trọng nhất).**
Trong `tools/opus-webview-helper/Sources/OpusWebViewHelper/main.swift` (~dòng
73) đã có comment cảnh báo do lần thử trước để lại:

> *"never bring this window to the front. orderFront on macOS contends with the
> game's window for the WindowServer and freezes the whole desktop."*

Nghĩa là: đã từng thử cho cửa sổ WKWebView hiện lên trên game và **treo cả
desktop**. Nguyên nhân gần như chắc chắn là game chạy **fullscreen kiểu LWJGL2
chiếm display độc quyền** (capture display). Overlay tranh WindowServer với chế
độ đó → treo. Đây là rào cản số một của hướng này và toàn bộ thiết kế phải
xoay quanh việc **né** nó.

**2.2 — MC 1.8.9 = LWJGL 2, không có GLFW.**
Không có `glfwGetCocoaWindow`, và `org.lwjgl.opengl.Display` không expose
`NSWindow` handle công khai. Vì thế overlay **không thể** là child window
(`addChildWindow:`) lấy từ trong JVM. `addChildWindow` cũng chỉ hoạt động
trong-cùng-tiến-trình, nên kể cả tìm được CGWindowID của game cũng không ghép
child cross-process được.

**Hệ quả:** overlay phải sống trong **tiến trình helper Swift**, là một cửa sổ
độc lập luôn-trên-cùng **bám theo** khung cửa sổ game (independent tracked
window), chứ không phải child window.

**2.3 — Chế độ hoạt động của app helper.**
Hiện helper set `setActivationPolicy(.prohibited)` (không hiện UI). Overlay
on-screen cần đổi sang `.accessory` (hiện cửa sổ, không có Dock icon, không
cướp menu bar).

## 3. Kiến trúc mục tiêu

```
Svelte SPA  →  WKWebView on-screen (helper Swift)
            →  cửa sổ trong suốt, luôn-trên-cùng, BÁM khung game
            →  WebKit tự composite native lên trên game (không stream pixel)
```

- Game chạy **borderless-windowed** (không exclusive-fullscreen) để tránh cú
  treo §2.1. Có thể trông vẫn như fullscreen (viền ẩn, phủ kín màn) nhưng là
  windowed dưới mắt WindowServer.
- Helper mở một `NSWindow` trong suốt (`isOpaque=false`, `backgroundColor=.clear`,
  `styleMask=[.borderless]`), `level` cao hơn game một bậc, và
  `collectionBehavior=[.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]`.
- Java gửi vị trí/kích thước cửa sổ game mỗi khi đổi; helper set frame overlay
  khớp từng pixel.
- **Xoá hẳn** `OpusWebTextureSurface` và nhánh đọc `Frame`/upload GL khi hướng
  này ổn định. Trong prototype thì **giữ song song** làm fallback.

## 4. Protocol loopback mới (bổ sung, không phá cũ)

Hiện có: `HELLO/SIZE/URL/INPUT/PING/RELOAD/BYE` → `READY/FRAME/PONG`.
Thêm các verb điều khiển overlay (giữ nguyên phần cũ để fallback):

| Verb (Java → helper) | Ý nghĩa |
|---|---|
| `MODE overlay` / `MODE stream` | Chọn chế độ render: overlay on-screen hay stream cũ |
| `SHOW` / `HIDE` | Hiện/ẩn cửa sổ overlay (mở/đóng UI) |
| `TRACK x y w h scale` | Đặt frame overlay khớp khung game (điểm gốc màn hình + backing scale) |
| `CLICKTHROUGH 0\|1` | 1 = `ignoresMouseEvents=true` (chỉ HUD, click xuyên xuống game); 0 = overlay nhận input |

Ở `MODE overlay`, helper **không** chạy timer chụp/`FRAME`. Input đi thẳng vào
WKWebView native nên `INPUT` gần như không cần (xem §5).

## 5. Mô hình input & focus

<!-- PLACEHOLDER_INPUT -->

Đây là phần tinh tế nhất vì input phải chuyển qua lại giữa game (LWJGL) và
overlay (AppKit) một cách sạch sẽ.

- **Khi UI mở (`SHOW` + `CLICKTHROUGH 0`):** overlay là key window, WKWebView
  nhận chuột/bàn phím native — con trỏ thật, cuộn thật, IME thật, không còn
  synthesize `window.__opusDispatch`. Game nên **nhả** con trỏ (giống lúc mở
  GuiScreen: `Mouse.setGrabbed(false)`), nếu không LWJGL vẫn giữ chuột.
- **Khi chỉ có HUD (`CLICKTHROUGH 1`):** overlay `ignoresMouseEvents=true`, mọi
  click rơi xuống game; overlay chỉ hiển thị, không tương tác.
- **Đóng UI (`HIDE`):** overlay ẩn, game `setIngameFocus()` để bắt lại chuột.
- **Rủi ro focus:** ở borderless-windowed + auxiliary window, click overlay sẽ
  đổi key window khỏi game. Cần đảm bảo khi `HIDE`/clickthrough thì key window
  trả về game. Với native fullscreen space, `fullScreenAuxiliary` cho overlay
  nổi trên nhưng vẫn phải test kỹ việc nhận phím.

Giữ đường `INPUT` cũ trong code chỉ để dùng lại nếu buộc phải fallback stream.

## 6. Chế độ cửa sổ game

Cách chắc chắn nhất để né §2.1 là **ép game không exclusive-fullscreen**:

- Chạy windowed thường, hoặc borderless-windowed (một `NSWindow` phủ kín màn
  hình, không dùng cơ chế capture-display của LWJGL2).
- Trong Opus, `USE_FULLSCREEN` đã nằm trong `OPTION_KEYS`; cần đảm bảo khi bật
  overlay thì buộc tắt fullscreen LWJGL2 (hoặc thay bằng borderless của Opus).
- Kiểm tra: `Display.setFullscreen(false)` + `Display.setResizable(...)` và cách
  launcher tạo cửa sổ. Đây là điểm phải xác minh trên máy vì LWJGL2 trên macOS
  có thể vẫn capture display tuỳ cấu hình.

## 7. Fullscreen spaces & multi-monitor

- Native fullscreen (Space riêng): overlay đặt `canJoinAllSpaces` +
  `fullScreenAuxiliary` để nổi trên Space đó. Đây là kỹ thuật overlay chuẩn
  (Discord, app annotate màn hình).
- Đổi Space / minimize / di chuyển cửa sổ: helper phải theo dõi và cập nhật
  frame; Java gửi `TRACK` khi phát hiện đổi kích/vị trí, helper cũng nên nghe
  `NSWindow.didMoveNotification`/`didResize` của chính nó cho chắc.
- Nhiều màn hình / Retina hỗn hợp: `TRACK` phải kèm `scale` (backingScaleFactor)
  đúng của màn đang chứa game, và toạ độ theo hệ toạ độ màn hình global.

## 8. Kế hoạch prototype theo phase

<!-- PLACEHOLDER_PHASES -->

**Phase 0 — chứng minh KHÔNG treo (quan trọng nhất, làm trước mọi thứ khác).**
Chạy game **windowed**, cho helper mở một overlay trong suốt nhỏ (ví dụ ô màu
bán trong suốt) bám lên góc cửa sổ game, `orderFront`. Nếu desktop **không**
treo trong windowed → hướng này khả thi. Nếu vẫn treo → phải xử lý window mode
của LWJGL2 trước khi đi tiếp. Đây là go/no-go gate.

**Phase 1 — overlay tĩnh full-window (windowed).** WKWebView load SPA, phủ kín
khung game windowed, `CLICKTHROUGH 1`, chỉ để nhìn. Xác minh: sắc nét, Retina
đúng, không treo, không cướp focus.

**Phase 2 — input & SHOW/HIDE.** Mở UI (`SHOW`+`CLICKTHROUGH 0`, game nhả
chuột), tương tác native, đóng (`HIDE`, game bắt lại chuột). Xác minh không kẹt
focus/chuột.

**Phase 3 — tracking đầy đủ.** Bám di chuyển/resize/đổi Space; thử borderless
"giả fullscreen".

**Phase 4 — native fullscreen space** (nếu vẫn muốn): `fullScreenAuxiliary`.
Đây là phần rủi ro nhất; có thể quyết định chỉ hỗ trợ borderless-windowed.

**Phase 5 — dọn dẹp.** Khi ổn định: xoá `OpusWebTextureSurface`, nhánh `FRAME`
trong `OpusWebViewClient`, timer chụp trong helper. Kết thúc pipeline stream.

Ghi chú lịch sử (không còn áp dụng): prototype từng đề xuất
`-Dopus.overlay=native`; production không có runtime switch này và không được
chạy lại pipeline native overlay song song với CEF.

## 9. Phần B — mổ bỏ GUI vanilla (đã thay thế, phần dưới chỉ còn lịch sử)

Phần này là ghi chú lịch sử của prototype và **không còn là hướng triển khai**.
Production hiện không có cờ `-Dopus.gui.strict=true`: `ClientOverlayController`
luôn thay mọi `GuiScreen` không phải màn hình hệ thống tối thiểu hoặc
`OpusClientScreen` bằng route CEF chính thống. Không được bật lại cờ cũ, thêm
whitelist sản phẩm thứ hai, hoặc dùng nó như fallback.

Whitelist và tùy chọn ẩn HUD ở bản prototype dưới đây chỉ được giữ để giải
thích quyết định cũ; contract hiện tại nằm trong
`docs/ui-game-goal-and-plan.md` và artifact gates phải bác bỏ mọi đường T-UI.

## 10. Rủi ro & cách kiểm chứng

<!-- PLACEHOLDER_RISKS -->

| Rủi ro | Mức | Cách kiểm chứng / giảm thiểu |
|---|---|---|
| Treo desktop (WindowServer) | Cao | Phase 0 go/no-go ở windowed trước; không bao giờ exclusive-fullscreen |
| Kẹt chuột/focus giữa game↔overlay | Cao | Phase 2; quy tắc nhả/bắt chuột rõ ràng theo SHOW/HIDE/CLICKTHROUGH |
| Native fullscreen space | TB-Cao | Có thể bỏ, chỉ hỗ trợ borderless-windowed |
| Retina/multi-monitor lệch | TB | `TRACK` kèm scale + toạ độ global; test 2 màn khác DPI |
| Blanket-cancel GuiScreen làm hỏng game | TB | Rủi ro prototype đã được thay bằng canonical CEF ownership; không có runtime switch |
| Không build/test được ở CI hiện tại | TB | Cần máy macOS thật; ghi rõ lệnh build ở §11 |

## 11. So sánh & lệnh build

**Đổi lại điều gì:** ta bỏ một lớp bất ổn (IPC stream + GL upload + snapshot
20fps) và nhận về một lớp khó khác (quản lý cửa sổ macOS: treo, focus,
fullscreen space). Khác biệt cốt lõi: quản lý cửa sổ là bài toán **tất định,
gỡ được**, còn IPC stream là bất ổn **theo thời gian chạy**. Bù lại: chữ nét,
GPU thật, input native, hết trễ snapshot.

Build/chạy thử (trên máy macOS thật):

```
# Helper Swift
cd tools/opus-webview-helper && swift build -c release

# Client + runtime
./scripts/build.sh          # xem scripts/ để biết target cụ thể

# Lệnh prototype lịch sử; không dùng cho production.
-Dopus.overlay=native -Dopus.embeddedUi=true
# `opus.gui.strict` is retired; do not pass it to production.
```

## 12. Kết luận

Hướng A+B khớp đúng mục tiêu "Minecraft = engine". Chìa khoá sống-còn là
**Phase 0**: chứng minh overlay không treo ở windowed mode. Nếu qua được, phần
còn lại là kỹ thuật cửa sổ thuần tuý và ta gỡ dần được. Phần B triển khai song
song, không rủi ro treo, và kiểm chứng ngay trong game hôm nay.
