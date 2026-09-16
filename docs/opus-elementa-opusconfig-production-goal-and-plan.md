# OPUS production goal and implementation plan

## Elementa Minecraft shell + OpusConfig opened with Right Shift

Status: **historical/paused — superseded as the active UI implementation plan
on September 15, 2026**

> The active product direction is
> [Decision 0008](decisions/0008-opus-client-launcher-ui-first-mainline.md):
> Opus Client + Opus Launcher, UI first. This plan is retained as historical
> implementation/reuse evidence. It does not select Elementa/OneConfig,
> CEF/Svelte, native UI, or another renderer for the current UI-first mainline.
>
> Every “current,” “production,” and sequencing statement below describes the
> August 2026 plan context only. It is not a current implementation instruction.

This document records a former concrete UI migration goal for the Opus
superproject, Runtime, and Launcher repositories.

The current repository does **not** satisfy this goal yet. The existing
OneConfig/Elementa work is an isolated compatibility proof and design baseline;
it is not the production game artifact. Completion means that a clean launcher
install starts Minecraft with the native UI integration enabled and the user
can press **Right Shift** to open the customized **OpusConfig** interface.

The current user-test blockers are tracked in
[docs/opus-elementa-opusconfig-known-issues.md](opus-elementa-opusconfig-known-issues.md).
Implementation is paused until the user confirms the revised priority order;
the product scope remains unchanged.

---

## 1. Product goal

Build a native Minecraft 1.8.9 client UI with two deliberate owners:

```text
Minecraft 1.8.9 + Forge 11.15.1.2318 + OptiFine HD U M5
                              |
                  OPUS native client integration
                     /                       \
                    /                         \
       Elementa + UniversalCraft          forked OneConfig
       Minecraft shell UI                  branded as OpusConfig
       --------------------                -----------------------
       main menu                           module browser
       pause menu                          module details
       Minecraft settings                  settings and search
       controls/audio/chat/interface       profiles
       server and world lists               HUD editor/runtime
       account/client information           automatic option rendering
                              ^
                              |
                  Right Shift opens OpusConfig
```

### Required user-visible behavior

1. The launcher installs and stages the complete native UI runtime.
2. Minecraft loads the OPUS native client UI mod alongside the verified OPUS
   bootstrap/core integration and the required locked UI dependencies.
3. Pressing the **right** Shift key (`Keyboard.KEY_RSHIFT`) opens OpusConfig.
4. OpusConfig presents OneConfig's module/config/profile/HUD capabilities with
   Opus branding and the shared Opus visual language.
5. Elementa replaces the selected Minecraft shell screens while preserving
   Minecraft's real game behavior through adapters.
6. Escape, Back, Right Shift, mouse, keyboard, scrolling, text input, GUI
   scale, fullscreen, and window resize behave correctly.
7. Configuration, profiles, module state, HUD state, and Minecraft options
   survive restart without cross-profile corruption.
8. Shell controls and content reflow across supported logical sizes, GUI
   scales, fullscreen, windowed, and HiDPI modes without clipping or hit-test
   drift.
9. The shell follows the approved visual direction: familiar Vanilla
   Minecraft structure with restrained Lunar Client-inspired OPUS polish.

### Product naming

The visible product name is **OpusConfig**. Upstream OneConfig package names,
class names, namespaces, and legal notices are not renamed wholesale until a
stock baseline, compatibility map, and reflection/API audit prove that doing so
is safe. Branding changes must not remove required OneConfig attribution,
license text, or source/relinking obligations.

---

## 2. Current baseline and gap

### Already present

- Locked OneConfig, Elementa, and UniversalCraft dependency evidence.
- An isolated OneConfig proof module.
- An isolated Elementa behavior lab.
- A renderer-neutral `OpusDesign` contract and theme adapters.
- Static dependency, duplicate-class, artifact, and design-contract checks.
- A launcher that can build and open, but currently stages only the Forge
  bootstrap and telemetry Core Mod.

### Not yet present

- A production native client UI artifact in the launcher runtime.
- A production Right Shift keybind.
- A production route from Right Shift to OneConfig.
- The forked/customized OneConfig frontend branded as OpusConfig.
- Elementa production shell screens.
- Runtime packaging of OneConfig, Elementa, UniversalCraft, and the native
  client mod.
- Exact-runtime acceptance evidence from a clean launcher-launched game.

