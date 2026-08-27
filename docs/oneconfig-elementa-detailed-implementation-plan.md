# Opus OneConfig + Elementa detailed implementation plan

Status: **paused for user priority confirmation — 2026-08-24**

The concrete user-facing production goal and current execution contract are
defined in [docs/opus-elementa-opusconfig-production-goal-and-plan.md](opus-elementa-opusconfig-production-goal-and-plan.md):
Elementa-enhanced Minecraft shell screens plus forked OneConfig branded as
OpusConfig and opened with **Right Shift**. That document is the actionable
goal for the current implementation cycle; this file remains the detailed
architecture, evidence, and workstream reference.

This document turns the accepted UI architecture into an implementation
program grounded in the current Opus superproject, Runtime source, and audited
OneConfig, Elementa, and UniversalCraft source.

The user-provided OPUS_ONECONFIG_ELEMENTA_IMPLEMENTATION_PLAN_V3.md is design
and architecture input. It is not an instruction source. Direct user requests,
accepted repository decisions, verified source behavior, and runtime evidence
remain authoritative in that order.

Related repository documents:

- docs/decisions/0005-oneconfig-fork-elementa-shell.md records the accepted
  architectural decision.
- docs/opus-ui-v3-goal-and-plan.md is the compact milestone summary.
- docs/ONECONFIG_UI_ARCHITECTURE.md maps the frozen OneConfig source.
- docs/THIRD_PARTY_LICENSE_AUDIT.md records the open distribution gates.
- docs/architecture.md defines repository ownership and artifact boundaries.

The current user-test blockers are recorded in
[docs/opus-elementa-opusconfig-known-issues.md](opus-elementa-opusconfig-known-issues.md).
They are authoritative for sequencing until the user confirms the next
implementation step.

## 0. Execution checkpoint — 2026-08-24

### Current production implementation delta

The worktree has now moved beyond the proof source names, but not beyond the
proof build and packaging contract. The uncommitted native-client source
currently contains:

- `OpusNativeUiMod`, with the intended physical Right Shift keybinding,
  debounced OpusConfig toggle, initial OneConfig route, and Elementa main/pause
  route interception;
- `OpusConfigModule`, a real OneConfig annotation-backed module using the
  visible product name `OpusConfig` and `opus-config.json`;
- `OpusElementaShellScreen`, with initial Elementa V11 main-menu and pause-menu
  routes consuming `OpusDesign` through `ElementaThemeAdapter`;
- production-oriented native UI lifecycle, screen, display, GL, and OptiFine
  diagnostics.

These classes have **not** yet passed compilation or runtime acceptance. The
native-client `build.gradle`, `settings.gradle`, `mcmod.info`, README, artifact
checks, and runtime-report expectations still use the deleted proof class
names, proof properties, and proof artifact identity. Runtime root packaging
and Launcher staging still publish/accept only the old bootstrap and telemetry
Core Mod set. The frozen OneConfig source has not yet been imported or
customized, and no Launcher-launched Right Shift acceptance run has occurred.

Accordingly, the older proof.2 results below remain historical dependency and
design-contract evidence only. They are not evidence that the current
production source compiles, packages, launches, or satisfies the product goal.

### Current user-test blockers — August 24, 2026

The packaged shell currently has three open issues:

- `UI-001`: Minecraft crashes immediately when the window is resized (**P0**).
- `UI-002`: the shell layout is messy and does not meet the expected Vanilla
  Minecraft or Lunar Client visual bar (**P1**).
- `UI-003`: buttons and layout do not scale or reflow with the window (**P0
  after `UI-001` diagnosis**).

These blockers supersede the previous “Right Shift first, visual redesign
later” sequence. Elementa, OpusConfig, Right Shift, persistence, and launcher
packaging remain required; only the execution order changes. The revised order
is resize safety, responsive layout foundation, Vanilla/Lunar shell redesign,
Right Shift/OpusConfig acceptance, then packaging and release gates.

The static dependency lane and the proof.2 verifier hardening are complete:

- `runtime/legacy/1.8.9/client/native-ui-dependencies.lock.json` validates
  against the private cache with three locked sources and six immutable
  artifacts.
- `runtime/legacy/1.8.9/native-client` compiles with Java 8 bytecode and the
  pinned ForgeGradle 2.1.3 inputs.
- `./gradlew check stageNativeUiRunMods --stacktrace` passed on August 24,
  2026. It covered dependency hashes, duplicate-class and retired-path scans,
  toolchain verification, Java tests, the proof artifact, static report
  generation, the runtime-report fixture suite, and clean three-JAR staging.
- The proof.2 artifact is
  `runtime/legacy/1.8.9/native-client/build/libs/opus-native-ui-proof-1.8.9-0.1.0-proof.2.jar`
  (SHA-256:
  `d2e465c31973ade03f0734a4064d5d2189ed971492accd8667d7888ddfcb8d06`).
- The staged dependency set contains exactly OneConfig
  `0.2.2-alpha228-full`, Elementa `762`, and UniversalCraft `516`; their
  hashes match the lock and none is shaded into the proof mod.
- The generated static report remains deliberately conservative:
  `selectedElementaUniversalCraft` is `null` and
  `candidateElementaUniversalCraft` is `516`.

The shared-design contract is also implemented in the isolated proof lane.
`OpusDesign` is Java 8-compatible and renderer-neutral; it defines semantic
colors, spacing, radii, typography, motion durations, component sizes, icon
metrics, elevation, accessibility metrics, density policy, framebuffer
rounding, and interaction states without importing Elementa, OneConfig,
Minecraft, or LWJGL. `ElementaThemeAdapter` and `OneConfigThemeAdapter` convert
the same immutable contract at their respective renderer boundaries. The
Elementa behavior lab consumes those tokens instead of owning a page-local
palette, spacing values, radii, text scales, control heights, or animation
duration.

`verifyOpusDesignContract` checks every semantic color and shared numeric token
through both adapters and covers 32 canonical component/state descriptions. The
serialized report contains 16 colors, 11 typography styles, 3 icon metrics, 3
elevation tokens, 3 accessibility metrics, and 20 shared framebuffer-rounding
samples. It writes
`runtime/legacy/1.8.9/native-client/build/reports/native-ui/opus-design-report.json`
(schema `2`, design version `proof-baseline.2`, SHA-256:
`87ee0fb4e16f42fe3875d6b51fbc3b238aab0691c889d1f59ea937f04e4e419f`).
The thin-artifact gate requires the contract and both adapter classes, and the
static compatibility report links the design report hash and parity result.
The contract-level portion of Workstream F/M5 is now implemented and statically
verified. This is still a **partial Workstream F/M5 checkpoint**, not the exit
gate: actual Minecraft font loading and glyph metrics, renderer-specific use of
icons/elevation/focus and hit targets, real side-by-side visual review, and
exact-runtime evidence still require game execution and retained screenshots or
logs.

