# M3 Gates 3–5 Current Badlion Live Record — September 11, 2026

Status: **Gate 3 `PASS`; Gate 4 `PASS`; Gate 5 technical
`NativeExecutionReady`. Owner UI/gameplay sanity remains pending and Gate 6 was
not started.**

## Environment reconciliation metadata — added after audit

| Field | Value / provenance |
| --- | --- |
| SIP | `disabled`. Post-audit reconciliation metadata added 2026-09-12; not a field retained in the original command transcript. This records the development-host environment and does not establish that SIP state was necessary or sufficient for any individual probe result. |

## Provenance and containment

This is a `newly observed` live record. The OPUS project owner started one
Badlion game session and asked for the Gates 3–5 diagnostic sequence against
that game JVM only.

The process selector inspected current-user `java` processes and required all
of the following evidence before a probe was permitted:

```text
Badlion + Minecraft + --gameDir + --assetsDir
```

Exactly one candidate matched. No raw command line, credentials, session token,
or unrelated process metadata is retained.

| Field | Observed value |
| --- | --- |
| Selection time window | `2026-09-11T19:31:21+0700` to `2026-09-11T19:33:42+0700` |
| Candidate count | `1` |
| Target PID | `91330` |
| Parent PID | `91329` |
| Target UID | `501` (current user) |
| Process start | `Fri Sep 11 19:29:30 2026` |
| Target executable | `/Users/zvwgvx/Library/Application Support/Badlion Client/Data/zulu-8u442b06.jre/Contents/Home/bin/java` |
| Target architecture | `arm64` |
| Target SHA-256 | `74bb8cf1c45ac60041646e6e9b4c61da0cdc20b19682001d3e8421209535b700` |
| Target signing | `com.azul.zulu.java`; Developer ID team `TDTHCUPYFR`; hardened runtime `0x10000(runtime)` |
| Helper | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-macos-transport` |
| Helper architecture | `arm64` |
| Helper SHA-256 | `a504470cef1efc7473b8d63617e13a49ab1dba69e0a1b6b770809a41bcc59bab` |
| Helper size / signature | `148976` bytes; ad-hoc signed |
| Helper build provenance | Fresh arm64 build from branch `m3-general-transport-foundation`, HEAD `6a117fe961d018077dd173709b38b33af96c331c`, dirty worktree; no staged changes |

The helper was rebuilt before the probes. The same helper digest was observed
before Gates 3, 4, and every Gate 5 stage.

## Gate 3 — VM region query and read

Command:

```text
output/injector-native-transport/arm64/opus-macos-transport probe-vm-read --pid 91330
```

Observed output:

```text
[OPUS/MACOS-TRANSPORT] code=VmReadProbeReady message=pid=91330 helper_architecture=arm64 target_architecture=arm64 target=selected-pid vm_region_queries=2 selected_region_address=4328931328 selected_region_size=16384 selected_region_protection=1 bytes_requested=16 bytes_read=16 task_for_pid_return=0 mach_vm_region_recurse_return=0 mach_vm_read_overwrite_return=0 mach_port_deallocate_return=0 task_port=acquired_and_released
```

The target PID and process start time were unchanged immediately after the
probe. Gate 3 does not modify target memory.

## Gate 4 — fresh RW allocation, write, readback, deallocation

Command:

```text
output/injector-native-transport/arm64/opus-macos-transport probe-vm-rw --pid 91330
```

Observed output:

```text
[OPUS/MACOS-TRANSPORT] code=VmRwProbeReady message=pid=91330 helper_architecture=arm64 target_architecture=arm64 target=selected-pid allocation_size=16384 bytes_written=32 bytes_read=32 readback=exact_match task_for_pid_return=0 mach_vm_allocate_return=0 mach_vm_protect_return=0 mach_vm_write_return=0 mach_vm_read_overwrite_return=0 mach_vm_deallocate_return=0 mach_port_deallocate_return=0 task_port=acquired_and_released
```

The probe writes only the newly allocated target page and deallocates that
page before releasing the task port. The target PID and process start time were
unchanged immediately after the probe.

## Gate 5 — native execution handoff

Commands:

```text
output/injector-native-transport/arm64/opus-macos-transport probe-native-execution --pid 91330 --iterations 1
output/injector-native-transport/arm64/opus-macos-transport probe-native-execution --pid 91330 --iterations 3
output/injector-native-transport/arm64/opus-macos-transport probe-native-execution --pid 91330 --iterations 10
output/injector-native-transport/arm64/opus-macos-transport probe-native-execution --pid 91330 --iterations 25
```

| Iterations | Code / state | Marker | Execution | Cleanup | Target alive |
| --- | --- | --- | --- | --- | --- |
| `1` | `NativeExecutionObserved` / `ExecutionObserved` | `0x11223344 -> 0x55667788` | true | true | true |
| `3` | `NativeExecutionObserved` / `ExecutionObserved` | `0x11223344 -> 0x55667788` | true | true | true |
| `10` | `NativeExecutionObserved` / `ExecutionObserved` | `0x11223344 -> 0x55667788` | true | true | true |
| `25` | `NativeExecutionReady` / `NativeExecutionReady` | `0x11223344 -> 0x55667788` | true | true | true |

The final stage emitted:

```text
[OPUS/MACOS-TRANSPORT] code=NativeExecutionReady message=gate=5 state=NativeExecutionReady target_pid=91330 architecture=arm64 marker_before=0x11223344 expected_after=0x55667788 marker_after=0x55667788 execution_observed=true cleanup=true target_alive=true iterations_completed=25 iterations_requested=25 iteration=25/25 task_for_pid_return=0 mach_vm_protect_return=0 thread_create_running_return=0 thread_terminate_return=0 bootstrap_thread_port_deallocate_return=15 bootstrap_thread_port_released=true code_mach_vm_deallocate_return=0 data_mach_vm_deallocate_return=0 mach_port_deallocate_return=0
```

`bootstrap_thread_port_deallocate_return=15` is recorded together with
`bootstrap_thread_port_released=true` after successful thread termination.
Code and data test pages were deallocated with return `0`.

At `2026-09-11T19:33:42+0700`, the same PID and same start time were still
present:

```text
pid=91330
process_start=Fri Sep 11 19:29:30 2026
target_alive=true
```

## Scope limits

The live sequence did not request a dylib load, JNI/JVMTI/Java interaction,
Minecraft/Badlion API access, hooks, persistence, a bootstrap runtime, or
Gate 6 work.

## Owner manual sanity record — pending

`target_alive=true` proves process survival only. The project owner must
provide the following manual observations; none is inferred by this record.

| Check | Owner observation |
| --- | --- |
| Badlion UI responsive after the final Gate 5 run | Pending owner observation |
| World/game input responsive | Pending owner observation |
| Disconnect/reconnect unaffected | Pending owner observation |
| Observer and local timestamp | Pending owner observation |

## Relation to historical evidence

This record identifies PID `91330` and its exact helper and target artifacts.
It does not retroactively identify the historical Badlion PID `51238` helper
or target executable. Historical claims remain separately classified in the
[Gate 3/4 transcript backfill](m3-badlion-vm-gates-transcript-record-2026-09-11.md)
and [Gate 5 historical record](m3-badlion-native-execution-record-2026-09-11.md).