The plan must not mark a milestone complete based only on compilation or on
the isolated proof JAR.

### Current implementation checkpoint — August 24, 2026

Production-oriented Runtime source work has started, but it is not yet a
working product path:

- `OpusNativeUiMod` now contains the intended Forge entry point, physical
  `Keyboard.KEY_RSHIFT` binding, toggle debounce, OneConfig route, and initial
  main/pause screen interception.
- `OpusConfigModule` now registers a real annotation-backed OneConfig module
  named `OpusConfig`.
- `OpusElementaShellScreen` now provides initial Elementa main-menu and
  pause-menu routes backed by shared `OpusDesign` tokens.
- native UI diagnostics now use production-oriented names and properties.

This source is currently **unverified and not launchable as the finished
feature**. The native-client Gradle files, resource metadata, README, and
runtime-report verifier still refer to the deleted proof classes and proof
artifact names. The OneConfig source fork and customized OpusConfig frontend
have not been imported. Runtime root packaging and Launcher staging still
accept only the old bootstrap/Core Mod set. No current production build,
Launcher-launched Minecraft run, Right Shift acceptance run, commit, push, or
launcher handoff has passed yet.

### Current user-test checkpoint — August 24, 2026

The packaged exact-runtime client reached a fixed-size Elementa shell and the
native UI artifact build/staging path, but user testing identified three open
blockers:

- `UI-001` — resizing the Minecraft window crashes immediately (**P0**).
- `UI-002` — the current shell layout is visually unacceptable (**P1**).
- `UI-003` — buttons and layout do not reflow or scale with the window (**P0
  after the resize diagnosis**).

These findings supersede the earlier “Right Shift first, visual redesign
later” sequence. They do not remove Elementa, OpusConfig, Right Shift,
persistence, or launcher packaging from the goal. They change the next order
to: reproduce and fix resize safety; establish responsive layout constraints;
redesign the title/pause shell against the approved Vanilla/Lunar direction;
resume Right Shift and OpusConfig acceptance; then finish packaging and release
gates.

---

## 3. Architecture and ownership

### Superproject (`opus`)

Owns:

- this plan and architectural decisions;
- release locks and artifact manifests;
- cross-repository build, package, and verification scripts;
- third-party notices and release evidence;
- submodule pointers.

### Runtime

Owns all code loaded inside Minecraft:

- native client mod entry point and lifecycle;
- Right Shift keybind and screen routing;
- OneConfig fork/integration and OpusConfig branding;
- Elementa shell integration;
- Minecraft/Forge/OptiFine adapters;
- config, profile, module, HUD, persistence, and migration behavior;
- reproducible native UI artifacts.

### Launcher

Owns:

- installation and authentication;
- staging and checksum verification;
- runtime artifact discovery;
- managed game-mod directory construction;
- launch process lifecycle and status reporting;
- packaging the native UI dependency set without embedding credentials.

The dependency direction remains:

```text
superproject -> Launcher
superproject -> Runtime
Launcher     -> versioned Runtime artifacts
Runtime      -X-> Launcher source
```

### Production frontend boundary

| Area | Owner | Rule |
|---|---|---|
| Module browser/detail | OpusConfig | OneConfig fork owns the route |
| Settings and automatic controls | OpusConfig | Adapt the Opus schema to OneConfig |
| Module/settings search | OpusConfig | One search model and index |
| Profiles | OpusConfig | One atomic profile transaction |
| HUD editor/runtime | OpusConfig | Preserve real HUD state and persistence |
| Main menu | Elementa | Delegate game operations to Minecraft |
| Pause menu | Elementa | Preserve pause and resume semantics |
| Minecraft settings | Elementa | Adapt `GameSettings` and side effects |
| Controls/audio/chat/interface | Elementa | Do not duplicate Minecraft internals |
| Server list | Elementa | Delegate load/save/ping/join behavior |
| World list | Elementa | Delegate world lifecycle and warnings |
| Account/client information | Elementa | Expose safe game/client metadata |
| Shared colors, sizes, states | OpusDesign | No page-local competing theme |

No production screen may be owned simultaneously by both frameworks. No CEF,
Svelte, WebView texture, retired T-UI, or parallel custom renderer may remain
as a production fallback after native acceptance.

---

## 4. Right Shift contract

Right Shift is a first-class product requirement, not a proof shortcut.

### Default binding

