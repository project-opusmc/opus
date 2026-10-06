# M3-GENERAL-001 — Mục tiêu Injector tổng quát cho Minecraft JVM

Trạng thái: **FROZEN / EVIDENCE-PRESERVED — historical M3 R&D objective;
không phải active product-mainline work**

> **Trạng thái hiện tại — September 15, 2026:** M3/injector được đóng băng như
> experimental R&D để ưu tiên Opus Client + Opus Launcher, UI first. Đọc
> [Decision 0008](decisions/0008-opus-client-launcher-ui-first-mainline.md) và
> [General Gate 6 policy hiện hành](protocol/m3-general-gate-6-current-policy-status-2026-09-15.md)
> trước mọi quyết định project-state hoặc execution. Nội dung bên dưới được
> giữ nguyên như contract/evidence lịch sử; nó không cho phép một live target
> run, Gate promotion, hay vendor claim mới.

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

## Quyền host do chủ dự án xác nhận

Chủ dự án xác nhận quyền kiểm soát và trách nhiệm đối với Mac dùng để phát
triển, bao gồm quyết định về cấu hình bảo mật, signing và service/daemon cục
bộ. M3 vì thế có thêm lane **owner-authorized host experiment** để đánh giá một
cơ chế transport ở cấp host khi chủ dự án chọn rõ ràng.

Lane này không biến Lunar, Badlion, launcher, service hay binary của vendor
thành OPUS-owned. Nó cũng không thay thế mục tiêu M3: phải xác định đúng game
JVM, chứng minh runtime entry, handshake, logical unload, reinjection và game
còn sống. Quy tắc authority, containment, rollback và evidence cho lane này
nằm tại [Decision 0007](decisions/0007-owner-authorized-host-experiment-boundary.md).

Nói ngắn gọn:

```text
M3 General trả lời:
“Có thể chọn đúng JVM Minecraft này, nạp Opus Runtime tương thích,
 nhận handshake, dừng sạch và nạp lại không?”

Adapter trả lời:
“Sau khi runtime đã vào JVM, đây là client/build nào và Opus có thể
 dùng Minecraft API, mappings, classloader, OneConfig và feature ở đó không?”
```

Lunar Client 1.8.9 và Badlion Client 1.8.9 trên macOS Apple Silicon là **cặp
target kiểm chứng transport ưu tiên**. Thứ tự thực thi là Lunar trước, rồi
Badlion ngay sau khi cùng capability/lifecycle gate đã sẵn sàng. Opus-owned
client/harness chỉ là baseline regression; nó không thay thế bằng chứng live
trên hai client ưu tiên này.

Điều đó không biến Lunar hoặc Badlion thành điều kiện hard-code để một
Minecraft JVM được M3 xem là candidate. Một kết quả thành công trên Lunar hay
Badlion là tín hiệu coverage có giá trị cao cho transport chung, nhưng không
phải cam kết phần trăm tương thích hoặc adapter certification tự động cho
client khác.

## Diễn giải các cụm từ đã gây nhầm lẫn

| Cụm từ | Nghĩa được chốt |
| --- | --- |
| “Inject tổng quát mọi process Minecraft 1.8.9” | Injector đánh giá và xử lý một **JVM Minecraft được chọn rõ ràng**, dù launcher/client tạo ra nó là gì, nếu target, architecture và runtime contract hợp lệ. Đây là mục tiêu transport; không phải lời hứa mọi feature hoạt động trên mọi client. |
| “Force inject” | Default là transport trực tiếp đến PID game đã chọn, thay vì cần Forge discovery, launcher plugin hoặc Lunar-specific debug API. Nếu chủ dự án khai báo lane owner-authorized host experiment thì có thể đánh giá entry mechanism cấp host; scope thực tế phải được ghi rõ và vẫn phải chứng minh lifecycle trên đúng game target. |
| “Opt-in” / “vendor interface” | Không phải yêu cầu kiến trúc để một JVM game do người dùng đang quản lý trở thành M3 target. Một đường vendor-approved có thể là **lựa chọn kiểm chứng bổ sung**, nhưng không định nghĩa target model và không biến M3 thành Lunar-only. |
| “Lunar/Badlion là target ưu tiên” | Lunar 1.8.9 là live lifecycle proof đầu tiên; Badlion 1.8.9 là proof kế tiếp trong cùng M3 transport cohort. Đây không phải process-name filter và không tự chứng minh Forge/Vanilla hoặc adapter compatibility. |
| “Hỗ trợ client” | Chỉ có sau classloader, mappings và adapter certification của M4–M6/M12. Runtime entry/handshake thành công chỉ chứng minh transport lifecycle. |