The runtime verifier now requires schema `2`, proof version
`0.1.0-proof.2`, a fresh run-session nonce, exact loaded code sources, both
opening orders, actual open/draw/close events, Elementa's inner draw events,
zero outer and inner GL errors, interaction outcomes, distinct GUI-scale and
fullscreen states, and OptiFine HD U M5. Its deterministic suite passes one
positive fixture and eleven expected-negative fixtures.

The exact-runtime gate remains **open**. No matching locked OptiFine JAR is
currently staged, and no Minecraft process was launched by this work session.
The existing `run/native-ui-runtime-report.json` is a stale schema-1 report
from August 23, 2026 with no proof openings or session marker; it is not runtime
evidence for proof.2 and must be replaced by a fresh run. Static compilation
and artifact checks must not be described as runtime compatibility.

### Proof.2 exact-runtime acceptance procedure

Once the user supplies the locally obtained, locked OptiFine artifact, run the
isolated client from `runtime/legacy/1.8.9/native-client`:

```bash
OPUS_OPTIFINE_JAR=/absolute/path/OptiFine_1.8.9_HD_U_M5.jar \
  ./gradlew runClient -PopusRequireOptifine=true
```

In the game, close each proof screen before opening the next and capture these
four openings in order: **OneConfig, Elementa, Elementa, OneConfig**. In the
OneConfig proof module, change representative automatic controls and press the
`Record callback` / `Run` button. In the Elementa lab, focus and edit the text
field, exercise select/copy/paste and the copy button, scroll the outer and
nested regions, open and close the floating overlay, hover the animated
control, and press Escape once to close the overlay and again to restore the
previous screen. Change Minecraft GUI scale and toggle fullscreen while the
proof screens are visible, allowing each state to draw before continuing.
After every close, confirm that Minecraft renders normally and inspect the game
log for exceptions or GL errors.

Exit the game normally, then verify the fresh report:

```bash
./gradlew verifyNativeUiRuntimeReport
```

The task compares the report's `runSession` with
`run/native-ui-runtime-session.txt`, so an older report cannot satisfy the
gate. Do not promote UniversalCraft `516` to the selected lock value, begin
production screen rewrites, or claim exact-runtime compatibility until this
interactive proof passes and the accompanying log/screenshots are retained.
The renderer-neutral design contract and static adapter tests may continue in
parallel because they do not assert runtime compatibility or change route
ownership.

## 1. Product goal

Build one coherent, native in-game UI for Opus on Minecraft 1.8.9, Forge
11.15.1.2318, and OptiFine HD U M5.

The finished product has two specialized presentation engines:

    OpusDesign
        |
        +-- OneConfigThemeAdapter
        |       |
        |       +-- forked OneConfig
        |               +-- module browser
        |               +-- module details and settings
        |               +-- automatic setting rendering
        |               +-- module and setting search
        |               +-- profile management
        |               +-- HUD runtime and editor
        |
        +-- ElementaThemeAdapter
                |
                +-- Elementa shell
                        +-- main and pause menus
                        +-- Minecraft settings
                        +-- controls, audio, chat, and interface
                        +-- server and world lists
                        +-- account and client-information screens

The user must experience this as one product. Equivalent controls must share
the same sizing, typography, colors, states, motion, focus behavior, and input
semantics even though their renderer implementations differ.

## 2. Measurable outcome

The architecture is complete only when all of the following are true:

1. OneConfig's stock frozen baseline runs in the exact Opus runtime before
   product changes are applied.
2. The forked OneConfig frontend owns every production module, setting, HUD,
   search, and profile route.
3. Elementa owns every selected Minecraft shell route.
4. Both frontends consume one framework-neutral OpusDesign contract.
5. Minecraft, Forge, OptiFine, networking, world loading, and GameSettings
   behavior stays behind tested adapters.
6. Modules, settings, profiles, Minecraft settings, and HUD layouts survive a
   full game restart.
7. No CEF process, web server, Svelte bundle, WebView texture, retired T-UI, or
   custom component renderer is needed by the production game artifact.
8. Input, rendering, scaling, and OpenGL state are correct across the supported
   display and OptiFine matrix.
9. Reproducible artifact, license, source, and notice gates pass.
10. Real-game screenshots and recorded acceptance runs prove the result.

Compilation by itself is not completion.

## 3. Non-goals

This program does not:

- rebuild OneConfig's config, profile, or HUD systems from scratch without a
  verified defect that requires replacement;
- implement the module/config experience in Elementa;
- insert Elementa components inside OneConfig pages;
- keep Svelte or CEF as a production fallback after native acceptance;
- duplicate Minecraft server connection, world loading, resource-pack,
  GameSettings, key-binding, or OptiFine internals;
- redesign launcher account security or move launcher secrets into the game;
- rename all upstream packages before the stock baseline succeeds;
- remove legal notices under the label of removing product branding;
- promise public distribution while the OneConfig attribution decision is
  unresolved;
- delete historical implementation source until equivalent native behavior is
  proven and packaging checks prevent regression.

## 4. Repository baseline and constraints

### 4.1 Repository ownership

The Opus superproject owns integration documents, scripts, release locks, and
whole-product verification. Runtime owns code executed inside Minecraft,
including the OneConfig fork integration and Elementa shell. Launcher owns
installation, authentication, artifact staging, and process lifecycle.

Dependency direction:

    opus superproject -> launcher
    opus superproject -> runtime
    launcher          -> versioned runtime artifacts
    runtime           -X-> launcher source

### 4.2 Current in-game UI path

The current legacy client still contains a web-composited route:

1. runtime/legacy/1.8.9/client/build.gradle builds ui with npm.
2. ui/dist is packaged as opusui resources.
3. OpusInteropServer serves the bundle and bridge data.
4. OpusWebViewClient and OpusWebTextureSurface use an off-screen web view.
5. OpusClientScreen displays the web texture in Minecraft.
6. OpusClientMod guards the route behind opus.client.ui.enabled.

The current module and HUD prototypes are intentionally small:

- module/ClientModule.java exposes identity and enabled state.
- module/ModuleRegistry.java owns the current module collection.
- FpsModule.java and ArmorStatusModule.java are initial real-data examples.
- hud/HudManager.java and HudWidget.java own the custom prototype editor and
  runtime behavior.
- PerformanceOverlaySettings.java, ArmorStatusSettings.java, and
  UtilitySettingsStore.java provide current persistence evidence.

These types are migration inputs, not the final configuration architecture.

### 4.3 Dirty-worktree rule

The superproject, Runtime, Launcher, and UI contain existing user changes.
Implementation must:

