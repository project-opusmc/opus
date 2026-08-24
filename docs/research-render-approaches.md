# Nghiên cứu: render UI Opus TRỰC TIẾP trong game (bỏ overlay)

> **Historical renderer comparison.** None of the CEF/JCEF/overlay approaches
> below is an active production path. The active path is
> [Forge + OptiFine + OPUS Core Mod + vanilla Minecraft UI]
> (coremod-first-goal-and-plan.md). This document is retained for failure and
> trade-off evidence only.

Ngày: 2026-08-18

## Câu hỏi

"Không có cách nào để Minecraft render trực tiếp được UI như bình thường hay
không?" — tức là vẽ web UI ngay trong khung hình game như một GUI bình thường,
KHÔNG dùng một cửa sổ native riêng bám theo màn hình (overlay).

## Trả lời ngắn

**CÓ. Và Opus đã có sẵn đường đó** — chế độ "stream" vẽ web UI thành một texture
OpenGL ngay trong khung hình của chính game (`OpusWebTextureSurface`). Overlay
(cửa sổ native riêng, `.floating`, bám vị trí game, click-through) là một nhánh
rẽ SAI: nó sinh ra hàng loạt vấn đề cửa sổ trên macOS (đè lên app khác, tranh
focus, phải kill game). **Bỏ overlay.**

Vấn đề thật không phải "render Ở ĐÂU" mà là "lấy PIXEL của web UI từ đâu cho ổn
định". Mô hình đúng (LiquidBounce/MCEF cũng vậy):

```
web UI  ->  pixel (BGRA)  ->  upload GL texture  ->  Minecraft tự vẽ trong khung của nó
```

Không cửa sổ riêng, không bám màn hình, không tranh focus — vì pixel do chính
Minecraft vẽ ra, y như mọi GUI vanilla.

## Vì sao trước đây kẹt (và hiểu nhầm ở đâu)

- JCEF (Chromium nhúng THẲNG trong JVM) crash trên Java 8 / macOS arm64 — đã
  chứng minh ở `research-jcef-spike.md`.
- Nên dự án chuyển sang helper WKWebView: render offscreen rồi `takeSnapshot`
  ~20fps stream BGRA về game. Đây chính là nguồn bất ổn — `WKSnapshot` không
  thiết kế cho realtime (nặng, hay khựng, frame trắng, helper chết).
- **Điểm mấu chốt bị bỏ qua:** rào cản Java 8 CHỈ đúng khi trình duyệt chạy
  TRONG tiến trình game. Nếu trình duyệt chạy ở một tiến trình HELPER riêng thì
  phiên bản Java của game hoàn toàn không liên quan. Helper đã tồn tại rồi — chỉ
  là nó đang dùng nhầm bộ máy render (WKWebView) và nhầm cách truyền (snapshot).

## Ba hướng

### Hướng 1 (khuyến nghị) — CEF OSR trong helper + texture in-game, GIỮ Java 8

Helper native nhúng **CEF thật** (Chromium Embedded Framework, không phải
JCEF-Java), bật **Offscreen Rendering (OSR)**. CEF gọi `OnPaint` mỗi khung kèm
buffer BGRA — API sinh ra đúng cho việc này, khác hẳn `WKSnapshot`. Truyền frame
về game:

- **1a (đơn giản, làm trước):** OSR "software" → ghi buffer BGRA vào **shared
  memory (mmap)** → game `glTexSubImage2D` lên texture. Tái dùng gần như nguyên
  `OpusWebTextureSurface`, chỉ đổi transport từ socket sang shared memory. Bỏ
  luôn cổ chai socket + snapshot.
- **1b (tối ưu zero-copy, làm sau):** OSR "accelerated" (`OnAcceleratedPaint`) →
  CEF trả một **IOSurface** (Metal) → game bind thẳng vào GL texture qua
  `CGLTexImageIOSurface2D` (một shim JNI nhỏ). GPU→GPU, không copy. Đã có dự án
  thật trên macOS (CefSwift chế độ OSR/Metal IOSurface; encse/cef-test).

Input: game gửi chuột/phím cho CEF qua `SendMouseClickEvent`/`SendKeyEvent` —
sạch, đồng bộ, bỏ hack `window.__opusDispatch`.

