# M3 Gate 3–5 Reconciliation Record — September 11, 2026

Status: **implementation and cooperative reproducibility are sealed for Gates
3–5. A current artifact-bound Badlion live record now exists for all three
gates; historical PID `51238` provenance remains separately unresolved. Gate 6
was not started.**

## Environment reconciliation metadata — added after audit

| Field | Value / provenance |
| --- | --- |
| SIP | `disabled`. Post-audit reconciliation metadata added 2026-09-12; not a field retained in the original command transcript. This is reconciliation context for the development host; it does not rewrite the historical evidence provenance or establish causality. |

## Scope

The initial clean rebuild and regression phase used only Opus-owned fixtures.
Later, the project owner opened one Badlion game session and authorized the
bounded Gate 3–5 diagnostic sequence against its one selected JVM, PID
`91330`. No other candidate matched the selector.

Neither phase loaded a dylib, invoked JNI/JVMTI/Java, used mappings or hooks,
created a bootstrap runtime, or began Gate 6.

The historical Badlion PID `51238` was checked only for presence at
`2026-09-11T19:04:24+0700`; it was no longer present. No process discovery
fallback was used.

## Baseline snapshot

Captured before any reconciliation change at `2026-09-11T18:55:56+0700`.

```text
branch=m3-general-transport-foundation
HEAD=6a117fe961d018077dd173709b38b33af96c331c
staged_changes=false
```

Tracked modified paths at baseline:

```text
docs/injector-m3-preflight-contract.md
docs/m3-general-objective.md
docs/m3-lunar-vendor-authorization-request.md
docs/protocol/m3-authorized-client-integration-evidence.md
injector-native/CMakeLists.txt
injector-native/src/macos_loader_bootstrap_arm64.S
injector-native/src/macos_transport.cpp
injector-native/src/task_port_probe_target.cpp
injector/README.md
injector/src/diagnostics.rs
injector/src/lib.rs
injector/src/main.rs
injector/src/native_transport.rs
injector/src/process.rs
launcher
runtime
scripts/build-injector-native-transport.sh
scripts/check.sh
tests/README.md
tests/check-injector-native-runtime-load.sh
```

Untracked paths at baseline:

```text
docs/decisions/0006-rust-control-plane-capability-boundaries.md
docs/decisions/0007-owner-authorized-host-experiment-boundary.md
docs/protocol/m3-badlion-direct-task-port-capability-record-2026-09-11.md
docs/protocol/m3-badlion-native-execution-record-2026-09-11.md
docs/protocol/m3-cooperative-vm-gate-harness.md
docs/protocol/m3-gate-6-bootstrap-lifecycle-plan.md
docs/protocol/m3-lunar-vendor-non-prohibition-record.md
docs/research-cosmosclient-lite-source-audit.md
injector-native/src/cooperative_vm_probe_protocol.cpp
injector-native/src/cooperative_vm_probe_protocol.hpp
injector-native/src/task_port_vm_read_probe.cpp
injector-native/src/task_port_vm_rw_probe.cpp
injector/src/code_signing.rs
injector/src/jvm_attach_probe.rs
injector/src/lldb_development.rs
reports/
tests/check-injector-jvm-attach-capability-probe.sh
tests/check-injector-lldb-development-harness.sh
tests/check-injector-native-direct-vm-gates.sh
tests/check-injector-native-execution-probe.sh
tests/check-injector-native-transport-stress.sh
tests/check-injector-native-vm-read-probe.sh
tests/check-injector-native-vm-rw-probe.sh
```

Submodule commits at baseline:

```text
8179eacae2d6fc8b868d38ae3a1576748ffb6a6a launcher (heads/main)
afcf4e4706b8cd7d57ea8d960b2f1839ac5726a6 runtime (heads/main)
```

`git status` marked both submodule worktrees as modified. No commit, stage, or
submodule update was performed by this reconciliation.

## Clean-build procedure

The following generated directories were confirmed ignored/untracked, then
removed with `cmake -E remove_directory`:

```text
output/injector-native-transport
output/injector-native-slices
output/injector-foundation
injector/target
launcher/target
runtime-java/build
```

