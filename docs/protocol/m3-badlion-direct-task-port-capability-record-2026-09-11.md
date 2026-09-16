# M3 Owner-Authorized Direct Task-Port Capability Record — September 11, 2026

Status: **capability available under the recorded conditions; not transport
entry, runtime readiness, lifecycle proof, client certification, or M3
completion**

This is the retained containment record required by
[Decision 0007](../decisions/0007-owner-authorized-host-experiment-boundary.md).
It is deliberately not an
[M3 Authorized Client Integration Evidence](m3-authorized-client-integration-evidence.md)
capture: that schema represents only cooperative OPUS-owned or vendor-approved
paths, while this observation used a single owner-authorized, privileged
selected-PID probe.

## Authority and scope

| Field | Recorded value |
| --- | --- |
| Experiment owner | OPUS project owner |
| Host | Owner-controlled Apple Silicon development Mac, `arm64`, macOS `26.6` |
| Host security state | System Integrity Protection was reported **disabled** by `csrutil status` before the probe. This is an observed condition, not proof that disabling SIP was necessary or sufficient for the result. |
| Intended target | Current-user Java game JVM, PID `4578`, launched at `2026-09-11T12:09:14+0700`; executable path was under `Badlion Client/Data/zulu-8u442b06.jre`. The path is a runtime/client hint only; this record makes no Badlion adapter or compatibility claim. |
| Test window | Bounded by target launch at `2026-09-11T12:09:14+0700` and record capture at `2026-09-11T12:23:00+0700`. The retained terminal transcript places the probe inside that window but does not contain a more precise wall-clock timestamp. |
| Actual mechanism scope | One explicitly named current-user PID. No launch-wide, host-wide, daemon, service, or bulk-process mechanism was used. |
| Privilege boundary | The owner invoked the named helper through `sudo` in the owner's Terminal. Codex did not receive, retain, or use the owner's password. |

## Identified artifacts

| Artifact | Observation |
| --- | --- |
| Target executable | `Mach-O 64-bit executable arm64`; SHA-256 `74bb8cf1c45ac60041646e6e9b4c61da0cdc20b19682001d3e8421209535b700` |
| Target signing | Identifier `com.azul.zulu.java`; Developer ID team `TDTHCUPYFR`; hardened-runtime flag `0x10000(runtime)` |
| Target entitlements observed | `com.apple.security.cs.allow-dyld-environment-variables`, `allow-jit`, `allow-unsigned-executable-memory`, `cs.debugger`, `disable-library-validation`, and `device.audio-input`. No conclusion about the causal role of any individual entitlement is made here. |
| Opus helper | `output/injector-native-transport/arm64/opus-macos-transport`; thin `arm64`, ad-hoc signed (`flags=0x2`), SHA-256 `d16b963a92f8f62f2afe66d1c52737aea6618ed6b44da21d89c4a8bbfff81cbe` |

The workspace was dirty at capture time. The helper digest, rather than the
current Git revision, is therefore the authoritative identity for this
observation.

## Measured result

The project owner executed the following **probe-only** helper operation against
the selected PID. The retained output was:

```text
[OPUS/MACOS-TRANSPORT] code=TaskPortProbeReady
message=pid=4578 helper_architecture=arm64 target_architecture=arm64
task_port=acquired_and_released
```

The selected `probe` branch validates target/helper architecture, obtains the
Mach task port with `task_for_pid`, and releases that port. It does not invoke
the helper's `load` branch. No runtime path was supplied; no dylib load,
remote-memory write, remote thread, protocol handshake, logical unload, or
reinjection was requested.

The owner also observed that a separate `sudo lldb` attach pauses the game
while the debugger owns the process and that exiting LLDB with `Ctrl-D` returns
the game to normal operation. After the Opus probe, local process inspection
reported the target as present and sleeping/runnable (`S`). This is survival
evidence for the probe only; it is not a runtime-lifecycle test.

## Result classification

```text
capability:         AVAILABLE
transport entered:  NOT TESTED
runtime ready:      NOT TESTED
lifecycle proven:   NOT TESTED
```

This proves that the recorded `sudo` invocation of the recorded arm64 Opus
helper acquired and released a task port for this exact PID on this host. It
does **not** isolate the relative effect of root privilege, the disabled-SIP
host configuration, the target build/signature, or other host policy. It must
not be generalized to unprivileged Opus operation, another PID, Lunar, another
Badlion build, an arbitrary Minecraft client, or a client adapter.

## Containment, rollback, and non-target impact

- The experiment installed no daemon, service, MIP component, or persistent
  host-wide loader.
- It did not re-sign, modify, suspend, or replace the target executable.
- The probe released the acquired task port and left no Opus session,
  descriptor, runtime payload, or target-side control endpoint.
- The owner, not this record, remains responsible for the host SIP state and
  any later restoration decision.
- No credentials, game command lines, session tokens, or account data are
  retained in this record.

## Consequence for M3 planning

Direct selected-PID transport is now a measured candidate on this host under a
manually owner-mediated privilege boundary. The next M3 gate remains a
controlled, OPUS-owned runtime lifecycle proof:

```text
same-architecture runtime entry
    -> versioned handshake
    -> logical unload
    -> clean reinjection
    -> target survival
```

No third-party-client runtime load is authorized, implied, or recorded by this
capability probe. MIP remains a separately evaluated early-launch fallback; it
is not established or required by this record.