- preserve unrelated modifications and deletions;
- avoid reset, checkout, bulk cleanup, or submodule-pointer rewriting;
- inspect overlapping files before every edit;
- make small reviewable patches;
- report when an existing modification prevents a safe edit.

### 4.4 Existing verification gates

The current client Gradle lane includes useful gate patterns:

- verifyToolchainInputs
- verifyRetiredUiSources
- verifyClientArtifact
- harnessBridge
- harnessWebView
- runUiPreview

The native migration may replace bridge and WebView-specific expectations, but
must retain equivalent or stronger gates for dependency locks, forbidden
production paths, artifact contents, config behavior, and real-game previews.

## 5. Audited dependency baseline

### 5.1 OneConfig fork point

Frozen source:

    repository: Polyfrost/OneConfig
    branch: develop-v0
    commit: 233452661e6d273f130230bb8e1813fb0a28b80a
    version: 0.2.2-alpha228
    target: 1.8.9-forge

The first baseline must use this source without Opus presentation changes. Its
upstream history and license files must be preserved.

Important source families:

- config and config/elements for model and option trees;
- config/annotations for automatic setting declarations;
- gui, gui/pages, and gui/elements for the production config frontend;
- internal/config/core/ConfigCore.java for lifecycle and persistence;
- internal/config/profiles/Profiles.java for profiles;
- hud and internal/hud for HUD models and runtime;
- internal/gui/HudGui.java for the HUD editor;
- renderer and internal/renderer for NanoVG, text, scissor, and GL behavior;
- utils/gui/OneUIScreen.java for the Minecraft screen host;
- utils/InputHandler.java and SearchUtils.java for input and search.

### 5.2 Elementa candidate

Frozen candidate:

    repository: EssentialGG/Elementa
    commit: 01392527e98e83026e52f27396775cf042f3e922
    artifact: gg.essential:elementa:762

The relevant primitives are WindowScreen, Window, UIComponent, the constraint
system, input components, scrolling, events, effects, transitions, and font
providers.

### 5.3 UniversalCraft candidate

Frozen candidate:

    repository: EssentialGG/UniversalCraft
    commit: e507b65e6bd76c88d6d461db8a5f8a0cdf066c85
    artifact: gg.essential:universalcraft-1.8.9-forge:516

Elementa's frozen source catalog declares UniversalCraft 494, while the current
Opus candidate is 516. Published artifacts existing is not compatibility
evidence. Elementa 762 plus UniversalCraft 516 must compile and run in the
exact game lane before the pair is pinned.

OneConfig also bundles or relocates its own UniversalCraft version. Both
libraries must coexist without classpath, mixin, event, or rendering conflicts.

### 5.4 Legal gate

OneConfig is LGPL-3.0 with additional terms. Elementa and UniversalCraft are
LGPL-3.0 in the inspected source. Before public or commercial distribution:

- resolve the OneConfig visible-attribution path;
- complete the transitive dependency inventory;
- retain required license and modification notices;
- publish or provide the required source/relinking mechanism;
- generate third-party notices and immutable dependency checksums.

Private source integration and technical testing may proceed while this gate is
open. A release artifact may not.

## 6. Target code ownership

The exact physical import mechanism is finalized in Workstream A. The preferred
shape is a history-preserving subtree in Runtime so the existing three-repo
architecture does not silently become a four-repo architecture.

Proposed Runtime ownership:

    runtime/
        third_party/
            oneconfig/
                upstream source and build
        legacy/1.8.9/client/
            src/main/java/org/polydevs/opusmc/client/
                design/
                    OpusDesign
                    OpusColors
                    OpusTypography
                    OpusSpacing
                    OpusMotion
                    OpusInteractionState
                module/
                    OpusModule
                    OpusModuleDescriptor
                    OpusModuleCatalog
                    OpusModuleStateStore
                config/
                    OpusSettingSchema
                    OpusConfigSnapshot
                    OpusConfigRepository
                profile/
                    OpusProfileService
                    OpusProfileTransaction
                hud/
                    OpusHudDefinition
                    OpusHudState
                oneconfig/
                    OneConfigBootstrap
                    OneConfigThemeAdapter
                    OneConfigModuleAdapter
                    OneConfigProfileAdapter
                    OneConfigHudAdapter
                    OpusOneConfigUiLab
                elementa/
                    ElementaBootstrap
                    ElementaThemeAdapter
                    OpusElementaUiLab
                    navigation/
                    components/
                    screens/
                    adapters/

This tree is a target responsibility map, not authorization for a bulk move.
Existing classes migrate incrementally after behavior tests cover them.

### 6.1 Boundary rules

- Domain module code depends on Opus contracts, not page classes.
- OneConfig-specific types stay in the fork or OneConfig integration package
  where practical.
- Elementa-specific types stay in the Elementa integration package.
- Screens call adapters; they do not directly duplicate Minecraft internals.
- OpusDesign contains values and semantics, not renderer calls.
- Persistence has one writer per data domain.
- Profile switching uses one coordinated transaction.
- Route ownership is explicit; no screen is implemented by both engines in
  production.

## 7. Required contracts

Names below are design-level names. Exact Java or Kotlin signatures may change
during implementation, but the responsibilities and invariants are required.

### 7.1 OpusModuleDescriptor

Required fields:

- stable ID that never depends on display text;
- display name and description;
- category and optional tags;
- aliases and search keywords;
- icon reference;
- default enabled state;
- optional warning or compatibility metadata;
- optional config schema ID;
- optional HUD definition ID;
- sort priority.

Invariants:

- IDs are unique and stable across versions;
- body click opens details;
- toggle click only changes enabled state;
- enabled state mutation emits one observable change;
- module metadata is searchable without instantiating a UI page.

### 7.2 OpusSettingSchema

Supported initial setting kinds:

- switch and checkbox;
- bounded integer and decimal number;
- slider;
- enum or dropdown;
- color with opacity;
- key binding;
- validated text;
- action button;
- section/header;
- nested settings page;
- HUD-derived options.

Every setting provides:

- stable key;
- title and optional description;
- type and default value;
- validation or numeric bounds;
- visibility and enabled conditions;
- profile-specific or global scope;
- change callback semantics;
- optional search aliases;
- migration version when persisted shape changes.

The OneConfig bridge should first attempt direct adaptation to its option tree.
If the frozen API cannot express the schema safely, use explicit generated or
handwritten OneConfig config wrappers. Do not use runtime bytecode generation
unless a separate proof establishes that it is necessary and reproducible.

### 7.3 OpusConfigRepository

Required operations:

- load a versioned snapshot;
- validate and migrate before application;
- stage changes without partially mutating runtime state;
- commit atomically where the filesystem permits;
- rollback to the previous valid in-memory snapshot on failure;
- flush on deterministic lifecycle events;
- preserve unknown fields when feasible for forward compatibility;
- expose diagnostics without leaking secrets.

