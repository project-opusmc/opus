# UI G0 audit — current repository ownership

Date: 2026-09-18
Execution contract: `docs/UI_G0_G2_EXECUTION.md`

## Scope and method

This is an ownership and reachability audit of the current working tree, not a
renderer-selection decision. It covers the browser fixture, the currently
packaged Forge/CEF host path, the launcher surfaces that stage that path, and
the older Svelte and Elementa/OneConfig lanes. Injector and M3 sources were
inventoried only far enough to prove that they are not UI entry points in this
pass; they were not changed or exercised.

### Git state at audit start

Superproject branch: `feature/web-surface-v2` at
`945a32700311edd47f060c6f117f54ffc07a0294`.

The working tree was already dirty. The following paths are pre-existing and
are preserved by this pass:

| Repository | Existing state | Paths |
| --- | --- | --- |
| Superproject | modified submodule gitlinks | `launcher`, `runtime` |
| Superproject | modified UI candidate | `ui-v2/src/App.tsx`, `ui-v2/src/bridge/bridge.ts`, `ui-v2/src/bridge/types.ts`, `ui-v2/src/styles.css` |
| Superproject | untracked inputs/assets | `docs/UI_G0_G2_EXECUTION.md`, `scripts/run-ui-g0-g2-agent.sh`, `ui-v2/HOME_SPEC.md`, `ui-v2/public/` |
| `launcher` submodule | modified | `crates/engine/src/forge.rs`, `crates/engine/src/launch.rs`, `scripts/assert-file-only-bundle.sh`, `scripts/build-tauri-bundle.sh`, `scripts/verify-runtime-launch-contract.mjs` |
| `runtime` submodule | modified | `legacy/1.8.9/client/native/opus-cef-helper/src/opus_main.mm`, `legacy/1.8.9/client/preview/harness/{BridgeHarness,HostNavigationAckHarness,W4InputHarness,W5ReactSurfaceHarness,WebViewHarness}.java`, `legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/{ClientOverlayController,OpusClientScreen}.java`, `legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/interop/OpusInteropServer.java`, `legacy/1.8.9/lwjgl-macos-compat/{build.gradle.kts,src/main/native/opus_lwjgl_resize_guard.m}`, `web-surface-v2/input/src/{main/java/org/polydevs/opusmc/websurface/OpusInputMapper.java,test/java/org/polydevs/opusmc/websurface/InputContractHarness.java}` |

No reset, checkout, restore, clean, or deletion is authorized by this audit.

## Reachability finding

There is one current, packaging-reachable in-game product compositor path:

```text
launcher Forge bootstrap
  -> launcher/crates/engine/src/launch.rs
     -Dopus.client.ui.enabled=true
     -Dopus.webview.helper=<staged helper on macOS>
  -> runtime/build.gradle.kts :buildWebClient
  -> runtime/legacy/1.8.9/client/build.gradle buildUiDist
  -> ui-v2/dist copied to JAR resource /opusui
  -> OpusClientMod -> ClientOverlayController -> OpusClientScreen
  -> OpusWebViewClient (CEF helper + shared-memory frames)
  -> OpusWebTextureSurface (Minecraft OpenGL texture)
```

`runtime/build.gradle.kts` renames the web client artifact to the historical
`opus-native-ui-1.8.9-0.1.0.jar` release filename. That name is a packaging
compatibility hazard, not evidence that the Elementa artifact is selected:
`launcher/scripts/assert-file-only-bundle.sh` requires the web-client classes
and `/opusui/index.html` and rejects `OpusNativeUiMod` plus the Elementa,
OneConfig, and UniversalCraft jars.

The source also contains direct/manual build tasks for an older native UI lane
and a frozen Svelte bundle. Neither is a dependency of the normal
`prepareBootstrap` path. They remain reintroduction risks and are classified
below; they are not a second renderer reachable through the normal packaged
client route.

## Source inventory and classification

