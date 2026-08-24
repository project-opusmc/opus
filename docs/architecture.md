# OPUS Architecture

OPUS uses three active repositories for this phase:

```text
project-opusmc/opus
        |
        +-- launcher/ -> project-opusmc/launcher
        |
        `-- runtime/  -> project-opusmc/runtime
```

The `opus` repository is the product superproject. It owns integration scripts,
release locks, product documentation, and complete-product CI. It does not own
copied Launcher or Runtime implementation source.

Launcher owns the desktop application, authentication, account catalog,
platform integration, installation, verification, artifact staging, launch
planning, and game process lifecycle.

Runtime owns code executed in the game JVM, including the bootstrap protocol,
Minecraft 1.8.9 integration, Forge compatibility, Core Mod bytecode patches,
the OneConfig UI fork, the Elementa shell integration, and reproducible Runtime
artifacts.

The dependency direction is:

```text
superproject -> Launcher
superproject -> Runtime
Launcher     -> versioned Runtime artifacts
Runtime      -X-> Launcher source
```

Runtime artifacts cross the repository boundary through the versioned manifest
described in [protocol/runtime-artifacts.md](protocol/runtime-artifacts.md).

The canonical product and architecture plan for the Minecraft client is
[opus-ui-v3-goal-and-plan.md](opus-ui-v3-goal-and-plan.md), backed by
[ADR 0005](decisions/0005-oneconfig-fork-elementa-shell.md). Older CEF, T-UI,
custom-renderer, and vanilla-only plans are historical evidence when they
conflict with ADR 0005 or the current local implementation.

The target in-game composition has two specialized frontend technologies under
one product design language:

```text
Opus Launcher -> Forge 1.8.9 + OptiFine HD U M5 -> Opus game integration
                                                   |-> forked OneConfig
                                                   |   module/config/HUD/profile UI
                                                   `-> Elementa + UniversalCraft
                                                       Minecraft shell UI
```

CEF/Svelte, the legacy T-UI (`UiRuntime` pages and
`OpusVanillaTerminalOverlay`), and the custom renderer prototype are not target
production components. Quarantined source may remain for review while the V3
baseline is established, but it must not become a third production frontend.