The downloaded test JDK cache under `output/injector-test-toolchains` was
preserved. The deleted paths contained only CMake, Cargo, or Gradle output.

Fresh builds then passed:

```text
./scripts/build-injector-native-transport.sh arm64
./scripts/build-injector-native-transport.sh x86_64
```

Both reported the requested architecture for the helper, probe target, VM
read probe, VM RW probe, and loader-probe library.

## Fresh helper identity

The first fresh arm64 helper, used for the explicit Gate 3–5 fixture
regressions, was:

```text
path=/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-macos-transport
architecture=arm64
sha256=668d19f09d76356187d8fd5489055f98a8eb86518620c71259fef3c989b143ed
size_bytes=148976
mtime=2026-09-11T18:59:00+0700
signature=ad-hoc
```

`./scripts/check.sh` subsequently rebuilt the transport again from the same
working tree. The resulting current helper is:

```text
path=/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-macos-transport
architecture=arm64
sha256=325afaffe7ccdd3411e0d9710856cf0e08eeac71c01f56c46f2070d569f4bdec
size_bytes=148976
mtime=2026-09-11T19:00:26+0700
signature=ad-hoc
worktree_branch=m3-general-transport-foundation
worktree_HEAD=6a117fe961d018077dd173709b38b33af96c331c
worktree_clean=false
```

The two fresh-build digests are separate artifact identities. Neither may be
attached retrospectively to the historical Badlion live run:

```text
historical live helper identity: unresolved
```

The later current-Badlion live sequence used a third fresh arm64 helper:

```text
path=/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-macos-transport
architecture=arm64
sha256=a504470cef1efc7473b8d63617e13a49ab1dba69e0a1b6b770809a41bcc59bab
size_bytes=148976
mtime=2026-09-11T19:31:21+0700
signature=ad-hoc
```

## Newly observed cooperative regression

All commands below exited `0` after the first fresh arm64 build:

```text
./tests/check-injector-native-vm-read-probe.sh
  -> OPUS native VM map/query/read probe passed.

./tests/check-injector-native-vm-rw-probe.sh
  -> OPUS cooperative VM allocation/write/readback/deallocation probe passed.

./tests/check-injector-native-direct-vm-gates.sh
  -> OPUS native direct VM map/read and RW round-trip probes passed.

./tests/check-injector-native-execution-probe.sh
  -> OPUS native execution handoff probe passed through 1, 3, 10, and 25 iterations.
```

The Gate 5 test asserts marker equality, `execution_observed=true`,
`cleanup=true`, target survival, and `NativeExecutionReady` at stage `25`.

`./scripts/check.sh` then exited `0` after its own fresh rebuild and printed:

```text
OPUS native VM map/query/read probe passed.
OPUS cooperative VM allocation/write/readback/deallocation probe passed.
OPUS native direct VM map/read and RW round-trip probes passed.
OPUS native execution handoff probe passed through 1, 3, 10, and 25 iterations.
OPUS M3 preflight, selected-PID native transport, test-only Attach harness,
owned-target, and authorized-target lifecycle checks passed for
injector-development; no distributable payload exists yet.
```

## Current artifact-bound Badlion live verification

The owner opened a new Badlion game session after the reconciliation clean
build. The current-user Java selector found exactly one game-JVM candidate:

```text
target_pid=91330
process_start=Fri Sep 11 19:29:30 2026
target_path=.../Badlion Client/Data/zulu-8u442b06.jre/Contents/Home/bin/java
target_architecture=arm64
target_sha256=74bb8cf1c45ac60041646e6e9b4c61da0cdc20b19682001d3e8421209535b700
helper_sha256=a504470cef1efc7473b8d63617e13a49ab1dba69e0a1b6b770809a41bcc59bab
```

Gate 3 and Gate 4 both returned all expected Mach success codes. Gate 5
passed `1 -> 3 -> 10 -> 25`, with `NativeExecutionReady`, exact marker
transition, cleanup, and target survival at stage `25`. The same PID and start
time were present at `2026-09-11T19:33:42+0700`.

