# Injector Native Architecture Contract

Status: **Phase 0 architecture contract — target-client proof pending**

The native runtime must match the architecture of the Java process that will
load it. The host CPU is not the selector.

## Current matrix

| JVM process | Native artifact | Status | Meaning |
| --- | --- | --- | --- |
| macOS `x86_64`, Java 8 under Rosetta | `libopus-runtime.dylib` (`x86_64`) | Owned/cooperative proofs; direct remote-thread transport rejected on this Apple Silicon host | The Launcher intentionally uses an `x86_64` game JVM under Rosetta. A same-architecture helper can acquire its task port, but standard remote-thread creation returns the typed `RosettaRemoteThreadUnavailable` result. This is not direct-transport support or client certification. |
| macOS `arm64`, controlled JVM | `libopus-runtime.dylib` (`arm64`) | Harness, authorized-fixture, and 20-cycle direct-transport fixture proof | The direct proof validates standard selected-PID transport plus JNI/JVMTI lifecycle in a debug-authorized Java fixture; it does not certify a game client. |
| macOS universal | Universal dylib | Not selected | May be distributed only after one same-architecture JVM proof per slice. |

`arm64` is not interchangeable with `x86_64`, even on an Apple Silicon Mac.
The currently installed system JDKs are arm64, so they cannot certify the
current `x86_64` Forge game JVM.

## Selection and rejection rules

1. Read the target JVM's `os.arch` and normalize `amd64`/`x86_64` to
   `x86_64`, and `aarch64`/`arm64` to `arm64`.
2. Select only the native artifact built for that normalized architecture.
3. Reject a missing, unknown, or mismatched architecture before any
   target-runtime load request.
4. Do not treat a controlled-JVM result as proof for Lunar, Badlion, Forge, or
   another game client.

`runtime-native/CMakeLists.txt` exposes
`OPUS_RUNTIME_TARGET_ARCH=auto|arm64|x86_64|universal`. It no longer assumes
that every macOS target is arm64.

## Evidence commands

The controlled-JVM proof selects the architecture of its own JDK, builds the
matching dylib, runs a Java 8-bytecode-compatible JNI/JVMTI test, and verifies
the Mach-O architecture:

```bash
./scripts/check-injector-foundation.sh
```

Both native slices can be compiled and checked independently:

```bash
./scripts/build-injector-native-slice.sh arm64
./scripts/build-injector-native-slice.sh x86_64
```

Slice compilation proves that the artifact can be built. It is not a
substitute for loading that slice into a same-architecture JVM.

To provision the exact checksum-locked x86_64 Java 8 test JDK already used by
the Runtime build lane, run:

```bash
./scripts/provision-injector-test-jdk.sh
```

It reads `runtime/legacy/1.8.9/client/toolchain.lock`, verifies the archive
SHA-256, and writes only below ignored `output/injector-test-toolchains/`.

The regular M3 check runs the pinned JDK proof automatically:

```bash
./scripts/check-injector-x86_64-owned-target.sh
```

It compiles the matching x86_64 dylib, runs the controlled JNI/JVMTI proof,
then performs three cooperative owned-target load → handshake → unload → exit
cycles in one JVM, followed by the separately launched authorized-target
fixture's typed load → health → unload → health cycles. Both use a logical
native restart after the first shutdown. They are architecture and lifecycle
proofs only. They do not target, inject into, or modify a Minecraft client.

## Current Phase 0 result

Both `arm64` and `x86_64` Mach-O slices build from the same source and are
verified with `lipo`. The arm64 controlled-JVM proof passes. The pinned
Temurin `8u502-b07` x86_64 Java 8 gate also compiles Java 8 bytecode, passes
the controlled JNI/JVMTI lifecycle proof, and runs both the three-cycle
cooperative owned-target same-process lifecycle proof and the separately
launched authorized-target survival proof with an x86_64 dylib.

The same gate accepts `OPUS_OWNED_TARGET_CYCLES=20` and
`OPUS_AUTHORIZED_TARGET_CYCLES=20` for development lifecycle stress proofs.

This satisfies `ARCH-001` for owned-JVM architecture selection and loading. It
does not certify Lunar, Badlion, Forge, TLauncher-launched instances, or any
other game client; those remain adapter-certification gates.

## Native macOS transport prerequisite

`injector-native/` contains the small architecture-specific
`opus-macos-transport` helper. Its initial `probe` command makes no change to
the selected process: it verifies that a helper built for the target
architecture can obtain and immediately release a macOS task port for an
explicit current-user PID.

```bash
./scripts/build-injector-native-transport.sh arm64
./scripts/build-injector-native-transport.sh x86_64
./tests/check-injector-native-transport-probe.sh
```

The integration target is an ad-hoc signed OPUS debug executable with an
explicit `get-task-allow` entitlement. The test first probes and releases its
task port, then loads a purpose-built no-JVM dylib that writes one PID-bound
marker from its constructor. That proves the standard dynamic-loader request
and target survival without pretending a hardened third-party game process
grants the same access. It is not a `libopus-runtime.dylib` JVM proof, client
certification, or workaround for an operating-system denial. A failed probe is
a typed, recoverable macOS permission result; OPUS does not bypass it.

`tests/check-injector-native-runtime-load.sh` then runs a separate
non-cooperative Java process with generic Minecraft-1.8.9 command-line
evidence. The process does not call `System.load`, expose an OPUS fixture
descriptor, or cooperate with the loader. The Rust injector writes a
PID-/process-instance-bound private session, the architecture-matched helper
requests standard `dlopen` for the actual `libopus-runtime.dylib`, and the
dylib's guarded post-load entry discovers the existing JavaVM, attaches,
publishes a capability-gated loopback descriptor, and completes three
load → handshake → unload → stopped → reload cycles while the JVM remains
alive.

On this Apple Silicon host, the arm64 fixture has passed twenty direct
load/handshake/unload/reload cycles. The pinned x86_64 Java 8 fixture runs
under Rosetta: its helper can acquire and release the selected task port, but
macOS rejects standard remote-thread creation before native entry. The
injector maps that result to `RosettaRemoteThreadUnavailable`, verifies target
survival, and removes the private pending session:

```bash
./tests/check-injector-x86_64-rosetta-transport-rejection.sh
```

That check is a negative architecture/host boundary, not an x86_64 direct
transport proof and not a reason to add a bypass.

`dlopen` does not invoke `JNI_OnLoad`; the guarded native constructor is the
separate post-load entry path. It does nothing without a valid private session.
The arm64 result is direct native transport and lifecycle evidence for the
debug-authorized OPUS Java fixture, not a workaround for an operating-system
denial or a Lunar, Badlion, Forge, TLauncher, Legacy, or other client
certification.
