# Opus UI — G0 to G2 execution contract

Status: active execution contract — 2026-09-18

## Objective

Re-establish the Opus Client UI from product semantics outward. Do not continue polishing the current Home implementation blindly. G0 through G2 are a bounded foundation pass: inventory the real repository, establish one canonical screen/state/interaction contract, then make the browser prototype prove those interactions before any production renderer integration.

## Non-negotiable product rules

- Opus Home is a Minecraft client Home, not a SaaS/AI dashboard.
- Home exposes Singleplayer, Multiplayer, Client Settings, Minecraft Settings, Accounts, and Quit directly and predictably.
- RSHIFT is the public client surface: modules, HUD, settings, profiles/keybinds as they become real.
- RCONTROL is the Opus Intelligence surface: analysis and information enrichment. It is separate in purpose but must share the same design language, component system, navigation semantics, and renderer architecture.
- No Elementa fallback or historical UI framework is automatically revived.
- No second product renderer or parallel product UI is introduced during G0-G2.
- No temporary local-web/WebSocket architecture pivot is introduced merely to make a demo work.
- No visible dead control. A route/action that is not implemented must be explicitly represented as a development fixture or omitted.
- Preserve unrelated dirty work. No reset, checkout, bulk deletion, or destructive cleanup.
- Injector R&D remains frozen and outside this execution pass.

## Gate discipline

A gate passes only with evidence in all applicable dimensions:

1. Product — flow matches Minecraft/client semantics.
2. Visual — presentation obeys the Opus visual constraints where visuals exist.
3. Functional — controls and transitions actually work in the target of that gate.
4. Technical — build/type/runtime checks pass for the gate scope.

No evidence means no PASS. A failed gate blocks promotion to the next gate unless the failure is documented as an explicitly non-blocking historical artifact.

---

# G0 — Repository and legacy UI audit

## Goal

Know exactly which UI paths exist and which are active, historical, duplicated, dead, or unresolved before changing architecture.

## Required inventory

Audit at minimum:

- `ui-v2/`
- `ui/`
- `runtime/`
- `runtime-java/`
- launcher UI surfaces that can affect the client flow
- CEF/JCEF/native helper integration references
- Elementa/OneConfig references
- WebSocket/shared-memory/bridge references
- title/home implementations
- multiplayer/singleplayer/settings/accounts routes
- input dispatch and keybind ownership
- render/compositor ownership
- RSHIFT/public-client entry points
- RCONTROL/intelligence entry points, if any
- duplicate `Opus*` UI/page/screen classes and stale prototypes
- packaging/build references capable of reintroducing retired paths

## Classification

Every relevant path/component must be classified as one of:

- KEEP — current reusable implementation consistent with the active direction.
- REPLACE — active or reachable implementation that conflicts with the target direction.
- DELETE-LATER — historical/dead artifact that should eventually be removed but is not deleted during G0.
- HISTORICAL — retained research/evidence, not a production path.
- UNKNOWN — ownership/reachability not yet proven.

## Required dependency/ownership map

Produce a concrete map of:

`screen/route -> state owner -> renderer/compositor -> input owner -> bridge/host action -> persistence/data owner`

The map must explicitly identify any route where more than one renderer or input dispatcher can own the same product interaction.

## G0 evidence

Write `docs/ui-g0-audit.md` containing:

- git branch and dirty-worktree inventory;
- source paths and classifications;
- active vs historical renderer paths;
- route ownership map;
- input ownership map;
- legacy/duplicate risks;
- build/package references that can resurrect old UI;
- unresolved UNKNOWN items;
- a G0 verdict with blockers.

G0 PASS requires no production-relevant UI component whose ownership is unknown. Historical research may remain UNKNOWN only when it is proven unreachable from the active product/build path.

---

# G1 — Canonical product state and interaction contract

## Goal

Define the client behavior independently of visual implementation.

## Canonical states

At minimum model:

- `MAIN_MENU`
- `SINGLEPLAYER`
- `WORLD_SELECTED`
- `MULTIPLAYER`
- `SERVER_SELECTED`
- `CONNECTING`
- `CLIENT_SETTINGS`
- `MODULE_BROWSER`
- `MODULE_DETAIL`
- `HUD_EDITOR`
- `MINECRAFT_OPTIONS`
- `ACCOUNT_MANAGER`
- `GAMEPLAY`
- `PAUSE_MENU`
- `PUBLIC_OVERLAY`
- `INTELLIGENCE_OVERLAY`

Names may map to existing route IDs rather than forcing a breaking rename. The contract is semantic; existing bridge/runtime identifiers should be preserved when sound.

## Required transitions

Document at minimum:

- launch -> Main Menu
- Main Menu -> Singleplayer -> select world -> launch world
- Main Menu -> Multiplayer -> select server -> connect -> Gameplay
- Main Menu -> Client Settings
- Main Menu -> Minecraft Settings
- Main Menu -> Accounts
- Gameplay -> ESC -> Pause -> Resume/Options/Client/Disconnect
- Gameplay -> RSHIFT -> Public Overlay -> close to Gameplay
- Gameplay -> RCONTROL -> Intelligence Overlay -> close to Gameplay
- Public Overlay -> Modules -> Module Detail
- Public Overlay -> HUD Editor
- all Back/ESC semantics
- failure transitions for connect/load/action failure

## Action contract

For every visible action record:

`current state -> user action -> requested command -> authoritative owner -> next state -> failure behavior -> back/close behavior`

No button may exist solely because it looks appropriate.

## Ownership rules

- Minecraft/host owns actual world/server/session operations.
- Opus product state owns Opus navigation and client-domain state.
- Browser prototype may simulate host results only through explicit fixture adapters.
- Fixture state must never be presented as live gameplay intelligence.
- UI must not infer authoritative state from URL/hash alone in integrated production.

## G1 evidence

Write `docs/ui-g1-interaction-contract.md` containing:

- canonical state graph;
- transition table;
- action ownership table;
- Back/ESC/hotkey rules;
- failure states;
- RSHIFT/RCONTROL boundary;
- explicit mapping to existing route IDs/bridge APIs where available;
- unresolved runtime dependencies separated from browser-prototype requirements.

G1 PASS requires that the normal Minecraft client journey can be explained and tested from the contract without referring to visual layout.

---

# G2 — Interactive browser prototype foundation

## Goal

Prove product flow and interaction in the fast browser iteration environment before production CEF/Minecraft integration. G2 is not proof of in-game readiness.

## Scope

Use the existing `ui-v2` React/TypeScript/Vite prototype unless G0 proves it is unusable. Do not select or modify the production renderer in G2.

## Required prototype flow

The browser prototype must support a coherent fixture-backed journey:

`Home -> Multiplayer -> select server -> Back -> Client Settings -> Modules -> Module Detail -> toggle -> Back`

Also prove:

- Home -> Singleplayer
- Home -> Accounts
- Home -> Minecraft Settings fixture/action boundary
- Home -> Quit fixture/action boundary without actually terminating the development host
- keyboard Tab focus
- Enter/Space activation where appropriate
- ESC/Back behavior
- scroll behavior on content that overflows
- toggle/selection state
- no dead visible control

## Home constraints

`ui-v2/HOME_SPEC.md` remains applicable unless this contract explicitly supersedes it. In particular:

- no dashboard shell on Home;
- no session/telemetry/renderer cards;
- no generic AI/SaaS presentation;
- Singleplayer and Multiplayer dominate hierarchy;
- restrained dark Minecraft-client presentation;
- no glassmorphism/neon/purple-gradient decoration;
- required Home controls remain usable at the small default viewport.

## G2 implementation rules

- Prefer extracting route/state/fixture logic from monolithic presentation code when it reduces ambiguity.
- Reuse one component vocabulary rather than page-local button implementations.
- Do not add a new dependency without a demonstrated need.
- Do not touch Java runtime, launcher, injector, CEF native code, or production packaging merely to pass G2.
- Do not hide an interaction failure with a fake toast or console log.
- Development-only host actions must be visibly/semantically fixtures in code, while the player-facing copy remains normal product copy.

## G2 automated evidence

At minimum:

- `npm run build` passes;
- TypeScript compilation passes through the normal build;
- static check confirms required Home action identifiers;
- static check rejects forbidden Home copy from `HOME_SPEC.md`;
- no new dependency unless recorded;
- browser prototype route/action smoke test where practical with the current toolchain.

## G2 manual evidence target

Capture or record, when tooling permits:

- 427x240 CSS viewport Home;
- 900x600 Home;
- Multiplayer selected state;
- Client Settings/Modules/Module Detail path;
- keyboard focus state;
- interaction sequence and any remaining fixture boundaries.

## G2 PASS

G2 passes only when the browser prototype is a coherent interactive Minecraft-client prototype and all required controls have working handlers. Visual perfection is not required yet; architecture, hierarchy, and interaction coherence are required.

---

# Stop conditions

Stop rather than improvising a new architecture if any of these occurs:

- active renderer ownership cannot be proven;
- G0 finds multiple reachable production product renderers for the same route;
- bridge/runtime semantics conflict with the canonical G1 contract in a way requiring Java changes;
- passing G2 would require changing production CEF/native/runtime code;
- existing dirty work would need reset/revert/overwrite;
- build failure originates outside the bounded UI prototype and cannot be isolated safely.

Document the blocker and preserve evidence.

# Expected outputs

- `docs/UI_G0_G2_EXECUTION.md` — this contract.
- `docs/ui-g0-audit.md`
- `docs/ui-g1-interaction-contract.md`
- bounded `ui-v2` G2 changes
- build/test evidence
- final G0/G1/G2 verdict summary

Do not claim G3 or production renderer readiness from completion of this contract.