Vì vậy, một Lunar hoặc Badlion bản chạy bình thường trong phiên người dùng
hiện tại nằm trong **mục tiêu kiểm chứng M3** nếu JVM đó được chọn rõ ràng và
thỏa các gate kỹ thuật. M3 không chờ một “debug mode” hay API test riêng để
được định nghĩa. Selected-PID transport không dùng kỹ thuật stealth hoặc mở
rộng scope ngầm; host-level experiment chỉ tồn tại khi chủ dự án khai báo nó
theo Decision 0007.

## “General” nghĩa là gì — và không nghĩa là gì

| Khái niệm | Nghĩa chính xác trong M3 |
| --- | --- |
| Client-independent target selection | Chọn Java game JVM theo bằng chứng JVM/Minecraft, PID người dùng chọn, ownership của phiên người dùng hiện tại hoặc ủy quyền kiểm thử, và architecture; không theo brand client. Một owner-authorized host experiment có thể dùng entry mechanism khác, nhưng không được làm mờ target JVM hay scope thực tế. |
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
- kiểm tra target thuộc phiên người dùng hiện tại, có ủy quyền kiểm thử, hoặc
  là target được ghi rõ trong owner-authorized host experiment;
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

## Ranh giới milestone và thứ tự kiểm chứng

1. Opus-owned client và harness chỉ giữ vai trò regression/control baseline cho
   protocol, artifact và lifecycle; chúng không được dùng thay cho live client
   evidence.
2. Lunar 1.8.9 là target bên ngoài đầu tiên: chọn PID rõ ràng, ghi capability
   matrix, và chỉ request load khi target mở transport hợp lệ.
3. Badlion 1.8.9 là target bên ngoài kế tiếp với cùng contract:
   capability -> native entry -> handshake -> unload -> reinjection -> target
   survival.
4. Chỉ sau khi hai lượt kiểm chứng này có kết quả đo được mới mở rộng survey
   transport sang Forge, Vanilla và client family khác.

Nếu selected-PID transport trả `UNSUPPORTED_TARGET_CONFIGURATION`, đó là kết
quả compatibility hợp lệ cho **transport path đó**. Nó không được tự động đổi
thành pass hoặc mở rộng scope ngầm. Chủ dự án có thể mở một owner-authorized
host experiment theo Decision 0007, nhưng lane đó phải được đánh giá và ghi
evidence riêng. Một `CAPABILITY_AVAILABLE` hoặc lifecycle pass chỉ mở lane cho
client/build đã đo, không tự chứng nhận các client còn lại.

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
| Lunar 1.8.9 JVM do người dùng quản lý | Target ưu tiên thứ nhất cho live transport/lifecycle validation M3. | Lunar adapter, mappings hoặc feature support. |
| Badlion 1.8.9 JVM do người dùng quản lý | Target ưu tiên thứ hai trong cùng M3 transport cohort. | Badlion adapter, mappings hoặc feature support. |
| Forge/Vanilla JVM 1.8.9 có bằng chứng hợp lệ | Client-neutral transport candidate sau Lunar/Badlion cohort; `client_hint` không phải gate. | Rằng chúng đã được adapter certification. |
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
- tự động tìm rồi tác động hàng loạt vào process nền mà không có scope
  experiment được chủ dự án ghi rõ;
- che giấu hoặc khai báo sai scope thực tế của một host-level mechanism;
- hard-code Lunar internals vào injector;
- feature/module/UI/OneConfig implementation; hoặc
- tuyên bố support cho một client chỉ vì runtime entry/handshake thành công.

Mọi live target phải là process trong phiên người dùng hiện tại do người dùng
quản lý, có đường kiểm thử được ủy quyền rõ ràng, hoặc được ghi đích danh
trong owner-authorized host experiment theo Decision 0007. Quyền host của chủ
dự án không phải tuyên bố rằng vendor binary là OPUS-owned; đây vẫn là hai
facts tách biệt trong record M3.

### Phản hồi vendor cho Lunar — không cấm (vùng xám), đã ghi nhận

Chủ dự án đã liên hệ kênh support/developer của Lunar Client và nhận được trả
lời **không cấm** inject client: vùng xám — không khuyến khích cũng không cấm.
Không khuyến khích vì inject cẩu thả có thể crash client và ảnh hưởng trải
nghiệm; không cấm nếu tính năng lành mạnh. Điều kiện kèm theo: không xâm phạm,
không gây hại, không crack Lunar. Phạm vi: khuyến khích nhất là **tiến trình
game**, inject toàn client được phép, inject vào **launcher** được phép nhưng
**cực kì không khuyến khích**.

