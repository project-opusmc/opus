# Opus Injector

This directory contains the M3 Rust injector: client-neutral preflight,
diagnostics, and selected-PID native transport on macOS. The transport has a
debug-authorized arm64 Java-fixture lifecycle proof. On this Apple Silicon
host, the x86_64 Java 8/Rosetta direct path returns a typed pre-entry
rejection; normal Minecraft-client evidence remains pending.

The current binary is `opus-injector`. It provides:

- read-only discovery of client-independent Java Minecraft JVM candidates;
- sanitized candidate evidence and a non-authoritative Lunar/Badlion/Forge/
  Vanilla/unknown process hint;
- explicit PID inspection;
- Mach-O native-runtime architecture inspection;
- target/runtime architecture preflight;
- thin-Java-executable architecture corroboration for read-only preflight;
- versioned handshake-contract diagnostics; and
- selected-PID, current-user native transport through the matching
  architecture-specific macOS helper;
- PID/process-instance-bound sessions plus capability-gated health, logical
  unload, and reload control;
- a repeatable owned-JVM native-runtime lifecycle harness;
- a source-controlled, test-only JDK Attach harness; and
- an explicit, separately launched authorized-target fixture proof; and
- typed, visible diagnostics for all preflight and transport outcomes.

On macOS, `request-load` validates the explicitly selected current-user
Minecraft JVM, matching native architecture, runtime artifact, and
PID/process-instance session before the matching `opus-macos-transport`
helper requests standard dynamic loading of that one runtime. The guarded
runtime entry does nothing without the private session, then discovers the
existing JVM and publishes a loopback-only, capability-gated control
descriptor. `request-unload` is a logical runtime stop and cleanup; it does
not claim physical dylib unmapping from the target.

If macOS denies task-port access, the helper reports a typed, recoverable
failure. OPUS does not bypass that denial, use stealth/manual mapping, or
scan and modify processes in bulk. The current direct-transport proof uses a
debug-authorized arm64 OPUS Java fixture. The x86_64 Java 8/Rosetta fixture
returns `RosettaRemoteThreadUnavailable` before native entry and is cleaned up
without a stale session. Neither case is evidence that a normal Lunar,
Badlion, Forge, TLauncher, Legacy, or other game client grants the same
access.

`attach-harness` is separately restricted to the source-controlled
`AttachTargetHarness`. It uses the JDK Attach API only as a diagnostic/test
proof and records a logical stop session; it is not a production transport for
Minecraft or another Java process.

Build and test it with:

```bash
cargo test --manifest-path injector/Cargo.toml
cargo clippy --manifest-path injector/Cargo.toml --all-targets -- -D warnings
cargo run --manifest-path injector/Cargo.toml -- contract
cargo run --manifest-path injector/Cargo.toml -- runtime-info \
  --runtime output/injector-native-slices/arm64/libopus-runtime.dylib
```

For a declared architecture preflight, use an explicitly selected PID and the
architecture reported by that target JVM. A preflight is not evidence that the
runtime was loaded:

```bash
cargo run --manifest-path injector/Cargo.toml -- prepare \
  --pid <pid> \
  --target-architecture <arm64|x86_64> \
  --runtime <path-to-libopus-runtime.dylib>
```

For a selected eligible Java target with a single Mach-O architecture slice,
`prepare-auto` can derive that one architecture before performing the same
read-only runtime-slice validation:

```bash
cargo run --manifest-path injector/Cargo.toml -- prepare-auto \
  --pid <pid> \
  --runtime <path-to-libopus-runtime.dylib>
```

It rejects universal Java executables because their slices do not establish the
architecture of the running JVM; use the explicit `prepare` command with the
target JVM's `os.arch` in that case.

After the foundation gate has built the local Java classes and dylib, the
owned-JVM proof exercises native runtime entry, handshake validation, logical
shutdown, same-process logical restart, and clean process exit. It is an
injector-owned child process, not a Minecraft client or target-process
transport:

```bash
./scripts/check-injector-foundation.sh
./scripts/check-injector-owned-target-harness.sh
```

The proof validates the full protocol-v1 field set: injector, native-runtime,
and Java-runtime versions; target architecture; mapping schema; OneConfig
adapter; and artifact state. In this foundation-only gate, the last three use
the explicit sentinels `not-applicable`, `not-loaded`, and `not-packaged`;
they are not a claim that mappings, OneConfig, or payload artifacts are ready.
The Java runtime version is also deliberately `not-built` until a real
`opus-runtime.jar` is packaged and loaded.

The independently launched fixture gate verifies the selected target PID
against the local process table, then uses a loopback-only endpoint, a fixture
capability, native-architecture validation, typed state frames, a recoverable
architecture-mismatch rejection, a recoverable unload error check, and
repeated load → health → unload → health cycles:

```bash
./scripts/check-injector-authorized-target.sh
```

Its command surface is intentionally fixture-specific:

```bash
opus-injector authorized-target load --descriptor <authorized-target.properties> \
  --runtime <libopus-runtime.dylib>
opus-injector authorized-target health --descriptor <authorized-target.properties> \
  --expect-state <waiting|running|stopped>
opus-injector authorized-target unload --descriptor <authorized-target.properties>
opus-injector authorized-target stop --descriptor <authorized-target.properties>
```

This is evidence for an opt-in OPUS-owned test target only. It is not a
transport for Lunar, Badlion, Forge, TLauncher, Legacy, or any other
third-party client.

The `opus-owned-client` command targets only the source-controlled,
developer-only OPUS-owned M3 preview bootstrap. It uses the same explicit
descriptor and capability boundary, but the target self-loads one runtime
path authorized by its private launch configuration:

```bash
opus-injector opus-owned-client health --descriptor <opus-owned-m3-target.properties> \
  --expect-state <waiting|running|stopped>
opus-injector opus-owned-client load --descriptor <opus-owned-m3-target.properties> \
  --runtime <libopus-runtime.dylib>
opus-injector opus-owned-client unload --descriptor <opus-owned-m3-target.properties>
opus-injector opus-owned-client stop --descriptor <opus-owned-m3-target.properties>
```

Use the developer-only launcher and evidence capture procedure in
[`docs/opus-owned-m3-preview.md`](../docs/opus-owned-m3-preview.md). A preview
capture derives its target version and client-build digest from the validated
private launch configuration; it is review evidence, not a declaration that M3
or any external client adapter is complete.

The injector owns no Minecraft feature, mapping, UI, module, or gameplay
logic. Stealth, manual mapping, anti-detection, and screenshare-evasion
mechanisms are outside the OPUS scope.