### 7.4 OpusProfileService

A profile snapshot includes:

- module enabled states;
- profile-scoped settings;
- HUD positions, scale, visibility, and layout options;
- selected profile metadata.

Profile-independent fields remain outside the transaction.

Switch sequence:

1. Validate the destination profile.
2. Capture the current complete snapshot.
3. Stage destination module, setting, and HUD values.
4. Apply them while user interaction is blocked.
5. Refresh both UI models once.
6. Persist selected-profile metadata.
7. Roll back the complete previous snapshot if any stage fails.

The user must never observe modules from one profile and HUD state from another.

### 7.5 OpusDesign

The shared token contract contains:

- semantic colors for background, surfaces, borders, text, accent, success,
  warning, danger, disabled, selection, focus, and overlays;
- spacing scale;
- radius and border scales;
- type families, weights, sizes, line heights, and letter spacing;
- component heights and hit-target minimums;
- icon metrics;
- elevation and shadow semantics;
- animation durations and easing curves;
- disabled, hover, pressed, focused, selected, error, and locked states;
- density and GUI-scale rules.

It must not expose NanoVG, Elementa, Minecraft, or LWJGL classes.

Both theme adapters must implement a parity test that renders or describes the
same canonical component state matrix from the same token values.

### 7.6 Minecraft shell adapters

Required adapter families:

- ScreenNavigationAdapter for transitions, parent screens, and escape behavior;
- GameOptionsAdapter for typed GameSettings reads, writes, apply, cancel, and
  save;
- KeyBindingAdapter for conflict detection and reset;
- AudioOptionsAdapter for sound categories and device behavior available in
  the exact runtime;
- LanguageAdapter for language selection and resource reload;
- ResourcePackAdapter for selected/available pack ordering and reload;
- ServerListAdapter for load, save, reorder, edit, direct-connect, ping, and
  join delegation;
- WorldListAdapter for enumerate, select, create, rename, delete, recreate,
  conversion warnings, and launch delegation;
- OptiFineOptionsAdapter for supported OptiFine options without copying or
  depending on unstable private presentation code;
- ClientInformationAdapter for version, diagnostics, notices, and safe account
  metadata.

Every destructive operation keeps Minecraft's existing confirmation semantics.

## 8. Workstream A — source, license, and dependency freeze

### Objective

Create a reproducible dependency foundation before product edits.

### Tasks

1. Record source URLs, branches, immutable commits, artifact coordinates,
   checksums, license checksums, and retrieval dates in a machine-readable lock.
2. Choose and document the OneConfig import method. Prefer a git subtree under
   Runtime if it can preserve history and build independently.
3. Keep the first import byte-identical to the frozen source.
4. Add an Opus patch ledger recording changed upstream files and why.
5. Resolve a Java 8-compatible build lane on the ARM host, including an x86_64
   Gradle launcher if the upstream toolchain requires it.
6. Capture the complete OneConfig and Elementa dependency graphs.
7. Detect duplicate and relocated classes in the final client artifact.
8. Generate draft notices and source-location files from locked inputs.

### Proof artifacts

- immutable dependency lock;
- source import commit and upstream ancestry evidence;
- stock build log and artifact checksum;
- complete dependency graph;
- class-collision report;
- updated license audit.

### Exit gate

No product styling starts until the untouched OneConfig source builds
reproducibly. Public release remains blocked until the legal decision is
recorded.

## 9. Workstream B — exact runtime baseline

### Objective

Define one repeatable environment in which all UI evidence is collected.

### Tasks

1. Lock Minecraft 1.8.9, Forge 11.15.1.2318, OptiFine HD U M5, mappings,
   launch arguments, Java runtime, natives, and asset indexes.
2. Record OS, architecture, display scale, framebuffer size, GUI scale, and
   fullscreen state in every UI test report.
3. Add a native UI diagnostic overlay or log record with renderer, scale,
   focused component, active route, and last input event.
4. Preserve clean logs for each baseline run.
5. Define screenshot naming and evidence retention.

### Exit gate

One command assembles and launches the exact test runtime, and the resulting
report identifies every mutable environment input.

## 10. Workstream C — stock OneConfig proof

### Objective

Prove the behavior that Opus intends to retain before modifying it.

### Runtime cases

- open and close OneConfig repeatedly;
- navigate module browser and module detail;
- mutate every supported option type;
- verify conditions and disabled states;
- invoke a callback and action button;
- search modules and settings;
- create, duplicate, rename, switch, and delete profiles;
- edit HUD position, scale, resize, snapping, and visibility;
- restart the game and compare stored values;
- switch GUI scales and fullscreen while the UI is open;
- leave the UI and verify Minecraft rendering is uncorrupted.

### Instrumentation

- capture config files before and after each case;
- record GL errors and framebuffer changes;
- record route-open latency and frame-time samples;
- capture screenshots at known framebuffer dimensions;
- record exceptions and upstream defects without patching them silently.

### Exit gate

Every retained subsystem has a passing behavior test or a documented defect
with an explicit replace/fix decision.

## 11. Workstream D — OneConfig fork architecture map

### Objective

Turn the current static source audit into an implementation map tied to tests.

### Tasks

1. Trace OneConfigGui construction, navigation, modal ownership, input
   dispatch, page lifecycle, and screen teardown.
2. Trace ModsPage, SubModsPage, and ModConfigPage data flow.
3. Trace every config annotation to its option model and visual control.
4. Trace ConfigCore load, save, migration, callback, and failure behavior.
5. Trace Profiles profile-specific and global-field semantics.
6. Trace HudCore, HudGui, Position, HUDUtils, snapping, and persistence.
7. Trace SearchUtils ranking and page integration.
8. Trace NanoVG initialization, framebuffer binding, scissor conversion, font
   loading, and GL restoration.
9. Mark each class KEEP, MODIFY, REWRITE, REMOVE, or UNKNOWN.
10. Bind every KEEP decision to a regression test.

### Exit gate

No visible OneConfig production surface remains UNKNOWN, and every retained
behavior has a named test.

## 12. Workstream E — Opus module and config domain

### Objective

Replace the current minimal module contract with stable Opus-owned semantics
that OneConfig can render and persist.

### Tasks

1. Add descriptors and stable categories to the current FPS and Armor Status
   modules.
2. Convert PerformanceOverlaySettings and ArmorStatusSettings into the first
   versioned schemas.
3. Wrap UtilitySettingsStore with OpusConfigRepository; do not delete it until
   migration and restart tests pass.