| Path or component | Classification | Current role and owner | Reachability / risk |
| --- | --- | --- | --- |
| `ui-v2/src/App.tsx`, `ui-v2/src/styles.css` | REPLACE | React browser-prototype presentation and local fixture behavior. It currently contains the Home candidate and existing bridge calls. | This is the only implementation area changed by G2. It is bundled by the current Forge client, but G0-G2 do not select or change the production compositor/host. |
| `ui-v2/src/bridge/{bridge,types}.ts` | KEEP | Typed browser-to-host contract; standalone mock and host REST client. | Existing dirty candidate adds accounts and `minecraft-settings`; preserve unless compilation proves inconsistency. |
| `ui-v2/public/brand/` | KEEP | Browser prototype brand assets, including the approved wordmark. | Untracked input asset scope; no change required for interaction work. |
| `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/OpusClientMod.java` | KEEP, frozen host boundary | Forge mod boot switch. The launcher supplies `opus.client.ui.enabled=true`. | Current packaged entry; out of scope for G2. |
| `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/ClientOverlayController.java` | KEEP, frozen host boundary | Java-owned route transitions, Minecraft host actions, RSHIFT keybind, world/server/module/HUD provider, and loopback server lifecycle. | Current in-game state/host owner. RCONTROL is not registered here. |
| `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/OpusClientScreen.java` | KEEP, frozen host boundary | One `GuiScreen` that owns CEF lifecycle, browser keyboard forwarding, and the native HUD-editor canvas partition. | Current in-game screen owner. Its lifecycle shell is not a second product page renderer. |
| `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/embed/{OpusWebViewClient,OpusWebTextureSurface}.java` | KEEP, frozen compositor bridge | CEF helper lifecycle/shared-memory frame consumer and the OpenGL texture uploader. | Current product compositor plumbing; not modified. |
| `runtime/legacy/1.8.9/client/native/opus-cef-helper/src/opus_main.mm` | KEEP, frozen compositor bridge | Out-of-process CEF OSR renderer; control socket plus three-slot shared-memory BGRA transport. | Current helper source; modified before this pass, so read-only here. |
| `runtime/web-surface-v2/{coordinate,input,native,scripts}` | HISTORICAL / research evidence | W1-W7 CEF coordinate, input, transport, and lifecycle research lane. | Some launcher asset preparation can use its W1 helper builder as a fallback. It is not a second Minecraft screen owner. |
| `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/ui/render/MinecraftUiRenderer.java` and `hud/` | KEEP, narrowly scoped host rendering | Native live HUD widgets and HUD-editor hit/canvas rendering. | On `hud_editor`, it is deliberately partitioned from CEF chrome; it must not render title/settings/product pages. |
| `runtime/legacy/1.8.9/client/preview/` and preview harnesses | HISTORICAL / development evidence | Controlled route/capture/harness support. | Not a normal user route; current dirty evidence files remain untouched. |
| `ui/` | HISTORICAL | Svelte SPA with an older REST/WebSocket integration and duplicate route set. | `buildLegacyUiDist` can be invoked directly but is not part of normal runtime packaging. Do not revive it. |
| `runtime/legacy/1.8.9/native-client/` | DELETE-LATER | Elementa shell and OneConfig integration, including main-menu/pause interception and an RSHIFT keybind. | Direct manual task only. `prepareBootstrap` does not depend on `buildNativeUi`; launcher verification rejects its class/dependencies from the packaged web client. Do not revive it. |
| `runtime/third_party/oneconfig/` | HISTORICAL | Vendored OneConfig source required only by the retired native-client proof lane. | Not included by the current root Gradle settings or normal web-client package path. |
| `tools/opus-webview-helper/` | HISTORICAL | Separate Swift webview-helper experiment. | No current Forge client build path references it. |
| `launcher/desktop/src/{App.tsx,ui/LauncherTui.tsx}` and `launcher/desktop/src-tauri/src/{lib.rs,main.rs}` | KEEP | Tauri launcher UI and host-side install/account/launch owner. | Separate desktop surface; it stages the one client JAR/helper and does not own in-game route state. |
| `launcher/crates/engine/src/{launch.rs,forge.rs}` and `launcher/scripts/{prepare-desktop-assets.sh,assert-file-only-bundle.sh}` | KEEP, frozen packaging boundary | Stages/validates exactly one web client JAR and the macOS CEF helper. | Packaging-reachable and read-only in this pass. `check-cef-keychain-free.sh` is explicitly disabled historical gate code after `exit 78`. |
| `runtime-java/`, `runtime-native/`, `injector/`, `injector-native/`, `adapters/` | HISTORICAL / frozen M3 R&D | Harnesses, native runtime/injector, and adapter evidence. | No current UI route or browser asset owner was found. Frozen and out of scope. |