Chủ dự án cũng hỏi riêng về ký lại binary và tắt SIP. Trả lời ghi nhận được:
Lunar **không cấm**, coi đó là quyền của dev bên thứ ba, và nêu rằng Apple cho
phép tắt SIP — kèm điều kiện người dùng tự chịu trách nhiệm nếu máy bị hỏng
hoặc nhiễm malware. Đây là **miễn trừ trách nhiệm của Lunar**, không phải một
bảo chứng kỹ thuật.

Bản ghi đầy đủ — kèm nguồn gốc, giới hạn, số liệu đo, và các trường truy vết
còn thiếu — nằm ở
[Lunar Client M3 Vendor Non-Prohibition Record](protocol/m3-lunar-vendor-non-prohibition-record.md).

**Đây là general non-prohibition, không phải `vendor-approved integration`.**
Lunar chưa cấp entry point hay build được phép; Lunar có nêu khả năng cung cấp
một phương pháp nội bộ cho third-party developer, nhưng tài liệu và mechanism
thật chưa được nhận. Đây là pending vendor-method lane, không phải bằng chứng
rằng một host experiment cụ thể đã được Lunar mô tả hoặc approved. Quan trọng hơn:
schema evidence hiện tại **không có chỗ** cho trạng thái này — `mode` chỉ nhận
`opus-owned | vendor-approved`, và
`scripts/verify-m3-client-integration-evidence.mjs` từ chối mọi giá trị khác.
Xử lý đúng là: **ghi ở đây, và không nộp capture nào dưới phản hồi này**. Thêm
một mode mới vào schema là thay đổi riêng, phải làm có chủ đích, không được lách
qua đường tài liệu.

### Phân biệt quyền host và thay đổi phía vendor

Quyền host của chủ dự án cần được áp dụng chính xác, không rộng hơn facts thực
tế:

- **Ký lại binary của target** là thao tác phát triển bình thường, không phải
  bypass OS. Tuy nhiên ký lại *client đã phát hành của Lunar* vẫn là sửa
  artifact của vendor; vendor permission và kết quả kỹ thuật phải được ghi
  riêng.
- **Vô hiệu hoá cơ chế tự sửa JRE của launcher Lunar** (`chflags uchg`, ghi đè
  file bất biến, hay bất kỳ cách nào chặn nó giải nén lại) tác động trực tiếp
  đến integrity repair của vendor. Host authority không tự cấp target-side
  authority cho việc này; chưa có tài liệu Lunar mô tả hoặc cho phép nó, nên
  đây không phải current M3 path.
- **Tắt SIP** là cấu hình host do chủ máy quyết định và chịu trách nhiệm. Nó có
  thể chỉ xuất hiện trong owner-authorized host experiment theo Decision 0007;
  nó không phải bằng chứng capability tự thân. Gate 3–5 hiện được đọc theo
  trạng thái môi trường reconciliation ở bên dưới; một direct task-port proof
  cũ trên target OPUS-owned khi SIP bật không làm SIP-off trở thành tùy chọn
  chưa cần thiết cho môi trường phát triển hiện tại.

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

Ngày 2026-09-11, một owner-authorized experiment riêng đã chứng minh **task-port
capability** cho một JVM Java đang chạy từ runtime path của Badlion, khi helper
arm64 của Opus được chủ máy gọi bằng `sudo`. Helper công bố
`TaskPortProbeReady` và `task_port=acquired_and_released`. Record đầy đủ, gồm
scope một PID, hash artifact, trạng thái SIP, rollback và giới hạn kết luận,
nằm tại [Badlion Direct Task-Port Capability Record](protocol/m3-badlion-direct-task-port-capability-record-2026-09-11.md).
Đây chỉ là `capability available`: không có dylib load, native entry,
handshake, unload, reinjection hay adapter claim nào được suy ra từ nó. Nó
không thay thế bằng chứng Lunar ở mục sau và không đóng M3 General.

Một harness cooperative riêng cho Gate 3 và Gate 4 hiện cũng tồn tại:
[M3 Cooperative VM Gate Harness](protocol/m3-cooperative-vm-gate-harness.md).
Nó dùng descriptor schema v2 do target tự publish, gắn PID với executable,
process-instance và capability cụ thể. Gate 3 chỉ query/read marker đã được
target công bố; Gate 4 chỉ allocate → RW protect → write/readback → deallocate
một page test. Không có executable memory, remote thread, dylib load hay JNI
trong hai probe này. Kết quả pass chỉ là bằng chứng primitive trên target
cooperative; không nâng cấp Badlion record, không chứng minh runtime entry,
và không đóng M3 General.