- Forge client key binding;
- default key: `Keyboard.KEY_RSHIFT`;
- category: `Opus`;
- display label: `Open OpusConfig`;
- persisted through Minecraft's normal keybinding options where appropriate;
- stable default remains Right Shift even if the user later remaps it.

### Open/close behavior

- From gameplay: open OpusConfig and remember the previous screen/context.
- From the pause menu: open OpusConfig without losing the paused state.
- From supported shell screens: open OpusConfig and preserve the parent route.
- From an OpusConfig screen: a second Right Shift press returns to the prior
  screen, behaving as a toggle rather than stacking duplicate screens.
- Escape closes a modal first, then the current child route, then OpusConfig,
  restoring the prior Minecraft screen according to the route policy.
- A closed OpusConfig must return control to Minecraft with no stuck keyboard,
  mouse, focus, cursor, or GL state.

### Input safety

The keybind handler must not steal Right Shift when:

- a text field is actively editing text;
- a keybinding capture control is waiting for input;
- a modal explicitly owns keyboard focus;
- Minecraft is in a state where opening a client screen is unsafe.

The implementation must distinguish `KEY_RSHIFT` from left Shift and from a
generic “shift held” condition. It must debounce one physical press so one
press opens at most one screen.

### Acceptance cases

At minimum, test:

1. Right Shift in a world opens OpusConfig.
2. Right Shift from the pause menu opens OpusConfig and preserves pause state.
3. Right Shift while OpusConfig is open closes/restores it.
4. Right Shift while typing does not insert an unexpected route transition.
5. Escape restores the correct previous screen.
6. The binding appears in the key controls screen and can be remapped without
   breaking the default behavior on a fresh profile.

---

## 5. OpusConfig requirements

### 5.1 Stock baseline first

Before changing the frontend, run the frozen stock OneConfig build in the
exact Opus Forge/OptiFine runtime. Record:

- opening and closing behavior;
- module registration;
- automatic controls and dependencies;
- search;
- profiles;
- HUD route and editor;
- keyboard, mouse, scroll, text, and focus behavior;
- resource and GL state after close;
- source code locations that must be forked or adapted.

### 5.2 Branding layer

Implement branding in a dedicated compatibility layer first:

- product title: `OpusConfig`;
- Opus logo and iconography;
- Opus colors, typography, spacing, radii, focus, hover, pressed, disabled,
  selected, warning, and error states;
- navigation labels and empty/error/loading states;
- module/category presentation;
- profile and HUD labels;
- version/about/attribution surface;
- resource names and settings filenames only where migration-safe.

Keep upstream API and reflection-sensitive identifiers until the architecture
map proves that a rename is safe. Add migration aliases for any persisted keys
or files that change.

### 5.3 Functional ownership

OpusConfig must expose real data, not placeholder cards:

- stable module IDs and metadata;
- enabled/disabled module state;
- typed settings and validation;
- dependency visibility and enabled conditions;
- action callbacks;
- module and setting search;
- profile create, duplicate, rename, switch, delete, restart, and recovery;
- HUD placement, scale, visibility, and reset;
- persistence and schema migrations;
- safe error and rollback behavior.

### 5.4 OneConfig integration rule

Prefer direct adaptation to the frozen OneConfig option model. Use handwritten
wrappers where the Opus schema cannot be represented safely. Do not introduce
runtime bytecode generation or a second settings engine merely to avoid an
adapter.

---

## 6. Elementa shell requirements

Elementa is for the Minecraft shell, not for rebuilding OpusConfig's module
frontend.

### First production vertical slice

Implement and ship internally in this order:

1. navigation registry and parent/child route state;
2. pause menu;
3. route from pause menu “Opus Modules” and “HUD Editor” to OpusConfig;
4. route from pause menu “Minecraft Settings” to Elementa;
5. resume/disconnect/return-to-menu behavior;
6. focus restoration and Escape behavior;
7. Right Shift integration from gameplay and pause states.

This slice proves both frameworks coexist before the rest of the shell is
rewritten.

### Shell expansion

After the vertical slice passes:

- main menu: singleplayer, multiplayer, Minecraft settings, account/client
  information, quit, version/status;
- settings home and categories: controls, audio, chat, interface, language,
  resource packs, video, and supported OptiFine settings;
- server list: load, save, reorder, edit, ping, direct connect, join;
- world list: enumerate, select, create, rename, delete, recreate, warnings;
- account/client information: safe metadata and diagnostics;
- loading, empty, error, confirmation, and recovery states.

