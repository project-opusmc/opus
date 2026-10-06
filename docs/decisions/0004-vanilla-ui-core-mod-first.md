# ADR 0004: Vanilla UI first, Core Mod only

Status: **historical — superseded for the active product direction by
Decision 0008 on September 15, 2026**

> This ADR remains a record of the vanilla/Core-Mod stabilization phase and of
> its artifact boundaries. It does not select the current Opus Client +
> Launcher UI architecture. See
> [Decision 0008](0008-opus-client-launcher-ui-first-mainline.md).

This ADR remains as the stabilization record for the vanilla-only phase. It is
not the current product UI direction.

## Decision

The supported Minecraft 1.8.9 production path returns to the stock Minecraft
GUI while the OPUS Core Mod is audited and stabilized. CEF/Svelte client source
may remain quarantined in the repository for historical review, but it is not a
production build, package, staging, or launch input.

The production launch has this boundary:

```text
Opus Launcher → Forge 1.8.9 + OptiFine HD U M5 → OPUS Core Mod
             → vanilla Minecraft GUI and input
```

The launcher packages and stages only its bootstrap JAR and Core Mod JAR. The
managed Forge `mods/` directory contains only locked OptiFine and the Core Mod.
No production command may set a CEF/UI enable property or include a client JAR
or webview helper.

## Why

The previous client path replaced `GuiMainMenu`, `GuiIngameMenu` (ESC/pause),
world selection, multiplayer, and options screens inside
`ClientOverlayController.onGuiOpening`. That made vanilla UI impossible to
recover and allowed stale UI behavior to look like a Core Mod failure. Removing
the client artifact from the production contract eliminates the parallel
compositor without destructively deleting quarantined source from a dirty
working tree.

## Core Mod boundary

Keep and verify:

- Forge loading plugin and transformer chain;
- lifecycle/bootstrap telemetry;
- network, render, combat, and OptiFine-safe patches;
- artifact integrity and launch ordering.

Do not let the Core Mod own a GUI, screen replacement, key binding, CEF
process, browser texture, HUD product surface, game-window title patch, resize
handler, or input router.

## Acceptance for this phase

1. Core Mod tests and artifact verification pass.
2. A real production launch logs Core Mod registration and does not log CEF
   startup or Opus route registration.
3. `GuiMainMenu`, `GuiIngameMenu`/ESC, world selection, multiplayer, and
   options remain Minecraft-owned.
4. No Keychain or credential prompt is needed for build/test.
5. CEF acceptance is explicitly out of scope until the user re-authorizes it.

This decision supersedes the earlier CEF-first product plan for the current
work phase. It does not restore the retired T-UI/terminal overlay or authorize
destructive deletion of quarantined research source from a dirty working tree.