### Chỗ đứt tới Lunar 1.8.9 live — đo ngày 2026-09-10

Đo trực tiếp trên một Lunar Client 1.8.9 đang chạy trên máy Mac của chủ dự án
(arm64, `zulu17…macosx_aarch64`, `com.moonsworth.lunar.genesis.Genesis`), với
**SIP đang bật**.

**Cổng thật sự là chữ ký của TARGET, không phải entitlement của caller.** Số
liệu này phủ định một bản nháp trước của chính mục này:

```text
TARGET: opus-task-port-probe-target
        flags=0x2(adhoc), TeamIdentifier=not set
        entitlement: com.apple.security.get-task-allow = true
CALLER: binary clang thường, KHÔNG entitlement nào
        -> kern_return=0 ((os/kern) successful)  port=7939
```

Caller **không có entitlement nào** vẫn lấy được task port khi **target** mang
`get-task-allow`. Với JVM của Lunar thì cùng caller đó nhận
`kern_return=5 KERN_FAILURE`, vì binary của Lunar:

```text
flags=0x10000(runtime)        <- hardened runtime
TeamIdentifier=TDTHCUPYFR     <- Azul Systems
entitlements: disable-library-validation, device.audio-input
              KHÔNG có get-task-allow
```

Đòn bẩy là **chữ ký trên binary target**, và việc ký đó là lựa chọn của bên
phát hành binary. Lunar **có thể** cấp nó — bằng cách phát hành build hoặc JRE
được ký kèm `get-task-allow`.

### Reconciliation platform statement — September 12, 2026

Gate 3–5 were validated on the current macOS development host with SIP disabled. SIP-off is an accepted platform prerequisite for the current Opus development environment. Success with SIP enabled on a hardened target has not been isolated or measured. The 2026-09-11 Badlion JVM measurement also demonstrates that absence of target get-task-allow alone is not sufficient to predict task_for_pid failure in this environment.

Quan sát `kern_return=0` ở trên vẫn được giữ như một phép đo lịch sử trên target
OPUS-owned mang `get-task-allow` với SIP bật. Nó không cô lập một đường thành
công SIP-enabled trên hardened target, và không thay thế platform statement
hiện tại.

**Đường hợp tác (JDK Attach API) — bị từ chối, nguyên nhân chưa xác định:**

```text
$ jcmd <lunar-pid> VM.version
com.sun.tools.attach.AttachNotSupportedException:
    The VM does not support the attach mechanism
```

`jps` vẫn liệt kê JVM trong khi `jcmd` ném lỗi. Cơ chế: HotSpot của target tự
báo attach listener chưa khởi tạo qua bộ đếm capability trong hsperfdata
(`sun.rt.jvmCapabilities`) — thứ mà `testAttachable` đọc — **không phải** do
thiếu file socket. Nguyên nhân cụ thể **chưa xác định**: flag
`-XX:+DisableAttachMechanism` không thấy trong command line quan sát được, nhưng
nó có thể đến qua argfile, `JDK_JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS` hoặc
`_JAVA_OPTIONS`, là những thứ không xuất hiện trong argv. Đây là thiết lập lúc
**khởi chạy**, không phải thuộc tính của build — nên câu hỏi đúng cho Lunar là
*launch profile*, không phải *build*.

**Phạm vi của phép đo:** `KERN_FAILURE` quan sát được với **bốn PID lấy mẫu** —
pid 1, JVM của chính caller, một process tự đẻ, và JVM của Lunar. Đây **không**
phải quy tắc phổ quát: target `get-task-allow` của chính repo này trả về thành
công. Nguyên nhân cũng không đồng nhất — pid 1 (binary nền tảng của Apple) bị
từ chối bởi SIP platform-binary protection, khác cơ chế với hardened runtime
đang từ chối Lunar.

Điều **không** phải chỗ đứt, để tránh sửa nhầm chỗ:

- Gate **chọn target** qua — `--version 1.8.9`, `genesis.Genesis`, `profiles/1.8/`
  đủ evidence, `client_hint=Lunar`.
- Gate **kiến trúc** qua — JVM của Lunar là arm64 (`macosx_aarch64`,
  `Mach-O 64-bit executable arm64`). Rào Rosetta ở mục "Phạm vi ban đầu" chỉ
  đúng cho JVM x86_64 do launcher Opus tự chọn, **không** áp dụng cho Lunar.

Hệ quả trực tiếp: `check.sh` xanh vì target của nó là binary **của chính Opus** —
ad-hoc ký kèm `get-task-allow`, không hardened. Đó chính là khoảng cách mục này
đã ghi từ trước, và nó **vẫn chưa được đóng**.

