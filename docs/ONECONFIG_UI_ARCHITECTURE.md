# OneConfig UI architecture map for the Opus fork

Status: **source audit baseline**

Frozen upstream:

```text
Polyfrost/OneConfig
branch: develop-v0
commit: 233452661e6d273f130230bb8e1813fb0a28b80a
version: 0.2.2-alpha228
platform node: 1.8.9-forge
```

This is a static source map. Runtime behavior remains unproven until the stock
artifact is loaded with Forge `11.15.1.2318` and OptiFine HD U M5.

## Why this branch

The frozen branch contains the exact legacy Forge node and the mature frontend
that V3 intends to reuse: `OneConfigGui`, module/config pages and controls,
NanoVG rendering, HUD editor mechanics, profiles, and automatic annotation
mapping. The repository's current `v1` branch is a different modern-Minecraft
architecture and is not the direct 1.8.9 fork base.

## Build and platform entry points

| Responsibility | Upstream source |
| --- | --- |
| Multi-version nodes | `settings.gradle.kts`, `versions/root.gradle.kts` |
| Forge 1.8.9 build | `versions/build.gradle.kts`, node `platform:1.8.9-forge` |
| Bootstrap/init | `src/main/java/cc/polyfrost/oneconfig/internal/init/OneConfigInit.java` |
| Legacy tweaker/mixin | `src/main/java/cc/polyfrost/oneconfig/internal/plugin/asm/OneConfigTweaker.java` and mixin resources |
| Cross-version platform API | `src/main/java/cc/polyfrost/oneconfig/platform/*` |
| Minecraft screen host | `src/main/java/cc/polyfrost/oneconfig/utils/gui/OneUIScreen.java` |

Fork rule: preserve package names and upstream history through the stock
baseline. Package relocation is a later packaging decision.

## Main config shell and navigation

| Surface | Upstream source | Initial disposition |
| --- | --- | --- |
| Main window | `gui/OneConfigGui.java` | MODIFY deeply |
| Sidebar | `gui/SideBar.java` | REWRITE presentation |
| Home | `gui/pages/HomePage.java` | REMOVE or replace with Opus module landing |
| Module browser | `gui/pages/ModsPage.java` | REWRITE presentation; retain data/navigation where sound |
| Nested module list | `gui/pages/SubModsPage.java` | ADAPT to Opus categories/navigation |
| Module detail | `gui/pages/ModConfigPage.java` | REWRITE presentation; retain option binding |
| Generic page base | `gui/pages/Page.java` | KEEP contract, modify only if required |
| Credits | `gui/pages/CreditsPage.java` | REMOVE from primary navigation; preserve legal notices elsewhere |

`OneConfigGui` is the RShift/module shell in V3. Elementa must not recreate
these routes.

## Primitive and composite controls

| Control family | Upstream source | Initial disposition |
| --- | --- | --- |
| Base element | `gui/elements/BasicElement.java` | KEEP behavior contract, audit input/focus |
| Button | `gui/elements/BasicButton.java` | REWRITE visuals and states |
| Module card | `gui/elements/ModCard.java` | REWRITE layout/hit targets |
| Slider | `gui/elements/Slider.java` | REWRITE visuals; retain value mechanics if verified |
| Dropdown | `gui/elements/Dropdown.java` | REWRITE visuals/focus/overlay |
| Color picker | `gui/elements/ColorSelector.java` | REWRITE presentation; retain color mechanics if verified |
| Text input | `gui/elements/text/TextInputField.java` | MODIFY and verify keyboard/clipboard |
| Number input | `gui/elements/text/NumberInputField.java` | MODIFY and verify validation |

Required Opus module-card behavior has independent body and toggle hit targets.
The whole card must not become a boolean toggle.

## Automatic config visualizers

OneConfig's annotation model and generated controls are retained as a major V3
capability.

