# OPUS Architecture

> **Current product authority — September 15, 2026.**
> [Decision 0008: Opus Client + Launcher mainline, UI first](decisions/0008-opus-client-launcher-ui-first-mainline.md)
> supersedes earlier injector-first, Core-Mod-only, CEF-first, and
> OneConfig/Elementa-first product priorities where they conflict with it.
> This document describes the current architecture direction; it does not claim
> that a new UI, renderer, or artifact contract has already been implemented.

OPUS has two deliberately separated lanes:

```text
active product mainline
        |
        +-- Opus Launcher
        |     desktop account/profile, install, verification, launch, and UI
        |
        +-- Opus Client
        |     lightweight in-game UI and RBW intelligence experience
        |
        +-- Opus Core
        |     host-neutral product-domain state and rules where practical
        |
        `-- Forge + OptiFine Minecraft 1.8.9
              initial reference host for lifecycle, tick, render, world,
              entity, packet, input, and game integration

frozen experimental R&D
        |
        +-- injector/       M3 preflight and transport research
        +-- runtime-native/ JNI/JVMTI lifecycle foundation
        +-- runtime-java/   Java payload foundation
        `-- adapters/       future client/runtime compatibility research
```

The active product mainline is a transparent, RBW-first Minecraft Client +
Launcher experience. It is not a generic Minecraft module collection and it is
not an injector research product. UI is the first product priority: Launcher
and in-game Client should become one understandable player experience before
the RBW intelligence surface broadens.

The frozen injector lane remains intact. Its source, artifacts, Gate evidence,
notes, and reproducibility bundles are retained for an explicit future
resumption; the freeze does not alter any recorded result, authorization
boundary, or vendor claim. The current General Gate 6 policy is
[September 15, 2026](protocol/m3-general-gate-6-current-policy-status-2026-09-15.md).

The `opus` repository is the product superproject. It owns integration
scripts, release locks, product documentation, and complete-product CI. It
does not own copied Launcher or Runtime implementation source.

Launcher owns the desktop application, authentication, account catalog,
platform integration, installation, verification, artifact staging, launch
planning, and game process lifecycle.

Runtime owns code executed in the game JVM, including the bootstrap protocol,
Minecraft 1.8.9 integration, Forge compatibility, host observations, and
reproducible Runtime artifacts. The current Runtime artifact contract remains
an implementation baseline; it has not been changed by the roadmap decision.

The intended product dependency direction is:

```text
superproject        -> Launcher
superproject        -> Runtime reference host
Launcher            -> versioned Runtime artifacts
Runtime host        -> host-neutral Opus Core
Opus Core           -X-> Forge, Minecraft, renderer, or client-brand types
Frozen injector R&D -X-> active product delivery
```

Forge + OptiFine 1.8.9 is the initial host/reference implementation. Thin host
integrations should expose lifecycle, tick, render, world, entity, packet,
input, and game-session observations to Core. RBW intelligence belongs above
that raw layer: player, team, bed, generator, resource, projectile, match, and
threat state.

UI-first does not select a renderer. CEF/Svelte, OneConfig/Elementa, native UI,
and prior renderer experiments are retained as research and reuse evidence;
none is an active architecture selection until a later explicit technical
decision. A renderer decision must preserve a single clear input,
configuration, and lifecycle ownership model.

Runtime artifacts cross the repository boundary through the versioned manifest
described in [protocol/runtime-artifacts.md](protocol/runtime-artifacts.md).
Any change to that contract, staging, package, or launch behavior remains
separate implementation work with its own verification.

Earlier Core-Mod-first, CEF-first, OneConfig/Elementa-first, and
injector-runtime-payload plans are preserved as implementation history and
research. They may inform later work, but they do not override Decision 0008.