Each screen must delegate the underlying operation to Minecraft/Forge/OptiFine
through an adapter. Elementa must not clone world loading, network, resource
reload, or options internals.

---

## 7. Runtime artifact and launcher integration

The current launcher contract stages only bootstrap and Core Mod artifacts. The
production UI requires an explicit artifact-contract migration.

### Target managed set

The exact filenames are finalized by the artifact lock, but the production
launch set must represent these roles:

1. OPUS Forge bootstrap JAR;
2. OPUS telemetry Core Mod JAR;
3. OPUS native client UI Mod JAR;
4. frozen OneConfig fork artifact;
5. Elementa artifact;
6. UniversalCraft artifact selected by exact runtime evidence;
7. user-imported OptiFine HD U M5 JAR;
8. Forge/Minecraft libraries already managed by the launcher.

OneConfig, Elementa, and UniversalCraft must not be silently shaded together
if that creates duplicate classes, violates their licenses, or prevents
source/relinking. Every shipped third-party artifact needs an immutable
coordinate, source revision, checksum, notice, and packaging decision.

### Runtime changes

- create a production native client mod module/artifact;
- register the Forge client entry point;
- load OneConfig/Elementa dependencies through the verified Forge classpath;
- register Right Shift during client initialization;
- register route ownership and screen lifecycle hooks through supported Forge
  APIs or narrowly verified adapters;
- keep telemetry Core Mod patches separate from product UI code;
- add native client artifact checks and forbidden-path checks;
- generate a manifest consumed by the launcher.

### Launcher changes

- stage the native client mod and locked UI dependencies;
- validate exact count, names, sizes, and SHA-1/SHA-256 values;
- reject stale legacy UI artifacts and unexpected duplicate UI jars;
- expose a runtime snapshot that reports native UI readiness;
- include required notices/source references in the bundle/release output;
- ensure a clean launcher install, not a developer-only classpath, starts the
  same artifact set used by QA.

### Artifact policy

The launcher must never claim “OpusConfig ready” if the native client artifact
or any locked UI dependency is absent. A missing OptiFine import remains a
separate launch prerequisite and must produce an actionable message.

---

## 8. Implementation workstreams

### M0 — Goal, inventory, and baseline freeze

Tasks:

- keep this document as the active execution plan;
- record current Runtime/Launcher commits and clean-worktree state;
- inventory proof-only versus production source;
- identify every current UI entry point and artifact gate;
- freeze Minecraft, Forge, OptiFine, Java, OneConfig, Elementa, and
  UniversalCraft versions.

Exit gate: the team can identify exactly which files are proof-only and which
files will be changed for production.

### M1 — Source, license, and dependency lock

Tasks:

- import the frozen OneConfig source history-preservingly into Runtime;
- record source commit, artifact coordinates, and checksums;
- lock Elementa and UniversalCraft candidates;
- run duplicate-class and classloader collision scans;
- record LGPL/additional-term notices and the Opus branding compliance path;
- decide whether the selected UniversalCraft version is 516 or a validated
  source-matched alternative.

Exit gate: reproducible dependency inputs and a documented legal path exist.

### M2 — Stock OneConfig exact-runtime proof

Tasks:

- build stock OneConfig unchanged;
- package it in an isolated test client mod lane;
- launch it with the exact Forge/OptiFine runtime;
- verify open/close, settings, search, profiles, HUD, focus, and persistence;
- capture logs and screenshots.

Exit gate: stock behavior is understood and a failed adaptation can be
distinguished from a dependency/runtime problem.

### M3 — Minimal Elementa exact-runtime proof

Tasks:

- launch the minimal Elementa screen in the same exact runtime;
- verify Elementa/UniversalCraft coexistence with OneConfig;
- test initialization orders: OneConfig → Elementa and Elementa → OneConfig;
- verify input, text, scroll, clipping, overlay, animation, GUI scale,
  fullscreen, resize, and GL restoration.

Exit gate: one real Elementa screen can open and close repeatedly without
breaking Minecraft or OneConfig.

### M4 — Native client mod and Right Shift vertical slice

Tasks:

- create the production Forge client mod entry point;
- register the `Open OpusConfig` Right Shift keybinding;
- implement route state and previous-screen restoration;
- open stock OneConfig from Right Shift first;
- add pause-menu integration and a Minecraft-settings Elementa route;
- add deterministic input and route diagnostics.

