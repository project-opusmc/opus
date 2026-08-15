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
Minecraft 1.8.9 integration, Forge compatibility, bytecode patches, typed
client modules, and reproducible Runtime artifacts.

The dependency direction is:

```text
superproject -> Launcher
superproject -> Runtime
Launcher     -> versioned Runtime artifacts
Runtime      -X-> Launcher source
```

Runtime artifacts cross the repository boundary through the versioned manifest
described in [protocol/runtime-artifacts.md](protocol/runtime-artifacts.md).
