# Opus Injector Runtime-Payload Migration Plan

- Status: **proposed migration plan — no production cutover yet**
- Created: **2026-09-08**
- Architecture authority: `OPUS_INJECTOR_TECHNICAL_SPEC.md`
- Current-release baseline: [`architecture.md`](architecture.md),
  [`protocol/runtime-artifacts.md`](protocol/runtime-artifacts.md), and the
  pinned `launcher/` and `runtime/` submodules.

## Decision

OPUS will not be rewritten as a native client. It will be migrated in stages
from the current Forge-started Java integration to this payload model:

```text
Opus Launcher / Host
        |
        v
Opus Injector                 Rust transport and diagnostics only
        |
        v
libopus-runtime.dylib         C++17 JVM/native lifecycle boundary
        |
        v
opus-runtime.jar              Java 8-compatible high-level payload
        |
        +-- Minecraft API and event bus
        +-- module SDK
        +-- OneConfig compatibility shim
        +-- OneConfig-backed config/UI
        `-- OPUS features
```

The injected Java payload becomes the feature runtime. The injector does not
become the mod, and `libopus-runtime.dylib` does not become the module/UI
implementation.

The existing Forge lane remains the production baseline until an explicit
cutover gate passes. No existing Launcher or Runtime artifact is removed as
part of the early migration phases.

## Scope and non-goals

This plan covers the code and artifact migration needed to support the
injector/runtime/payload architecture.

It does not authorize:

- a big-bang rewrite of Launcher or Runtime;
- moving Java feature code into C++ or Rust;
- replacing OneConfig with a custom UI framework;
- copying third-party source outside its approved license/disposition;
- stealth, manual mapping, anti-detection, competitive automation, or
  gameplay automation; or
- changing a user’s existing game installation during a migration test.

Target-process transport is a separately gated M3 concern. This document
defines its surrounding contracts and acceptance requirements; it is not an
implementation guide for process-control mechanisms.

## Current baseline: what exists today

The planned payload must be based on the actual codebase, not on an assumed
blank starting point.

| Area | Current concrete implementation | Migration disposition |
| --- | --- | --- |
| Launcher | Rust workspace (`launcher/`) owns verification, isolated instances, Java discovery, and Forge launch planning. | Retain. Add a new immutable payload/runtime artifact contract only after its gate passes. Do not merge Minecraft feature code into Launcher. |
| Game startup | `ForgeBootstrapMain` reads the bounded stdin launch protocol and starts Forge `LaunchWrapper`. | Retain as the legacy release path. Do not repurpose it as the injected payload entry point. |
| Core lifecycle | `OpusCore`, `LifecycleStage`, and `ClientTelemetry` provide Java 8 lifecycle/diagnostic behavior. | Extract only platform-neutral portions behind payload interfaces. Keep current Forge adapters until replacement evidence exists. |
| Forge coremod | `OpusLoadingPlugin`, `OpusForgeClassTransformer`, and the ASM patch chain run under Forge. | Keep as an isolated legacy compatibility lane. Migrate a responsibility only when the new native/game-thread bridge replaces it; do not port the whole transformer chain by default. |
| Native UI Forge mod | `OpusNativeUiMod` owns FML initialization, Forge event subscriptions, Right Shift, OneConfig routing, and Elementa shell routes. | Split by responsibility. Reuse owned Java models and diagnostics where compatible; replace FML lifecycle/event ownership with the payload bridge. |
| OneConfig | Frozen legacy OneConfig fork, separately packaged and checksum-locked. | Required production config/UI dependency if late-bootstrap compatibility passes. Its licensing/release gate remains open. |
| Elementa/UniversalCraft | Existing Java shell/UI dependency lane, separately packaged and verified. | Deferred from the first payload vertical slice. It must not substitute for the required OneConfig gate. |
| Quarantined legacy client | `runtime/legacy/1.8.9/client/` contains retired CEF/web UI research. | Do not migrate into the payload. It is not a source of production transport, UI, or feature code. |
| LWJGL macOS compatibility | A separate legacy artifact supports the present Forge/LWJGL environment. | Retain unchanged until the target runtime proves a compatible replacement path. |
| Native foundation | `runtime-native/` proves JNI/JVMTI lifecycle in owned Java processes and has a guarded post-load entry used by the selected-PID native transport fixture. | Keep and extend incrementally. It is not yet a Java-payload loader or a certified game-client runtime. |

### Baseline discrepancies that must be resolved first

Three facts affect the migration order:

1. **Architecture mismatch.** The current Launcher intentionally selects an
   `x86_64` Java 8 game JVM under Rosetta on macOS Apple Silicon because the
   legacy Java/LWJGL stack is x86_64. The current controlled-JVM
   `libopus-runtime.dylib` build is `arm64`. An `arm64` dylib cannot load into
   the current `x86_64` game JVM.

2. **Artifact-contract documentation drift.** The checked-in runtime manifest
   currently contains seven roles: `bootstrap`, `runtime-legacy-1.8.9`,
   `lwjgl-macos-compat`, `native-ui`, `opusconfig`, `elementa`, and
   `universalcraft`. Some documentation still describes a two-artifact
   contract. The build, Launcher staging scripts, and release documentation
   must agree before a payload schema is introduced.

3. **Rosetta direct-transport boundary.** On September 10, 2026, the pinned
   x86_64 Java 8 fixture under Rosetta allowed same-user task-port acquisition
   but rejected standard remote-thread creation before native entry. The
   injector now returns `RosettaRemoteThreadUnavailable`, keeps the target
   alive, and removes its pending session. This is not an x86_64 support
   result and must not be replaced by a protection bypass.

None of these issues is cosmetic. All are release and compatibility gates.

## Non-negotiable design rules

1. **Match the JVM process architecture, not the host architecture.** A host
   being Apple Silicon does not prove that its Minecraft JVM is arm64. Each
   target must report the Java architecture before a native runtime is chosen.

2. **The product Java payload is Java 8-compatible.** The current managed
   Minecraft runtime is Java 8. The Java 17 setup under `runtime-java/` is
   limited to the controlled-JVM harness and must not become the production
   `opus-runtime.jar` build configuration unchanged.

3. **Only one integration owner is active per game instance.** The legacy
   Forge UI/coremod route and the new payload must never simultaneously own
   the same keybind, screen route, module registry, lifecycle callback, or
   OneConfig bridge.

4. **No raw JNI in feature code.** Native JNI/JVMTI, mapping names, global
   reference ownership, and classloader details remain below the Java SDK.

5. **OneConfig is a hard gate.** A visually simpler replacement UI is not an
   acceptable workaround if late-bootstrap OneConfig integration fails.

6. **Existing production behavior stays reversible.** Every proof uses an
   isolated preview instance/artifact set. The release lock and normal Forge
   path change only at the final cutover.

## Product verification contract

“Works on any 1.8.9 client” is not a testable or safe release claim. The
product requirement is instead:

> OPUS supports every explicitly **adapter-certified** 1.8.9 runtime/build and
> rejects every unknown or incompatible target before it attempts to run the
> payload.

Certification is per client family, exact build/runtime fingerprint, JVM
architecture, classloader proof, mapping schema, and payload/OneConfig
compatibility version.

| Target family | Planned support state | Certification requirement |
| --- | --- | --- |
| Lunar 1.8.9 | First target | Complete Lunar adapter, read-only state proof, payload bootstrap, OneConfig proof, unload/reinject evidence. |
| Badlion 1.8.9 | After Lunar is stable | Separate Badlion adapter and the same full acceptance suite. |
| Vanilla/Forge 1.8.9 launched through TLauncher or another launcher | Separate runtime profile, not a launcher-name shortcut | Certify the actual JVM, game/Forge build, classloader, mappings, and artifact set. |
| Other legacy/custom 1.8.9 clients | Unsupported until certified | Add a named adapter and pass the full suite before advertising support. |

The four required product behaviors are verified as follows.

### 1. Client compatibility

For each supported runtime, record and validate:

- client family and exact build/runtime fingerprint;
- Minecraft version and Java version;
- target JVM/process architecture;
- verified game-visible classloader and Minecraft singleton;
- adapter and mapping-schema versions; and
- OneConfig adapter version when the payload exposes UI/config.

An unknown classloader, mapping, architecture, or version mismatch is a typed
`UnsupportedRuntime`/compatibility failure. It is not a best-effort fallback.

### 2. Load the Opus payload

Load is successful only when all of these occur in order:

```text
injector handshake
    ->