Exit gate: a clean exact-runtime game opens stock OneConfig with Right Shift,
returns with Escape/Right Shift, and preserves pause/game state.

### M5 — OpusConfig branding and shared design

Tasks:

- apply OpusDesign to OneConfig and Elementa adapters;
- replace visible OneConfig product chrome with OpusConfig branding where
  legally and technically permitted;
- add logo, palette, typography, navigation, focus, hover, and error states;
- preserve attribution/about/license information;
- add screenshot parity fixtures and token completeness tests.

Exit gate: the screen visibly presents as OpusConfig and both frameworks share
the same design semantics.

### M6 — Opus module/config domain

Tasks:

- implement stable module descriptors and catalog;
- implement typed setting schema and validation;
- adapt initial real modules, beginning with FPS and Armor Status;
- implement dependency conditions, callbacks, and action buttons;
- add module and setting search metadata;
- create migration fixtures for persisted settings.

Exit gate: real modules and settings render, mutate, validate, and persist in
OpusConfig.

### M7 — OpusConfig production frontend

Tasks:

- rewrite primitives in dependency order: buttons, toggles, sliders, dropdowns,
  text input, cards, lists, tabs, tooltips, modals, loading, empty, and error;
- implement module browser and categories;
- implement module detail and reset actions;
- implement global/module setting search;
- implement profile UI and recovery states;
- ensure body-click versus toggle-click behavior is unambiguous.

Exit gate: OpusConfig owns the complete module/config/search/profile route set.

### M8 — HUD runtime and profile transactions

Tasks:

- connect module state to real HUD runtime state;
- implement HUD editor, drag/resize/scale/visibility, anchors, and reset;
- implement atomic profile create, duplicate, rename, switch, delete, restart,
  and failure rollback;
- verify module, setting, HUD, and selected-profile state cannot mix.

Exit gate: HUD and profiles survive restart and fault-injection tests.

### M9 — Elementa shell production screens

Tasks:

- finish pause menu and route ownership;
- implement main menu;
- implement Minecraft settings categories and side effects;
- implement controls, audio, chat, interface, language, resource packs, video,
  and supported OptiFine delegation;
- implement server and world lists;
- implement account/client information;
- cover loading, empty, error, confirmation, and reconnect states.
- use responsive constraints, content bounds, stacks, grids, and compact-mode
  breakpoints rather than fixed page compositions;
- review title and pause shell structure against Vanilla Minecraft, with
  restrained Lunar Client-inspired polish for OPUS-specific hierarchy and
  states.

Exit gate: selected shell routes are fully Elementa-owned and real Minecraft
operations remain correct.

### M10 — Coexistence, scaling, and performance

Tasks:

- test both opening orders and 100 repeated transitions;
- test GUI scales, fullscreen/windowed modes, HiDPI, resize, and OptiFine;
- verify GL state before/after every native renderer;
- measure route opening, input latency, scrolling, memory, and closed-game FPS;
- test 100 modules and 1,500 settings search responsiveness;
- fix leaks, focus loss, stale route state, and input duplication.
- make display-resize and framebuffer/resource recreation lifecycle-safe while
  preserving the active route, focus, cursor, and parent screen;
- verify minimum, reference, wide, and tall responsive size classes before
  accepting any shell route.

Exit gate: performance and compatibility budgets pass or have an explicitly
approved measured revision.

### M11 — Launcher packaging and clean-install verification

Tasks:

- update Runtime artifact manifest and checksums;
- update Launcher staging and artifact validation;
- update bundle gates to allow exactly the approved native UI set;
- reject old CEF/WebView/T-UI artifacts and unexpected jars;
- build the local `.app` and test from a clean isolated data root;
- verify launcher status accurately reports native UI readiness.

Exit gate: the launcher-launched game uses the same native UI artifacts tested
by Runtime QA.

### M12 — Retirement and release candidate

Tasks:

- switch production route selection to native by default;
- remove production WebView/CEF/Svelte dependencies after one rollback window;
- archive or remove superseded UI paths according to repository policy;
- complete notices, source/relinking, checksums, release locks, and evidence;
- publish a reproducible release candidate only after the legal gate passes.

Exit gate: no third production frontend remains and the complete evidence
bundle is reviewable.

---

## 9. Verification plan

### Automated checks

