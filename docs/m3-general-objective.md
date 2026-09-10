# M3-GENERAL-001 — Mục tiêu Injector tổng quát cho Minecraft JVM

Trạng thái: **MỤC TIÊU ĐÃ CHỐT — implementation M3 General đang tiếp tục;
M3 General chưa hoàn tất**

Nguồn quyết định: [OPUS Injector — Kế hoạch & Đặc tả Kỹ thuật](../../../Desktop/OPUS_INJECTOR_TECHNICAL_SPEC.md),
đặc biệt là M3, M4–M6, M11 và M12.

## Mục tiêu đã chốt

**M3 General** phải đưa `libopus-runtime.dylib` vào một **Minecraft Java 1.8.9
JVM do người dùng chọn rõ ràng**, rồi hoàn tất lifecycle chung:

```text
verify target
    -> native runtime entry
    -> versioned handshake
    -> running
    -> clean unload
    -> clean reinjection
```

Target được nhận diện bằng bằng chứng Java/Minecraft, PID được chọn, ownership
và architecture — **không** bằng tên Lunar, Badlion, Forge, Vanilla, TLauncher
hay Legacy. M3 là lớp transport/lifecycle; nó không chứa Minecraft feature,
mapping, classloader logic hay adapter của client.

Nói ngắn gọn:

```text
M3 General trả lời:
“Có thể chọn đúng JVM Minecraft này, nạp Opus Runtime tương thích,
 nhận handshake, dừng sạch và nạp lại không?”

Adapter trả lời:
“Sau khi runtime đã vào JVM, đây là client/build nào và Opus có thể
 dùng Minecraft API, mappings, classloader, OneConfig và feature ở đó không?”
```

Lunar Client 1.8.9 trên macOS Apple Silicon vẫn là **target kiểm chứng đầu
tiên** theo đặc tả team. Điều đó không biến Lunar thành điều kiện hard-code để
một Minecraft JVM được M3 xem là candidate.

## Diễn giải các cụm từ đã gây nhầm lẫn

| Cụm từ | Nghĩa được chốt |
| --- | --- |
| “Inject tổng quát mọi process Minecraft 1.8.9” | Injector đánh giá và xử lý một **JVM Minecraft được chọn rõ ràng**, dù launcher/client tạo ra nó là gì, nếu target, architecture và runtime contract hợp lệ. Đây là mục tiêu transport; không phải lời hứa mọi feature hoạt động trên mọi client. |
| “Force inject” | Transport trực tiếp đến PID game đã chọn, thay vì cần Forge discovery, launcher plugin hoặc Lunar-specific debug API. Nó không có nghĩa quét rồi tác động hàng loạt vào process, vượt quyền sở hữu, hay bypass bảo vệ của client/OS. |
| “Opt-in” / “vendor interface” | Không phải yêu cầu kiến trúc để một JVM game do người dùng đang quản lý trở thành M3 target. Một đường vendor-approved có thể là **lựa chọn kiểm chứng bổ sung**, nhưng không định nghĩa target model và không biến M3 thành Lunar-only. |
| “Lunar là target đầu tiên” | Lunar 1.8.9 là nơi chứng minh live lifecycle đầu tiên. Nó là baseline kiểm chứng, không phải process-name filter và không tự chứng minh Badlion/Forge/Vanilla compatibility. |
| “Hỗ trợ client” | Chỉ có sau classloader, mappings và adapter certification của M4–M6/M12. Runtime entry/handshake thành công chỉ chứng minh transport lifecycle. |

Vì vậy, một Lunar bản chạy bình thường trong phiên người dùng hiện tại nằm
trong **mục tiêu kiểm chứng M3** nếu JVM đó được chọn rõ ràng và thỏa các gate
kỹ thuật. M3 không chờ một “debug mode” hay API test riêng của Lunar để được
định nghĩa; đồng thời M3 cũng không được dùng kỹ thuật stealth, bypass hay
điều khiển process ngoài target đã chọn.

