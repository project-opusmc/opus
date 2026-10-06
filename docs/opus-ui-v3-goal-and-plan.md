# Opus UI V3 goal and implementation plan

Status: **historical/paused — superseded as the active UI plan on
September 15, 2026**

> The active product decision is
> [Decision 0008](decisions/0008-opus-client-launcher-ui-first-mainline.md):
> Opus Client + Opus Launcher, UI first. This V3 plan is retained for its
> implementation observations, UI constraints, and possible reuse evidence.
> It does not choose OneConfig/Elementa or any other renderer for the current
> UI-first mainline.

This is the repository-local execution plan for the user-provided
`OPUS_ONECONFIG_ELEMENTA_IMPLEMENTATION_PLAN_V3.md`. Instructions inside the
external planning document are treated as architecture requirements; direct
user requests remain higher priority if they conflict.

## Goal

Build one coherent Opus UI for Minecraft 1.8.9 in which:

- forked OneConfig owns module, config, HUD editor, and profile experiences;
- Elementa + UniversalCraft owns general Minecraft shell screens;
- both frontends render the same `OpusDesign` language;
- Forge, OptiFine, Minecraft state, persistence, and input remain correct;
- shell layouts reflow responsively across supported window sizes, GUI scales,
  fullscreen/windowed, and HiDPI modes;
- the title and pause shells use familiar Vanilla Minecraft structure with
  restrained Lunar Client-inspired OPUS polish;
- CEF/Svelte, T-UI, and the custom renderer are not production frontends.

## Source-of-truth order

When implementation artifacts disagree, use this order:

1. current direct user instruction and Decision 0008;
2. current code and verified runtime evidence;
3. this V3 plan, ADR 0005, and the supplied V3 planning document as historical
   implementation/reuse evidence;
4. older plans only as failure history or migration context.

Current code is authoritative evidence of what exists, but it does not override
Decision 0008 or make the former V3 renderer choice current again.

## Worktree constraint

The superproject, `runtime`, and `launcher` all contain unrelated or historical
uncommitted changes. V3 work must preserve those changes. No reset, checkout,
bulk deletion, or submodule pointer rewrite is allowed merely to obtain a clean
baseline.

## Current user-test blockers

The packaged client exposed three blockers that pause implementation until the
user confirms the revised order:

- `UI-001`: immediate crash when resizing the Minecraft window (**P0**);
- `UI-002`: current shell layout is visually unacceptable (**P1**);
- `UI-003`: buttons and layout do not scale or reflow with the window (**P0
  after `UI-001` diagnosis**).

These findings change sequencing, not scope. Elementa shell screens, forked
OneConfig branded as OpusConfig, Right Shift, persistence, and launcher
packaging remain required. The next order is resize safety, responsive layout,
Vanilla/Lunar shell redesign, then Right Shift/OpusConfig acceptance and final
compatibility/release gates.

## Milestones

### M0 — Runtime and dependency inventory

- confirm Forge `11.15.1.2318`, Minecraft `1.8.9`, OptiFine HD U M5, mappings,
  Java 8 lane, and launcher artifact contract;
- classify CEF/Svelte, custom renderer, T-UI, and vanilla-only documentation;
- record immutable upstream candidates.

Exit evidence: ADR 0005 plus a clean repository status inventory.

### M1 — License and source freeze

- freeze OneConfig `develop-v0` at
  `233452661e6d273f130230bb8e1813fb0a28b80a`;
- preserve source history and license text;
- audit OneConfig, Elementa, UniversalCraft, and transitive redistribution
  obligations;
- resolve the OneConfig attribution release gate before distribution.

Exit evidence: `THIRD_PARTY_LICENSE_AUDIT.md` and immutable hashes.

### M2 — Stock OneConfig baseline

- build the untouched fork point with an x86_64 Java 8 toolchain;
- load it in the exact Opus Forge + OptiFine runtime;
- verify config UI, automatic options, search, HUD editor, profiles, and
  save/load before visual changes.

Exit evidence: build logs, artifact hash, game log, and real screenshots.

