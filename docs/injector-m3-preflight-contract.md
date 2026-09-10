# M3 Injector Preflight Contract

Status: **implemented M3 General target discovery/preflight, guarded
selected-PID native transport on macOS, owned-JVM lifecycle proof, and
debug-authorized non-cooperative Java-fixture transport proof — normal
Minecraft-client evidence is still pending**

The `injector/` Rust crate is the M3 entry boundary for OPUS. Its current role
is to make target selection, architecture checks, protocol expectations, and
failures explicit before any future transport work is considered.

## M3 General objective

The intended M3 production boundary is **client-independent Minecraft JVM
transport**, not a Lunar-only injector. A selected Minecraft JVM must not need
to identify as Lunar, Badlion, Forge, or Vanilla before the native runtime
handshake begins. The current preflight emits a non-authoritative process
client hint for diagnostics; authoritative client detection and
client-specific mappings happen after runtime entry, through later adapter
gates.

The complete contract, current limitations, and exact completion evidence are
defined in [M3 General](m3-general-objective.md). This file describes the
implementation currently in `injector/`; it does not claim that M3 is complete
or that a normal third-party game client has accepted transport.

## What the binary does

`opus-injector` can:

- inspect the local process table without changing process state;
- list explicit Java commands that identify a Minecraft JVM without requiring
  a Lunar/Badlion/Forge/Vanilla label;
- require a selected generic preflight/load/unload target to belong to the
  current OS user before proceeding;
- expose a non-authoritative client hint and sanitized candidate evidence
  separately from target eligibility;
- distinguish an open Lunar desktop shell from an eligible Java game JVM;
- inspect the Mach-O slices in a local `libopus-runtime.dylib`;
- validate that an explicitly declared target JVM architecture is represented
  by that dylib;
- derive a target architecture from a selected Java executable only when that
  executable has exactly one supported Mach-O slice;
- report the protocol-v1 handshake fields; and
- create a private PID/process-instance-bound session for an explicitly
  selected current-user Minecraft JVM;
- select an architecture-matched macOS transport helper and request the
  standard runtime load path for that one target;
- validate the guarded native runtime's versioned ready handshake and
  capability-gated loopback control descriptor;
- request typed health, logical unload, and logical reload operations after
  runtime entry; and
- prove a PID-bound, loopback-only, capability-gated lifecycle against the
  OPUS authorized-test-target fixture; and
- return typed, prefixed diagnostics.

All output uses the team-standard `[OPUS/INJECTOR]` prefix.
Read-only process reports include only PID, parent PID, and executable name;
they do not echo raw JVM arguments that may contain credentials or session
material.

When `inspect` sees Lunar's desktop shell but no explicit Java Minecraft
candidate, it emits `LunarLauncherOpenNoGameJvm`. That is a read-only
readiness diagnostic: start an authorized game session and rerun `inspect`;
the launcher shell itself is not an injection target.

Current discovery uses the client-independent `MinecraftJvmCandidate` model.
Its process-side `client_hint` is intentionally non-authoritative: it does not
replace post-entry runtime detection, classloader proof, mappings, or adapter
certification.

The root integration gate builds both native slices and exercises the compiled
binary against them:

```bash
./scripts/check-injector-m3-preflight.sh
```

## Owned-target lifecycle proof

The following two gates prove the complete lifecycle of an
injector-owned Java child process:

```bash
./scripts/check-injector-foundation.sh
./scripts/check-injector-owned-target-harness.sh
```

The harness starts a same-architecture JVM and waits for an explicit,
cooperative `load <absolute-runtime-path>` request from the injector. The
target then loads its local `libopus-runtime.dylib`, validates JNI/JVMTI
readiness, emits the protocol-v1 ready handshake, accepts a logical shutdown
request, and exits cleanly. Its ready, unload, and exit frames validate the
complete injector handshake field set. The foundation-only values for mapping
schema, OneConfig adapter, and artifact checksums are explicitly
`not-applicable`, `not-loaded`, and `not-packaged`; they are not runtime
certification claims. The same owned JVM remains alive across all three default
CI cycles: the first cycle loads the dylib and later cycles use the explicit
native logical-restart entry after a clean shutdown. That is not an
operating-system dylib unload/reload.