## “General” nghĩa là gì — và không nghĩa là gì

| Khái niệm | Nghĩa chính xác trong M3 |
| --- | --- |
| Client-independent target selection | Chọn Java game JVM theo bằng chứng JVM/Minecraft, PID người dùng chọn, ownership của phiên người dùng hiện tại hoặc ủy quyền kiểm thử, và architecture; không theo brand client. |
| Client hint | Nhãn suy đoán để hiển thị chẩn đoán, ví dụ Lunar/Badlion/Forge/Vanilla/Unknown. Nó không mở mappings, không chọn adapter và không phải bằng chứng tương thích. |
| General transport | Cùng một contract load → handshake → unload → reload cho target hợp lệ, không chứa logic game của Lunar hoặc client khác. |
| Adapter certification | Chứng minh riêng cho từng client family, build, classloader, mappings và payload. Đây là M4–M6 và M12, không phải kết quả tự động của M3. |

Vì vậy, câu “inject được mọi Minecraft process 1.8.9” chỉ có thể mang nghĩa
kỹ thuật có giới hạn sau:

> Trên platform được hỗ trợ, OPUS có thể đánh giá một JVM Minecraft 1.8.9 do
> người dùng đang quản lý hoặc được ủy quyền kiểm thử, rồi chạy contract
> transport chung nếu architecture và artifact/handshake tương thích.

Nó **không** có nghĩa rằng mọi client hoặc mọi build sẽ lập tức chạy được Opus
features. Một JVM có thể đi qua M3 nhưng vẫn nhận trạng thái
`adapter-not-certified` sau khi M4–M6 kiểm tra classloader và mappings.

`TLauncher` là ví dụ quan trọng: launcher không phải injection target. Target
luôn là Java process đang chạy Minecraft; tên launcher chỉ là metadata, không
quyết định compatibility.

## M3 General phải chứng minh bốn năng lực

### 1. Chọn target Minecraft JVM tổng quát

Injector phải:

- hiển thị candidate Java game JVM mà không yêu cầu nhãn Lunar/Badlion/Forge;
- yêu cầu PID được chọn rõ ràng, thay vì tự động tác động hàng loạt lên process;
- phân biệt launcher/desktop shell với Java game JVM thật;
- kiểm tra target thuộc phiên người dùng hiện tại hoặc có ủy quyền kiểm thử;
- kiểm tra Minecraft 1.8.9/runtime evidence đủ để gọi nó là candidate; và
- kiểm tra architecture của **JVM đang chạy**, không suy ra từ architecture của
  máy Mac hoặc tên client.

Kết quả của bước này chỉ là `eligible transport candidate`; nó không phải
`supported client`.

### 2. Nạp Opus Runtime vào target đã chọn

Với candidate hợp lệ, M3 phải dùng production transport family đã chốt trong
đặc tả:

```text
Opus Injector
    ->
libopus-runtime.dylib
    ->
native runtime entry
    ->
JVM/JNI/JVMTI handshake
```

M3 không được chứa Minecraft features, mappings, module logic, UI hoặc
client-specific hook. Cơ chế transport cụ thể phải được review riêng trước
khi code; tài liệu mục tiêu này không chọn hay mô tả một kỹ thuật bypass.
Java-to-native lifecycle calls phải đi qua một bridge dùng chung, không qua
JNI entry point mang tên Lunar, Badlion, Forge, launcher hoặc adapter cụ thể.

Điều M3 phải chứng minh là **runtime entry thật trong target đã chọn**, không
phải chỉ là một harness OPUS-owned hoặc một handshake giả lập. Harness và
cooperative fixture vẫn có giá trị foundation, nhưng không thay thế proof trên
JVM Minecraft live.

### 3. Reverse unload và reinjection

`unload` không chỉ là báo “đã tắt”. Runtime phải hoàn thành reverse lifecycle:

