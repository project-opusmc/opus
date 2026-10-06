# RESEARCH-001 — Opus Injector Foundation Research Matrix

Status: **complete — architecture research only**  
Captured: **2026-09-08**

This is the M0 deliverable required by
`OPUS_INJECTOR_TECHNICAL_SPEC.md`. All eight named repositories were inspected
at the pinned source states below. No third-party source was copied into OPUS,
vendored, built, or made a production dependency by this research task.

The reference projects are evidence, not implementation authority. “Reuse” in
this document means an independently implemented architectural pattern unless
the entry explicitly approves a separately audited dependency.

## Scope and non-negotiable exclusions

The Foundation v1 scope is a reliable, debuggable native-to-Java runtime for a
controlled JVM integration environment. It excludes:

- anti-cheat bypass, competitive automation, or gameplay automation;
- stealth, anti-detection, screenshare evasion, manual mapping, or memory
  hiding;
- native overlay UI as the product UI;
- copying GPL-licensed source into OPUS;
- importing unlicensed proof-of-concept source.

The production UI/config target remains the actual legacy OneConfig fork
already present in Runtime. Its separate licensing and attribution release gate
remains open; see [the third-party license audit](THIRD_PARTY_LICENSE_AUDIT.md).

## Source snapshots

| Repository | Inspected commit | Commit date | License disposition |
| --- | --- | --- | --- |
| `vifezdev/viper` | `84feca49b6ce22fc11500f7c7291dcf7001623b2` | 2026-08-02 | MIT; patterns only |
| `baier233/nobody-client` | `312745d9c51141e7a2626e2ce1330273fdea840e` | 2026-06-05 | Apache-2.0; patterns only |
| `66hh/RiptermsGhost` | `dcccb45309bc9102dd4a40a3efe9b647caa860df` | 2023-09-02 | MIT; patterns only |
| `TesseractLiberty/OpenCommunity` | `405df982a4823a362a45ffda0ddbfde02cb9e242` | 2026-05-14 | MIT; patterns only |
| `TheDarkSword/DarkClient` | `2ab8de902d56a2f776a2544dd14489ffd463fb49` | 2026-05-24 | GPL-3.0-only; no source reuse |
| `jmpews/Dobby` | `5dfc8546954ce3b3198132ab13fddb89ee92cdd7` | 2024-03-14 | Apache-2.0; evaluate as a dependency only |
| `Polyfrost/OneConfig` | `dd0241a613b960681583b2d40ca89f3871da4787` | 2026-09-07 | LGPL-3.0 plus Additional Terms; use the separately frozen legacy fork |
| `Swofty-Developments/MinecraftInjectionPOC` | `912114c0471ce26e7e033fe63f7067b3d69f7467` | 2026-08-30 | No software license found; no source reuse |

## Reference matrix

### `vifezdev/viper`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C++17 and CMake; Windows-oriented x64 implementation. |
| Inject method | A Windows bootstrap-to-DLL flow. **Do not reuse.** It is not portable to macOS ARM64. |
| JVM bootstrap | Resolves the created `JavaVM`, obtains a thread-local `JNIEnv`, and tracks whether the current thread was attached by the runtime. |
| Classloader method | Tries direct lookup first, then Forge `LaunchClassLoader` or a thread context classloader. |
| Mapping method | Detects broad mapping styles from known classes and selects a runtime adapter. |
| Event / module method | Native event dispatcher and module manager. |
| Render / UI method | Windows OpenGL buffer-swap hook and native renderer. **Do not use for OPUS UI.** |
| Unload method | Stops the runtime loop, clears JNI global-reference caches, removes hooks, and detaches runtime-owned threads. |
| Reuse | RAII-like JNI attachment ownership, reference-cache cleanup, staged initialization, structured diagnostics, and loader fallback ordering. |
| Do not reuse | Windows injection, `DllMain`, remote-thread assumptions, MinHook/OpenGL UI, or native feature modules. |

### `baier233/nobody-client`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C++ with Visual Studio project files; Windows-only implementation. |
| Inject method | The repository assumes an already-loaded DLL and starts work from `DllMain`. No portable injector is supplied. |
| JVM bootstrap | Discovers the existing VM through JNI, attaches a daemon thread when necessary, and obtains JVMTI. |
| Classloader method | Searches thread context classloaders and uses JVMTI loaded-class enumeration as a client-specific fallback. |
| Mapping method | Version-specific C++ wrappers for Vanilla, Forge, Lunar, Badlion, and other targets. |
| Event / module method | Module registry plus update, key, packet, and render events. |
| Render / UI method | Native Windows hooks, ImGui, and an embedded local web UI. **Do not use.** |
| Unload method | Disables modules and exits the DLL worker thread. |
| Reuse | Positive classloader validation: prove that a candidate loader can resolve the live Minecraft class before retaining it. |
| Do not reuse | PEB/export-resolution code, native input/render UI, client-specific feature code, and all competitive/gameplay modules. |

