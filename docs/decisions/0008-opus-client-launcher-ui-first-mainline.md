# Decision 0008: Opus Client + Launcher mainline, UI first

Status: accepted — September 15, 2026

## Decision

OPUS is returning its main development focus to a usable, transparent
**Opus Client + Opus Launcher** product. The initial reference host is
Minecraft Java Edition 1.8.9 through the existing Forge + OptiFine lane.

The product is RBW-first: Ranked Bedwars/PvP intelligence that turns
game- and server-visible information into useful player analysis. It is not a
generic Minecraft-client module collection, and it is not an injector research
product.

The first active product priority is **UI**. The Launcher and in-game Client
must become one understandable player experience before broad RBW intelligence
work expands.

## Mainline and preserved R&D lanes

```text
active product mainline
    Opus Launcher + Opus Client UI
        -> host-neutral Opus Core
        -> Forge + OptiFine 1.8.9 reference host
        -> RBW intelligence

frozen experimental R&D
    injector/ + injector-native/ + runtime-native/ + runtime-java/ + adapters/
        -> retained M3/Gate evidence, bootstrap artifacts, notes, and
           reproducibility bundles
```

The injector/injection track is frozen, not deleted, failed, or discarded.
Its source, artifacts, evidence, and reproducibility records must remain
available for an explicit future resumption. A freeze does not change any
recorded Gate result, vendor-authorization boundary, or release claim.

No new injector implementation, live target interaction, Gate promotion, or
vendor-compatibility claim is part of the Client + Launcher mainline unless
the owner explicitly resumes that R&D lane.

## UI-first scope

UI-first means prioritizing a small, coherent visual and interaction foundation
for both product surfaces:

- Launcher: clear account/profile, installation, runtime-readiness, launch,
  and actionable failure states.
- Client: a lightweight in-game HUD/notification and module presentation shell
  suitable for RBW intelligence.
- Shared product behavior: a clear visual language, configuration ownership,
  predictable input/navigation, and no fabricated gameplay intelligence.

This decision does **not** select a renderer or revive a historical UI stack.
CEF/Svelte, Elementa/OneConfig, native UI, and prior renderer experiments are
retained as research and reusable evidence only. Selecting or replacing a
renderer requires a later, explicit technical decision.

UI-first also does not authorize a broad ClickGUI, cosmetics catalog, generic
module collection, stealth behavior, injection path, or third-party-client
adapter.

## Architecture direction

- Keep Opus Core host-neutral where practical. It owns product-domain state and
  rules, not Forge, Minecraft, or renderer types.
- Keep host integrations thin. Forge + OptiFine 1.8.9 is the initial reference
  implementation for lifecycle, tick, render, world, entity, packet, and input
  observations.
- Model RBW intelligence above raw host objects: player, team, bed, generator,
  resource, projectile, match, and threat state.
- Future Lunar or Badlion work, if ever resumed and authorized, must consume
  the same Core through a separate host adapter. It is not a current UI or
  product dependency.
- Competitive legitimacy favors a transparent, auditable standalone client
  path. The frozen injector lane is not the product delivery mechanism.

## Delivery order

1. Establish the Client + Launcher UI foundation and its product-state
   contracts using explicit fixture/development states where live RBW data is
   not yet available.
2. Add the host-neutral telemetry/data foundation behind those contracts.
3. Build the RBW player/team/match model.
4. Deliver one end-to-end flagship intelligence feature, initially expected to
   be Enemy Tracker or Fireball Intelligence.
5. Expand the lightweight HUD and only then add further intelligence modules
   and an AI analyst.

No fixture or mock state may be presented as live gameplay intelligence in a
player-facing release surface.

## What this supersedes

This decision supersedes the **product-priority and active-architecture**
portions of prior injector-first, Core-Mod-only, CEF-first, and
OneConfig/Elementa-first plans where they conflict with this document.

It does not rewrite historical research, existing implementation contracts,
release artifacts, Gate evidence, or technical facts. Those remain valid
records of what was built or observed. Changing the current Runtime or Launcher
artifact/staging contract remains separate implementation work and requires
its own verification.

## Current non-claims

This decision does not claim that:

- a new Opus Client UI has been implemented or shipped;
- the existing Forge/OptiFine artifact contract has already changed;
- Badlion or Lunar is supported;
- injector R&D has passed, resumed, or been deleted;
- General Gate 6 has passed or Gate 7 is ready; or
- vendor authorization exists.