```text
stop new callbacks
    ->
stop runtime-owned work
    ->
remove runtime-owned hooks/callbacks
    ->
release JNI references and caches
    ->
detach OPUS-owned JVM threads
    ->
report stopped
```

Sau `stopped`, target game phải còn sống, không còn callback của Opus, và một
lệnh load mới phải bắt đầu từ state sạch. M3 cần chứng minh các cycle cơ bản
load → ready → unload → stopped được lặp lại có ghi nhận; M11 mới là mốc stress
20+ cycle có UI/modules/game-session đầy đủ.

### 4. Tương thích injector ↔ runtime ↔ payload

Trước khi runtime được coi là `ready`, các thành phần phải fail-fast nếu
handshake không khớp:

```text
protocol_version
injector_version
native_runtime_version
java_runtime_version
target_architecture
mapping_schema_version
oneconfig_adapter_version
artifact_checksums
```

Trong M3, payload/mapping/OneConfig có thể mới ở trạng thái foundation được
ghi rõ trong handshake. Điều đó không cho phép báo rằng Java payload đã chạy
hoặc OneConfig đã tương thích; các bằng chứng đó thuộc M7 và M9.

## Luồng trạng thái cần có

```text
explicit PID
    ->
Minecraft-JVM candidate validation
    ->
target architecture + artifact compatibility validation
    ->
runtime load request
    ->
native entry
    ->
versioned ready handshake
    ->
running
    ->
unload request
    ->
stopped / clean for reinjection
```

Nhãn client, nếu có, đi song song với luồng trên:

```text
process-side client hint (diagnostic only)
    ->
post-entry runtime classification (M4–M6)
    ->
named adapter certification (M6/M12)
```

`Unknown` là kết quả hợp lệ ở cả hint và classification. Nó phải tạo typed
diagnostic, không được bị đổi thành tuyên bố “works on any client”.

## Ranh giới milestone

| Milestone | Điều phải hoàn thành | Không được tuyên bố |
| --- | --- | --- |
| M3 General | Client-neutral JVM selection, architecture/artifact gate, native entry, handshake, stop/reload lifecycle. | Minecraft object access, mappings, OneConfig, module hay hỗ trợ client cụ thể. |
| M4–M5 | JVM bootstrap và classloader/Minecraft singleton proof trên Lunar đầu tiên. | Rằng cùng logic đã đúng trên Badlion/Forge/Vanilla. |
| M6 | `Lunar189Adapter` và mapping proof. | Rằng target khác dùng chung mapping. |
| M7–M10 | Java payload, game-thread bridge, OneConfig và SDK vertical slice. | Rằng native entry một mình đã làm Opus Client usable. |
| M11 | Full cleanup và 20+ lifecycle stress cycles trong game session. | Rằng một test cycle M3 đủ cho release. |
| M12 | Badlion/Forge và các adapter được chứng nhận riêng. | Rằng tên launcher/client tự tạo compatibility. |

## Phạm vi target theo client/launcher

| Process/JVM được thấy | Vai trò trong M3 General | Điều không được suy diễn |
| --- | --- | --- |
| Lunar 1.8.9 JVM do người dùng quản lý | Live validation target đầu tiên cho lifecycle M3. | Lunar adapter, mappings hoặc feature support. |
| Badlion/Forge/Vanilla JVM 1.8.9 có bằng chứng hợp lệ | Có thể là client-neutral transport candidate; `client_hint` không phải gate. | Rằng chúng đã được adapter certification. |
| Minecraft mở qua TLauncher/Legacy/launcher khác | Chỉ **Java game JVM** là target; launcher là metadata/readiness hint. | Rằng launcher là process injection target hoặc đảm bảo compatibility. |
| `Unknown` Java Minecraft JVM | Vẫn là candidate nếu target/architecture/contract hợp lệ. | Rằng Opus Java payload hay feature đã chạy được. |

## Phạm vi ban đầu và các điều cấm