### `66hh/RiptermsGhost`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C++ with Visual Studio projects, MinHook, and ImGui; Windows x64 only. |
| Inject method | Assumes an externally loaded DLL. |
| JVM bootstrap | Demonstrates a fallback that receives a valid `JNIEnv*` inside an existing LWJGL JNI callback, then obtains `JavaVM` and JVMTI from that thread. |
| Classloader method | Defines a temporary helper Java payload through a custom loader. |
| Mapping method | Per-client/per-version mapping headers, including legacy Lunar mappings. |
| Event / module method | Native events plus JVMTI class retransformation and Java ASM transforms. |
| Render / UI method | JNI OpenGL callback hook plus ImGui. **Do not use for OPUS UI.** |
| Unload method | Stops modules, restores transformed classes, disposes JVMTI state, removes hooks, and releases the DLL. |
| Reuse | The callback-based `JNIEnv*` acquisition is a narrowly scoped fallback only; the explicit restore-on-unload mindset is valuable. |
| Do not reuse | ASM/JVMTI transformation as the default event path, hidden-state techniques, client-brand changes, native UI, and all feature code. |

### `TesseractLiberty/OpenCommunity`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C++20, Visual Studio, Windows x64. |
| Inject method | Launcher/runtime/shared split; the inspected launcher includes a manual-mapping loader. **Manual mapping is prohibited in OPUS.** |
| JVM bootstrap | Runtime attaches to JNI/JVMTI and owns the game-side wrappers. |
| Classloader method | Game-instance wrappers resolve classes through a client-specific mapper and JVM state. |
| Mapping method | Per-client mappings are selected at runtime for Badlion, Forge, Feather, Lunar, and Vanilla 1.8.x targets. |
| Event / module method | Game-thread callbacks backed by JVMTI breakpoint events, with a fallback tick path. |
| Render / UI method | Native render hook and ImGui configuration UI. **Do not use for OPUS UI.** |
| Unload method | Launcher exposes unload; runtime shuts down modules, render hooks, and game-thread hooks in reverse order. |
| Reuse | Clear host/runtime/shared boundaries, a versioned shared configuration schema, reverse-order cleanup, and adapter-owned mappings. |
| Do not reuse | Manual mapping, shared-memory UI coupling, native overlay UI, and combat or automation modules. |

### `TheDarkSword/DarkClient`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | Rust Cargo workspace with Linux, Windows, and macOS platform layers. |
| Inject method | Injector, small agent loader, and hot-swappable client-library split. |
| JVM bootstrap | Agent loader monitors `JNI_GetCreatedJavaVMs`, checks VM health, and attaches daemon threads only as needed. |
| Classloader method | Scans all thread context classloaders and keeps only one proven to own a non-null Minecraft singleton. |
| Mapping method | JSON mapping data for obfuscated builds, reflection for unobfuscated builds, and generated wrapper traits. |
| Event / module method | Frame-driven module ticks plus packet-pipeline hooks. |
| Render / UI method | Buffer-swap hook and `egui` overlay. **Do not use for OPUS UI.** |
| Unload method | Calls an explicit cleanup export, drops the loaded library, and uses hook-handle destruction to restore patched bytes. |
| Reuse | Design-only reference for agent/runtime separation, VM health monitoring, live-singleton classloader proof, reload-safe ordering, and in-process JVM test fixtures. |
| Do not reuse | Any DarkClient source: it is GPL-3.0-only. Do not use its overlay, input hooks, network code, or feature modules. |

### `jmpews/Dobby`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C/C++17 CMake library supporting macOS and ARM64 alongside other platforms and architectures. |
| Inject method | None; Dobby is an in-process inline-hook framework, not an injector. |
| JVM bootstrap | None. |
| Classloader / mapping method | None. |
| Event / module method | None; lifecycle ownership must be provided by OPUS. |
| Render / UI method | None. |
| Unload method | Hook installation/removal is an embedding application's responsibility. |
| Reuse | Evaluate as the first possible macOS ARM64 hook dependency only after the no-hook bootstrap works. Any adoption requires a pinned version, license notice, build proof, and teardown test. |
| Do not reuse | Built-in monitoring examples, arbitrary hook targets, or a self-authored trampoline engine. |

