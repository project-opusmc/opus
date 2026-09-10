# Opus Foundation Tests

The first Foundation v1 test is built and run from
`runtime-native/CMakeLists.txt`.

It uses a Java process launched by CTest and never targets a Minecraft, Lunar,
Badlion, or other third-party process.

Phase 0 also validates the existing Forge artifact baseline:

```bash
node ./scripts/check-runtime-artifact-contract.mjs
```

The release-lock contract test verifies that the active schema-v2 profile is
foundation-only, rejects a Forge-manifest requirement, and rejects a generated
payload-artifact claim before checksums and certification exist:

```bash
node ./tests/verify-release-lock.mjs
```

The M3 injector's Rust tests cover candidate selection, architecture mismatch
rejection, typed diagnostic output, preflight, private session/descriptor
validation, and selected-PID native-transport control:

```bash
cargo test --manifest-path injector/Cargo.toml
cargo clippy --manifest-path injector/Cargo.toml --all-targets -- -D warnings
./scripts/check-injector-m3-preflight.sh
```

The native macOS transport helper proves task-port access and a standard
remote dynamic-library load against a fresh, explicitly debug-authorized
OPUS target. It builds separate architecture slices, loads a purpose-built
no-JVM dylib, verifies its constructor marker, and verifies target survival:

```bash
./scripts/build-injector-native-transport.sh arm64
./scripts/build-injector-native-transport.sh x86_64
./tests/check-injector-native-transport-probe.sh
```

The next transport proof launches an independent Java process with generic
Minecraft-1.8.9 command-line evidence. That target does not call
`System.load`, expose a descriptor, or use the OPUS test fixture control
protocol. The native helper loads the actual matching `libopus-runtime.dylib`
and verifies that the JVM remains alive:

```bash
./tests/check-injector-native-runtime-load.sh
```

On Apple Silicon, the x86_64 Java 8 fixture is translated through Rosetta. Its
standard direct remote-thread path is expected to reject before runtime entry;
the following regression check verifies the typed failure, target survival,
and session cleanup. It is not an x86_64 direct-transport pass:

```bash
./tests/check-injector-x86_64-rosetta-transport-rejection.sh
```

The M3 authorized-client evidence verifier prevents the OPUS-owned test
fixture from being treated as a production integration. It validates the
format and full repeated lifecycle recorded by a future OPUS-owned or
vendor-approved opt-in client integration; it does not itself certify a
client:

```bash
node ./tests/verify-m3-client-integration-evidence.mjs
node ./scripts/verify-m3-client-integration-evidence.mjs \
  /absolute/path/to/m3-authorized-client-evidence.json
bash ./tests/check-capture-opus-owned-m3-evidence.sh
```

The native foundation check probes the selected JDK's `os.arch`, builds a
same-architecture dylib, and verifies its Mach-O slice after the JNI/JVMTI
harness passes:

```bash
./scripts/check-injector-foundation.sh
```

The owned-target lifecycle gate starts an injector-owned Java child process
with that same architecture, sends it an explicit cooperative load request,
proves native entry and the protocol handshake, then requests logical native
shutdown and repeats subsequent cycles through the native logical-restart
entry in that same JVM before a clean exit. It does not perform remote
operating-system loading into another process. The mapping, OneConfig, and
artifact handshake fields use explicit foundation-only sentinel values:

```bash
./scripts/check-injector-owned-target-harness.sh
```

The authorized-target gate starts a separate OPUS-owned Java test fixture
outside the injector. The fixture authorizes one exact local runtime path at
startup, binds only to loopback, publishes an explicit PID-bound descriptor,
and accepts capability-gated typed requests. The injector proves a
wrong-architecture rejection before the target is contacted, a recoverable
rejected unload, target health, repeated native entry, logical shutdown, and
post-unload target survival. It does not target a game client:

```bash
./scripts/check-injector-authorized-target.sh
```

Both macOS architecture slices are compile-checked separately:

```bash
./scripts/build-injector-native-slice.sh arm64
./scripts/build-injector-native-slice.sh x86_64
```

The owned x86_64 Java 8 harness proof uses the pinned, SHA-256-verified
Runtime toolchain:

```bash
OPUS_INJECTOR_JAVA_HOME="$(./scripts/provision-injector-test-jdk.sh --print-home)" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
./scripts/check-injector-foundation.sh
```

`check.sh` runs this proof automatically through:

```bash
./scripts/check-injector-x86_64-owned-target.sh
```

The same pinned x86_64 Java 8 gate also runs the authorized-target proof. Use
twenty cycles for the development stress gates:

```bash
OPUS_OWNED_TARGET_CYCLES=20 \
OPUS_AUTHORIZED_TARGET_CYCLES=20 \
  ./scripts/check-injector-x86_64-owned-target.sh
```