Phạm vi M3 General ban đầu là **macOS**. Lunar 1.8.9 trên Apple Silicon/arm64 là
baseline live validation; x86_64 chỉ được coi là hỗ trợ khi target JVM và
native slice tương ứng đã được build, kiểm tra và có direct transport proof.
Trên host Apple Silicon hiện tại, fixture Java 8 `x86_64` chạy dưới Rosetta
nhận `RosettaRemoteThreadUnavailable` trước native entry; vì vậy x86_64
Rosetta chưa phải direct-transport support. Cross-platform không được gộp vào
M3 này.

M3 General không bao gồm:

- stealth, anti-detection, header wiping, manual mapping hoặc screenshare
  evasion;
- tự động tìm rồi tác động hàng loạt vào process nền;
- bypass bảo vệ của client, launcher hay OS;
- hard-code Lunar internals vào injector;
- feature/module/UI/OneConfig implementation; hoặc
- tuyên bố support cho một client chỉ vì runtime entry/handshake thành công.

Mọi live target phải là process trong phiên người dùng hiện tại do người dùng
quản lý, hoặc có đường kiểm thử được ủy quyền rõ ràng, đúng với
`INJECTOR-MAC-001` trong đặc tả team. Điều này là ownership boundary, không
phải yêu cầu Lunar/Badlion phải cung cấp debug API hoặc plugin interface.

## Definition of Done cho M3 General

M3 General chỉ có thể được đánh dấu hoàn thành khi, trên một JVM Lunar 1.8.9
đang chạy bình thường trong phiên người dùng hiện tại và được chọn rõ ràng,
reviewer có thể kiểm tra được:

1. candidate được chọn bằng JVM/Minecraft evidence, không phải Lunar label;
2. architecture của target JVM khớp native runtime artifact;
3. runtime entry thực sự xảy ra trong target;
4. injector và runtime trao đổi đủ versioned handshake;
5. trạng thái load/unload lỗi và thành công đều typed, có thể chẩn đoán;
6. target vẫn sống sau unload và hoàn thành ít nhất ba cycle load → ready →
   unload → stopped từ state sạch; và
7. client hint `Unknown` không chặn transport contract, đồng thời không tạo
   false claim về adapter/feature compatibility.

Sau mốc đó, Lunar adapter vẫn phải đi qua M4–M6. Badlion, Forge, Vanilla hoặc
Minecraft chạy từ TLauncher/launcher khác chỉ được quảng bá sau adapter
certification riêng.

## Trạng thái chứng cứ hiện tại

Foundation/preflight, controlled JVM, OPUS-owned harness và authorized fixture
chỉ chứng minh các phần con của contract. `request-load`/`request-unload` giờ
đã triển khai direct native transport theo PID được chọn, với session riêng,
architecture gate, handshake và logical cleanup; fixture arm64 không hợp tác
đã chứng minh 20 cycle lifecycle khi target còn sống. Trên cùng host đó,
x86_64 Java 8 dưới Rosetta trả `RosettaRemoteThreadUnavailable` và dọn session
sạch, nên không được tính là direct-transport support. Tuy vậy, arm64 proof
cũng **không** là native entry vào một Minecraft JVM live và không thể đóng M3
General. Transport hiện chỉ được coi là implementation evidence, chưa phải
production client-transport evidence, cho đến khi Definition of Done ở trên
có evidence trên Lunar bình thường.

## Cổng scope đã duyệt

Tài liệu này chốt **mục tiêu và ranh giới** cho implementation. Mọi source
change phải tiếp tục nằm trong contract client-neutral ở trên; không nhảy sang
M4–M12, không dùng client label làm điều kiện chọn target, và không thử nghiệm
trên process ngoài ownership boundary đã nêu.

Foundation/preflight trong workspace là evidence kỹ thuật riêng; M3 General
chỉ hoàn tất khi Definition of Done ở trên được chứng minh trên target Lunar
đầu tiên.
