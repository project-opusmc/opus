# Opus Foundation Tests

> **Frozen R&D test-document notice — September 15, 2026:** these are retained
> injector/Foundation test contracts and historical evidence procedures. The
> active product mainline is Opus Client + Opus Launcher, UI first, under
> [Decision 0008](../docs/decisions/0008-opus-client-launcher-ui-first-mainline.md).
> Do not treat the commands below as authorization for a new live-target,
> transport, or Gate execution while the injector lane is frozen.

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

Before the remote-load fixture, the cooperative VM Gate harness provides
independent, test-only Gate 3 and Gate 4 proofs. A participating target
publishes a private descriptor bound to its PID, canonical executable,
process-instance start time, session nonce, and explicitly granted
capabilities. The full contract is
[M3 Cooperative VM Gate Harness](../docs/protocol/m3-cooperative-vm-gate-harness.md).

For Gate 3, start a target that grants `vm_read` and publishes one public fixed
marker:

```bash
./output/injector-native-transport/arm64/opus-task-port-probe-target \
  --seconds 120 \
  --publish-vm-read-marker
```

Then run the reader with that exact target PID in another terminal:

```bash
./output/injector-native-transport/arm64/opus-task-port-vm-read-probe \
  --pid <opus-owned-target-pid>
```

The reader verifies the selected process against the target-published identity,
reads only the target-published eight-byte public marker, and accepts no
caller-supplied address, runtime path, or arbitrary memory-read input. The
automated form of the same independent-process proof is:

```bash
./tests/check-injector-native-vm-read-probe.sh
```

For Gate 4, start the same controlled target with the separate `vm_rw`
capability:

```bash
./output/injector-native-transport/arm64/opus-task-port-probe-target \
  --seconds 120 \
  --allow-vm-rw-probe
```

Then run:

```bash
./output/injector-native-transport/arm64/opus-task-port-vm-rw-probe \
  --pid <cooperative-target-pid>
```

That probe allocates one target page, sets data-only `READ | WRITE`
protection, writes a fixed-size nonce-derived pattern, verifies the readback,
deallocates the page, and releases the task port. It has no executable-memory,
remote-thread, or dylib-loading path. Its automated check is:

```bash
./tests/check-injector-native-vm-rw-probe.sh
```

The existing `opus-macos-transport` helper also has direct, selected-PID
diagnostic commands for an owner-authorized target. They do not accept an
address, byte payload, runtime path, or execution request. The operator must
provide the target PID manually and remain responsible for selecting an
authorized target:

```bash
sudo ./output/injector-native-transport/arm64/opus-macos-transport \
  probe-vm-read --pid <explicit-target-pid>

sudo ./output/injector-native-transport/arm64/opus-macos-transport \
  probe-vm-rw --pid <explicit-target-pid>
```

`probe-vm-read` obtains the task port, enumerates VM regions, reads sixteen
bytes from one readable non-executable region, then releases the task port
without writing target memory. `probe-vm-rw` allocates one new page, applies
only `READ | WRITE` protection, writes a fixed 32-byte data pattern, verifies
the exact readback, deallocates that page, and releases the task port. It does
not create executable pages, a remote thread, or a dylib load request.

`check-injector-native-direct-vm-gates.sh` regression-tests those helper
commands against a fresh OPUS-owned target; this is a code-path test and not a
substitute for a separately recorded live-target result.

```bash
./tests/check-injector-native-direct-vm-gates.sh
```

Gate 5 is a separate native-execution handoff probe. It accepts only an
explicit target PID and a bounded iteration count; it does not accept a
runtime path, marker value, target address, Java request, or payload input.

```bash
./output/injector-native-transport/arm64/opus-macos-transport \
  probe-native-execution --pid <explicit-target-pid> --iterations 1
```

The helper uses fixed marker values `0x11223344` and `0x55667788`. It creates
fresh data/code pages, gives only the fresh code page `READ | EXECUTE`
protection, runs the minimal arm64 routine, verifies the marker, deallocates
both pages, and releases task access. It contains no dylib load, Java,
JNI/JVMTI, Minecraft API, hook, or persistence path.

`iterations` is restricted to `1..50`. Output is `ExecutionObserved` below
25 clean iterations and `NativeExecutionReady` at 25 or more. The regression
ladder is deliberately staged rather than starting at a large count:

```bash
./tests/check-injector-native-execution-probe.sh
```

The retained owner-authorized live result is
[Gate 5 Native Execution Record](../docs/protocol/m3-badlion-native-execution-record-2026-09-11.md).

Gate 6 is a pure-native bootstrap lifecycle proof in an Opus-owned arm64 host
only. It does not select a JVM or third-party process. The host uses ordinary
in-process dynamic loading to resolve the versioned `opus-bootstrap.dylib`
start/stop ABI, verifies a nonce-derived handshake and deterministic stop/
cleanup acknowledgements, then records raw witnesses under
`output/m3-gate-6/<run-id>/`.

```bash
./tests/check-injector-native-bootstrap-lifecycle.sh
```

The staged `1 -> 3 -> 10 -> 25` ladder reports `BootstrapLoadObserved` before
the final stage and `BootstrapLoadReady` at stage 25. Its evidence includes
artifact SHA-256 and architecture metadata, code-signing/install-name/export
tool output, JSONL lifecycle events, per-stage stdout/stderr, cleanup status,
and a checksum manifest. It does not prove dylib delivery to Badlion, JNI,
JVMTI, Java, Minecraft APIs, mappings, hooks, or a Gate 7 bridge.

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

`probe-native` is the explicit read-only capability check used before that
load path. It validates the selected current-user Minecraft JVM and matching
helper architecture, requests a task port and immediately releases it, then
reports either `CAPABILITY_AVAILABLE` or
`UNSUPPORTED_TARGET_CONFIGURATION`. Code-signing fields are diagnostic-only:
they do not substitute for the probe result.

For lifecycle stress development, run the target-survival proof repeatedly.
Each round records the target's RSS before and after its in-process
load/unload/reload cycles. The RSS value is an observation for review, not by
itself a proof that no memory leak exists:

```bash
OPUS_NATIVE_TRANSPORT_STRESS_CYCLES=20 \
OPUS_NATIVE_TRANSPORT_STRESS_ROUNDS=3 \
  ./tests/check-injector-native-transport-stress.sh
```

The LLDB path is a bounded development-only attach-and-detach availability
probe. It is tested only against the source-controlled Java harness and
explicitly rejects a general process PID before LLDB starts:

```bash
./tests/check-injector-lldb-development-harness.sh
```

`probe-jvm-attach` is different: it runs only the bounded `jcmd <pid>
VM.version` capability query on one explicit current-user Minecraft JVM. It
does not load an agent. Its result is diagnostic-only and must not be inferred
from a command-line flag:

```bash
./tests/check-injector-jvm-attach-capability-probe.sh
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
