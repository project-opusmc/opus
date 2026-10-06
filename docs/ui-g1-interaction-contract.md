# UI G1 interaction contract — renderer-independent client behavior

Date: 2026-09-18
Inputs verified before writing: `docs/UI_G0_G2_EXECUTION.md`, Decision 0008,
`ui-v2/HOME_SPEC.md`, and the current `ui-v2`/Forge bridge sources recorded in
`docs/ui-g0-audit.md`.

## Contract boundaries

This document defines player-visible client behavior, not a renderer choice.
Minecraft owns worlds, network sessions, game options, gameplay, pause, and
process shutdown. Opus owns product navigation, product-domain selections, and
module/HUD settings. A browser prototype may use explicit fixture adapters to
exercise this contract; it must not present fixture data as live gameplay or
infer integrated authority from a URL/hash.

The current integrated implementation has a Java-owned `UiNavigationState`,
revisioned `ui-state`/`ui-actions` bridge, and these current route IDs:
`title`, `singleplayer`, `multiplayer`, `settings`, `accounts`, `game_menu`,
`quick_hub`, `mods_catalog`, `module_detail`, and `hud_editor`.

## Canonical semantic states

| Semantic state | Current route/API mapping | Authoritative owner | Notes |
| --- | --- | --- | --- |
| `MAIN_MENU` | `title` | Minecraft title lifecycle + Opus navigation when integrated | Browser Home is a fixture rendering of this state. |
| `SINGLEPLAYER` | `singleplayer` | Opus navigation; Minecraft owns world catalog/load | The selected world is not a current Java route parameter. |
| `WORLD_SELECTED` | no current route ID | Opus selection state until launch; Minecraft owns validation/load | Browser fixture keeps `selectedWorldId` locally. |
| `MULTIPLAYER` | `multiplayer` | Opus navigation; Minecraft owns server catalog/connect | The selected server is not a current Java route parameter. |
| `SERVER_SELECTED` | no current route ID | Opus selection state until connect; Minecraft owns connection | Browser fixture keeps `selectedServerId` locally. |
| `CONNECTING` | `connection`, phase `connecting` | Minecraft `GuiConnecting` lifecycle via `NativeSystemScreenSession` | CEF presents actual host state; Cancel/Back invokes the native action. |
| `LOADING_TERRAIN` | `connection`, phase `loading` | Minecraft `GuiDownloadTerrain` lifecycle | CEF shows host loading text, with no invented percentage or cancellation. |
| `DISCONNECTED` / kicked | `connection`, phase `disconnected` | Minecraft `GuiDisconnected` lifecycle | CEF displays the localized native title and actual kick/error reason as plain text. Back invokes the real parent. |
| `CLIENT_SETTINGS` | `settings` with `settingsSection: "interface"` | Opus settings owner | Current `ui-v2` browser settings persistence is only local; integrated persistence remains a runtime dependency. |
| `MODULE_BROWSER` | `mods_catalog` | Opus navigation + `ModuleRegistry` | Module selection is product state. |
| `MODULE_DETAIL` | `module_detail` with required `moduleId` | Opus navigation + `ModuleRegistry` | The current bridge validates the required module ID. |
| `HUD_EDITOR` | `hud_editor` | Opus navigation + native `HudManager` | CEF chrome and the revisioned native canvas have explicit, exclusive input boundaries. |
| `MINECRAFT_OPTIONS` | `minecraft-settings` host action -> vanilla `GuiOptions` | Minecraft | Do not treat existing `settingsSection: "game"` as this semantic state; that older bridge route remains accepted but is semantically ambiguous. |
| `ACCOUNT_MANAGER` | `accounts` | Opus navigation; launcher owns stored account catalog | Selecting an account affects a later launch, not the running Minecraft session. |
| `GAMEPLAY` | no product route | Minecraft | Opus overlays may be opened only through their separate entry points. |
| `PAUSE_MENU` | `game_menu` | Minecraft pause lifecycle + Opus navigation | Resume/disconnect are host actions. |
| `PUBLIC_OVERLAY` | current `quick_hub` | Opus navigation | Current RSHIFT mapping opens this state only during gameplay. |
| `INTELLIGENCE_OVERLAY` | no current route/API | future Opus intelligence owner | RCONTROL is intentionally distinct from RSHIFT; no current runtime keybind or route exists. |