- Java 8 compilation with warnings treated as errors;
- dependency/source/checksum lock verification;
- duplicate-class and classloader collision scan;
- native artifact manifest verification;
- forbidden CEF/WebView/Svelte/T-UI path scan;
- route ownership test;
- Right Shift keycode and debounce test;
- OneConfig option/dependency/callback tests;
- config schema migration fixtures;
- profile transaction fault injection;
- HUD serialization and restart fixtures;
- OpusDesign token and adapter parity tests;
- responsive layout constraint and breakpoint tests;
- resize lifecycle/resource recreation tests;
- launcher staging and clean-bundle checks.

### Exact-runtime manual matrix

Run on a clean isolated profile with the locked Forge and OptiFine:

| Case | Required result |
|---|---|
| Fresh game + Right Shift | OpusConfig opens |
| Right Shift twice | Opens then restores previous screen |
| Escape from OpusConfig | Restores previous screen |
| Open from pause | Game remains correctly paused |
| OpusConfig module browser | Real modules appear |
| Setting change | Visible immediately and persists |
| Search | Module and setting results are accurate |
| Profile switch | Complete state switches atomically |
| HUD edit | Position/scale/visibility persist |
| Minecraft settings | Vanilla side effects still occur |
| Server/world action | Minecraft owns the actual operation |
| Text input/key capture | Right Shift is not stolen |
| Resize while shell is open | No crash; route, focus, viewport, clipping, and input remain valid |
| Minimum/reference/wide/tall sizes | Controls reflow, remain readable, and stay hit-test aligned |
| Shell visual review | Vanilla structure with approved restrained Lunar/OPUS polish |
| GUI scale/fullscreen/resize | Layout and hit targets remain aligned |
| Repeated open/close | No duplicate screens, leaks, or GL errors |
| Launcher clean install | Same artifact set works outside the dev tree |

### Evidence required

- commit IDs for superproject, Runtime, and Launcher;
- dependency/source lock and checksums;
- build logs and test reports;
- artifact contents and manifest;
- game logs with native UI lifecycle records;
- screenshots of OpusConfig and each Elementa shell route;
- Right Shift interaction recording or reproducible manual log;
- profile/HUD restart evidence;
- performance and compatibility measurements;
- third-party notices and legal decision record.

---

## 10. Performance and reliability budgets

Initial targets, to be measured on the reference host:

- warm screen opening: ≤150 ms where Minecraft's own work permits;
- input result visible by the next rendered frame;
- no sustained UI scroll frame time above 33 ms;
- 100 open/close cycles without unbounded native or heap growth;
- closed-UI gameplay regression no worse than 10% against the native baseline;
- search remains interactive with 100 modules and 1,500 settings;
- no network, disk migration, or profile transaction work on the render thread;
- no stuck keyboard, mouse, cursor, focus, pause, or GL state after close.

If a target fails, record the measured baseline and approve a revision rather
than silently weakening the requirement.

---

## 11. Risks and decisions

### OneConfig/Elementa dependency collision

Mitigation: immutable locks, class scans, isolated classpath tests, and no
unreviewed shading or relocation.

### OneConfig fork API/reflection coupling

Mitigation: stock baseline first, architecture map, adapters, and incremental
branding. Do not rename upstream packages wholesale at the beginning.

### Right Shift conflicts with text/key capture

Mitigation: focus-aware route gate, explicit key-capture state, physical
keycode test, and one-press debounce.

### Elementa changes Minecraft behavior

Mitigation: adapters delegate to Minecraft and Forge; shell screens own only
presentation and route state.

### OptiFine/GL state corruption

Mitigation: GL guards, before/after error checks, scale/fullscreen matrix, and
repeated transitions.

### Resize lifecycle and stale composition

Mitigation: reproduce `UI-001` first; centralize display and framebuffer
lifecycle handling; rebuild logical bounds, scissor regions, and renderer
resources safely; and retain route/focus/input state through repeated
grow/shrink cycles.

### Fixed-composition shell layout

Mitigation: treat `UI-003` as a release gate, define explicit responsive size
classes and compact breakpoints, and require visual review against Vanilla
Minecraft structure plus restrained Lunar/OPUS polish before expanding routes.

### Legal branding limits

Mitigation: retain required notices, document visible attribution or obtain the
appropriate permission/release path before distribution.

### Launcher/runtime drift

Mitigation: one versioned manifest, checksums, exact staging gate, and clean
launcher-launched acceptance run.

---

## 12. Definition of done