native runtime loaded
    ->
JVM / JVMTI / classloader proof
    ->
adapter selected
    ->
opus-runtime.jar Bootstrap.start(...)
    ->
Java payload READY
```

The success report must include the full version handshake and prove that
Minecraft classes are visible to the Java payload. A loaded dylib without a
running Java payload is a failed load, not a partial success.

### 3. Reverse unload

Unload is successful only when the runtime performs the documented reverse
lifecycle:

```text
stop new callbacks
    ->
disable modules
    ->
stop event dispatch
    ->
close OPUS-owned UI
    ->
unregister OneConfig bridge
    ->
stop workers
    ->
remove hooks/callbacks
    ->
release JNI references and caches
    ->
detach OPUS-owned threads
    ->
native runtime stopped
```

The target game must remain alive, no OPUS callback may fire after stop, and a
new load must start from a clean state. Development acceptance is at least 20
isolated load → use → unload → reload cycles.

### 4. Injector/runtime/payload compatibility

Injector, native runtime, Java payload, mappings, and the OneConfig shim must
fail fast unless this exact handshake agrees:

```text
protocol_version
injector_version
native_runtime_version
java_runtime_version
target_architecture
mapping_schema_version
oneconfig_adapter_version
artifact_checksums
```

No component may silently downgrade, guess a mapping, or run a partially
compatible payload.

### Current verification status

| Requirement | Status on 2026-09-08 |
| --- | --- |
| Controlled Java-process JNI/JVMTI/native shutdown | Passed in M2 harness |
| Target client compatibility (Lunar, Badlion, Forge/Vanilla profiles) | Not started |
| Java payload load in a target runtime | Not started |
| Target-runtime reverse unload/reinject | Not started |
| Cross-component version handshake | Specified; not implemented |

## Target ownership boundaries

```text
Launcher (Rust)
  - verified artifacts, explicit user-facing state, session lifecycle
  - no Minecraft feature/module implementation