## Route, state, renderer, input, host-action, and data ownership map

The browser route identifiers below are the current bridge IDs. The semantic
names are used by G1; this table records only proven current ownership.

| Screen / route | State owner | Renderer / compositor | Input owner | Bridge or host action owner | Persistence / data owner |
| --- | --- | --- | --- | --- | --- |
| Main Menu / `title` | `UiNavigationState` in `OpusClientScreen`; React state only in standalone browser mode | CEF OSR -> `OpusWebTextureSurface`; browser DOM for G2 | CEF DOM via `OpusClientScreen`; browser DOM in G2 | `GuiOpenEvent` replacement of `GuiMainMenu` in `ClientOverlayController` | Minecraft title lifecycle; client metadata from `/api/v1/client` |
| Singleplayer / `singleplayer` | Java navigation state; browser fixture selection is local | same CEF/browser split | same | `/worlds`, `/worlds/load` -> `ClientOverlayController.listWorlds/loadWorld` | Minecraft save format/world loader |
| World selected / semantic-only today | No distinct current bridge route | browser fixture only in G2 | browser DOM | eventual `loadWorld` remains Minecraft-owned | Minecraft save format/world loader |
| Multiplayer / `multiplayer` | Java navigation state; browser fixture selection is local | same CEF/browser split | same | `/servers`, `/servers/connect` -> `ClientOverlayController` | Minecraft `ServerList` / `ServerData` |
| Server selected / semantic-only today | No distinct current bridge route | browser fixture only in G2 | browser DOM | eventual connect remains Minecraft-owned | Minecraft `ServerList` |
| Connecting / semantic host state | Minecraft | Minecraft system `GuiConnecting` | Minecraft | `ClientOverlayController.connectServer` calls host connect | Minecraft network/session lifecycle |
| Client Settings / `settings?settingsSection=interface` | Java navigation route, but current UI settings object is browser-local in `ui-v2` | same CEF/browser split | same | `navigate`; UI setting bridge methods have no current Java REST persistence endpoint | **unresolved for integrated persistence**; G2 uses fixture state only |
| Minecraft Options / semantic `MINECRAFT_OPTIONS` | Minecraft `GuiOptions` | Minecraft vanilla GUI | Minecraft | `minecraft-settings` action; controller permits vanilla `GuiOptions` once | Minecraft `GameSettings` |
| Accounts / `accounts` | Java navigation state; account list selection through loopback endpoint | same CEF/browser split | same | `/accounts`, `/accounts/select`; launcher writes the configured `opus.accounts.file` catalog | Launcher-managed accounts catalog; current session is Minecraft-owned |
| Pause / `game_menu` | Java navigation state | same CEF/browser split | CEF DOM or Minecraft ESC fallback | `GuiIngameMenu` interception | Minecraft gameplay/pause lifecycle |
| Public Overlay / current `quick_hub` | Java navigation state with `EntryPoint.HOTKEY` | same CEF/browser split | RSHIFT keybinding in `ClientOverlayController`; then CEF DOM | `openHotkeyFlow` | Opus module/HUD state; no separate general product store exists yet |
| Modules / `mods_catalog` | Java navigation state and `ModuleRegistry` | same CEF/browser split | CEF/browser DOM | `/modules`, `/modules/toggle` | `ModuleRegistry`; underlying settings store for current utility modules |
| Module Detail / `module_detail?moduleId=…` | Java navigation state carries `moduleId` | same CEF/browser split | CEF/browser DOM | `navigate` with bridge validation; module toggle/set settings actions | `ModuleRegistry` / module settings |
| HUD Editor / `hud_editor` | Java navigation state plus native `HudManager` state | CEF chrome plus `MinecraftUiRenderer` only inside the revision-acknowledged canvas | `OpusClientScreen` gives each pointer sequence exclusively to native canvas or CEF | `/ui-input-region` sets canvas boundary; HUD movement/module actions are host-owned | `HudManager` / utility settings |
| Intelligence Overlay / required semantic state | **No current route or state owner** | none | **No RCONTROL registration found** | none | none |
| Gameplay | Minecraft | Minecraft | Minecraft | Minecraft | Minecraft world/session |

### Shared-renderer/input ownership check