This goal is complete only when all statements below are true:

- Right Shift opens **OpusConfig** in the exact launcher-launched Minecraft
  runtime.
- Right Shift and Escape restore screens correctly and do not interfere with
  text input or keybinding capture.
- OpusConfig visibly and behaviorally presents as the Opus product while
  retaining required OneConfig legal notices.
- OneConfig exclusively owns module, config, search, profile, and HUD routes.
- Elementa exclusively owns the selected Minecraft shell routes.
- Both frameworks consume the same OpusDesign semantics.
- Minecraft resizing is crash-free across the supported display, GUI-scale,
  fullscreen, windowed, and HiDPI matrix.
- Shell controls and content reflow responsively with aligned drawing and
  hit-testing at minimum, reference, wide, and tall sizes.
- The title and pause shells pass visual review against the approved
  Vanilla/Lunar visual direction.
- Real modules, settings, profiles, HUD layouts, and Minecraft options work and
  survive restart.
- Forge, Minecraft, networking, world loading, GameSettings, and OptiFine
  behavior remain delegated to their real implementations.
- The launcher stages and verifies every required native UI artifact from a
  clean install.
- No CEF, Svelte, WebView, retired T-UI, or parallel custom renderer is active
  in the production artifact.
- Exact-runtime screenshots, logs, tests, performance measurements, artifact
  hashes, and legal/release records are present.

Until then, the project must report the UI as **in migration**, not complete.

---

## 13. Revised implementation slice after current user-test checkpoint

This sequence is paused pending user confirmation:

1. Reproduce `UI-001` from a fresh packaged launch and capture the crash,
   display, framebuffer, and native UI evidence.
2. Fix resize lifecycle safety and prove repeated grow/shrink cycles without
   crash, GL error, stale resources, or input drift.
3. Establish responsive Elementa size classes, constraints, content bounds,
   and compact-mode breakpoints; verify button reflow and hit-test alignment.
4. Redesign the title and pause shells using Vanilla Minecraft structure with
   restrained Lunar/OPUS polish, then capture the visual review matrix.
5. Resume Right Shift/OpusConfig open-close, persistence, exact-runtime, and
   launcher packaging acceptance.

## 14. Historical immediate implementation slice

The current coding slice is deliberately narrow and user-testable:

1. Align native-client Gradle metadata, resources, artifact checks, and runtime
   report verification with the new production classes.
2. Compile and statically verify the thin native client mod artifact.
3. Import the frozen OneConfig source and establish the stock exact-runtime
   baseline before presentation edits.
4. Preserve the focus-aware, debounced physical Right Shift route and verify it
   opens stock OneConfig in the exact runtime.
5. Customize the OneConfig frontend as `OpusConfig`, retaining compatibility,
   source history, and required legal notices.
6. Complete the initial Elementa main/pause/settings shell routes and correct
   parent-screen restoration.
7. Publish the native client mod, OneConfig, Elementa, and UniversalCraft as a
   locked thin-artifact set in Runtime.
8. Stage and validate that set through the Launcher, then build and launch the
   local packaged `.app` from a clean isolated data root.
9. Capture Right Shift, Escape, persistence, focus, GL, GUI-scale, fullscreen,
   and repeated-transition evidence.

This slice is the first proof that the requested feature is connected to the
real product path. Broader visual redesign follows only after this slice
passes.

---

## 15. Commit, push, and user-test handoff order

Commits happen only after the relevant verification gates pass. Preserve
unrelated user changes and keep repository ownership explicit.

1. Commit the Runtime implementation, frozen OneConfig fork/customization,
   artifact locks, notices, and passing Runtime evidence in the Runtime
   repository.
2. Push the verified Runtime branch and record its immutable commit ID.
3. Commit the Launcher manifest parser, staging, checksum validation, launch
   arguments/tweaker handling, bundle gates, and passing Launcher checks in the
   Launcher repository.
4. Push the verified Launcher branch and record its immutable commit ID.
5. In the superproject, update only the intended Runtime and Launcher gitlinks,
   release locks, architecture records, this plan, and retained acceptance
   evidence.
6. Commit and push the superproject after confirming both submodule commits are
   reachable from their remotes.
7. Build and open the packaged Launcher for the user only after the pushed
   commits match the locally accepted artifact set.
8. Keep the goal active while the user tests; close it only after the requested
   behavior is confirmed or any discovered defect is fixed and reverified.