Until a real `opus-runtime.jar` exists, the handshake must also report
`javaRuntimeVersion=not-built`. That sentinel means no Java payload has been
loaded; it must not be changed to a release version merely because the native
foundation has reached `READY`.

## Test-only JDK Attach harness

The separate diagnostic proof is:

```bash
./scripts/check-injector-attach-harness.sh
```

`opus-injector attach-harness` is intentionally restricted to the
source-controlled `AttachTargetHarness`, checks current-user ownership and
process-instance identity, and uses the JDK Attach API only to exercise the
native runtime foundation. Its `unload` operation is a recorded logical stop;
it does not claim OS-level dylib unloading. This command is not a production
Minecraft transport and must not be generalized to arbitrary Java processes.

On macOS Temurin Java 8, the Attach API can return
`AgentLoadException: Failed to load agent library: 0` after `Agent_OnAttach`
has completed successfully. The harness reconciles only that exact completion
quirk, and only after it validates the capability-bound report's PID,
operation, architecture, and complete handshake. All other Attach helper
failures remain failures.

For the development stress proof, run all twenty lifecycle cycles in the
pinned x86_64 Java 8 target:

```bash
OPUS_OWNED_TARGET_CYCLES=20 \
  ./scripts/check-injector-x86_64-owned-target.sh
```

The injector command behind that gate is:

```text
opus-injector owned-harness --java <java> --classpath <classes-dir> \
  --runtime <libopus-runtime.dylib> \
  --target-architecture <arm64|x86_64> [--cycles <1..20>]
```

It reports separate `OwnedTargetLoadProof` and `OwnedTargetUnloadProof`
diagnostics. This is a cooperative owned-target transport and lifecycle proof
only: it does not prove remote operating-system library loading, OS-level
dylib unload, a live Minecraft client, or a Lunar/Badlion adapter.

## Separately launched authorized-target proof

The following gate tests a target process that is launched independently from
the injector:

```bash
./scripts/check-injector-authorized-target.sh
```

The Java 8 fixture is intentionally narrow:

1. it starts with one canonical `--allowed-runtime` path and cannot load a
   different path;
2. it listens only on `127.0.0.1`;
3. it writes an explicit descriptor containing its PID, loopback port,
   architecture, and a test capability;
4. before connecting, the injector verifies that the selected PID is a live
   `AuthorizedRuntimeTarget` JVM in the local process table;
5. every request must repeat the selected PID and architecture and present the
   descriptor capability;
6. it returns protocol-v1 handshake data plus typed state and result code; and
7. it removes its descriptor after a clean explicit stop.

The proof first verifies that the independently running target is healthy,
attempts to use the opposite Mach-O architecture slice and verifies that the
injector rejects it before sending a target request, then proves that the
target remains healthy. It also issues an intentionally invalid unload request
and checks that the typed rejection is recoverable, then repeats:

```text
load -> native entry -> READY handshake -> health(running)
     -> unload -> health(stopped)
```

The injector command surface is fixture-specific:

```text
opus-injector authorized-target load --descriptor <authorized-target.properties> --runtime <libopus-runtime.dylib>
opus-injector authorized-target health --descriptor <authorized-target.properties> [--expect-state <waiting|running|stopped>]
opus-injector authorized-target unload --descriptor <authorized-target.properties>
opus-injector authorized-target stop --descriptor <authorized-target.properties>
```

This is target-process lifecycle and survival evidence for an OPUS-owned,
opt-in test target. It is not a generic IPC loader, OS-level dynamic-library
injection mechanism, OS-level dylib unload, live Minecraft client proof, or
Lunar/Badlion adapter.

## Current selected-PID native transport

The direct control surface is:

```text
opus-injector request-load --pid <pid> --target-architecture <arm64|x86_64> --runtime <libopus-runtime.dylib>
opus-injector request-health --pid <pid>
opus-injector request-unload --pid <pid>
opus-injector request-stop --pid <pid>
```

`request-load` first repeats all M3 preflight gates: explicit PID,
current-user ownership, Minecraft-JVM evidence, target-process identity,
matching runtime architecture, and a canonical runtime path. It writes a
private 0600 session tied to that process instance, then invokes only the
matching native helper. The runtime's guarded post-load entry refuses to run
without that session; on success it publishes a loopback-only descriptor with
an unprinted capability. `request-health`, `request-unload`, and reload after
`stopped` use that capability-gated descriptor, not a client-specific Java
interface.