Injector (Rust)
  - transport request, architecture validation, handshake/status
  - no Minecraft UI, mappings, modules, or feature logic

Native Runtime (C++17)
  - JVM discovery, thread/ref lifecycle, classloader proof, adapters,
    game-thread bridge, Java payload load/unload
  - no product UI or broad module implementation

Java Payload (Java 8)
  - Bootstrap, SDK, module manager, events, OneConfig bridge, UI/config
  - no raw JNI or native mapping strings
```

## Migration map for current code

| Current code or artifact | Planned action | Destination / rule |
| --- | --- | --- |
| `ForgeBootstrapMain`, `GameArgumentProtocol`, `GameLaunchStatus` | Retain as the legacy Forge launch contract. Reuse only semantics that remain useful, such as bounded status reporting. | Legacy Runtime lane; not payload bootstrap code. |
| `OpusCore`, `LifecycleStage` | Extract a Java 8-safe lifecycle state model after it has an explicit payload owner. | `runtime-java` payload core; no Forge imports. |
| `ClientTelemetry` | Preserve local-only diagnostics, then adapt it behind payload lifecycle and event interfaces. | Java payload diagnostics; no direct dependency on a Forge transformer. |
| `OpusLoadingPlugin`, `OpusForgeClassTransformer`, ASM transformers | Keep as legacy behavior. Inventory each hook’s purpose before migrating it. | No wholesale port. Prefer a supported game event, then the central bridge, before any new low-level hook. |
| `OpusNativeUiMod` | Split FML setup, input routing, screen ownership, config route, and diagnostics into independent services. | FML annotations/event subscriptions do not move into the payload. |
| `OpusConfigModule` | Use as the first owned source reference for a OneConfig-backed payload configuration proof. | Adapt after the OneConfig compatibility shim exists; preserve config migration behavior. |
| `NativeUiRuntimeDiagnostics` | Retain its evidence-oriented reporting concepts, but remove direct Forge lifecycle assumptions. | Payload diagnostics/test support. |
| `OpusDesign` | Reuse as an owned, Java 8-neutral design contract. | Payload design module after dependency boundaries are made explicit. |
| `OneConfigThemeAdapter` / `ElementaThemeAdapter` | OneConfig adapter is relevant after M9. Elementa adapter remains deferred. | Do not make Elementa a prerequisite for initial payload readiness. |
| `OpusElementaShellScreen` and `NativeUiLiveProof` | Keep as current Forge-lane evidence. Re-evaluate only after the payload owns stable screen/input events. | Deferred; no automatic port. |
| `legacy/1.8.9/client/` | Preserve only as quarantined historical research. | No migration. No restored CEF/web UI path. |
| OneConfig, Elementa, UniversalCraft JARs | Keep as independently identifiable, locked dependencies. | No unreviewed shading, relocation, or source copying. |

## Required contracts before feature migration

### 1. Architecture contract (`ARCH-001`)

Before any target-runtime loading work:

- record host architecture, target Java `os.arch`, JVM version, and process
  architecture;
- decide the supported artifact matrix explicitly:
  `x86_64`, `arm64`, or a correctly tested universal distribution;
- build and test the native runtime for every supported target architecture;
- reject an architecture mismatch before any runtime load request; and
- keep the controlled-JVM arm64 harness labelled as a harness result, not proof
  for the current x86_64 Forge runtime.

**Exit gate:** the selected target JVM can load a same-architecture test dylib,
and the selection is covered by automated architecture validation.

### 2. Artifact-baseline contract (`ARTIFACT-BASELINE-001`)

Before adding payload artifacts:

- reconcile `runtime/README.md`, `docs/protocol/runtime-artifacts.md`, Runtime
  build output, Launcher staging, and release-lock verification;
- publish one canonical list of current legacy artifact roles;
- add explicit tests for the canonical list; and
- preserve schema v1 behavior for the existing release lane.

**Exit gate:** documentation, manifest generation, Launcher staging, and
artifact verification report the same legacy role set.

### 3. Payload contract (`PAYLOAD-001`)

Define a Java 8-compatible `opus-runtime.jar` with:

- `dev.opus.runtime.Bootstrap.start(...)` and an explicit stop path;
- no `@Mod`, `IFMLLoadingPlugin`, Forge bootstrap main class, or dependence on
  a Forge discovery lifecycle;
- a typed bootstrap result and failure model;
- a versioned handshake containing `protocol_version`, injector version,
  native-runtime version, Java-runtime version, mapping-schema version, and
  OneConfig-adapter version; and
- a test that rejects use of raw JNI or obfuscated mapping strings in the
  payload SDK/module packages.

**Exit gate:** the JAR compiles to Java 8 bytecode, starts in an owned
classloader test, validates its handshake, and does not contain Forge entry
metadata.

### 4. Native-to-Java boundary (`BRIDGE-001`)

The native runtime owns classloader proof and bootstrap invocation. The Java
payload owns module-facing APIs.

The initial bridge must provide only:

- a bootstrap context with immutable runtime/version/diagnostic facts;
- dispatch to the verified game thread;
- lifecycle state/error reporting;
- a narrow, typed Minecraft adapter surface; and
- an orderly stop/unload notification.

It must not expose `JNIEnv*`, raw `jobject` values, obfuscated field names, or
unbounded native callbacks to Java modules.

**Exit gate:** a controlled test proves start, callback dispatch, stop, and
post-stop rejection without JNI warnings, leaked runtime-owned threads, or
work continuing after shutdown.

## Ordered implementation phases

The sequence preserves the team specification’s M3–M12 progression while
adding migration gates for the existing codebase.

| Phase | Work | Changes allowed | Exit gate |
| --- | --- | --- | --- |
| 0 | `MIGRATION-001`, `ARCH-001`, `ARTIFACT-BASELINE-001` | Documentation, inventories, build metadata, isolated architecture proofs. | Target architecture and current artifact baseline are unambiguous. |
| 1 | M3 General — client-independent Minecraft JVM transport | Process/JVM target model, architecture validation, native lifecycle, and handshake. Client brand is not a transport eligibility requirement; a process-side client hint is diagnostic only. | A selected, authorized Minecraft JVM survives repeatable load/unload requests and reports typed lifecycle plus a non-authoritative client hint; runtime classification and a client adapter remain separately gated. |
| 2 | M4–M6 — JVM, classloader, Lunar adapter | Read-only runtime detection, classloader proof, mapping/adaptor work. | Correct class identity and live Minecraft singleton are proven; no feature/module migration yet. |
| 3 | M7 — Java payload bootstrap | Build and load the Java 8 payload into the proven game-visible loader. | `Bootstrap.start()` runs without Forge `@Mod` discovery and sees Minecraft classes. |
| 4 | M8 — Game-thread/event bridge | Central tick, render, input, screen, and world lifecycle dispatch. | Callbacks occur on the correct game/render thread; no arbitrary worker accesses Minecraft state. |
| 5 | M9 — OneConfig vertical slice | Compatibility shim plus one real config containing enable, slider, dropdown, and keybind. | OneConfig renders, accepts mouse/keyboard, persists, reloads, and closes cleanly. Stop feature migration if this fails. |
| 6 | M10 — SDK and first Java feature slice | Migrate one benign module and its settings through the new SDK. | Module lifecycle, event dispatch, config mutation, and disabled-by-default behavior are proven. |
| 7 | M11 — lifecycle/reinjection | Explicit stop, cleanup, and repeatability tests. | At least 20 isolated load/open/enable/unload/reload cycles complete without stale callbacks, refs, hooks, or UI ownership. |
| 8 | Cutover review | Launcher/Runtime artifact contract and release-lock migration. | Payload lane passes all acceptance gates; legacy and payload owners cannot collide; rollback remains available. |
| 9 | M12 — additional adapters | Badlion/Forge adapters only after Lunar is stable. | Module code stays unchanged across adapters. |

## First payload vertical slice

The first migrated feature must be deliberately small:

```text
Java payload bootstrap
        ->
