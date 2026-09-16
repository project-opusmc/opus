# Hồ sơ kiểm chứng Opus M3

**Báo cáo tiến độ · Lưu hành nội bộ**

Đối chiếu tám phiên làm việc của Codex (24/08 → 11/09/2026) với trạng thái thật của repository. Điểm khác biệt then chốt: phần lớn kết quả then chốt **không tái lập được** từ repository, và bước định nghĩa nên "inject" thì **chưa từng chạy thành công**.

| | |
|---|---|
| **Ngày** | 2026-09-11 |
| **Nhánh** | `m3-general-transport-foundation` |
| **HEAD** | `6a117fe` · 2026-09-10 |
| **Phạm vi** | 8 phiên · 658 MB rollout |

---

## 1. Kết luận điều hành

M3 **chưa đạt**. Thứ đã được chứng minh — và chứng minh được một cách tái lập — chỉ là một primitive *đọc/ghi bộ nhớ* trên các tiến trình do Opus tự sinh. Kết quả chạy trên client thật (Badlion) không để lại bất kỳ artifact nào trong repository và mâu thuẫn với chính phân tích chữ ký mà dự án đã ghi lại.

Bước định nghĩa nên khả năng inject — buộc tiến trình đích *thực thi* code native do Opus đưa vào — chưa được nối vào `HEAD`, đang lỗi ở working tree, và **chưa từng được quan sát là thành công**.

Ngoài ra: toàn bộ công việc tháng 9 **chưa được commit**; bộ kiểm thử tổng (`./scripts/check.sh`) hiện **đỏ**; và tài liệu uỷ quyền chưa có văn bản nào từ phía vendor.

---

## 2. Phạm vi & phương pháp

Codex lưu rollout tại `~/.codex/sessions/<năm>/<tháng>/<ngày>/rollout-*.jsonl`. Có 51 phiên trỏ tới thư mục dự án; báo cáo này lấy tám phiên gần nhất (658 MB) làm phạm vi.

Các rollout thô quá lớn để đọc trực tiếp, nên chúng được trích thành digest dễ đọc, sau đó **đối chiếu ngược lại với repository thật**: `git log`, `git status`, sự tồn tại của từng file trên đĩa, nội dung test script, và chạy lại các bài kiểm thử. Mọi tuyên bố trong báo cáo được phân loại theo nguồn:

- **Đã quan sát** — có lệnh được chạy và có output đọc được.
- **Chỉ được tuyên bố** — agent hoặc người dùng nói là đã làm, không có output tương ứng.
- **Mâu thuẫn** — hai nguồn nói ngược nhau, chưa gỡ được.

Việc chạy lại kiểm thử trong quá trình lập báo cáo chỉ nhắm vào các target do Opus tự sinh. Không có tiến trình client bên thứ ba nào bị tác động.

---

## 3. Bảng trạng thái

Mức độ chắc chắn của từng tuyên bố, sau kiểm chứng:

| Tuyên bố | Kết luận | Cơ sở kiểm chứng |
|---|---|---|
| Gate 3 (đọc VM) và Gate 4 (allocate/write/readback) đạt trên target hợp tác do Opus tự sinh | **Xác nhận** | Chạy lại 3 test script độc lập; mỗi script in dòng pass và thoát mã 0. |
| Gate 3 / Gate 4 đạt *live* trên Badlion PID 51238 | **Không kiểm chứng được** | `rg 51238` trên `docs/ tests/ scripts/ injector/` → 0 kết quả. Không test, không record, không commit. Chỉ tồn tại dưới dạng một dòng log dán trong khung chat. |
| Task port trên Badlion PID 4578 | **Một phần** | Do chủ dự án tự chạy `sudo`. Record còn untracked, và SHA-256 helper ghi trong record không khớp helper trên đĩa. |
| Gate 5 — thực thi code native trong JVM đích | **Chưa đạt** | Không được dispatch trong `HEAD`. Working tree tái hiện `NativeExecutionCleanupFailed` 3/3 lần. Chưa từng in ra `execution_observed`. |
| `./scripts/check.sh` xanh, toàn bộ gate đạt | **Bác bỏ** | Chạy hai lần, cả hai thoát mã 2, chết ở bước build arm64 với `-Werror` (unused function/const). Không tới được các lane kiểm thử gate. |
| 73 bài kiểm thử Rust đạt | **Xác nhận** | Đếm trực tiếp: 56 + 17. |
| Đã có uỷ quyền từ vendor | **Chưa thiết lập** | Văn bản đề nghị ghi rõ *"SUPERSEDED — never sent in this form"*; bản ghi non-prohibition là lời kể của chủ dự án, `recordSha256: PENDING`, artifact gốc không đính kèm. |
| SIP là rào cản kỹ thuật | **Bác bỏ** | Chính `docs/m3-general-objective.md` kết luận gate là chữ ký `get-task-allow` của binary đích, và ghi đậm *"Tắt SIP là không cần thiết"*. |