`hud_editor` is the only current route with two render paths. The source gives
them disjoint responsibilities: CEF paints product chrome, while
`MinecraftUiRenderer` paints the live native canvas. `OpusClientScreen` checks
the revisioned canvas bounds before assigning a pointer sequence; a canvas
pointer never reaches CEF and a CEF capture blocks native ownership. This is a
known partition, not two renderers owning the same product interaction.

The lifecycle loading/error shell in `OpusClientScreen` is also native, but it
contains no title/menu/settings fallback controls. It is a failed-compositor
state, not a competing product renderer.

## Bridge and runtime semantics verified for G1

- `UiNavigationState` owns history and monotonic revisions in the integrated
  client. The web UI requests `navigate`, `back`, or `close`; it does not write
  Java route state directly.
- `OpusInteropServer` accepts `navigate`, `back`, `close`,
  `minecraft-settings`, and `quit`; all except `quit` require the current
  navigation revision. It validates `module_detail` and `settings` parameters.
- `ClientOverlayController` marshals bridge actions to the Minecraft client
  thread, owns host world/server/options/quit operations, and allows the
  explicit Home `minecraft-settings` action to open vanilla `GuiOptions`.
- Browser assets are served from `/opusui`; the loopback bridge is
  authenticated and can broadcast `uiNavigationChanged` over WebSocket. CEF
  pixels do **not** travel over that WebSocket: the helper uses a separate
  loopback control socket plus shared memory.
- `OpusInputMapper` maps LWJGL logical coordinates to CEF CSS pixels; it
  forwards Tab, Enter, Space, Escape, navigation keys, text, pointer, and
  wheel events when the embedded surface is ready.

## Legacy and duplication risks

1. `ui/` and `ui-v2/` duplicate much of the client route surface in different
   web frameworks. `ui/` is not normal-package reachable, but
   `buildLegacyUiDist` remains a direct task.
2. `runtime/legacy/1.8.9/native-client/` duplicates main-menu, pause, and
   RSHIFT ownership with Elementa/OneConfig. It is blocked from the current
   packaged JAR by source and launcher verification, but its direct build task
   remains a material reintroduction risk.
3. The release filename `opus-native-ui-1.8.9-0.1.0.jar` now carries the web
   client. A manual native-lane artifact sharing that logical name could be
   staged incorrectly outside the normal checked launcher flow.
4. `launcher/scripts/check-cef-keychain-free.sh` contains an explicit disabled
   historical body after an unconditional `exit 78`, while the active launcher
   packaging scripts require the CEF helper. Treat that script as historical,
   not an authority on active ownership.
5. `RCONTROL` has no source owner. This is an unimplemented capability, not an
   ambiguous duplicate: G1 must define its semantic boundary and record the
   runtime dependency without adding a Java keybind in G0-G2.
6. Current `ui-v2` standalone navigation derives route display from the hash
   and lacks a browser-fixture history/selection contract sufficient for the
   required G2 path. That is the bounded G2 replacement target, not a reason
   to change the integrated host.

## UNKNOWN items

No production-relevant renderer, input dispatcher, or packaged route owner is
unknown after the source audit. The following are explicitly **unimplemented**
or **unverified**, rather than UNKNOWN ownership:

- RCONTROL / Intelligence Overlay has no runtime registration, route ID,
  persistence owner, or bridge endpoint.
- Integrated persistence for `UiSettings` in `ui-v2` is not backed by a current
  Java API; G2 may use browser fixture state but must not claim it is live.
- `WORLD_SELECTED`, `SERVER_SELECTED`, and `CONNECTING` do not have current
  browser route IDs. The host owns the load/connect transitions; G1 will model
  the semantic states without changing Java.
- This audit proves source and build reachability only. It is not live Minecraft
  or CEF runtime evidence.

## G0 verdict: PASS

G0 passes for the bounded G1/G2 work: the current packaged client route has a
single known CEF/web compositor path, legacy renderer lanes are identified and
not normal-package reachable, and all current input/bridge owners are mapped.

The pass does **not** select, certify, or modify the CEF/Java/launcher
production path. G2 is permitted only inside `ui-v2`, using explicit browser
fixtures for host-dependent results. RCONTROL and integrated settings
persistence remain blockers for later runtime integration, not for the
renderer-independent G1 contract or the browser-only G2 fixture.