`request-unload` is a logical runtime lifecycle operation: it stops
runtime-owned work, releases runtime-owned JNI state, and reports `stopped`.
It does not claim that macOS has physically unmapped the dylib. `request-stop`
is only for closing a stopped test control session and must not be used before
a desired reload.

The positive direct test is currently arm64. On this Apple Silicon host, the
pinned x86_64 Java 8 fixture runs under Rosetta: task-port acquisition succeeds
but standard remote-thread creation is rejected before native entry. The
injector reports `RosettaRemoteThreadUnavailable`, keeps the target alive, and
removes its pending private session. It is a typed architecture/host boundary,
not x86_64 direct-transport support:

```bash
./tests/check-injector-x86_64-rosetta-transport-rejection.sh
```

The helper can still receive a macOS task-port denial from a selected normal
client. That denial is a typed, recoverable result; OPUS does not bypass
client or operating-system protection, use stealth/manual mapping, or broaden
the operation beyond the selected current-user PID.

The passing arm64 direct-transport test currently uses a debug-authorized,
non-cooperative OPUS Java fixture with generic Minecraft-1.8.9 command-line
evidence. It proves native load, entry, handshake, health, logical unload,
reload, and target survival. It does not certify Lunar, Badlion, Forge,
TLauncher, Legacy, or another normal Minecraft client.

## Architecture rule

`prepare` receives an explicit target architecture. That value must ultimately
come from the selected target JVM's `os.arch`, normalized as:

```text
amd64 / x86_64 -> x86_64
aarch64 / arm64 -> arm64
```

The command proves only that the local dylib contains a matching Mach-O slice.
It does not prove the process architecture, select an adapter, or certify a
Minecraft client.

`prepare-auto --pid <pid> --runtime <path>` is a read-only convenience for a
selected eligible JVM whose executable is a thin Mach-O binary. It derives the
architecture only when `lipo -archs <java-executable>` reports exactly one
supported slice, then performs the same local runtime-slice validation as
`prepare`. It does not attach to or modify the JVM. A universal Java executable
is deliberately rejected: its file slices do not prove the architecture of the
running process, so the caller must use `prepare` with the normalized
`os.arch` reported by the target JVM.

## M3 exit evidence still required

Before M3 General can be marked complete, a selected, authorized target must
demonstrate:

```text
explicit selection
    ->
same-architecture runtime request
    ->
native runtime entry
    ->
versioned handshake
    ->
typed load status
    ->
typed unload status
    ->
repeatable clean lifecycle
```

The owned-target harness covers the same-JVM lifecycle protocol through clean
child exit. The authorized-target fixture now additionally proves explicit
PID selection, runtime-architecture validation, runtime entry, versioned
handshake, typed load/unload status, recoverable failure handling, repeated
lifecycle, and target survival outside the injector process.

## Authorized-client evidence gate

The future production integration must produce a non-fixture capture that
passes [the M3 authorized-client evidence contract](protocol/m3-authorized-client-integration-evidence.md).
It records launcher-bound client-build/runtime identities plus at least three
complete health → load → health → unload → health cycles. The contract rejects
the OPUS test harness and any unbounded process transport; passing its
structural verifier is necessary but not sufficient for M3 completion.

That evidence gate constrains who may be used for a live proof. It does not
make Lunar a transport prerequisite or change the M3 General goal of
client-independent target discovery and post-entry classification.

## OPUS-owned preview target

The source-controlled OPUS-owned preview target is the next live integration
step. It is launched only through the debug-only `opus-owned-m3-preview`
launcher feature, starts a private loopback endpoint before delegating to the
unchanged Forge bootstrap, and self-loads one SHA-256-authorized runtime after
a capability-gated request. Its launcher procedure and evidence-capture tool
are documented in [opus-owned-m3-preview.md](opus-owned-m3-preview.md).

This is still a developer preview, not a normal Launcher UI path, a generic
injector, an OS-level dylib loader, or evidence of third-party-client support.

M3 is still not complete as a production client-loader milestone. A
supported, explicitly authorized client integration must still demonstrate
the same evidence without relying on the test fixture. Lunar, Badlion, Forge,
and other 1.8.9 runtimes remain uncertified until their later adapter gates
pass.