| Option | Annotation/model | Visual control |
| --- | --- | --- |
| Boolean switch | `config/annotations/Switch.java` | `gui/elements/config/ConfigSwitch.java` |
| Checkbox | `config/annotations/Checkbox.java` | `ConfigCheckbox.java` |
| Number | `config/annotations/Number.java` | `ConfigNumber.java` |
| Slider | `config/annotations/Slider.java` | `ConfigSlider.java` |
| Dropdown | `config/annotations/Dropdown.java` | `ConfigDropdown.java` |
| Color | `config/annotations/Color.java` | `ConfigColorElement.java` |
| Keybind | `config/annotations/KeyBind.java` | `ConfigKeyBind.java` |
| Text | `config/annotations/Text.java` | `ConfigTextBox.java` |
| Button/action | `config/annotations/Button.java` | `ConfigButton.java` |
| Group/header | `config/annotations/Header.java` | `ConfigHeader.java` |
| Nested page | `config/annotations/Page.java` | `ConfigPageButton.java` |
| HUD option | `config/annotations/HUD.java` | `HUDUtils.java` generated option set |

Supporting tree classes:

```text
config/elements/BasicOption.java
config/elements/OptionPage.java
config/elements/OptionCategory.java
config/elements/OptionSubcategory.java
config/core/ConfigUtils.java
config/Config.java
```

Disposition: KEEP binding, callbacks, dependencies, serialization, and tree
generation; REWRITE every visible row/control through Opus theme primitives.

## Persistence and profiles

| Responsibility | Upstream source | Initial disposition |
| --- | --- | --- |
| Config lifecycle | `internal/config/core/ConfigCore.java` | KEEP, test migrations and atomicity |
| Public config model | `config/Config.java` | KEEP initially |
| Profiles | `internal/config/profiles/Profiles.java` | KEEP engine, REWRITE management UI |
| Profile-independent fields | `config/annotations/NonProfileSpecific.java` | KEEP and test |
| Migration | `config/migration/*` | KEEP only required migrations |
| Forge/Vigilance compatibility | `internal/config/compatibility/*` | CLASSIFY per Opus need |

Profile switching must eventually update modules, settings, and HUD state as
one user-visible transaction.

## HUD system and editor

| Responsibility | Upstream source | Initial disposition |
| --- | --- | --- |
| Public HUD model | `hud/Hud.java`, `BasicHud.java`, `TextHud.java`, `SingleTextHud.java` | KEEP/ADAPT |
| Position model | `hud/Position.java` | KEEP after scale/anchor audit |
| Generated HUD options | `hud/HUDUtils.java` | KEEP mechanics, REWRITE controls |
| HUD runtime | `internal/hud/HudCore.java` | KEEP after Forge/OptiFine render audit |
| Editor screen | `internal/gui/HudGui.java` | KEEP mechanics, REWRITE complete presentation |
| Drag offset | `internal/hud/utils/GrabOffset.java` | KEEP after coordinate tests |
| Snap guide | `internal/hud/utils/SnappingLine.java` | KEEP/EXTEND |

The editor rewrite may replace borders, handles, toolbar, inspector, background,
spacing, typography, and animation. Dragging, resizing, snapping, selection,
and persistence should be retained only after runtime tests prove them.

## Search

Relevant source begins with:

```text
utils/SearchUtils.java
gui/pages/ModsPage.java
gui/pages/ModConfigPage.java
```

The v0 search implementation must be profiled before extension. The Opus index
will cover module names, aliases, descriptions, categories, setting names,
setting descriptions, and keywords, with exact/prefix/substring/fuzzy matches.

## Renderer and asset boundary

| Responsibility | Upstream source | Initial disposition |
| --- | --- | --- |
| Draw API | `renderer/RenderManager.java`, `renderer/TextRenderer.java` | KEEP API initially |
| NanoVG backend | `internal/renderer/NanoVGHelperImpl.java` | KEEP, audit GL state |
| Font backend | `internal/renderer/FontHelperImpl.java` | KEEP/replace assets |
| Assets | `renderer/asset/*`, `internal/assets/*` | REPLACE branded assets; preserve provenance |
| Scissor | `renderer/scissor/*`, `internal/renderer/ScissorHelperImpl.java` | KEEP after HiDPI tests |
| LWJGL bridge | `renderer/LwjglManager.java` | KEEP after platform audit |