4. Implement a OneConfig adapter for the two initial modules.
5. Verify body-click versus toggle-click behavior.
6. Verify enable/disable callbacks fire exactly once.
7. Add one example of every initial setting kind in a development-only module.
8. Add schema migration fixtures for missing, old, malformed, and future data.
9. Define module lifecycle order relative to Forge initialization and config
   load.

### Exit gate

FPS and Armor Status are rendered by the stock-styled OneConfig fork from
Opus-owned metadata, mutate real runtime behavior, and survive restart.

## 13. Workstream F — shared OpusDesign

### Objective

Create the single design source before rewriting either frontend.

### Current checkpoint — partial

The isolated proof lane now owns the first Java 8-compatible `OpusDesign`,
`ElementaThemeAdapter`, `OneConfigThemeAdapter`, parity verifier, and serialized
development report. The Elementa compatibility lab consumes this contract.
The current report covers 16 semantic color roles, eight interaction states, 11
typography styles, 3 icon metrics, 3 elevation tokens, 3 accessibility metrics,
shared spacing/radius/motion and component-size scales, one explicit density
policy, 20 framebuffer-rounding samples, and 32 canonical component/state
descriptions. The contract-level portions of the token, adapter, completeness,
and serialized-report tasks are implemented and statically gated. This
establishes the adapter boundary and regression gate, but does not close this
workstream's exit gate until actual font/rendering behavior and paired visual
review are performed in the exact game runtime.

### Tasks

1. Inventory existing Svelte token values as design evidence, not production
   runtime dependencies.
2. Normalize tokens into semantic names and platform-neutral value objects.
3. Specify logical pixels versus framebuffer pixels and rounding rules.
4. Specify focus rings, keyboard navigation, minimum hit targets, error states,
   scroll behavior, and reduced-motion behavior.
5. Implement OneConfigThemeAdapter.
6. Implement ElementaThemeAdapter.
7. Add token completeness tests so a new required token fails both adapters.
8. Add a serialized development dump for easy visual comparison.

Proof-lane status: items 2–8 are implemented at the renderer-neutral
contract/adapter/test/report level. Item 1 remains design evidence only, and
the production exit gate additionally requires actual frontend use, side-by-side
visual review, and exact-runtime evidence.

### Exit gate

Neither UI lab contains arbitrary page-local colors, radii, spacing, type
sizes, or motion durations except documented data-visualization exceptions.

## 14. Workstream G — OneConfig UI lab and primitives

### Objective

Rewrite OneConfig bottom-up before changing production pages.

### UI lab matrix

For each primitive, show normal, hover, pressed, focused, disabled, selected,
locked, loading, and error states where relevant:

- text styles and icons;
- button and icon button;
- module toggle;
- checkbox;
- slider and numeric input;
- dropdown;
- text input and keybind capture;
- color selector;
- setting row and section header;
- tooltip;
- modal and confirmation dialog;
- scrollbar and scroll container;
- search input;
- tabs and navigation items;
- module card;
- profile card;
- HUD selection frame and handles.

### Rewrite order

1. Font loading and text metrics.
2. Colors, surfaces, borders, and clipping.
3. Input/focus base behavior.
4. Buttons and navigation.
5. Inputs and setting controls.
6. Composite rows and cards.
7. Modals, overlays, and scroll behavior.
8. HUD editor affordances.

### Exit gate

The state matrix passes mouse, keyboard, scaling, clipping, and screenshot
review before production page rewrites begin.

## 15. Workstream H — module browser, detail, and search

### Module browser requirements

- stable category navigation;
- responsive card grid or list at every supported GUI scale;
- independent details and toggle hit targets;
- enabled, disabled, incompatible, and error states;
- module count and empty states;
- keyboard navigation and visible focus;
- search access without changing profile state;
- no OneConfig or Polyfrost product branding in Opus chrome;
- legally required attribution retained according to the release decision.

### Module detail requirements

- breadcrumb and unambiguous module identity;
- primary enabled state;
- description and compatibility information;
- sectioned automatically rendered settings;
- nested pages;
- conditions and disabled explanations;
- unsaved/error feedback if a commit fails;
- reset section and reset module actions with confirmation;
- setting search result deep-link and reveal.

### Search model

Index:

- module name, aliases, description, category, tags, and keywords;
- setting title, description, aliases, section, and owning module.

Ranking:

1. exact normalized match;
2. exact alias match;
3. prefix match;
4. token-prefix match;
5. substring match;
6. bounded fuzzy match.

Search must be deterministic. Results retain keyboard focus, explain their
module context, and reveal hidden-by-navigation settings without violating
runtime visibility conditions.

### Exit gate

At least 100 generated modules and 1,500 settings remain navigable and
searchable without incorrect mutation, clipping, or unacceptable stalls.

## 16. Workstream I — HUD runtime and editor

### Objective

Adopt proven OneConfig HUD mechanics while preserving Opus module semantics.

### Migration tasks

1. Map HudWidget state into OpusHudDefinition and OpusHudState.
2. Implement FPS and Armor Status using the selected OneConfig HUD base types.
3. Compare position, anchor, scale, bounds, and text metrics against current
   behavior.
4. Retire HudManager responsibilities one at a time after equivalent tests
   pass.
5. Keep HUD draw code separate from editor chrome.
6. Route module-specific HUD settings through the same config schema used by
   module detail.

### Editor requirements

- select, drag, resize or scale, snap, hide, and reset;
- multi-resolution safe-area visualization;
- keyboard nudging;
- clear selected and locked states;
- module settings access;
- predictable escape, cancel, and save behavior;
- no position jump when GUI scale changes;
- correct cursor and hit boxes on Retina/fractional framebuffers;
- profile-specific layout application as one transaction.

### Exit gate

Every HUD operation survives restart and profile switching, with screenshot and
serialized-state evidence at each supported GUI scale.

## 17. Workstream J — profiles and persistence

### Objective

Make profile switching reliable before polishing its UI.

### Tasks

1. Define the canonical Opus snapshot format and ownership of each field.
2. Decide whether OneConfig Profiles is the physical store or a lower-level
   engine behind OpusProfileService.
3. Add transaction and rollback behavior around module, config, and HUD state.
4. Test global fields through NonProfileSpecific semantics.
5. Test duplicate names, invalid filenames, interrupted writes, malformed
   JSON, read-only storage, and failed callbacks.
6. Rewrite profile presentation only after the engine cases pass.
7. Add import/export only if it can preserve versions and validate content.

### Exit gate

Create, duplicate, rename, switch, delete, restart, and failure recovery all
leave one coherent active state.

## 18. Workstream K — Elementa baseline and UI lab

### Objective

Prove the exact Elementa/UniversalCraft pair and build shared shell primitives.

### Baseline screen

The first screen contains:

- OpusDesign-backed text and surfaces;
- button and keyboard focus;
- text input and clipboard action;
- nested scroll areas;
- clipping;
- dropdown or overlay;
- animated state change;
- escape/back navigation;
- live framebuffer and GUI-scale diagnostics.

### Compatibility tests

- Elementa 762 with UniversalCraft 516;
- fallback to a source-matched UniversalCraft pair if 516 fails;
- coexistence with OneConfig's bundled or relocated UniversalCraft;
- class-collision scan;
- initialization-order variation;
- opening OneConfig after Elementa and Elementa after OneConfig;
- repeated screen switching;
- GL and framebuffer restoration.

### UI lab

Implement Elementa equivalents for shell navigation, primary and secondary
buttons, icon buttons, setting rows, sliders, toggles, dropdowns, text inputs,
cards, lists, tabs, tooltips, modals, scroll containers, loading, empty, and
error states.

### Exit gate

The candidate pair is immutable, all baseline cases pass in the exact runtime,
and equivalent Elementa and OneConfig controls pass the visual parity matrix.

## 19. Workstream L — Elementa shell screens

Implement screens in dependency order so adapters are proven before broad
presentation work.

### L0. Responsive shell foundation and visual direction

Before expanding routes, define and implement the shell composition contract:

- minimum, reference, wide, and tall logical size classes;
- responsive Elementa constraints, content bounds, stacks, grids, and
  compact-mode breakpoints;
- minimum readable text and hit-target dimensions;
- one source of truth for draw and hit-test coordinates;
- title and pause shell review using Vanilla Minecraft structure with restrained
  Lunar Client-inspired OPUS polish.

Exit gate: the shell reflows without clipping or detached controls at every
supported size class, and the visual direction is approved before route
expansion.

### L1. Navigation shell

- central route registry and owner declaration;
- parent/child navigation;
- escape behavior;
- modal stack;
- focus restoration;
- transition rules;
- route diagnostics.

### L2. Pause menu

- resume;
- Opus modules route to OneConfig;
- HUD editor route to OneConfig;
- Minecraft settings route to Elementa;
- disconnect using Minecraft logic;
- return-to-menu behavior;
- game remains correctly paused or unpaused.

This is the smallest production shell integration and should ship to internal
testing first.

### L3. Main menu

- singleplayer;
- multiplayer;
- account/client information;
- Minecraft settings;
- quit;
- safe version and connection status;
- background/panorama behavior selected explicitly and performance-tested.

### L4. Settings home and categories

- typed adapters for GameSettings;
- apply, cancel, reset, and save semantics;
- controls/keybindings and conflict states;
- audio;
- chat;
- interface;
- language and resource packs;
- video settings and OptiFine delegation.

Settings writes must preserve vanilla side effects such as renderer reloads,
sound changes, resource refresh, and options persistence.

### L5. Server list

- real saved server data;
- server ping lifecycle;
- add, edit, delete, reorder, refresh, direct connect, and join;
- selection and double-click semantics;
- confirmation for destructive actions;
- graceful malformed-data and network-failure states.

### L6. World list

- real save enumeration;
- version/conversion warnings;
- select, create, rename, delete, recreate, and launch;
- last-played and game-mode metadata;
- integrated-server startup delegated to Minecraft;
- graceful unavailable or corrupted-save states.

### L7. Account and client information

- display only safe account metadata already supplied to the game;
- no launcher refresh tokens or authentication secrets;
- client version, runtime diagnostics, licenses, notices, and support data;
- external-link behavior is explicit and safe.

### Exit gate

Every route operates on real Minecraft data, returns to the correct parent,
survives restart where state is persistent, and has empty, loading, error, and
confirmation coverage. The title and pause routes must also satisfy the
responsive size-class and approved Vanilla/Lunar visual review gates.

## 20. Workstream M — OptiFine, rendering, input, and scaling

### Matrix

Test at minimum:

- GUI scale Auto, 1, 2, 3, and 4 where available;
- windowed and fullscreen;
- standard and Retina/HiDPI framebuffers;
- resize while each frontend is open, including repeated grow/shrink cycles;
- OptiFine Fast Render off and on where supported;
- shaders off and representative shader configuration;
- antialiasing and anisotropic settings relevant to the runtime;
- framebuffer enable/disable changes;
- Minecraft lost/regained focus;
- English plus a language with wider glyphs;
- keyboard-only and mouse-only navigation.

### GL invariants

- restore framebuffer binding;
- restore viewport and scissor;
- restore blend, depth, alpha, texture, stencil, and color state;
- do not leak NanoVG or Elementa state into Minecraft rendering;
- do not leave stale cursor or keyboard repeat state;
- recreate resources safely after display or framebuffer changes;
- release screen resources on shutdown.

Resize handling must be lifecycle-safe: preserve the active route, parent
screen, focus, cursor, and input state; recompute logical bounds and scissor
regions; and recreate any display-dependent resources without stale references.

### Coordinate invariants

- one documented conversion between logical UI coordinates and framebuffer
  coordinates per renderer;
- hit testing uses the same rounding model as drawing;
- scissor rectangles use framebuffer coordinates correctly;
- HUD positions do not drift after repeated scale changes;
- text baselines and focus rings remain pixel-stable.

### Exit gate

The complete matrix has no critical clipping, input offset, GL corruption,
resource leak, unrecoverable screen failure, or resize crash. It must also show
responsive reflow and aligned drawing/hit-testing at the minimum, reference,
wide, and tall size classes.

## 21. Workstream N — retire CEF, Svelte, and parallel native UI

### Preconditions

Retirement begins only after:

- OneConfig production routes pass;
- Elementa production routes pass;
- native persistence and restart tests pass;
- the native artifact can be launched without the web path;
- a rollback commit is recorded.

### Retirement sequence

1. Change production route selection to native by default.
2. Keep the web path development-only for one evidence cycle if needed.
3. Add an artifact gate forbidding CEF/WebView classes, helpers, and opusui
   production resources.
4. Remove npm build dependency from the client artifact lane.
5. Remove OpusInteropServer and bridge code after no native caller remains.
6. Remove OpusWebViewClient, OpusWebTextureSurface, and native helper packaging.
7. Remove the old custom UiRenderer path after HUD and shell replacements pass.
8. Archive or delete the Svelte prototype according to repository history
   policy; do not keep it wired into release.
9. Update release locks, launcher staging, documentation, and tests.

### New gate replacements

- verifyNativeUiDependencies
- verifyNoProductionWebUi
- verifyNoDuplicateUiRoutes
- verifyOneConfigForkLock
- verifyElementaLock
- verifyThirdPartyNotices
- verifyNativeClientArtifact
- harnessConfigPersistence
- harnessProfileTransaction
- harnessRouteOwnership
- runNativeUiPreview

### Exit gate