## State graph

```text
launch -> MAIN_MENU

MAIN_MENU -> SINGLEPLAYER -> WORLD_SELECTED -> GAMEPLAY
MAIN_MENU -> MULTIPLAYER -> SERVER_SELECTED -> CONNECTING -> GAMEPLAY
MAIN_MENU -> CLIENT_SETTINGS -> MODULE_BROWSER -> MODULE_DETAIL
MAIN_MENU -> MINECRAFT_OPTIONS                 (Minecraft-owned boundary)
MAIN_MENU -> ACCOUNT_MANAGER

GAMEPLAY -> ESC -> PAUSE_MENU -> Resume -> GAMEPLAY
GAMEPLAY -> RSHIFT -> PUBLIC_OVERLAY -> close/ESC -> GAMEPLAY
GAMEPLAY -> RCONTROL -> INTELLIGENCE_OVERLAY -> close/ESC -> GAMEPLAY

PUBLIC_OVERLAY -> MODULE_BROWSER -> MODULE_DETAIL
PUBLIC_OVERLAY -> HUD_EDITOR
```

Any failed world/server/action transition remains at the prior valid semantic
state or moves to a Minecraft-owned system error state. It never advances based
only on a client-side route string.

## Transition and action contract

The tables use `fixture boundary` only for the standalone browser prototype.
In an integrated client, each listed host command is sent through the existing
bridge or handled by Minecraft; it is not simulated as success by the product
UI.