### `Polyfrost/OneConfig`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | Java/Kotlin Gradle library for Minecraft loaders. The upstream `v1` snapshot inspected here targets newer loader/version lines. |
| Inject method | None; it is loader-owned Java code, not a native runtime transport. |
| JVM bootstrap | Standard loader/bootstrap and Mixin lifecycle. The OPUS runtime must bootstrap the **legacy 1.8.9 fork** into a compatible game-visible classloader. |
| Classloader method | Normal Minecraft loader ownership; legacy Forge support uses a tweaker/Mixin initialization path. |
| Mapping method | Version- and loader-specific source/build configuration; not a replacement for the OPUS native adapter mapping layer. |
| Event / module method | Minecraft/Mixin-driven events, config model, keybinds, HUD, and lifecycle integrations. |
| Render / UI method | Actual Minecraft-native OneConfig GUI/config/HUD framework. This is the intended OPUS primary UI/config surface. |
| Unload method | Designed for ordinary game-loader lifecycle, not repeated dynamic runtime unload. This must be explicitly proven in `ONECONFIG-001`. |
| Reuse | The existing Runtime fork pinned at `Polyfrost/OneConfig@233452661e6d273f130230bb8e1813fb0a28b80a` (`develop-v0`) is the legacy 1.8.9 candidate. Reuse it only under the current audit, attribution, and source-availability obligations. |
| Do not reuse | Do not substitute current upstream `v1` for the frozen legacy target, and do not introduce a parallel native, browser, or ImGui product UI. |

### `Swofty-Developments/MinecraftInjectionPOC`

| Field | Finding and Opus decision |
| --- | --- |
| Language / platform | C and Java; Linux x86_64 proof of concept. |
| Inject method | Linux process-control and shared-library loading proof of concept. **Prohibited for OPUS implementation.** |
| JVM bootstrap | Finds an existing JVM through JNI and starts Java code from a native payload. |
| Classloader method | Temporary isolated Java loader, thread context-loader inspection, and reflection-based discovery. |
| Mapping method | Reflection across obfuscated, MCP, SRG, and Yarn-style names. |
| Event / module method | Java-side scheduled ticks and Minecraft render integration. |
| Render / UI method | Minecraft-rendered overlay and simple GUI. **Do not use for OPUS UI.** |
| Unload method | Includes native-memory removal and concealment behavior. **Prohibited.** |
| Reuse | No source or transport design. At most, it reinforces the need for an owned-JVM bootstrap harness with an explicit Java start/stop contract. |
| Do not reuse | All injection, memory-removal, anti-detection, screenshare-evasion, process-control, overlay, and unload code. The repository has no conventional software license. |

## Decisions derived from the research

1. **The native runtime stays narrow.** It owns JVM discovery, thread
   attachment, reference safety, diagnostics, classloader resolution, mapping
   dispatch, a minimal game-thread bridge, and teardown. It does not own
   modules, product UI, or broad feature code.

2. **Classloader resolution must be proof-based.** A candidate loader is valid
   only if it resolves the target Minecraft class and that class exposes the
   live game singleton. Class names, a window title, or a successful
   `FindClass` call alone are insufficient.

3. **Mappings belong behind adapters.** Runtime detection selects
   `Lunar189Adapter`, `Badlion189Adapter`, or `Forge189Adapter`; feature-facing
   Java APIs must not expose obfuscated names.

4. **A normal JNI lifecycle is the default.** Track every runtime-owned thread
   attachment and every JNI global reference. The existing-JNI-callback
   technique is a documented fallback only if ordinary VM discovery and
   attachment fail in the controlled target.

5. **No hook before a no-hook vertical slice.** Dobby may be evaluated only
   after `FOUNDATION-001` proves startup, diagnostics, JNI, JVMTI acquisition,
   and clean shutdown in an owned Java test process.

6. **OneConfig is a hard gate, not a future enhancement.** `ONECONFIG-001`
   must validate actual legacy OneConfig rendering, input, and persistence
   through the Java runtime before module development begins.

7. **Every lifecycle path is symmetrical.** Startup, bootstrap failure,
   module disablement, UI close, worker shutdown, reference release,
   thread detach, hook removal, and runtime unload need separately testable
   reverse-order behavior.

## M0 exit record

| Requirement | Result |
| --- | --- |
| Eight reference repositories inspected | Complete |
| License and source disposition recorded | Complete |
| Injector/JVM/classloader/mapping/event/render/UI/unload approaches recorded | Complete |
| Reuse and exclusion boundaries recorded | Complete |
| Third-party source copied into OPUS | No |
| Recommended next milestone | `FOUNDATION-001`: controlled-JVM native runtime bootstrap with logging, JVM discovery, JNI/JVMTI acquisition, and safe shutdown |

`FOUNDATION-001` must not begin with a Lunar or Badlion target process. Its
first test target is a Java process owned and launched by the OPUS test suite.
