# M3 Gate 5 Owner-Authorized Native Execution Record — September 11, 2026

Status: **Gate 5 cooperative implementation is `PASS`. A current,
artifact-bound Badlion run reached technical `NativeExecutionReady` on
September 11, 2026; owner UI/gameplay sanity remains pending. The historical
PID `51238` run below remains separately unresolved. This is not Gate 6,
runtime entry, JNI/JVMTI, dylib loading, client certification, or M3
completion.**

## Environment reconciliation metadata — added after audit

| Field | Value / provenance |
| --- | --- |
| SIP | `disabled`. Post-audit reconciliation metadata added 2026-09-12; not a field retained in the original command transcript. This is current development-host context for the record and does not retroactively make SIP a captured field of the historical PID `51238` session. |

## Current Badlion live run — newly observed

The project owner opened a new Badlion game session and authorized the bounded
Gate 3–5 sequence on its one selected game JVM. The Gate 5 live target was:

| Field | Observed value |
| --- | --- |
| Target PID / start | `91330` / `Fri Sep 11 19:29:30 2026` |
| Target executable / architecture | Badlion Zulu 8 `bin/java` / `arm64` |
| Target SHA-256 | `74bb8cf1c45ac60041646e6e9b4c61da0cdc20b19682001d3e8421209535b700` |
| Helper SHA-256 | `a504470cef1efc7473b8d63617e13a49ab1dba69e0a1b6b770809a41bcc59bab` |
| Gate 5 ladder | `1 -> 3 -> 10 -> 25`, with exact marker, execution observed, cleanup, and target survival at every stage |
| Final state | `NativeExecutionReady` |
| Process survival check | Same PID and start time present at `2026-09-11T19:33:42+0700` |

The raw Gate 3, Gate 4, and Gate 5 outputs, target/helper metadata, and scope
limits are retained in the
[Current Badlion Live Gates 3–5 Record](m3-badlion-live-gates-3-5-record-2026-09-11.md).

## Historical scope and selected target — PID `51238`

The OPUS project owner authorized this one-PID experiment on the designated
Apple Silicon development Mac under the containment terms of
[Decision 0007](../decisions/0007-owner-authorized-host-experiment-boundary.md).

| Field | Historical value | Provenance |
| --- | --- |
| Target PID | `51238` | Historical session record |
| Target architecture | `arm64` | Historical session record |
| Executable | Badlion-distributed Zulu 8 Java runtime under `Badlion Client/Data` | Historical session record; canonical executable path and digest were not retained for this PID |
| Game-JVM selection evidence | Badlion, Minecraft, `--gameDir`, and `--assetsDir` markers were present; launcher candidates were excluded. Raw command lines and credentials were not retained. | Historical session record |
| Helper path | `output/injector-native-transport/arm64/opus-macos-transport` | Historical session record |
| Helper SHA-256 used live | Not retained | **Unresolved** |
| Privilege actually used | The helper completed unprivileged on this host. A non-interactive `sudo` attempt was not used for the result because its credential prompt was unavailable to the agent. | Historical session record |
| PID state at reconciliation, `2026-09-11T19:04:24+0700` | No longer present | Newly observed; no process discovery fallback was used |

## Bounded mechanism — repository-observed implementation

For each iteration, `probe-native-execution`:

1. acquires the selected task port;
2. creates fresh target-owned data and code pages;
3. initializes marker `0x11223344`;
4. changes only the fresh code page to `READ | EXECUTE`;
5. starts a minimal arm64 worker through a narrow native execution handoff;
6. has that worker verify the initial marker, write `0x55667788`, publish
   completion, and return through its pthread entrypoint;
7. reads the marker back, terminates the parked bootstrap thread, deallocates
   the fresh code/data pages, releases ports and task access; and
8. confirms the selected PID still exists.

The Gate 5 branch contains no `.dylib` load request, Java/JNI/JVMTI call,
Minecraft/Badlion API access, hook, persistence, or target-memory overwrite
outside the freshly allocated test pages.

## Cooperative reproducibility — newly observed