| Current state | User action | Requested command | Authoritative owner | Next state | Failure behavior | Back / close behavior |
| --- | --- | --- | --- | --- | --- | --- |
| launch | game reaches title | host title lifecycle / `title` navigation | Minecraft then Opus navigation | `MAIN_MENU` | Vanilla/system startup failure remains Minecraft-owned | no product Back at root |
| `MAIN_MENU` | Singleplayer | `navigate(singleplayer)` | Opus navigation | `SINGLEPLAYER` | retain Main Menu and surface inline action error | Back returns `MAIN_MENU` |
| `SINGLEPLAYER` | select world | local `selectedWorldId`; no host mutation | Opus selection state | `WORLD_SELECTED` | keep prior selection; announce unavailable list/error | Back clears selection and returns `MAIN_MENU` |
| `WORLD_SELECTED` | Play selected world | `/worlds/load` / `loadWorld` | Minecraft | `GAMEPLAY` after host load | stay selected or Minecraft system failure; browser shows an explicit development boundary only | browser Back returns `SINGLEPLAYER`; no post-load browser Back assumption |
| `MAIN_MENU` | Multiplayer | `navigate(multiplayer)` | Opus navigation | `MULTIPLAYER` | retain Main Menu and surface inline action error | Back returns `MAIN_MENU` |
| `MULTIPLAYER` | select saved server | local `selectedServerId`; no host mutation | Opus selection state | `SERVER_SELECTED` | keep prior selection; announce unavailable list/error | Back clears selection and returns `MAIN_MENU` |
| `SERVER_SELECTED` | Connect | `/servers/connect` / `connectServer` | Minecraft network/session lifecycle | `CONNECTING` | stay selected or Minecraft system failure; browser shows explicit development boundary only | browser Back returns `MULTIPLAYER`; no client-side fake connection result |
| `CONNECTING` | host completes connection | Minecraft connection lifecycle | Minecraft | `LOADING_TERRAIN` / `GAMEPLAY` | host `DISCONNECTED` state presented through CEF | revisioned Back cancels the native connection |
| `LOADING_TERRAIN` | host completes terrain load | Minecraft terrain lifecycle | Minecraft | `GAMEPLAY` | host disconnect/error state | native lifecycle decides when to close |
| `DISCONNECTED` | Back | revisioned `back` -> native button 0 | Minecraft then Opus navigation | actual native parent, normally `MULTIPLAYER` | preserve error if host action fails | CEF retains its browser/texture through return |
| `MAIN_MENU` or `PUBLIC_OVERLAY` | Client Settings | `navigate(settings, {settingsSection: "interface"})` | Opus navigation | `CLIENT_SETTINGS` | retain source state and show inline action error | Back returns prior navigation state |
| `CLIENT_SETTINGS` | change an Opus setting | `setUiSettings` in current browser contract | Opus settings owner | `CLIENT_SETTINGS` | revert optimistic fixture value / show inline error; do not toast success | Back returns prior navigation state |
| `CLIENT_SETTINGS` | Modules | `navigate(mods_catalog)` | Opus navigation | `MODULE_BROWSER` | retain settings and show inline action error | Back returns `CLIENT_SETTINGS` |
| `MODULE_BROWSER` | select/open module | `navigate(module_detail, {moduleId})` | Opus navigation | `MODULE_DETAIL` | retain module browser and show inline action error | Back returns `MODULE_BROWSER` |
| `MODULE_DETAIL` | toggle module | `/modules/toggle` / `setModuleEnabled` | `ModuleRegistry` | `MODULE_DETAIL` with reflected enabled state | restore previous state and show inline error | Back returns `MODULE_BROWSER` |
| `PUBLIC_OVERLAY` | HUD Editor | `navigate(hud_editor)` | Opus navigation + `HudManager` | `HUD_EDITOR` | retain public overlay and show inline action error | Back returns `PUBLIC_OVERLAY`; close returns `GAMEPLAY` |
| `MAIN_MENU` | Minecraft Settings | `minecraft-settings` | Minecraft `GuiOptions` | `MINECRAFT_OPTIONS` | remain at prior state if host rejects; browser opens explicit development boundary | vanilla options Back returns the supplied Minecraft parent screen |
| `MAIN_MENU` | Accounts | `navigate(accounts)` | Opus navigation + launcher account catalog | `ACCOUNT_MANAGER` | retain Main Menu and show inline action error | Back returns `MAIN_MENU` |
| `ACCOUNT_MANAGER` | select account for next launch | `/accounts/select` | Launcher-managed account catalog | `ACCOUNT_MANAGER` | preserve existing selected account and show inline error | Back returns prior navigation state |
| `MAIN_MENU` | Quit Minecraft | `quit` | Minecraft process owner | process termination | browser must not terminate development host; it opens an explicit development boundary | boundary dismiss returns `MAIN_MENU` |
| `GAMEPLAY` | ESC | Minecraft pause request | Minecraft | `PAUSE_MENU` | Minecraft owns failures | Resume/ESC closes to `GAMEPLAY` |
| `PAUSE_MENU` | Resume | `close`/host close | Minecraft | `GAMEPLAY` | retain pause if host refuses | no deeper Back at root |
| `PAUSE_MENU` | Options / Client / Disconnect | Minecraft/Opus host action | respective owner | specified state / system screen | host error is authoritative | screen-specific return rules |
| `GAMEPLAY` | RSHIFT | `openHotkeyFlow` -> `quick_hub` | `ClientOverlayController` | `PUBLIC_OVERLAY` | no route if a screen is already open | RSHIFT or ESC closes to `GAMEPLAY` |
| `PUBLIC_OVERLAY` | Modules | `navigate(mods_catalog)` | Opus navigation | `MODULE_BROWSER` | retain overlay and show inline error | Back returns public overlay |
| `GAMEPLAY` | RCONTROL | future explicit intelligence-open command | future Opus intelligence owner | `INTELLIGENCE_OVERLAY` | current runtime has no binding: do nothing rather than opening the public overlay or fabricating intelligence | when implemented, ESC/close returns `GAMEPLAY` |
| any integrated product route | stale bridge action | current revision check | `UiNavigationManager` | current authoritative state | bridge returns current state/409; UI resynchronizes and does not apply stale local transition | use returned state/history |
| embedded route | CEF/helper failure | none; host owns lifecycle | `OpusClientScreen` | host lifecycle shell | clear product input, expose only retry/ESC host shell | retry remains host-owned; ESC follows Java history/close |