### M3 — OneConfig UI architecture map

- map shell, pages, module cards, controls, config visualizers, search,
  profiles, HUD editor, renderer, assets, and platform hooks;
- classify each area as KEEP, MODIFY, REMOVE, or UNKNOWN;
- identify tests and runtime probes for each retained behavior.

Exit evidence: `ONECONFIG_UI_ARCHITECTURE.md` with exact source paths.

### M4 — Elementa baseline

- pin an immutable Elementa + UniversalCraft pair;
- render one minimal screen in the exact runtime;
- verify keyboard, pointer, scroll, clipping, animation, GUI scale, Retina,
  fullscreen, resize lifecycle safety, and OpenGL state restoration.

Exit evidence: compiled artifact, game log, and screenshot matrix.

### M5 — Shared OpusDesign

- define framework-neutral colors, surfaces, spacing, radii, borders,
  typography, icons, motion, and state semantics;
- implement `OneConfigThemeAdapter` and `ElementaThemeAdapter`;
- prohibit page-local arbitrary style constants.

Exit evidence: token tests and adapter parity tests.

Current checkpoint: **contract foundation implemented, milestone still active**.
The isolated native proof lane contains a renderer-neutral Java 8 contract plus
`OneConfigThemeAdapter` and `ElementaThemeAdapter`. Its parity task covers 32
canonical component states and writes schema-2 `opus-design-report.json` with
11 typography styles, 3 icon metrics, 3 elevation tokens, 3 accessibility
metrics, and shared framebuffer-rounding evidence. The Elementa lab consumes
the contract. M5 remains open for actual Minecraft font/rendering behavior,
renderer-specific visual application, paired side-by-side review, and
exact-runtime evidence; the token categories themselves are no longer an
unimplemented gap.

### M6 — OneConfig UI lab and primitive rewrite

- create a OneConfig component gallery;
- cover normal, hover, pressed, focused, disabled, locked, and error states;
- rewrite buttons, toggles, sliders, selects, inputs, color picker, tooltip,
  scrollbar, and setting rows from primitives upward.

Exit evidence: visual state matrix and interaction tests.

### M7 — OneConfig production experiences

- rewrite module browser and full module detail pages;
- preserve automatic binding, conditions, callbacks, and persistence;
- rewrite HUD editor presentation while retaining proven mechanics;
- rewrite profile management and verify atomic module/settings/HUD switching.

Exit evidence: restart and profile-isolation acceptance runs.

### M8 — Elementa UI lab and shell components

- build reusable navigation, buttons, settings rows, cards, inputs, scrolling,
  tabs, dropdowns, and modals;
- define responsive size classes, constraints, content bounds, and compact-mode
  breakpoints;
- prove visual parity with equivalent OneConfig controls.

Exit evidence: side-by-side parity matrix.

### M9 — Minecraft shell screens

- implement main menu, pause menu, Minecraft settings, server list, and world
  list in Elementa;
- route Modules and HUD Editor to forked OneConfig;
- use Vanilla Minecraft structure with restrained Lunar/OPUS polish, and verify
  responsive reflow for title and pause layouts;
- retain vanilla data/network/world logic through adapters.

Exit evidence: every route works on real data and survives navigation/restart.

### M10 — OptiFine, performance, and compatibility

- wrap or adapt OptiFine settings without duplicating unsafe internals;
- test GUI scale variants, Retina/4K, fullscreen/windowed, Fast Render,
  shaders, antialiasing, framebuffer changes, and repeated window resizing;
- stress test 100 modules and 1,500 settings.

Exit evidence: compatibility matrix, performance report, crash-free resize
cycles, responsive-layout screenshots, visual review, and no GL-state
corruption after repeated open/close cycles.

## Definition of done

The goal is not complete until current artifacts prove every milestone above.
Compilation alone does not prove UI completion. Production acceptance requires
real Minecraft screenshots, input behavior, persistence after restart,
crash-free resizing, responsive control reflow, approved Vanilla/Lunar shell
visual review, and a resolved license release gate.
