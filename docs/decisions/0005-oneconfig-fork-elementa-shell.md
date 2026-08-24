# ADR 0005: OneConfig UI fork with an Elementa Minecraft shell

Status: **accepted — 2026-08-23**

## Context

The vanilla-only stabilization phase in ADR 0004 intentionally removed broken
CEF, T-UI, and custom-renderer paths from production. It did not define the
final Opus product UI.

An earlier V2 plan incorrectly interpreted OneConfig as backend-only and
proposed rebuilding every visible screen in Elementa. The corrected V3 product
decision is to retain and deeply modify OneConfig's mature module, config, HUD,
and profile frontend while using Elementa for Minecraft shell screens.

## Decision

Opus will use two specialized frontend technologies under one framework-neutral
design specification:

```text
                         OPUS DESIGN
                              |
                 +------------+------------+
                 |                         |
       OneConfigThemeAdapter      ElementaThemeAdapter
                 |                         |
        forked OneConfig                 Elementa
      modules/config/HUD/profile   Minecraft shell screens
```

OneConfig is **not backend-only**.

Forked OneConfig owns:

- module browser and module detail;
- automatic config option rendering and dependency behavior;
- search for modules and settings;
- HUD model, rendering mechanics, editor, and persistence where retained;
- profile storage and profile-management UI where retained.

Elementa owns:

- main menu and pause menu;
- Minecraft settings, controls, audio, chat, and interface screens;
- server list and world list;
- account/client-information and other first-party shell screens.

Minecraft, Forge, and OptiFine logic remains behind adapters. Elementa screens
must not reimplement networking, world loading, `GameSettings`, or OptiFine
behavior merely to replace presentation.

## Frozen OneConfig baseline

The initial fork point is:

```text
repository: https://github.com/Polyfrost/OneConfig.git
branch:     develop-v0
commit:     233452661e6d273f130230bb8e1813fb0a28b80a
version:    0.2.2-alpha228
target:     1.8.9-forge
```

This commit matches the published `cc.polyfrost:oneconfig-1.8.9-forge` version
and contains the frontend architecture described by V3. The repository's
current `v1` branch targets modern Minecraft versions and is not the initial
Opus 1.8.9 fork base.

The source history must be preserved when the fork is imported. Packages must
not be renamed wholesale before the stock baseline and architecture map pass.

## Elementa baseline candidates

The initial compatibility lane will evaluate these immutable candidates:

```text
Elementa commit:       01392527e98e83026e52f27396775cf042f3e922
Elementa artifact:     gg.essential:elementa:762
UniversalCraft commit: e507b65e6bd76c88d6d461db8a5f8a0cdf066c85
UniversalCraft target: gg.essential:universalcraft-1.8.9-forge:516
```

They remain candidate pins until a minimal screen passes the exact Opus
Forge/OptiFine runtime. A failed compatibility proof may move these pins to an
older immutable pair; it does not authorize replacing Elementa with another UI
engine.

## Shared design contract

`OpusDesign` is framework-neutral and is the only source for colors, spacing,
radii, borders, typography, icons, motion, and interaction states. OneConfig
and Elementa each implement an adapter from that same specification.

A user must not be able to infer the renderer from the visual or interaction
behavior of a button, toggle, setting row, navigation item, or modal.

## Legal release gate

OneConfig's frozen source is LGPL-3.0 plus Additional Terms Applicable to
OneConfig 1.1. Those terms create an attribution requirement for conveyed
adaptations in cases not covered by an exception. Therefore “remove OneConfig
branding” means remove OneConfig product chrome and product identity; it does
not authorize deleting legally required notices.

Before any public or commercial build is distributed, the project must choose
and document one compliant path:

1. retain the required visible attribution;
2. obtain written authorization from Polyfrost;
3. distribute the adaptation under a license path whose consequences have
   been reviewed, including the GPL option described by the Additional Terms;
4. establish that a stated non-commercial exception applies.

This choice is a release gate, not a blocker for private source integration,
baseline builds, UI labs, or technical testing.

## Superseded paths

This ADR supersedes ADR 0004 as the product UI direction and supersedes plans
that select any of the following as production architecture:

- vanilla Minecraft UI as the final product UI;
- OneConfig as backend-only;
- Elementa for OneConfig's module/config/HUD/profile frontend;
- CEF/Svelte or WebView as the in-game product compositor;
- the retired T-UI or custom OpenGL component framework.

Historical source and documents may be retained until migration evidence makes
their safe deletion clear.

## Acceptance

This decision is implemented only when:

1. stock OneConfig runs on the exact Opus Forge 1.8.9 + OptiFine M5 runtime;
2. the OneConfig UI source map identifies every production rewrite surface;
3. a minimal Elementa screen passes input, GUI scale, and HiDPI checks;
4. both UI labs render from the same `OpusDesign` values;
5. OneConfig owns module/config/HUD/profile routes and Elementa owns shell
   routes without a third active frontend;
6. persistence, profiles, HUD layout, and Minecraft settings survive restart;
7. the license release gate has a recorded resolution.