## Back, Escape, and keyboard rules

1. Integrated route history is owned by Java `UiNavigationState`, not by the
   browser hash. A `back` request pops its route stack. When the stack is empty,
   Java returns to gameplay when in a world, or Main Menu when out of world.
2. The browser prototype owns a small in-memory navigation stack solely for
   fixture evaluation. Its hash can mirror the current route for deep-linking,
   but it is not its authoritative integrated-state model.
3. Escape first dismisses an explicit browser development boundary. Otherwise
   it performs the same Back action as a visible Back control. Native CEF gets
   first refusal for document-local modal handling; Java then owns root close.
4. Tab order follows DOM order. On Home: account, Singleplayer, Multiplayer,
   Client Settings, Minecraft Settings, Quit. Native CEF input explicitly
   forwards Tab, Enter, Space, Escape, arrows, Home/End, Page keys, and text.
5. Enter and Space activate native HTML buttons. Row selections must be actual
   buttons (or equivalent keyboard-operable controls), never click-only divs.
6. Scrollable lists retain focus and use normal browser wheel/keyboard scroll.
   The integrated `OpusInputMapper` forwards wheel and navigation keys to CEF.

## RSHIFT/RCONTROL boundary

`RSHIFT` is the public client surface: modules, HUD, settings, profiles, and
keybinds as those capabilities become real. Its current runtime mapping is
`quick_hub` and its root entry point is `HOTKEY`.

`RCONTROL` is reserved for the separate Opus Intelligence surface. It must not
be implemented as an alias for RSHIFT, a public-overlay submenu, or a fixture
that implies live RBW analysis. The current source contains RCONTROL only as a
modifier forwarded to CEF; it has no registered keybind, route, state owner,
or bridge command. Adding it requires later Java/runtime work and is out of
scope for G0-G2.

## Browser-fixture adapter rules

- Standalone lists, account selection, module selection/toggles, and browser
  settings are fixture state. They are local, deterministic, and visibly
  identified in code as browser-development behavior.
- Host-dependent commands (`loadWorld`, `connectServer`,
  `minecraft-settings`, and `quit`) must open a development-boundary result in
  standalone mode. They must not merely `console.log`, toast a fake success, or
  claim gameplay changed.
- In host mode the same controls call the existing bridge. A rejected request
  leaves the UI in its last authoritative state and displays an inline failure
  state with a usable retry/back path.

## Runtime dependencies deliberately outside G2

1. A real RCONTROL/Intelligence Overlay entry point and its state/data owner.
2. A durable integrated owner/API for `CLIENT_SETTINGS` values currently held
   only by `ui-v2` browser state.
3. Explicit integrated representations of `WORLD_SELECTED`,
   `SERVER_SELECTED`, and `CONNECTING` if the host needs browser-visible
   intermediate states beyond Minecraft's own screens.
4. Live Forge/CEF/manual evidence for the contract; browser-only results do
   not prove in-game input, compositor, or gameplay behavior.

## G1 verdict: PASS (contract), with integration dependencies recorded

The normal Minecraft client journey is now describable and testable without
referring to a visual layout. Current route IDs and bridge semantics are
preserved where they are sound, while semantic gaps are explicit rather than
papered over. The missing RCONTROL and settings-persistence owners block a
later runtime-integration gate, but do not block the standalone G2 prototype:
G2 can prove the bounded Home-to-module path with explicit fixture adapters and
without changing Java, CEF, launcher, packaging, or renderer selection.