Trong phạm vi phép đo Lunar ngày 2026-09-10, target thiếu `get-task-allow` là
một boundary được quan sát. Nó không được giữ như “chặn duy nhất còn lại” cho
nền tảng hiện tại: phép đo Badlion ngày 2026-09-11 trong platform statement ở
trên cho thấy riêng việc vắng `get-task-allow` chưa đủ để dự đoán
`task_for_pid` thất bại trong môi trường này. Hai hướng đã được xem xét cho
đường Lunar cụ thể, trong đó một hướng đã được đo là không chạy được:

1. **Xin Lunar** một build/JRE/launch profile có `java` được ký kèm
   `get-task-allow` — nếu họ đã có cấu hình debug thì đây chỉ là một bước ký.
   Kèm luôn câu hỏi switch nào tắt attach listener, để nguyên nhân đường hợp tác
   thôi là giả thuyết.

   **Cập nhật 2026-09-10: Lunar từ chối cấp dev build cho dev bên thứ ba.**
   Phần build của yêu cầu này coi như đã đóng. Lunar nêu khả năng cung cấp **tài
   liệu nội bộ, lưu hành hạn chế, mô tả phương pháp inject cho dev bên thứ ba** —
   xem mục bên dưới. Đó là artifact khác về bản chất, và cần đánh giá riêng khi
   có bản thật.
2. **Tự ký lại target** — công thức đã chứng minh chạy được trên **bản copy**
   trong `/tmp` (JVM vẫn boot, `task_for_pid` trả `kern_return=0`). Nhưng trên
   bản cài thật thì **thất bại**: launcher của Lunar verify rồi **giải nén lại
   toàn bộ JRE** mỗi lần launch, ghi đè chữ ký về bản gốc và xoá luôn file
   backup. Đo ngày 2026-09-10: 163 file trong cây JRE bị viết lại, `bin/java`
   trở về `flags=0x10000(runtime)` / Azul, `task_for_pid` trên JVM game đang
   chạy trả `kern_return=5`. Bản cài không hỏng — `codesign -v` báo *valid on
   disk*, launcher chỉ trả artifact của nó về đúng trạng thái phát hành.

Cách duy nhất được quan sát để cứu cách (2) là vô hiệu hoá cơ chế tự sửa của
launcher. Đây không phải host setting đơn thuần: nó tác động trực tiếp đến
integrity repair của vendor artifact, không được suy ra từ host authority, và
chưa có tài liệu vendor cho phép. Vì vậy nó không phải M3 path hiện tại. Một
owner-authorized host experiment không được relabel hành động này thành
vendor-approved transport.

Hệ quả: yêu cầu gửi Lunar giờ có lý lẽ đo được, không còn là giả định — "launcher
của các bạn revert mọi thao tác ký lại cục bộ, nên build mở được đường này phải
đến từ các bạn".

Direct task-port proof lịch sử của OPUS-owned target khi SIP bật vẫn là phép
so sánh hữu ích, nhưng không phải hardened-target measurement và không được
dùng để tuyên bố rằng SIP-off không cần thiết cho môi trường Gate 3–5 hiện tại.
Phép đo Badlion được ghi trong [Badlion Direct Task-Port Capability
Record](protocol/m3-badlion-direct-task-port-capability-record-2026-09-11.md);
nó được thực hiện với SIP tắt và không cô lập riêng tác động của SIP. Bất kỳ
thay đổi SIP nào vẫn là decision cấp host; nó không tự mở M3 capability chung.
Ghi chép Lunar riêng nằm ở [Lunar Client M3 Vendor Non-Prohibition
Record](protocol/m3-lunar-vendor-non-prohibition-record.md), mục "Measured: the
launcher restores its JRE".

Lưu ý phạm vi: đường mod chính thức của Lunar
(`-Dichor.fabric.localModPath=…/profiles/1.8/mods`) nạp được code Opus vào JVM
Lunar mà không cần inject — nhưng mod **không** thoả M3, vì M3 là bài toán
transport/lifecycle, không phải bài toán nạp mod. Nó **không** đóng M3 General.

## Cổng scope đã duyệt

Tài liệu này chốt **mục tiêu và ranh giới** cho implementation. Mọi source
change phải tiếp tục nằm trong contract client-neutral ở trên; không nhảy sang
M4–M12, không dùng client label làm điều kiện chọn target, và không thử nghiệm
trên process ngoài ownership/host-experiment boundary đã nêu.

Foundation/preflight trong workspace là evidence kỹ thuật riêng; M3 General
chỉ hoàn tất khi Definition of Done ở trên được chứng minh trên target Lunar
đầu tiên.