---

## 4. Mạch thời gian

### 24–25/08 · hai phiên — Nhánh UI trong game (không liên quan injector)

Hai phiên đứng ở thư mục dự án nhưng làm việc khác: sửa `config.toml` và vấn đề Keychain của chính Codex; và một phiên về Computer-Use khi khoá máy (agent từ chối tự bật quyền cho mình).

> **Không đụng tới** task port, Mach VM, hay injector. Không gate nào được bàn tới.

### 24–27/08 · hai phiên, 6 MB + 511 MB — OpusConfig / Elementa cho Minecraft 1.8.9

Xây dựng và đóng gói runtime UI, đuổi theo lỗi crash/méo cửa sổ native.

> **Kết thúc:** chủ dự án dừng toàn bộ việc code/build/commit vì các tuyên bố chưa được kiểm chứng. Phiên kết thúc bằng `<turn_aborted>`.

### 08/09 14:09 · 15 MB — Bước ngoặt kiến trúc: bỏ hướng client Forge riêng

Chuyển sang kiến trúc *injector → native runtime → Java payload*. Khảo sát 8 repo tham chiếu (clone về `/tmp`), dựng nền M2 controlled-JVM, viết migration plan, tạo crate Rust `injector/`, đổi release lock sang schema v2, làm build chọn được kiến trúc.

> **Kết thúc:** giữa M3, không có gate nào xanh. Hai lệnh cuối phiên lỗi (exit 101 — format string; rồi exit 2).

### 08/09 19:52 → 11/09 · 119 MB — Phiên nặng nhất: dựng toàn bộ helper native

Yêu cầu được đẩy từ "chỉ harness của Opus" sang "ép inject vào client Minecraft". Agent **từ chối** làm forced-injector tổng quát, và thay vào đó dựng: harness vòng đời JVM, lane authorized-target, evidence gate, toàn bộ helper C++ `macos_transport.cpp`, các module capability-boundary, reject Rosetta, stress harness, và viết decisions 0006/0007 cùng các record về Lunar/Badlion. Audit CosmosClient-lite và MIP ở mức chỉ đọc source.

> **Kết thúc:** xác nhận Badlion JVM PID 51238, chạy `probe --pid 51238` thoát 0, target còn sống. Không commit.

### 11/09 14:16 → 15:38 · 1,8 MB — Gate 3 / Gate 4 trực tiếp, rồi dừng ở ngưỡng Gate 5

Thêm hai subcommand trực tiếp vào helper (`probe-vm-read`, `probe-vm-rw`, +369 dòng), thêm test, nối vào `check.sh`. Được phép quét, tìm và xác thực PID 51238 là game JVM chứ không phải launcher. Chạy live và báo cáo toàn bộ Mach return code bằng 0.

> **Kết thúc:** sau chỉ thị Gate 5, agent chỉ *inspect và lên plan*, rồi hết phiên. Không commit.

---

## 5. Bằng chứng đã kiểm chứng

Đây là phần đứng vững. Ba test script được chạy lại trong quá trình lập báo cáo, tất cả đều thoát mã 0:

```
./tests/check-injector-native-direct-vm-gates.sh
  → OPUS native direct VM map/read and RW round-trip probes passed.   exit 0

./tests/check-injector-native-vm-read-probe.sh
  → OPUS native VM map/query/read probe passed.                       exit 0

./tests/check-injector-native-vm-rw-probe.sh
  → OPUS cooperative VM allocation/write/readback/deallocation
    probe passed.                                                     exit 0
```

Đây là các assertion thật (script thoát 1 khi thiếu token, không chỉ in). Nhưng cả ba đều spawn target do Opus tự sinh và yêu cầu descriptor công bố — về mặt cấu trúc, chúng *không thể* trỏ vào Badlion/Lunar.

Con số duy nhất sống sót qua kiểm chứng đối kháng là số bài kiểm thử Rust: **73** (56 + 17).

Cần lưu ý về phạm vi: chính tài liệu harness của dự án đã tự giới hạn —

> *"A passing Gate 3 or Gate 4 fixture proves only that the named primitive worked for that participating process instance, helper slice, and host configuration. It does not prove runtime entry, executable-memory permission, dylib loading, JNI/JVMTI bridge readiness, unload/reinjection, a Lunar/Badlion adapter, or M3 General completion."*