The reconciliation removed the generated transport, runtime-slice,
foundation, Cargo, launcher-Cargo, and `runtime-java` build outputs before
building again from the current dirty worktree. Both arm64 and x86_64 native
transport builds passed.

The first fresh arm64 helper used for the explicit fixture regressions was:

```text
path=output/injector-native-transport/arm64/opus-macos-transport
architecture=arm64
sha256=668d19f09d76356187d8fd5489055f98a8eb86518620c71259fef3c989b143ed
size_bytes=148976
```

The following Opus-owned tests passed with that fresh output:

```text
./tests/check-injector-native-vm-read-probe.sh
./tests/check-injector-native-vm-rw-probe.sh
./tests/check-injector-native-direct-vm-gates.sh
./tests/check-injector-native-execution-probe.sh
```

The Gate 5 script completed its `1 -> 3 -> 10 -> 25` ladder. Its assertions
require the exact marker transition, `execution_observed=true`, `cleanup=true`,
target survival, and `NativeExecutionReady` at stage `25`.

`./scripts/check.sh` then performed another fresh transport build and passed
all of its phases, including the same Gate 3, Gate 4, direct Gate 3/4, and
Gate 5 ladder checks. Its resulting arm64 helper is a distinct, separately
recorded artifact:

```text
path=output/injector-native-transport/arm64/opus-macos-transport
architecture=arm64
sha256=325afaffe7ccdd3411e0d9710856cf0e08eeac71c01f56c46f2070d569f4bdec
size_bytes=148976
```

The two fresh-build digests must remain distinct in the evidence record. They
do not identify the historical Badlion live helper.

## Historical Badlion live execution — recorded, not newly observed

The historical selected JVM was recorded as passing the prescribed staged
progression:

| Iterations | State | Marker | Cleanup | Process alive |
| --- | --- | --- | --- | --- |
| `1` | `ExecutionObserved` | exact | true | true |
| `3` | `ExecutionObserved` | exact | true | true |
| `10` | `ExecutionObserved` | exact | true | true |
| `25` | `NativeExecutionReady` | exact | true | true |

The historical final 25-iteration event was recorded as:

```text
code=NativeExecutionReady
marker_before=0x11223344
expected_after=0x55667788
marker_after=0x55667788
execution_observed=true
cleanup=true
target_alive=true
iterations_completed=25
```

The historical record says `thread_terminate` returned `0`. The subsequent
deallocation of the
already-terminated bootstrap thread's port returned `15`
(`KERN_INVALID_NAME`), which macOS reported after termination; the helper
records that raw return while classifying the port as released. Both target
code/data-page deallocations and final task-port release returned `0`.

No separate raw terminal-output artifact, helper digest, or canonical target
executable digest was retained for this PID. Therefore:

```text
historical live helper identity: unresolved
historical Badlion live reproducibility: unresolved
```

## Limits of this result

In the historical event, `target_alive=true` means the selected JVM PID was
recorded as surviving each stage. It does not independently verify rendered
gameplay, input responsiveness, a Java-level handshake, native runtime
initialization, logical unload, reinjection, or any Badlion adapter behavior.
The clean-build cooperative result does not upgrade this historical Badlion
record into a newly reproduced live-target result.

Gate 6 remains a separate, unstarted question: bootstrap delivery and
lifecycle management. This Gate 5 record must not be used as a claim that a
runtime entered the JVM or that any client integration is supported.

## Owner manual sanity record — pending

This is a one-time, manual post-run observation only. It is intentionally
separate from the machine-observed Gate 5 result and must be completed by the
experiment owner after the final run; no value is inferred from
`target_alive=true`.

| Check | Owner observation |
| --- | --- |
| Badlion UI responsive after the final Gate 5 run | Pending owner observation |
| World/game input responsive | Pending owner observation |
| Disconnect/reconnect unaffected | Pending owner observation |
| Observer and local timestamp | Pending owner observation |

Recording these observations does not expand Gate 5, prove a Java/runtime
bridge, or change the Gate 6 boundary.