- Ưu: giữ Java 8; render THẬT trong game (không cửa sổ/overlay/focus); ổn định;
  đúng chuẩn ngành; tái dùng lớp vẽ texture sẵn có.
- Nhược: phải build/bundle CEF (~200MB framework, cần ký + notarize); viết helper
  C++/Obj-C dùng CEF OSR — nhiều việc hơn WKWebView.
- Rủi ro: chủ yếu ở đóng gói/ký CEF; **KHÔNG đụng vào JVM game.**

### Hướng 2 — Nâng JVM game lên 17/21 + MCEF in-process

Đúng như LiquidBounce: MCEF nhúng CEF, render OSR thẳng vào GL texture trong MỘT
tiến trình. Kiến trúc gọn nhất nếu chạy được.

- Nhưng MCEF cần Java 17+. Chạy Forge 1.8.9 trên Java 17+ RẤT rủi ro:
  LaunchWrapper, ASM cũ, reflection vào nội bộ JDK bị hệ module chặn (phải
  `--add-opens`), thư viện đời cũ. Có người vá được nhưng mong manh.
- Ưu: sạch nhất. Nhược/Rủi ro: **CAO NHẤT** — yak-shave lớn, dễ phá vỡ toàn bộ
  runtime 1.8.9 vốn đang chạy ổn.

### Hướng 3 — Vá lại stream WKWebView hiện có

Bỏ overlay, quay về texture in-game, tối ưu snapshot (đã có skip-frame-tĩnh; thêm
hạ fps khi idle; thử API snapshot mới).

- Ưu: ít việc nhất, rủi ro thấp.
- Nhược: **trần hiệu năng thấp** — `WKSnapshot` không dành cho realtime; UI động
  vẫn giật; vẫn còn nguy cơ frame trắng/helper chết. Chỉ tạm ổn với menu tĩnh.

## So sánh nhanh

| Hướng | Giữ Java 8 | Render thật in-game | Ổn định | Công sức | Rủi ro |
|---|---|---|---|---|---|
| 1a CEF + shared memory | ✅ | ✅ | Cao | Trung bình | Thấp (không đụng JVM) |
| 1b CEF + IOSurface | ✅ | ✅ | Rất cao | Trung bình–cao | Thấp–TB |
| 2 MCEF + nâng JVM17 | ❌ (phải nâng) | ✅ | Cao | Cao | **Rất cao** |
| 3 vá WKWebView | ✅ | ✅ | Thấp–TB | Thấp | Thấp (trần thấp) |

## Khuyến nghị

Bắt đầu **Hướng 1a**: CEF OSR (software) + shared memory + lớp vẽ texture sẵn có.
Nó cho "render trực tiếp trong game như bình thường" ngay, ổn định, giữ Java 8,
tái dùng `OpusWebTextureSurface`. Khi chạy tốt thì nâng lên **1b** (IOSurface
zero-copy) nếu cần mượt hơn cho UI động. **Bỏ hẳn overlay.**

## Việc cần làm cho Hướng 1a (phác thảo)

1. Helper: nhúng CEF, OSR software, load SPA từ interop server, `OnPaint` → ghi
   BGRA vào shared memory (tên theo token phiên).
2. Bỏ đường `WKSnapshot` + `FRAME`-over-socket; giữ kênh điều khiển
   (URL/INPUT/SIZE) qua loopback như cũ.
3. Game: `OpusWebTextureSurface` đọc từ shared memory thay vì socket; phần vẽ
   texture giữ nguyên.
4. **Xoá toàn bộ code overlay** (`setMode`/`SHOW`/`HIDE`/`TRACK`/`CLICKTHROUGH` +
   observer focus) — không cần nữa.
5. Input: chuyển sang CEF `SendMouse/KeyEvent`, bỏ `__opusDispatch`.

## Nguồn

- CEF OSR + Metal/IOSurface trên macOS: [CefSwift](https://github.com/Rajaniraiyn/CefSwift), [encse/cef-test](https://github.com/encse/cef-test)
- Hành vi `OnAcceleratedPaint` (đổi từ CEF 124, trả texture chromium sở hữu): [cef#3755](https://github.com/chromiumembedded/cef/issues/3755), [cef#3730](https://github.com/chromiumembedded/cef/issues/3730)
- Chia sẻ texture OSR ra tiến trình khác (tham khảo mô hình): [cef-spout](https://github.com/fg-uulm/cef-spout)