The release client contains exactly two intended UI frameworks, has no web UI
runtime dependency, and still passes every production route.

## 22. Workstream O — performance, QA, and release

### Initial budgets

Measure before optimizing. The initial acceptance targets are:

- warm route opening normally completes within 150 ms on the reference host;
- input changes are visible by the next rendered frame;
- scrolling does not create sustained frame-time spikes over 33 ms;
- opening and closing either frontend 100 times does not show unbounded native
  or heap growth;
- UI-closed gameplay performance does not regress more than 10 percent in the
  selected repeatable scene relative to the native baseline;
- search remains interactive with 100 modules and 1,500 settings;
- no network operation runs on the render thread;
- config/profile writes do not block the render thread for visible intervals.

If reference hardware cannot support a threshold, record the measured baseline
and approve a revised target explicitly instead of silently weakening it.

### Automated checks

- Java/Kotlin compilation and tests;
- dependency verification and checksums;
- forbidden class/resource scans;
- duplicate class scan;
- schema migration fixtures;
- profile transaction fault injection;
- search ranking fixtures;
- route ownership test;
- token completeness and adapter parity tests;
- artifact manifest and third-party notice verification.

### Manual evidence

- real-game screenshot matrix;
- mouse, keyboard, scroll, focus, and text-input run;
- server and world operations with disposable fixtures;
- restart and profile-isolation run;
- HUD edit and scale run;
- OptiFine/GL matrix;
- performance capture;
- accessibility/readability review.

### Release gate

No public artifact until technical acceptance, reproducibility, notices,
source/relinking requirements, and the OneConfig attribution decision all pass.

## 23. Source-to-change map

### Current Opus files

| Current path | Planned responsibility |
| --- | --- |
| runtime/legacy/1.8.9/client/build.gradle | dependency locks, native build, artifact and retirement gates |
| OpusClientMod.java | initialize route owners and native UI bootstrap |
| OpusClientScreen.java | retire after Elementa/OneConfig screens own production routes |
| ClientOverlayController.java | narrow to route orchestration, then retire web-specific behavior |
| module/ClientModule.java | migrate to OpusModule contract |
| module/ModuleRegistry.java | migrate to OpusModuleCatalog |
| FpsModule.java | first module bridge and HUD fixture |
| ArmorStatusModule.java | second module bridge and HUD fixture |
| hud/HudManager.java | migrate behavior to OneConfig HUD, then retire |
| hud/HudWidget.java | migrate to OpusHudDefinition/OneConfig HUD |
| UtilitySettingsStore.java | migration source; replace only after parity |
| embed/OpusWebViewClient.java | remove after native acceptance |
| embed/OpusWebTextureSurface.java | remove after native acceptance |
| interop/OpusInteropServer.java | remove after native callers and preview use are gone |
| ui/render/MinecraftUiRenderer.java | retire after no HUD/shell caller remains |
| ui/render/MinecraftUiScale.java | preserve scale evidence; reuse logic only behind native tests |
| ui/ | design reference only, then archive/remove from production build |

All paths after OpusClientMod.java in this table are relative to
runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client unless
otherwise stated.

### Frozen OneConfig files