Giới hạn này là đúng và cần được giữ nguyên khi báo cáo lên trên.

---

## 6. Những gì chưa kiểm chứng được

### 6.1. Kết quả trên Badlion không để lại dấu vết nào

Kết quả then chốt nhất của cả tháng — Gate 3/4 chạy trên client thật — chỉ tồn tại dưới dạng một khối văn bản dán trong transcript. Không có record nào được cập nhật, không test nào được viết, không commit nào. Record duy nhất trên đĩa là cho **PID 4578**, do chủ dự án tự chạy `sudo`, và tự phân loại kết quả là `transport entered: NOT TESTED`.

Record đó còn tự vô hiệu hoá: nó ghi *"the helper digest, rather than the current Git revision, is therefore the authoritative identity"*, nhưng digest được ghim (`d16b963a…`) **không khớp** helper đang có trên đĩa (`68a99cbb…`). `output/` nằm trong `.gitignore`, nên đây là build artifact không có version control.

### 6.2. Mâu thuẫn chưa gỡ về quyền truy cập

Hai ghi nhận không thể cùng đúng:

- **10/09** — đọc chữ ký JVM Badlion, ghi `get-task-allow=absent`, kết luận *"không có quyền cho một process ngoài như Opus lấy task port của nó"*. Theo phân tích này, một tiến trình user thường **phải bị từ chối**.
- **11/09** — chạy **không sudo** trên PID 51238, nhận `task_for_pid_return=0`.

Giả thuyết khả dĩ nhất là phép đọc chữ ký hôm 10/09 đã nhắm vào launcher stub `bin/java` thay vì image đang chạy. Nhưng điều đó **chưa được đo lại**, và repository không có gì để phân xử. Cho tới khi gỡ được, không nên trích dẫn kết quả Badlion như một năng lực đã xác lập.

### 6.3. Bộ kiểm thử tổng xanh chỉ vì artifact cũ

Các script kiểm thử chỉ rebuild khi binary chưa tồn tại. Vì `output/` đã có sẵn binary, các test chạy trên artifact cũ, còn build sạch thì đỏ. Nói cách khác: *suite xanh so với artifact cũ, và đỏ khi build lại từ đầu*. Đây là loại khác biệt dễ bị đọc nhầm thành "toàn bộ gate đều xanh".

### 6.4. Một tuyên bố không có nguồn

Có một đoạn agent khẳng định điều khoản chính thức của Lunar cấm vượt cơ chế bảo vệ. Kiểm tra tool inventory của phiên đó: **không có công cụ fetch/search nào**, và không có URL `lunarclient.com` nào xuất hiện. Đây là khẳng định từ kiến thức sẵn có của model, không phải nguồn được truy xuất. Bản thân agent sau đó đã rút lại.

### 6.5. "Đọc memory" trong LLDB là bằng chứng yếu

Phép đọc được trích dẫn là header Mach-O của một dylib, trả về `cf fa ed fe` — tức magic number chuẩn của Mach-O arm64 (`0xfeedfacf`). Các byte này **nằm nguyên trong file trên đĩa**; đọc trực tiếp file cũng cho đúng kết quả đó. Nó không chứng minh truy cập được vùng nhớ riêng tư của tiến trình (heap, đối tượng JVM, state runtime). Thêm nữa, lệnh được ghi lại là `sudo lldb` — chạy bằng root, một đường quyền khác hẳn với helper chạy bằng user thường.

---

## 7. Ràng buộc nền tảng cần biết

Đây là phần ảnh hưởng trực tiếp tới quyết định, nên tách riêng khỏi phần tiến độ.

**Cơ chế gate thật.** `task_for_pid` từ tiến trình cùng user, không phải root, phụ thuộc vào **chữ ký của binary đích** — cụ thể là entitlement `get-task-allow`. Không phải SIP, và không phải entitlement của bên gọi.

**Yêu cầu triển khai thật.** Root **một mình không đủ** khi SIP còn bật — `taskgated` vẫn chặn root lấy task port của binary hardened-runtime không có `get-task-allow`. Điều kiện đầy đủ là **root + SIP tắt**, tức yêu cầu mọi máy người dùng phải hạ bảo mật toàn hệ thống.

**Chưa cô lập được SIP.** Toàn bộ evidence Gate 1–4 được thu trên máy **đã tắt SIP sẵn**. Kết luận "tắt SIP là không cần thiết" trong tài liệu rút ra từ một target *có* `get-task-allow`, nên nó không nói gì về target *không* có. Câu hỏi này chưa từng được đo.