The raw outputs, exact commands, selection evidence, and owner-sanity template
are retained in the
[Current Badlion Live Gates 3–5 Record](m3-badlion-live-gates-3-5-record-2026-09-11.md).

## Historical Badlion evidence and contradiction review

- The Gate 3/4 live claims for Badlion PID `51238` are now preserved in
  [the transcript backfill](m3-badlion-vm-gates-transcript-record-2026-09-11.md).
  Their raw stdout, canonical target image digest, and helper digest remain
  unknown.
- The historical Gate 5 Badlion claim is separated from its cooperative
  reproduction in the
  [Gate 5 record](m3-badlion-native-execution-record-2026-09-11.md).
- The September 10 signature/task-port analysis in
  `docs/m3-general-objective.md` explicitly names a Lunar Zulu 17 target, not
  the current Badlion Zulu 8 PID `91330` target. It is therefore not a
  same-image comparison.
- A separate Badlion task-port-only record for PID `4578` retained an arm64
  Java executable digest
  `74bb8cf1c45ac60041646e6e9b4c61da0cdc20b19682001d3e8421209535b700`.
  The recorded on-disk Badlion Zulu 8 `bin/java` still matches that digest and
  its hardened Azul signature. The current PID `91330` uses that same
  executable path and digest. This identifies the new live target, not
  historical PID `51238`.
- PID `51238` was absent during this reconciliation, so its running executable
  image could not be re-read.

Conclusion:

```text
documented 10/09 Lunar versus current 11/09 Badlion: different targets
separate alleged Badlion 10/09 image analysis:         UNRESOLVED
historical PID 51238 image/helper identity:            UNRESOLVED
```

The new live evidence does not retroactively identify the historical PID
`51238` execution instance.

## Reconciliation matrix

| Claim | Fresh-build evidence | Cooperative evidence | Badlion live evidence | Repository artifact | Status |
| --- | --- | --- | --- | --- | --- |
| Gate 3 VM read | arm64 and x86_64 helpers rebuilt from removed output | VM-read and direct VM-gate fixtures exited `0` | Current PID `91330` returned region/read/task-port successes with exact helper and target identities | [current live record](m3-badlion-live-gates-3-5-record-2026-09-11.md) | `PASS` |
| Gate 4 VM RW | arm64 and x86_64 helpers rebuilt from removed output | VM-RW and direct VM-gate fixtures exited `0` | Current PID `91330` returned allocation/write/readback/deallocation successes with exact identities | [current live record](m3-badlion-live-gates-3-5-record-2026-09-11.md) | `PASS` |
| Gate 5 native execution | arm64 and x86_64 helpers rebuilt from removed output | `1 -> 3 -> 10 -> 25` ladder exited `0`; stage 25 asserted `NativeExecutionReady` | Current PID `91330` completed the exact ladder with cleanup and survival; owner UI/gameplay sanity pending | [current live record](m3-badlion-live-gates-3-5-record-2026-09-11.md) | `PARTIALLY VERIFIED` |
| Full `check.sh` | Build caches/output removed before run; the script rebuilt native slices and transport | Gate 3/4/5 phases printed pass messages | No Badlion process selected by the check | This record | `PASS` |
| Current fresh helper identity | arm64 helper built three times from the current dirty worktree | Test paths point at the fresh arm64 output path | Current PID `91330` helper identity is exact; historical PID `51238` helper remains unknown | This record | `RECORDED` |
| 10/09 versus 11/09 contradiction | N/A | N/A | Primary documented 10/09 target is Lunar; a separate alleged Badlion analysis is not retained | This record and cited source records | `PARTIALLY VERIFIED` |

## Seal decision

```text
Gate 3 implementation sealed?                 yes
Gate 4 implementation sealed?                 yes
Gate 5 cooperative implementation sealed?     yes
Gate 5 Badlion live provenance sealed?         yes (PID 91330)
Ready for Gate 6?                              no
```

The `no` for Gate 6 is a scope decision, not a build failure. Historical PID
`51238` identity, the separate unsupported Badlion-analysis claim, and owner
manual-sanity evidence remain open. No Gate 6 work was started by this
reconciliation.