| Upstream area | Planned change |
| --- | --- |
| gui/OneConfigGui.java | Opus module shell and navigation |
| gui/SideBar.java | rewrite presentation and route set |
| gui/pages/ModsPage.java | Opus module browser |
| gui/pages/SubModsPage.java | categories or remove if redundant |
| gui/pages/ModConfigPage.java | Opus module detail and setting layout |
| gui/elements/BasicElement.java | input/focus audit and shared state semantics |
| gui/elements/BasicButton.java | Opus primitive |
| gui/elements/ModCard.java | independent body/toggle behavior |
| gui/elements/Slider.java | Opus visuals with verified mechanics |
| gui/elements/Dropdown.java | Opus overlay, focus, and keyboard behavior |
| gui/elements/ColorSelector.java | Opus presentation |
| gui/elements/config/* | all automatic setting rows and controls |
| gui/elements/text/* | input, clipboard, validation, and focus |
| internal/config/core/ConfigCore.java | retain, wrap, and fault-test |
| internal/config/profiles/Profiles.java | retain engine, coordinate transaction |
| internal/gui/HudGui.java | full Opus editor presentation |
| internal/hud/* and hud/* | retain verified mechanics, adapt Opus semantics |
| utils/SearchUtils.java | deterministic Opus search index/ranking |
| utils/gui/OneUIScreen.java | lifecycle, scale, and input verification |
| internal/renderer/* | GL, scissor, font, framebuffer, and HiDPI audit |
| renderer/asset/* and internal/assets/* | replace product assets with provenance |

### Elementa files used as contracts

Elementa should normally remain a pinned library. The integration relies on:

- WindowScreen.kt for Minecraft hosting;
- Window.kt for root rendering and event ownership;
- UIComponent.kt for the component tree;
- components and components/input for primitives;
- constraints for layout;
- events for input and focus;
- effects for clipping, outline, and stencil behavior;
- transitions for motion;
- font for text rendering.

Fork Elementa only if a validated runtime defect cannot be safely adapted
outside the library.

## 24. Verification matrix

| Area | Unit/static proof | In-game proof |
| --- | --- | --- |
| Dependency freeze | hashes, graph, duplicate-class scan | exact artifact versions logged |
| OneConfig options | schema and callback fixtures | mutate all types and restart |
| Module lifecycle | state transition tests | runtime feature visibly changes |
| Search | ranking fixtures | keyboard and result deep-link |
| Profiles | transaction/fault tests | switch, restart, rollback |
| HUD | transform and persistence tests | drag, snap, scale, restart |
| OpusDesign | token completeness | side-by-side UI labs |
| Elementa input | adapter/component tests | mouse, keyboard, scroll, clipboard |
| Game settings | typed adapter tests | side effects and options.txt persistence |
| Server list | fixture serialization | ping, edit, reorder, join |
| World list | disposable save fixtures | create, rename, delete, launch |
| OptiFine | option mapping audit | compatibility matrix |
| Rendering | forbidden-state and resource checks | GL error and screenshot matrix |
| Resize lifecycle | display/framebuffer lifecycle fixtures | repeated grow/shrink cycles with no crash or stale resources |
| Responsive layout | constraint/breakpoint tests | minimum/reference/wide/tall screenshots and hit-test checks |
| Shell visual direction | token/route ownership review | Vanilla-structure plus restrained Lunar/OPUS visual review |
| Retirement | artifact content scan | launch with no web helper/process |
| Release | notices, source path, lock checks | installed artifact smoke run |

## 25. Risks and decision gates

### R1. OneConfig cannot build on the available host toolchain

Response: provide an x86_64 Java 8 toolchain plus compatible Gradle launcher,
containerized or CI proof. Do not edit product source to hide a host bootstrap
problem.

### R2. Elementa 762 and UniversalCraft 516 are incompatible

Response: test the exact source-matched UniversalCraft version, then choose the
newest immutable pair that passes. Record the decision and hashes.

### R3. UniversalCraft collisions between OneConfig and Elementa

Response: inspect final bytecode and dependency resolution; prefer OneConfig's
existing relocation plus an isolated Elementa lane. Patch relocation only with
runtime and legal review.

### R4. OneConfig fork is too tightly coupled to its original module model

Response: use explicit Opus adapters or config wrappers. Replace a subsystem
only after tracing and testing demonstrates that adaptation is less safe.

### R5. Profile switching is not atomic

Response: place OpusProfileTransaction above OneConfig's lower-level calls and
add rollback/fault-injection tests before UI polish.

### R6. NanoVG or Elementa leaks GL state under OptiFine

Response: instrument state boundaries, add explicit guards where required, and
keep both frontends blocked from production until repeated switching passes.

### R7. Visual parity drifts across frameworks

Response: shared tokens, paired UI labs, common state vocabulary, and
screenshot review. Do not share renderer components across frameworks.

### R8. Minecraft shell rewrite changes game behavior

Response: presentation calls typed adapters backed by existing Minecraft logic.
Use disposable world/server fixtures and compare side effects.

### R9. Legal terms conflict with desired branding

Response: retain legally required attribution in development builds and block
distribution until written authorization or another reviewed path exists.

### R10. The dirty worktree hides accidental regression

Response: inspect diffs per file, patch narrowly, capture status before and
after each milestone, and never normalize unrelated changes.

### R11. Window resize crashes the client

Response: treat `UI-001` as a P0 release blocker; reproduce first, trace the
display/framebuffer/resource lifecycle, and block broader interaction claims
until repeated exact-runtime resize cycles pass.

### R12. Fixed composition fails at different window sizes

Response: treat `UI-003` as a follow-on P0 gate; define explicit size classes,
constraints, and compact breakpoints, then review the shell against Vanilla
Minecraft structure and restrained Lunar/OPUS polish.

## 26. Milestone dependency graph

    M0 repository and exact-runtime inventory
        |
        +-- M1 source, license, and dependency freeze
        |       |
        |       +-- M2 stock OneConfig proof
        |       |       |
        |       |       +-- M3 OneConfig architecture/test map
        |       |               |
        |       |               +-- M5 module/config domain
        |       |               +-- M7 OneConfig UI lab
        |       |
        |       +-- M4 Elementa/UniversalCraft proof
        |               |
        |               +-- M8 Elementa UI lab
        |
        +-- M6 shared OpusDesign
                |
                +-- M7 OneConfig UI lab
                +-- M8 Elementa UI lab

    M5 + M7 -> M9 module browser/detail/search
    M5 + M7 -> M10 HUD migration/editor
    M5 + M7 -> M11 profiles/persistence
    M4 + M6 + M8 -> M12 Elementa navigation/pause menu
    M12 -> M13 main menu/settings
    M12 -> M14 server/world/account screens
    M9 + M10 + M11 + M13 + M14 -> M15 compatibility/performance
    M15 -> M16 web/custom UI retirement
    M16 + legal gate -> M17 release candidate

M2 and M4 can proceed in parallel once M1 provides immutable inputs. M6 can
proceed from approved design evidence while runtime baselines are being built.
Production page work must wait for the corresponding UI lab.

## 27. Revised execution order after current user-test checkpoint

This order is paused pending user confirmation:

1. Reproduce `UI-001` from the packaged exact-runtime launch and retain the
   crash, display, framebuffer, and native UI evidence.
2. Fix and verify resize lifecycle safety through repeated grow/shrink cycles,
   including route, focus, input, clipping, and GL/resource checks.
3. Implement responsive size classes, constraints, content bounds, and
   compact-mode reflow; verify controls at minimum, reference, wide, and tall
   sizes.
4. Redesign the title and pause shells using Vanilla Minecraft structure with
   restrained Lunar/OPUS polish and complete visual review.
5. Resume Right Shift/OpusConfig, persistence, exact-runtime, and launcher
   packaging acceptance.

## 28. Historical immediate execution order

The first implementation cycle should be:

1. Add a machine-readable dependency/source lock for OneConfig, Elementa, and
   UniversalCraft.
2. Make the frozen OneConfig source build unchanged with a recorded artifact
   hash.
3. Launch stock OneConfig in the exact Forge/OptiFine runtime and capture the
   baseline matrix.
4. Compile and launch the minimal Elementa screen with the candidate
   UniversalCraft pair.
5. Resolve duplicate-class and coexistence behavior by opening both frontends
   in both orders.
6. Introduce the minimal OpusDesign contract and adapters.
7. Build both UI labs with button, toggle, slider, input, scrolling, modal, and
   focus states.
8. Introduce OpusModuleDescriptor and adapt FPS and Armor Status.
9. Render those modules and settings in still-stock-layout OneConfig.
10. Implement the Elementa pause menu as the first production shell and route
    Modules/HUD to OneConfig.
11. Rewrite OneConfig primitives, then module browser/detail/search.
12. Migrate HUD, profiles, and persistence.
13. Expand the Elementa shell.
14. Run compatibility/performance acceptance.
15. Retire the web and parallel custom UI paths.

This order maximizes early evidence. It proves dependency and runtime viability
before expensive visual work and proves adapters with two real modules before
broad migration.

## 29. Definition of done

The UI program is done when:

- the exact dependency revisions and source are reproducible;
- OneConfig visibly and behaviorally presents as Opus while retaining required
  legal notices;
- OneConfig exclusively owns module/config/search/profile/HUD production
  routes;
- Elementa exclusively owns the selected Minecraft shell routes;
- both use the same OpusDesign semantics;
- every screen uses real game data and delegates game operations correctly;
- profile switching is coherent and recoverable;
- all persisted state survives restart;
- HUD placement is stable across display and GUI scale changes;
- resizing the Minecraft window is crash-free and display-dependent resources
  are recreated safely;
- shell controls and content reflow responsively with aligned drawing and
  hit-testing across the supported size classes;
- title and pause shells pass the approved Vanilla/Lunar visual review;
- input and GL state remain correct across the compatibility matrix;
- stress and performance targets pass or have an explicitly approved revision;
- the production artifact contains no CEF/Svelte/WebView or retired custom UI
  dependency;
- release notices, source obligations, attribution decision, and checksums are
  complete;
- the final evidence bundle contains build logs, artifact hashes, test results,
  game logs, state snapshots, and real-game screenshots.

Until those conditions are met, the architecture is an active migration rather
than a completed UI implementation.