**Target nghiệm thu thật.** Lunar 1.8.9 — hiện trả `kern_return=5 KERN_FAILURE`. Launcher Lunar giải nén lại toàn bộ JRE (163 file) mỗi lần chạy, xoá mọi re-sign. Tài liệu dự án tự xếp việc chặn cơ chế đó vào nhóm ngoài phạm vi, và agent đã từ chối triển khai.

**Phạm vi primitive.** `acquire_target_task` trong helper **không có allowlist** — chỉ kiểm tra kiến trúc rồi gọi thẳng `task_for_pid`. Nghĩa là nó là primitive đọc/ghi VM tổng quát, không phải thứ bị giới hạn như tài liệu mô tả.

---

## 8. Khoảng trống uỷ quyền

Trạng thái này cần được nêu rõ khi báo cáo lên trên, vì nó là rủi ro chứ không phải chi tiết thủ tục.

- `docs/m3-lunar-vendor-authorization-request.md` mang dòng trạng thái *"SUPERSEDED — retained as history only. This draft was never sent in this form."* — tức chưa từng có văn bản nào được gửi tới vendor.
- `docs/protocol/m3-lunar-vendor-non-prohibition-record.md` tự ghi ở mục provenance rằng nó được viết từ **lời kể của chủ dự án**, artifact gốc không đính kèm repository, và `recordSha256` còn `PENDING`. Bản thân tài liệu nói nó *"must not be cited as vendor certification, adapter certification, or feature-support evidence."*
- Record Badlion không viện dẫn vendor nào; nguồn duy nhất là transcript chủ dự án tự chạy.
- Ở tầng code, `scripts/verify-m3-client-integration-evidence.mjs` chỉ chấp nhận hai chế độ `opus-owned` và `vendor-approved`, và tài liệu schema ghi rõ nó *"has no slot for a general non-prohibition."*

Nói gọn: **chưa có bất kỳ văn bản nào từ phía vendor**, và chính repository cũng đã được thiết kế để từ chối coi lời kể là bằng chứng uỷ quyền.

---

## 9. Việc còn dở tại thời điểm lập báo cáo

- **Toàn bộ công việc tháng 9 chưa được commit.** `HEAD` vẫn là `6a117fe` từ 10/09 — năm commit M3 được tạo trong vòng 44 giây. Working tree có 20 file sửa và 19 file mới, **0 file staged**. Cả hai submodule `launcher` và `runtime` đều dirty.
- **Gate 5 đang được viết dở ngay lúc này.** Một phiên Codex chưa vào archive đang sửa `injector-native/src/macos_transport.cpp` — mtime nhảy 15:47 → 15:49, helper rebuild 15:49:22, tức sau khi phiên lưu trữ cuối kết thúc (15:38). Source hiện không ở trạng thái compile được.
- **Biến thể "no-data" của Gate 4 chưa từng được viết.** Gate 4 hiện luôn gọi `mach_vm_read_overwrite` để đọc lại, nên yêu cầu "test kín, không đọc dữ liệu" chưa đáp ứng được.
- **Kiểm chứng độc lập trước mặt chủ dự án chưa diễn ra.** Recipe hai Terminal đã được đưa, nhưng log không cho thấy lần chạy nào.
- **Bốn tính năng yêu cầu ban đầu chưa hiện thực:** inject mọi client 1.8.9, load `opus-runtime`, unload ngược, và handshake injector↔runtime.
- **Pin của `release/opus.lock.json` vẫn lệch** so với worktree của hai submodule.

---

## Phụ lục — cách tái lập

| Mục | Lệnh |
|---|---|
| Rollout gốc | `~/.codex/sessions/2026/09/11/rollout-2026-09-11T14-16-12-01a08f52-*.jsonl` (và các phiên cùng ngày) |
| Chạy lại Gate 3/4 | `./tests/check-injector-native-vm-read-probe.sh` · `check-injector-native-vm-rw-probe.sh` |
| Tìm dấu vết Badlion | `rg 51238 docs tests scripts injector` → kỳ vọng 0 kết quả |
| Xác nhận Gate 5 chưa nối | `./output/injector-native-transport/arm64/opus-macos-transport probe-native-execution --pid 1` → in usage, thoát 2 |
| Trạng thái build sạch | `./scripts/check.sh` → thoát 2 ở bước build arm64 |

---

*Báo cáo lập ngày 2026-09-11, từ tám rollout Codex trong khoảng 24/08 – 11/09/2026, đối chiếu với repository tại `HEAD 6a117fe`, nhánh `m3-general-transport-foundation`.*

*Mọi tuyên bố "Xác nhận" trong báo cáo này đều đã được chạy lại và quan sát trực tiếp. Mọi tuyên bố "Không kiểm chứng được" đều không có artifact tương ứng trong repository.*