central game-thread tick/input bridge
        ->
OneConfig-backed configuration
        ->
one benign, disabled-by-default module
        ->
clean stop/unload
```

Recommended source candidates are the existing `OpusConfigModule` configuration
shape and a simple informational HUD module. This is a proof of lifecycle,
config, and API ownership—not a reason to move all current UI/screens at once.

The following remain out of the first slice:

- Elementa shell replacement;
- main-menu/pause-menu replacement;
- CEF/web UI research;
- broad ASM migration;
- multiple module categories; and
- any feature that needs a special hook before the central event bridge exists.

## OneConfig migration rule

Late loading a OneConfig JAR is not equivalent to its normal Forge-tweaker
startup. The payload must therefore provide a narrow compatibility shim for
the actual OneConfig surfaces OPUS uses:

```text
payload game-thread bridge
        ->
OneConfig event/lifecycle adapter
        ->
OneConfig config, input, GUI, persistence
```

The initial proof must cover:

- switch, slider, dropdown, keybind, text/color/button where used;
- open, close, reopen, world/menu transition, focus, mouse, keyboard,
  fullscreen/windowed, GUI scale, and persistence; and
- no cursor capture, GL corruption, resource leak, or configuration damage.

If it fails, work stops at the OneConfig compatibility problem. The project
does not introduce a parallel custom UI to bypass that result.

## Build and artifact migration

The payload lane must be introduced as a new, versioned contract rather than a
silent modification of the Forge artifact set.

1. Keep the current schema v1 legacy manifest/staging path intact.
2. Add a separately named preview contract only after
   `ARTIFACT-BASELINE-001` is complete.
3. Include explicit roles for the native runtime and Java payload, their
   architecture/Java compatibility, sizes, checksums, and protocol version.
4. Verify every artifact before staging. Do not discover files by a loose
   filename pattern.
5. Do not stage the legacy native UI mod and payload UI into the same preview
   instance unless a deliberate coexistence test proves distinct ownership.
6. Update the superproject release lock only after the owning Launcher and
   Runtime changes are independently tested and committed.

The final manifest schema must let Launcher fail before launch/load when any of
these differ:

```text
target architecture
Java major/bytecode compatibility
protocol version
injector version
native runtime version
Java payload version
mapping schema version
OneConfig adapter version
artifact checksum
```

## Cutover and rollback

### Preview isolation

- Use a separately named preview bundle/profile and a separate game data root.
- Preserve the existing Forge release path and release lock.
- Never make the payload and legacy Forge UI both respond to Right Shift,
  screen events, or module state in the same instance.
- Capture diagnostics that identify the active integration owner and all
  handshake versions.

### Cutover conditions

The normal Launcher path may switch only when all of these are true:

- architecture selection has passed on the real target JVM;
- native JVM/classloader/bootstrap/bridge tests pass;
- OneConfig M9 has passed in the exact target environment;
- the module SDK has a real vertical slice with no raw JNI;
- lifecycle/reinjection stress tests pass;
- artifact manifest and Launcher staging checks pass;
- OneConfig and other third-party release obligations are satisfied for the
  proposed distribution; and
- an explicit rollback artifact set remains available.

### Rollback rule

If a phase fails, keep the legacy release manifest active and remove only the
isolated preview artifacts. Do not partially change the normal launcher
contract, delete a legacy artifact, or overwrite a user profile to force the
new path.

## Ownership and review

| Repository / area | Owner in this migration |
| --- | --- |
| Superproject | Architecture records, cross-repository artifact protocol, release lock, integration gates. |
| Launcher | Rust-side artifact verification, target architecture validation, user-facing status, preview/cutover selection. |
| Runtime | Java 8 payload build, SDK, adapters, OneConfig shim, current Forge-lane preservation. |
| `runtime-native/` | C++17 JNI/JVMTI lifecycle, classloader proof, bridge, and cleanup. |
| `injector/` | Rust transport/status boundary only. |
| `adapters/` | Version/client-specific mapping and detection, never feature code. |

Changes should remain in their owning repository. A superproject change must
not silently copy or fork Launcher/Runtime implementation source.

## Current status and next concrete deliverable

Completed:

- `RESEARCH-001`: reference/license/reuse matrix.
- controlled-JVM native foundation: `JNI_OnLoad`, JVM discovery, JNI, JVMTI,
  owned-thread attach/detach, structured diagnostics, and safe shutdown.

- `ARTIFACT-BASELINE-001` role reconciliation: the canonical schema-v1 role
  list now verifies the Runtime build definition, generated manifest/checksum
  files, Launcher staging behavior, and the relevant Runtime/Launcher docs.
- `ARCH-001` build selection: `libopus-runtime.dylib` now builds as explicit
  `arm64` and `x86_64` Mach-O slices, while the harness checks that its dylib
  matches the JVM selected for the test. On September 8, 2026, the
  checksum-locked x86_64 Temurin Java 8 harness compiled Java 8 bytecode and
  passed the native lifecycle test with the x86_64 slice.
- `RELEASE-LOCK-001`: `release/opus.lock.json` now uses schema v2. Its active
  `injector-development` profile records the Rust injector, C++17 native
  runtime, Java 8 payload contract, architecture matrix, required version
  handshake, and a no-artifact foundation state. The former Forge metadata is
  retained as `legacy-forge-rollback`. The verifier and root build scripts are
  profile-aware: the active lane validates and builds only the native
  foundation, while packaging is blocked.
- `M3-PREFLIGHT-001`: `injector/` now builds `opus-injector` as a Rust
  preflight/status and selected-PID native-transport binary. It discovers
  client-independent `MinecraftJvmCandidate` processes read-only, reports
  sanitized candidate evidence plus a non-authoritative client hint, validates
  native Mach-O slices against a declared JVM architecture, reports the
  protocol-v1 handshake contract, and gates `request-load`/`request-unload`
  with current-user ownership, process-instance identity, a private session,
  and a capability-gated runtime descriptor. The arm64 direct path is proven
  only with the debug-authorized non-cooperative Java fixture; the current
  x86_64 Java 8/Rosetta path yields a typed pre-entry rejection with cleanup.
  Neither result is normal-client or adapter certification.
- `M3-GENERAL-TARGET-MODEL-001`: client-independent target discovery is
  implemented. Lunar is the first live compatibility target, while client
  hints are diagnostic-only and runtime classification, mappings, and feature
  compatibility remain adapter-specific after runtime entry.
- `M3-OWNED-LIFECYCLE-001`: the injector can now launch an owned,
  same-architecture Java harness, send a cooperative load request, and verify
  repeated same-process native runtime entry, the complete protocol-v1 version
  handshake, logical native shutdown/restart, and clean child exit.
  Mapping/OneConfig/artifact fields use explicit foundation-only sentinels
  until those components exist. This is lifecycle evidence, not remote OS-level
  transport, dylib unload, or client compatibility certification.
- `M3-AUTHORIZED-TARGET-TRANSPORT-001`: a separately launched, OPUS-owned
  Java 8 fixture publishes an explicit PID-bound, loopback-only descriptor and
  accepts a capability-gated request for exactly one startup-authorized native
  runtime path. The injector verifies the selected PID against the local
  process table, validates architecture and the full protocol-v1 handshake,
  proves a wrong-architecture rejection before the target is contacted and a
  typed recoverable failure, repeats native entry and logical shutdown,
  verifies health before, during, and after each cycle, and requires clean
  target stop with descriptor removal. This is a narrow fixture proof, not an
  OS-level injection mechanism or third-party-client certification.
- `M3-AUTHORIZED-CLIENT-EVIDENCE-GATE-001`: a standalone verifier currently
  rejects fixture captures and unbounded transports while accepting an
  OPUS-owned or vendor-approved cooperative evidence identity, matching
  architecture/handshake, three complete load/unload/survival cycles, and
  clean descriptor removal. This schema is deliberately narrower than the
  M3 General target model; it is a review aid for its present fixture/vendor
  paths, not a requirement that a current-user-managed Minecraft JVM expose a
  vendor opt-in API. It does not produce real-client evidence or certify a
  client.

Still open:

- a release-ready payload artifact manifest. The current rollback pins remain
  historical and must only be verified from a clean checkout at their exact
  commits; no dirty component state is represented in the schema-v2 lock;
- production payload JAR;
- a selected, current-user-managed Minecraft JVM (or a separately authorized
  test target) that demonstrates real runtime entry, versioned handshake,
  clean unload, repeatability, and target survival without relying on the
  OPUS test fixture;
- `M3-GENERAL-LIVE-TRANSPORT-002`: prove the M3 General lifecycle contract
  against an eligible authorized Minecraft JVM with native runtime entry,
  versioned handshake, typed load/unload, repeatability, and target survival;
- target classloader proof;
- OneConfig late-bootstrap compatibility;
- module migration; and
- release cutover.

Phase 0 is complete for the foundation-only build contract. The M3
authorized-target fixture subgate is also complete, but neither result
certifies Lunar/Badlion/Forge adapters, Java payload loading, OneConfig late
bootstrap, a production client transport, or release packaging. Those remain
separately gated M3-and-later work.
