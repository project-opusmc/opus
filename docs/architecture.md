# OPUS Architecture

OPUS currently has two deliberately separated integration lanes:

```text
injector-development (active, foundation-only)
        |
        +-- injector/       Rust M3 preflight and authorized-target proof boundary
        +-- runtime-native/ C++17 JNI/JVMTI runtime
        +-- runtime-java/   Java 8 payload foundation
        `-- adapters/       client/runtime certification boundaries

legacy-forge-rollback (not active)
        |
        +-- launcher/ -> project-opusmc/launcher
        `-- runtime/  -> project-opusmc/runtime
```

The schema-v2 release lock selects the foundation-only injector lane. It
verifies architecture, native/JVM proof, an opt-in authorized-test-target
lifecycle/survival proof, and the future payload compatibility contract without
claiming a generated payload JAR or certified third-party client. The legacy
Forge lane remains available only as a rollback profile with exact historical
component pins.

The `opus` repository is the product superproject. It owns integration
scripts, release locks, product documentation, and complete-product CI. It
does not own copied Launcher or Runtime implementation source.

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

The separately gated transition from the current Forge-started integration to
the Injector → native runtime → Java payload architecture is documented in
[injector-runtime-payload-migration-plan.md](injector-runtime-payload-migration-plan.md).
That plan does not change the current release artifact contract until its
architecture, payload, OneConfig, lifecycle, and cutover gates pass.