OneConfig renders its own specialized frontend. Elementa is not inserted inside
OneConfig pages. Visual parity is achieved through `OneConfigThemeAdapter`, not
by mixing component trees.

## Initial KEEP / MODIFY / REMOVE classification

### KEEP subject to tests

- annotation and option-tree generation;
- serialization, callbacks, conditions, and migrations needed by Opus;
- profile engine;
- HUD model, transform, drag/resize/snap, and persistence mechanics;
- platform abstraction and NanoVG renderer where Forge/OptiFine-safe.

### MODIFY deeply

- `OneConfigGui`, sidebar, navigation, categories, and search;
- module cards and module detail page;
- all visible config controls and setting rows;
- HUD editor chrome and inspector;
- profile-management presentation;
- fonts, colors, spacing, radii, borders, icons, surfaces, motion, and states.

### REMOVE from product presentation

- OneConfig and Polyfrost product logos/branding;
- irrelevant home, credits, integration, or promotional pages;
- generic categories that conflict with Opus semantics;
- duplicate notifications or settings surfaces not selected by Opus.

Required legal notices are not product branding and are governed by
`THIRD_PARTY_LICENSE_AUDIT.md`.

### UNKNOWN until runtime proof

- blur behavior with OptiFine Fast Render and shaders;
- NanoVG framebuffer/state restoration on the exact macOS runtime;
- fractional/Retina coordinate behavior;
- interaction between OneConfig's bundled UniversalCraft `246` and the
  separately pinned Elementa/UniversalCraft lane;
- stock profile/HUD persistence atomicity under Opus module semantics.

## Opus fork extension points

The fork should introduce these seams before broad screen rewrites:

```text
OpusDesign
OneConfigThemeAdapter
OpusModuleCatalogAdapter
OpusProfileAdapter
OpusHudAdapter
OpusOneConfigUiLab
```

Opus module code must depend on Opus-owned module semantics. Direct OneConfig
imports should be confined to the fork/integration layer where practical,
without throwing away automatic option machinery.

## Baseline verification matrix

| Area | Static source evidence | Required runtime evidence |
| --- | --- | --- |
| Config UI | classes mapped above | open stock UI and mutate every initial option type |
| Persistence | `Config`, `ConfigCore`, Gson/profile code | restart and compare stored values |
| Search | `SearchUtils` and page integration | module and setting query results |
| HUD | model/editor classes mapped | drag, resize, snap, save, restart |
| Profiles | `Profiles.java` | create, duplicate, switch, delete, restart |
| Rendering | NanoVG/scissor/font backends | readable text and no Minecraft/OptiFine GL corruption |
| Input/scale | `OneUIScreen` and platform APIs | mouse/keyboard/scroll across GUI scales and Retina |

## Current build evidence

The untouched frozen source built successfully on 2026-08-23 with Gradle 8.7
running under an x86_64 Eclipse Temurin 17.0.17+10 launcher and an explicitly
selected x86_64 Eclipse Temurin 8u502-b07 compiler toolchain:

```text
BUILD SUCCESSFUL in 11m 38s
21 actionable tasks
```

The Java installation controls had to be Gradle project properties (`-P`), not
system properties (`-D`). Auto-detection and auto-download were disabled.

The source-built regular JAR and the locked published regular JAR each contain
1,550 extracted files with identical paths and bytes. Their ZIP byte streams
are not identical because the upstream build writes current ZIP timestamps:

```text
source-built SHA-256: a1e759bd56489b4ae7531a5c016d5246518cec3bf52aa66a58b22d51a49c0bb7
published SHA-256:    bf44d346a6a53df3f1f9813de9c6f028cc93adf9c8cb1276c694863a7e1136de
size of each JAR:     8,736,779 bytes
```

Runtime now owns a checksum-pinned build and content-equivalence command in
`scripts/build-stock-oneconfig.mjs`; the full evidence and exact toolchain
hashes are recorded in `runtime/docs/native-ui-source-baseline.md`.
