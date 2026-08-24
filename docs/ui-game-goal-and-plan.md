# Historical CEF-first in-game UI plan — superseded

Status: **historical reference; not a production plan**

> **Superseded on 2026-08-22.** The binding production architecture is
> Forge 1.8.9 + OptiFine HD U M5 + OPUS Core Mod + vanilla Minecraft UI.
> See [ADR 0004](decisions/0004-vanilla-ui-core-mod-first.md) and the active
> [Core-Mod-first goal and plan](coremod-first-goal-and-plan.md). The text below
> is retained only as evidence of CEF/UI failure modes; it does not authorize
> building, staging, packaging, or enabling CEF, `opus-client`, T-UI, or another
> parallel UI route.

Last preserved from the local working tree: 2026-08-22.

> **Phase decision (2026-08-22):** Current production work is temporarily
> vanilla-first and Core-Mod-first. See
> [`docs/decisions/0004-vanilla-ui-core-mod-first.md`](decisions/0004-vanilla-ui-core-mod-first.md).
> The CEF/Svelte architecture below is retained as future product context,
> but its client hooks are opt-in and must not replace vanilla GUI during this
> phase. The retired T-UI remains retired.

Current launch blocker (2026-08-22): the release artifact is ready, but
`/Applications/Opus Launcher.app` is still an older bundle (`b3d6ca...`;
release target `0908cb...`). The old nested macOS game stub can reach Java
`RUNNING` without publishing `game.window.ready`, which makes launch appear to
hang. The release installer refuses to replace it while `IOConsoleLocked` or
`CGSSessionScreenIsLocked` is true, before signing and without requesting a
password. The official `zvwgvx` catalog entry also has no file-backed refresh
token and therefore requires an explicit reconnect; unofficial launch remains
the offline acceptance path.

This document defines the target experience, implementation contracts, and
acceptance evidence. It is the product/architecture plan, not an automatic
authorization to modify code or build a release artifact. Any implementation
work still requires an explicit project request; completion requires real
Minecraft acceptance.

## Scope and authority

The attached `opus_ui_architecture_handoff_for_claude_code.md` is review
context. Its review-only constraints, evidence requirements, and warning not to
pivot architecture remain in force unless the user explicitly authorizes a
code change. They do not authorize keeping an old product UI as a fallback.

The current product decision is separate and explicit: standardize the
in-game experience around one CEF/Svelte product compositor, with native Java
limited to the live HUD, HUD-editor hit testing, and a minimal lifecycle/error
shell. Retired T-UI/native product pages are removal targets, not a parallel
implementation.

## 1. Goal

Build one coherent OPUS UI system for Minecraft 1.8.9 with exactly one
canonical product-rendering path in which:

- the title, pause, Quick Hub, Mods Catalog, Module Detail, and HUD Editor have
  explicit product roles instead of being aliases of a generic settings page;
- Java owns canonical navigation, game state, module state, HUD state, and
  persistence;
- Svelte/CEF owns complex application UI and fast browser-first iteration;
- the native Minecraft renderer owns real-time HUD widgets and editor hit
  testing;
- Java does not render a second product UI underneath, above, or beside CEF;
- a CEF startup or transport failure produces only a minimal loading/error
  state (or a controlled close), never the retired T-UI product surface;
- every visible control is backed by real game data and a verifiable action;
- input, scaling, CEF lifecycle, shared-memory transport, and OpenGL state are
  correct before the UI is treated as production-ready.

Success is not "the page renders in a browser". Success is the same route,
state, interaction, and persisted result working inside the installed
Minecraft 1.8.9 client.

## 2. Source-of-truth order

When documents disagree, use this order:

1. Current local source code and artifacts.
2. This document for the target product and implementation sequence.
3. `opus_ui_architecture_handoff_for_claude_code.md` for CEF review context and
   authorization boundaries.
4. `runtime/docs/lunar-1.8.9-ui-study.md` for observed UX evidence.
5. Older migration, WKWebView, native-overlay, and prototype documents as
   historical evidence only.

In particular:

- the then-current renderer was the CEF OSR helper, not the older Swift/WKWebView
  prototype described in `CODEX_HANDOFF.md`;
- the target hotkey destination is now Quick Hub, not the direct HUD Editor
  route recorded in the older framework-adoption decision;
- the architecture remains Svelte/CEF plus native HUD. There is no approved
  pivot to NanoVG, Elementa, a native overlay window, or a new custom UI engine.

## 3. Product invariants

1. No external browser or overlay window is part of the player experience.
2. Complex UI is rendered by Svelte through CEF into the Minecraft window.
3. Always-on and editor-preview HUD widgets are rendered natively.
4. The CEF editor never recreates a fake HTML copy of a native HUD widget.
5. Module catalog, module detail, and HUD editor resolve the same module ID and
   the same persisted state.
6. Java/Core is authoritative. The SPA is a view and command client.
7. Integrated navigation never depends on a local hash as authoritative state.
8. No placeholder accounts, worlds, servers, modules, settings, ping values,
   or HUD measurements are shown as real.
9. A route or control without complete behavior is omitted, not mocked.
10. Browser preview is necessary for iteration but never proves in-game
    acceptance.
11. There is exactly one product UI compositor for each route. Native Java
    rendering is reserved for the live HUD, HUD editor hit testing, and a
    minimal lifecycle/error shell; it is not a parallel product UI or a
    fallback implementation of CEF screens.
12. There is exactly one input dispatcher for each event. An event is not sent
    to CEF and a native product page in the same frame.
13. `UiRuntime`, `OpusUiPageFactory`, `Opus*Page`, and
    `OpusVanillaTerminalOverlay` are migration/removal targets, not supported
    production UI paths.
14. A launch may load only the verified Runtime artifacts staged into the
    selected identity's isolated game directory. Shared or stale `game/mods`
    content is outside the product path; an unmanaged instance artifact fails
    closed instead of becoming a second UI implementation.

## 4. Current-state assessment

| Area | Current state | Target state | Current verdict |
| --- | --- | --- | --- |
| Java routes | Includes `MOD_HUB`, `MODULE_DETAIL`, `HUD_EDITOR` | Structured route plus context and history | Implemented; Minecraft pending |
| SPA routes | Title, lists, settings, accounts, HUD, game menu | Adds Quick Hub, Mods Catalog, Module Detail | Implemented; Minecraft pending |
| Route mapping | Lossless route and `moduleId` mapping | Same | Static pass; Minecraft pending |
| Back/ESC | Core-owned history and deterministic close rules | Same | Bridge Harness pass; Minecraft pending |
| Modules | Real FPS and Armor Status data exists | Catalog/detail use one typed registry | Implemented; persistence pending |
| HUD editor | Native widgets, drag, resize, settings, remove | Same | Implemented in source; Minecraft pending |
| Mutations | Frontend handles `204` without parsing an empty body | Explicit no-content/authoritative responses | Static pass |
| Worlds | Bridge reads real save list; metadata remains limited | Real typed metadata | Partial; unsupported filters/actions hidden in integrated mode |
| Servers | Bridge reads saved list; ping is not yet authoritative | Ping/state events and real metadata | Partial; fabricated ping/state and unsupported edit/remove controls hidden |
| Accounts | Integrated view is read-only current session and absent in-world | Launcher-owned capability or real bridge | Static pass for read-only scope |
| Composition | CEF product compositor, native HUD/editor, minimal shell | Same | Static/artifact pass; Minecraft pending |
| Input | One owner per interaction; native HUD canvas is revision-scoped | Same | Production CEF keyboard/pointer harness pass; Minecraft pending |
| Frame transport | Two mmap slots with explicit release protocol | Proven slot ownership and reuse | Production CEF frame/release/reopen harness pass; Minecraft pending |
| GL boundary | Raw GL plus cached state restoration implemented | Full state restoration | Static pass; runtime pixel test pending |
| CEF packaging | Helper discovery works in dev paths | Every macOS launcher install carries one complete CEF helper bundle and passes its path to the JVM | Premium bundle/resource staging pass; clean-install launch pending |

### 4.1 Legacy product-path inventory (resolution record)

The following table records the retired path and the evidence that it has been
removed from the current production source/artifact. It must not be treated as
an implementation checklist to recreate the old surface:

| Legacy surface | Evidence | Required disposition |
| --- | --- | --- |
| `OpusClientScreen` native render | Formerly called `UiRuntime.render(...)` before CEF | Removed; screen now owns only CEF lifecycle/composition and approved HUD editor boundary |
| `UiRuntime` and `OpusUiPageFactory` | Former integrated construction path | Deleted from source and rejected by artifact verifier |
| `Opus*Page` classes | Former T-UI product pages | Deleted from source and absent from rebuilt JAR |
| `OpusVanillaTerminalOverlay` | Former vanilla event overlay | Deleted/unregistered and absent from rebuilt JAR |
| `ClientConfigUi` and `ClientUiHooks` | Retired reflection-rendered utility screen/HUD and its injected input/render boundary | Deleted from source and absent from the Runtime coremod artifact |
| `ClientOptionsTransformer` and generated options screen | Retired ASM Right-Shift/pause/HUD/product-screen entry path | Deleted from source/service registration and absent from Runtime artifacts |
| Embedded failure fallback | Formerly could expose T-UI on CEF failure | Explicit `starting`/`ready`/`failed`/`closed` lifecycle shell only |
| Input forwarding | Formerly sent events to CEF and native product pages | One dispatcher with revision-scoped native HUD ownership; CEF receives `SendMouse*Event`/`SendKeyEvent` directly and the dead DOM-synthesis shim is removed |

Build packaging is part of this inventory. References in the client artifact
assembly (including explicit T-UI class entries) must be removed or changed so
deleted production classes cannot be reintroduced by a stale packaging list.

## 5. Target information architecture

```text
No world
  Title
    Singleplayer
    Multiplayer
    Client
      Mods Catalog
        Module Detail
      HUD Editor is unavailable without a live world
    Options
    Accounts or Manage in Launcher

In world
  Right Shift
    Quick Hub
      Mods Catalog
        Module Detail
      HUD Editor

  Escape
    Pause Menu
      Resume
      Client -> Mods Catalog
      Options
      Disconnect

  Mods Catalog
    Module Detail
    Edit HUD Layout -> the same HUD Editor

  HUD Editor
    Widget settings -> the same Module Detail
```

Initial Quick Hub contains only actions with complete behavior:

- `Mods`
- `HUD Edit`
- close

Profiles, cosmetics, waypoints, marketplace, and unidentified reference
buttons remain absent until their data and workflows exist.

## 6. Screen contracts

`none` remains an internal transport state meaning no OPUS `GuiScreen` is
open. It is not a visible product route.

| Route ID | Required context | Presentation | Simulation | Close/ESC |
| --- | --- | --- | --- | --- |
| `title` | No world | Opaque full viewport | N/A | No implicit close |
| `singleplayer` | No world | Opaque full viewport | N/A | Back to `title` |
| `multiplayer` | No world | Opaque full viewport | N/A | Back to `title` |
| `settings` | Either | Opaque without world; workspace over world | Pause only when entered from Pause Menu | Back through route history |
| `accounts` | No world | Opaque full viewport | N/A | Back to `title` |
| `game_menu` | In world | World with dim/blur and focused menu | Pause integrated server | Resume/ESC closes to game |
| `quick_hub` | In world | Compact translucent overlay, no large card | Live | ESC or Right Shift closes to game |
| `mods_catalog` | Either | Opaque without world; translucent workspace over world | Live in world | Back to entry route |
| `module_detail` | Either plus `moduleId` | Reuses Mods workspace shell | Live in world | Back to catalog or HUD Editor origin |
| `hud_editor` | In world | Transparent editor chrome over live native HUD | Live | Back to origin; root hotkey flow closes to game |

The same route may have a different presentation when a world exists, but it
must not have different data or controls.

## 7. Navigation contract

### 7.1 Structured state

The route contract must preserve parameters and origin instead of reducing
everything to a string.

```ts
type RouteId =
  | "title"
  | "singleplayer"
  | "multiplayer"
  | "settings"
  | "accounts"
  | "game_menu"
  | "quick_hub"
  | "mods_catalog"
  | "module_detail"
  | "hud_editor";

type EntryPoint =
  | "launch"
  | "title"
  | "pause"
  | "hotkey"
  | "mods_catalog"
  | "hud_widget";

interface RouteRef {
  id: RouteId;
  params?: {
    moduleId?: string;
    settingsSection?: "interface" | "game";
  };
}

interface NavigationState {
  revision: number;
  current: RouteRef;
  entryPoint: EntryPoint;
  returnTo: RouteRef | null;
  worldContext: "none" | "singleplayer" | "multiplayer";
  presentation: "opaque" | "workspace" | "quick" | "hud_editor";
  pausePolicy: "not_applicable" | "paused" | "live";
  canGoBack: boolean;
  canCloseToGame: boolean;
}
```

Java owns `revision`, `returnTo`, pause policy, and the route stack. The SPA may
request `navigate`, `back`, or `close`; it does not directly replace the
authoritative route.

Hash navigation remains available only through the standalone preview host,
which implements the same interface locally.

### 7.2 Required transitions

| Starting state | Action | Destination |
| --- | --- | --- |
| Gameplay | Right Shift | `quick_hub` |
| Quick Hub | Right Shift or ESC | Gameplay |
| Quick Hub | Mods | `mods_catalog`, return to Quick Hub |
| Quick Hub | HUD Edit | `hud_editor`, return to Quick Hub |
| Pause Menu | Client | `mods_catalog`, return to Pause Menu |
| Title | Client | `mods_catalog`, return to Title |
| Mods Catalog | Module options | `module_detail(moduleId)` |
| Mods Catalog | Edit HUD Layout | `hud_editor`, return to Mods Catalog |
| HUD Editor | Widget settings | `module_detail(moduleId)`, return to HUD Editor |
| Module Detail | Back/ESC | Its recorded origin |
| Any in-world client root | Close command | Gameplay |

Opening the same root hotkey while another hotkey-owned client route is open
closes the full hotkey flow. It does not push a duplicate route.

### 7.3 Transport acknowledgement

Virtual-screen acknowledgement remains a transport health mechanism. It must
acknowledge a navigation revision, not act as product navigation itself.

```text
Core commits NavigationState revision N
  -> WebSocket uiNavigationChanged(N, state)
  -> SPA renders N
  -> SPA acknowledges N
  -> timeout reloads only if N is still current and unacknowledged
```

## 8. Composition and coordinate model

### 8.1 Composition

- Title and no-world list screens are opaque.
- Pause Menu uses a recognisable live-world background with restrained
  dim/blur.
- Quick Hub is compact and leaves the world and enabled HUD visible.
- Mods Catalog and Module Detail use one translucent workspace shell in-world.
- HUD Editor has no fake canvas. It overlays minimal controls on the live world
  and native HUD.
- There are no native fallback product screens. Native Java may render only the
  live HUD, editor hit targets, and a minimal loading/error/retry shell while
  CEF is unavailable. It must never render a second title, pause, catalog,
  settings, or terminal surface.

### 8.2 Canonical compositor and ownership

For every product route, the compositor has one authoritative branch:

```text
Java/Core route state
        |
        +--> CEF OSR product surface --> Minecraft texture composition
        |
        +--> native HUD/editor layer (only for live HUD responsibilities)
        |
        `--> minimal loading/error/retry shell (only before CEF is ready)
```

The retired T-UI path is not part of this graph. In particular, production
code must not call `UiRuntime.render(...)` from `OpusClientScreen`, must not
construct `OpusUiPageFactory` for an integrated product screen, and must not
register `OpusVanillaTerminalOverlay` as a compatibility compositor.

CEF readiness is an explicit lifecycle state (`starting`, `ready`, `failed`,
`closed`). A failed or delayed helper cannot reveal stale native product pages.
The error shell may expose only retry, close, and a diagnostic status; it is not
allowed to grow into a second UI framework.

### 8.3 Coordinate spaces

Only three coordinate spaces are allowed:

1. framebuffer pixels;
2. OPUS logical units, equal to CEF CSS pixels;
3. persisted HUD anchor plus logical offsets and uniform scale.

The host adapter owns framebuffer-to-logical conversion. Device scale changes
raster density only; it must not silently change layout or hit testing.

The integrated UI must not combine an implicit fixed 1440-pixel auto-fit with
an unrelated Minecraft scale. Responsive CSS handles viewport size. A user UI
scale, if retained, is one explicit value in the shared viewport state and is
tested with the same pointer transform.

Persisted HUD positions are resolution-independent:

```ts
type HudAnchor = "top_left" | "top_right" | "bottom_left" | "bottom_right";

interface HudLayout {
  anchor: HudAnchor;
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
}
```

Offsets are interpreted relative to the selected anchor. Dragging does not
silently change the anchor. Bounds are clamped to the current safe viewport.

## 9. Bridge and data contract

### 9.1 General rules

- All integrated responses are typed JSON except an intentional `204`.
- The frontend fetch helper must return `undefined` for `204` and must never
  call `response.json()` on an empty body.
- Target mutations return the authoritative updated snapshot with `200` where
  the UI needs state immediately. Existing `204` endpoints remain supported
  during migration.
- Every mutable aggregate carries a monotonic `revision`.
- Non-2xx responses use a stable error shape.
- The UI displays loading, empty, pending, retry, and error states. It does not
  silently fall back to mock data in the integrated host.

```ts
interface BridgeError {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
}
```

### 9.2 Navigation API

```text
GET  /api/v1/client/ui-state
POST /api/v1/client/ui-actions
WS   uiNavigationChanged
```

Actions:

```json
{ "action": "navigate", "route": { "id": "mods_catalog" } }
{ "action": "navigate", "route": { "id": "module_detail", "params": { "moduleId": "fps" } } }
{ "action": "back" }
{ "action": "close" }
```

The response is the committed `NavigationState`.

### 9.3 Module contract

```ts
type ModuleCategory = "hud" | "visual" | "mechanic" | "server";

interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  hasHudWidget: boolean;
  settings: ModuleSettingDefinition[];
}

interface ModuleSnapshot {
  revision: number;
  definition: ModuleDefinition;
  enabled: boolean;
  values: Record<string, boolean | number | string>;
}
```

Required operations:

```text
GET   /api/v1/client/modules
GET   /api/v1/client/modules/{moduleId}
PATCH /api/v1/client/modules/{moduleId}
PATCH /api/v1/client/modules/{moduleId}/settings/{key}
WS    moduleChanged
```

Catalog cards and detail controls consume this contract. Module Detail is one
generic schema-driven page, not a separate hard-coded page per module.

### 9.4 Shared HUD model

```ts
interface HudWidgetSnapshot {
  revision: number;
  id: string;
  moduleId: string;
  enabled: boolean;
  layout: HudLayout;
  measuredBounds: { x: number; y: number; width: number; height: number };
  minScale: number;
  maxScale: number;
  resizable: boolean;
}

interface HudEditorSnapshot {
  revision: number;
  selectedWidgetId: string | null;
  widgets: HudWidgetSnapshot[];
  safeViewport: { x: number; y: number; width: number; height: number };
}
```

Required operations:

```text
GET   /api/v1/client/hud/editor
PATCH /api/v1/client/hud/widgets/{widgetId}/layout
POST  /api/v1/client/hud/widgets/{widgetId}/select
POST  /api/v1/client/hud/widgets/{widgetId}/hide
WS    hudChanged
```

High-frequency body dragging and resizing are handled by the native HUD editor
input layer. The bridge broadcasts authoritative snapshots for panels and
external state changes; it is not used as a 60 Hz pointer transport.

### 9.5 World contract

```ts
interface WorldSnapshot {
  id: string;
  name: string;
  folder: string;
  gameMode: "survival" | "creative" | "adventure" | "hardcore" | "unknown";
  lastPlayedEpochMs: number | null;
  sizeBytes: number | null;
}
```

Create, edit, delete, and load actions are not shown until corresponding bridge
operations exist. `Singleplayer` is a screen type, not a valid game-mode value.

### 9.6 Server contract

```ts
interface ServerSnapshot {
  id: string;
  name: string;
  address: string;
  state: "saved" | "pinging" | "online" | "offline" | "connecting" | "incompatible";
  latencyMs: number | null;
  versionName: string | null;
  playersOnline: number | null;
  playersMax: number | null;
}
```

Ping updates arrive through `serverPingUpdated`. Remove and edit must persist
to Minecraft's server list before their controls are exposed.

### 9.7 Accounts contract

The launcher owns Microsoft authentication and the launch identity. The
running game must not pretend it can hot-swap the authenticated session.

For the initial UI:

- show the current identity from a read-only client session endpoint;
- expose `Manage in Launcher` only if a real launcher capability exists;
- hide Add, Use, Remove, and Random account controls in the integrated game;
- retain richer mock accounts only in an explicitly labelled design fixture,
  never through the integrated host adapter.

## 10. HUD Editor behavior

### 10.1 Ownership

```text
Module registry and persisted state
              |
           HudManager
              |
    native widget renderer + editor hit testing
              |
  CEF toolbar/inspector and Module Detail
```

Native owns:

- real widget rendering;
- measured bounds;
- hover, selection, drag, resize, snapping, and clamping;
- editor handles and widget-local gear/remove hit targets;
- immediate in-memory layout updates.

CEF owns:

- global editor toolbar;
- selected-widget inspector, when useful;
- navigation to Mods Catalog or Module Detail;
- loading/error feedback for persisted state.

### 10.2 Interaction state

```text
idle -> hover -> selected -> dragging -> selected
                         -> resizing -> selected
selected -> settings -> module_detail(moduleId)
selected -> hide -> widget removed from editor surface
```

Requirements:

- dragging the widget body moves the real widget;
- uniform resize uses the widget's supported min/max scale;
- selection does not change layout;
- gear opens the canonical Module Detail;
- hide disables or hides according to the module's one documented semantic;
- in-memory updates are immediate, persistence occurs on pointer release;
- persistence failure is visible and retryable;
- restart and resolution changes restore the same anchor-relative placement;
- only real enabled HUD widgets appear.

## 11. UI state and mutation policy

- Reads show a stable loading skeleton or progress state without shifting the
  route shell.
- Empty state describes the domain result, not missing integration.
- A mutation control becomes pending until the core confirms the new revision.
- Optimistic updates are allowed only with rollback to the last confirmed
  snapshot. The initial implementation should prefer the fast authoritative
  loopback response.
- Errors stay near the affected control and are also logged with endpoint and
  error code.
- WebSocket reconnect triggers a full state refresh before controls are
  re-enabled.
- Integrated mode never catches a bridge error and replaces it with mock data.

## 12. Acceptance matrix

### 12.1 Product and navigation

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| IA-1 | Right Shift opens Quick Hub | Implemented in source; Minecraft pending |
| IA-2 | Pause Client opens Mods Catalog directly | Implemented in source; Minecraft pending |
| IA-3 | Catalog opens `module_detail(moduleId)` without losing ID | Static pass; CEF native pointer harness pass; Minecraft pending |
| IA-4 | Widget gear opens the same detail and state | Source and CEF native pointer harness pass; Minecraft pending |
| IA-5 | Back/ESC follows recorded origin for all entry paths | Static pass; Minecraft pending |
| IA-6 | No Modules tab masquerades as Mods Catalog | Static pass |

### 12.2 Bridge and data

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| API-1 | `204` mutations resolve successfully without JSON parse | Pass (`svelte-check` + bridge harness) |
| API-2 | Worlds expose real typed metadata and filters preserve them | Partial; real save list works, unsupported metadata filters/actions are omitted |
| API-3 | Server ping/state updates drive the list | Pending; integrated UI no longer fabricates ping, version, or offline state |
| API-4 | No integrated account mocks or local-only lifecycle controls | Pass for current-session read-only scope; account UI is hidden in-world |
| API-5 | Module/HUD mutations return or emit authoritative revisions | Partial; bridge revision events remain |
| API-6 | Loading, pending, error, retry, reconnect are exercised | Source paths present; scenario evidence pending |

### 12.3 HUD Editor

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| HUD-1 | Real native widget is visible under editor chrome | Pass in real Minecraft preview revision 197/199/200; native FPS widget is visible below the CEF editor chrome |
| HUD-2 | Body drag moves it continuously | Pass in real Minecraft preview revision 197; persisted offset changed to `87 · 52` |
| HUD-3 | Resize handle changes real uniform scale | Pass in real Minecraft preview revision 199; persisted scale changed to `150` |
| HUD-4 | Toggle/hide changes real module/widget state | Source and real catalog screenshot pass; full hide/restart evidence remains pending |
| HUD-5 | Gear and catalog share Module Detail state | Source and CEF native pointer harness pass; Minecraft pending |
| HUD-6 | Layout survives restart and viewport changes | Pass for the tested resize/restart path: revision 199 writes layout, revision 200 restores `122 · 52` and scale `150`; revision 201 confirms the compact `480x300` logical editor layout in Minecraft |

### 12.4 CEF/runtime gates

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| 0 | Game x86_64/Java 8 and helper/CEF arm64 topology is documented and starts reliably | Static pass; runtime recheck required |
| D | Raw GL plus `GlStateManager` blend, texture, active unit, viewport, color, pixel-store, matrix and enable state are restored | Static pass; runtime pixel test pending |
| A | BGRA, premultiplied alpha, orientation, resize, texture allocation and full upload are pixel-correct | Production OSR harness plus nonblank real-Minecraft captures pass; a dedicated in-game pixel oracle remains pending |
| C | Hover, click, drag, wheel, text, focus, ESC and Right Shift have one owner and no double action | Production CEF OSR harness passes native hover, keyboard, pointer ownership, catalog/detail routing, and revision-scoped HUD input; real Minecraft native HUD drag/resize pass, while the full ESC/Right Shift/wheel matrix remains pending |
| B | Windowed/fullscreen, Retina, GUI scale and user UI scale preserve layout and hit testing | Browser matrix passes; production OSR harness verifies `640x480 @ 1.0`, resize to `800x500 @ 1.25` (`1000x625` raster), and reopen at `480x320 @ 1.5`; Minecraft pending |
| F | Start, close, reopen, resize, world join/leave, helper crash and shutdown clean resources in order | Production OSR harness passes clean stop/reopen with a fresh frame and no new shm/cache leftovers; direct BYE/`OnBeforeClose` smoke also passes; Minecraft crash scenarios pending |
| E | Idle does not repaint continuously; active UI meets measured frame-time and latency budgets | Unknown |
| R | No T-UI page or terminal overlay is visible before, beneath, or after a CEF route; CEF failure shows only the minimal error shell; stale/shared Forge mods cannot reintroduce it | Source, client JAR, coremod JAR, packaged Runtime artifact, and isolated staging tests pass; Minecraft capture pending |

Static ownership, GL restoration, and artifact gates are implemented. The first
real-Minecraft HUD editor vertical slice now has evidence, but runtime release
remains blocked on the broader pixel, input, lifecycle, persistence, and
performance matrix.

### 12.6 Real-Minecraft evidence recorded

The following captures were produced by the production CEF compositor and the
native HUD editor in the installed 1.8.9 preview client; they are not browser
mock screenshots:

- `opus-hud-editor-drag-197.png`: native FPS body drag; settings persisted as
  `offset: 87 · 52`.
- `opus-hud-editor-resize-199.png`: native resize handle; settings persisted as
  `scale: 150`.
- `opus-hud-editor-restart-200.png`: a fresh client process restored the same
  layout (`offset: 122 · 52`, `scale: 150`) and reported a current HUD input
  region for the active navigation revision.
- `opus-hud-editor-responsive-201.png`: revision `201` at the same Minecraft
  logical `480 x 300` viewport after the responsive sidebar fix; the native FPS
  widget remains visible and the CEF editor exposes complete `Widget settings`
  and `Back` controls without horizontal clipping.
- `preview/opus-ui-preview.json.status.json`: revision `200`, route
  `hud_editor`, `productCompositor: cef`, surface `ready`.

These captures establish the single-owner HUD boundary and persistence slice;
they do not by themselves close the complete release matrix or prove every
route transition.

The real-game preview control protocol now uses schema version 2 with canonical
structured route IDs. It waits for a current CEF product frame before input or
capture, records compositor/surface/viewport status, and rejects `starting` or
`failed` captures. The retired native preview theme file and JVM property were
removed with `UiTheme`/`UiThemeStore`; no dead native styling path remains.

The production compositor harness uses the packaged SPA, loopback interop
server, production `OpusWebViewClient`, native CEF helper, and shared-memory
frames. Its baseline run on 2026-08-19 verified a nonblank title frame plus
navigation ACK, real keyboard and pointer activation of the Svelte
`singleplayer` command, a different Mods Catalog frame, logical resize/device
scale, clean stop/reopen, and removal of helper-owned temporary resources. The
macOS helper now maps Windows virtual keys to native macOS key codes and emits
the CEF sequence `KEYDOWN -> CHAR -> KEYUP`; no JavaScript/DOM input synthesis
fallback remains.

The extended catalog/gear pointer probe now **passes**: the harness uses a
small native CEF hit-test grid in the `640 x 480` control band and verified
that catalog Options and HUD widget gear both emit
`navigate -> module_detail -> fps`. This proves the bridge/input path in the
production helper; it does not replace the remaining in-game route evidence.

### 12.4.1 Historical artifact verification (2026-08-21)

This section records the superseded 2026-08-21 artifact snapshot. The current
working-tree bundle and launch evidence are recorded in 12.4.2.

The strict GUI-ownership correction was rebuilt and verified from source
through both installed Premium and QA bundles. `verifyClientArtifact`, Bridge
Harness, CEF WebView Harness, the packaged `securityd` Keychain gate, Runtime
artifact verification, Svelte type-check/build, and Rust workspace tests all
pass. The installed client artifact is SHA-256
`ae8a3eea4fe2840aed3dce43b589ddb9aa7b898f515206f3befdda3f950ec369` (size
`430491`), and the installed Runtime/client JARs contain none of the retired UI
classes.

The current preview status file still describes historical revision `208` and
must not be used as evidence for this artifact until a new real-Minecraft run
rewrites it. Real Minecraft acceptance remains pending for the full ESC/Right
Shift/wheel matrix, viewport/Retina scale, helper failure/reopen, lifecycle,
and no-retired-UI framebuffer captures.

Current local rerun status: the standalone Bridge and CEF WebView harnesses,
client artifact verifier, coremod verifier, Runtime artifact verifier, and
launcher engine tests (41 cases) pass. The release lock now matches the rebuilt
working-tree manifest
(`c93ef6798c1366f677736b696d7042b7cea2e096c977d6bf70fabf14be4b15e5`), the
verified Runtime JAR set is staged identically into Launcher resources, and the
Launcher Forge pin matches the current client JAR
(`8381d4b8db8160998ef3ef87728b8aabfaf01bc2`, 430491 bytes). Launcher
`check.sh` remains environment-blocked before tests because
`cargo-fmt` is not installed. These are release reproducibility checks, not
Minecraft acceptance evidence.

The active QA and offline profiles were also scrubbed of stale game-mod
artifacts without deleting them. Twelve legacy JARs (four RBW and eight old
Opus client/coremod pairs) are preserved under
`/Users/zvwgvx/.opus-launcher-quarantine/20260821-150202/`; a content scan
shows the retired `UiRuntime`, `Opus*Page`, and `ClientConfigUi` families in
those preserved bytes. No such JAR remains in an active profile; the only
managed client/coremod pair is the freshly staged artifact set above.

### 12.4.2 Launch unblock audit (2026-08-22)

The first real launch complaint was split into two independent causes rather
than treated as a CEF failure:

- The `zvwgvx` official catalog entry has no file-backed refresh token under
  `~/Library/Application Support/opus/auth`. It is therefore `ready: false` by
  contract and must reconnect in the launcher; the Launch Dock now routes an
  unready identity to Accounts instead of issuing a futile `launch_game` call.
- `/Applications/Opus Launcher.app` was stale. Its Runtime pair was the old
  `430517`/`70762` set and its macOS game stub did not contain current
  child-JVM/console-lock failure detection. The latest offline session proves
  Java and CEF reached HTTP 200 and delivered a first frame before a native
  OpenAL shutdown crash; this is launch/runtime evidence, not UI acceptance.

The rebuilt, not-yet-installed Premium bundle is internally consistent:

- client mod: SHA-1 `b2e1b261c9ab7e36e348bbe16e17e564a0c438bb`, `430897` bytes;
- coremod: SHA-1 `3c763acf240dca163feaa7d1c30e41263c84fd10`, `70630` bytes;
- Runtime manifest SHA-256:
  `f5550275192107a305f4d5a5c254bd77040a188820cb72c3aa50ecd939a2d06b`;
- launch-contract verifier, Rust workspace tests (`45` engine cases and `23`
  desktop cases), launcher TypeScript check, and C-stub syntax check pass.

The launcher source now refuses this class of stale install before spawning
Java: it validates a binary contract marker in the nested macOS game stub and
checks `IOConsoleLocked` / `CGSSessionScreenIsLocked`. The snapshot exposes the
reason as `gameLaunchStatus`, and a blocked Launch Dock opens Installation
instead of issuing a launch request. The fresh release bundle was rebuilt after
that guard; the installed app has not been replaced yet.

Current rerun evidence: the target release launcher is
`0908cb9067373125c4f55ab78cacc6f13e8fa1f8523150f76d4884dbc13ae1a9`, while the
installed launcher is the older `b3d6ca4375672cda1f04ab72e0984da238102824b1a9e47677e8cddb6e4ac03e`.
The target passes the file-only bundle gate and Runtime launch-contract verifier;
the active catalog selection is the unofficial `zvwgvx` profile. The current
file-only process audit passes for Codex/app-server and credential boundaries,
but the macOS console currently reports both lock flags as `true`, so install and
real-game smoke testing remain intentionally refused with exit `78`.

Installation and real-Minecraft smoke evidence remain pending because the
macOS console is currently locked; the installer correctly refuses to sign or
replace `/Applications/Opus Launcher.app` with exit `78` and never requests a
password. No UI completion claim is made until the fresh bundle is installed
and the official reconnect/offline launch paths are exercised in Minecraft.

### 12.5 Required test viewports

At minimum:

- approximately `998 x 623` logical units;
- `1280 x 720` logical units;
- a small resizable window, currently audited at `640 x 480`;
- fullscreen Retina with browser raster width capped as configured;
- UI scale minimum, default, and maximum if user scaling remains supported.

For each viewport verify text fit, scroll ownership, pointer alignment, no
overlap, route round trips, and HUD bounds.

Browser audit on 2026-08-20 covered all ten visible routes at `480 x 300`,
`640 x 480`, `998 x 623`, and `1280 x 720` with zoom 1. Body/app bounds stayed
within every viewport; the compact breakpoint was specifically checked for
Title, Pause, Quick Hub, Catalog, Module Detail, and HUD Editor. List scrolling
remains owned by the list viewport. This is responsive-layout evidence only; it
does not replace the required in-game input and pixel tests.

## 13. Execution plan

### Phase 0 - Contract approval (complete)

Deliverables:

- this canonical plan;
- reviewed route IDs and transition table;
- reviewed bridge and shared HUD schemas;
- accepted gate matrix.

Exit gate: route, ownership, and Back/ESC contracts are recorded in this plan.

### Phase 0.1 - Credential and test boundary (complete; permanent precondition)

- Codex and MCP credentials remain in `~/.codex/auth.json` (`0600`) with
  `auth storage mode = File`; the macOS Keychain is never a test dependency.
- Codex background analytics is disabled in `~/.codex/config.toml` so the
  file-only runtime does not create unrelated background security/network work
  while the console is locked.
- `~/.codex/config.toml` also pins
  `model_catalog_json = "/Users/zvwgvx/.codex/models-polydevs.json"`.
  The custom provider can stream `/responses` while its `/models` endpoint
  stalls over HTTP/2; local discovery keeps app-server `model/list` and turn
  startup independent of that endpoint. The catalog is required to be a
  non-empty JSON model list and is checked by the same pre-test gate.
- The same config's `[shell_environment_policy]` injects the file-only
  subprocess boundary (`OPUS_FILE_ONLY_CREDENTIALS=1`, `SSH_AUTH_SOCK=/dev/null`,
  non-interactive Git/SSH, and a refusal stub first in `PATH`) so a spawned
  command cannot silently rediscover the macOS Keychain. An unsafe existing
  app-server still requires a normal restart.
- Repository commands run through `tools/no-keychain/run-file-only.sh`, which
  refuses the `security` CLI and disables interactive Git/SSH/GitHub CLI
  credential fallback; Git is forced to the file-backed helper and SSH uses
  `BatchMode`/`IdentitiesOnly` with no Keychain or ambient agent.
  `/Users/zvwgvx/.ssh/config`
  carries the same fail-closed policy for commands launched outside the
  wrapper.
- The user's `~/.zshenv` also sources
  `tools/no-keychain/zshenv-file-only.zsh`, so direct zsh commands inherit the
  same file-only boundary even when the repository wrapper is omitted.
- Because macOS login startup may rewrite `PATH` after `.zshenv`, the same
  boundary is re-applied at the end of `~/.zprofile` and `~/.zshrc`. The gate
  checks effective `command -v security` resolution in both login and
  interactive zsh; a source-line-only check is insufficient.
- `tools/no-keychain/install-file-only-environment.sh` is loaded by
  `~/Library/LaunchAgents/com.opus.file-only-environment.plist`, so GUI apps
  opened after login inherit the same non-interactive, file-only boundary;
  launchd also puts the refusing `security` stub first in `PATH`.
- Direct Opus installers and the CEF helper build fail closed with exit `78`
  while the console is locked, before invoking ad-hoc `codesign`.
- Every test entry point checks the macOS console lock state and fails closed
  while the screen is locked, so a test never turns a locked session into a
  login or Keychain password prompt.
- The preflight must not invoke `codex doctor` or another network diagnostic:
  even with file-backed auth, that binary can enter macOS
  `Security.framework` for TLS and wake a Keychain prompt. The preflight reads
  `config.toml` and the mode-`0600` `auth.json` directly instead.
- ChatGPT and Cursor must match the file-only launcher contract. A process
  started before those switches is a blocking stale-process condition and is
  never reported as accepted. A currently running process that already has the
  exact switches and environment can be attested in place; this does not
  retrofit an unsafe process and does not require another restart. If only the
  non-secret attestation file is missing, the preflight recreates it after
  rechecking the live process contract.
  Nested code-mode children under an attested GUI parent are checked by their
  live refusal-stub PATH and SSH boundary, not by unrelated config-file mtime
  changes; direct unknown app-servers retain the mtime fallback.
- Cursor's persistent `argv.json` must also contain
  `use-mock-keychain = true`, `password-store = "basic"`,
  `use-inmemory-secretstorage = true`, and the disabled
  `vscode.github-authentication` extension. This covers a normal Dock launch;
  the launcher remains the explicit smoke-test entry point.

Exit gate: `tools/no-keychain/check-file-only.sh` passes without a security CLI
process and without requiring a user password. Only then may real-Minecraft
acceptance continue.

Resolved 2026-08-21: the old preflight compared GUI process start time with the
current `config.toml` inode mtime. Codex Desktop atomically rewrites that file
during startup, so a correct restart received a newer inode and was falsely
reported stale forever. The gate now uses a non-secret launch attestation,
exact GUI PID/start time, Chromium switches, and live environment; only direct
shell app-servers retain the mtime fallback. A live ChatGPT process with the
complete contract can repair missing attestation state in place, without a
restart. Nested code-mode children under that parent are checked by their live
refusal-stub PATH and SSH boundary, so unrelated config rewrites do not make
them stale. ChatGPT PID `68127` and primary app-server PID `68178` pass. The
old nested child `75446` was terminated in place after the catalog/policy
update; a fresh stdio child smoke test loads all eight local models. The gate
exits successfully without invoking Keychain, `security`, or asking for a
password; Cursor is not running and is only a warning. `ps lstart`/`date`
parsing is pinned to `LC_ALL=C` so localized macOS sessions cannot turn a valid
process start time into a false stale result.

Resolved 2026-08-21 (separate app-server health issue): `model/list` was
repeatedly timing out because the cached catalog was client `0.148.0` while the
running Codex expected `0.149.0`, forcing refreshes against the provider's
stalled HTTP/2 `/models` endpoint. The config now uses the local
`models-polydevs.json` catalog. A fresh file-only stdio app-server test returned
all eight models from `initialize` + `model/list` with no provider catalog
request; no Keychain access or password prompt was involved.

### Phase 1 - Navigation and bridge foundation (source complete; runtime pending)

- make Java route state structured and lossless;
- add Quick Hub, Mods Catalog, and Module Detail SPA routes;
- make integrated SPA navigation request core actions;
- make standalone preview use the same navigation interface;
- fix `204`, typed errors, reconnect, and authoritative mutation responses;
- remove integrated mock data fallback.

Exit gate: source and bridge harness pass; real Minecraft route evidence remains.

### Phase 2 - Remove the parallel product UI (source/artifact complete)

- remove `UiRuntime` and `OpusUiPageFactory` construction from the integrated
  `OpusClientScreen`;
- remove every `runtime.render`, native product-navigation, and duplicate native
  input call from the CEF screen;
- remove the legacy vanilla pause-menu product button; both production and
  Preview Mode enter the catalog through the canonical CEF route;
- unregister and remove `OpusVanillaTerminalOverlay` from production events;
- migrate required actions from `Opus*Page` classes to typed bridge commands,
  then remove the legacy product pages and stale artifact packaging entries;
- reject the complete retired class families (`Opus*Page`, terminal overlay,
  `UiPage`, old component/layout packages, and external browser) during client
  JAR verification, not only a small list of exact filenames;
- reject boot/loading terminal transformers and classes in the coremod and
  packaged Runtime artifacts;
- introduce explicit CEF `starting`, `ready`, `failed`, and `closed` states;
- render only a minimal loading/error/retry shell before readiness or on failure;
- preserve native Java only for live HUD rendering and editor hit testing.

Exit gate: static Gate R and rebuilt-artifact checks pass. Real Minecraft
crash/reopen evidence remains required.

### Phase 3 - Runtime correctness boundary (source/CEF harness complete; Minecraft pending)

- add explicit shared-memory frame ownership/release or a proven copy boundary;
- restore all raw GL and Minecraft cached state;
- document and test the one input owner per interaction;
- verify resize, crash, close, and reopen lifecycle;
- verify one coordinate model across Java, CEF, framebuffer, and HUD.

Exit gate: Gates 0, D, A, C, B, and F pass for the vertical slice.

### Phase 4 - Quick Hub, catalog, and detail vertical slice (source complete; runtime pending)

- implement Quick Hub over live gameplay;
- implement real-module catalog with search/filter only where data exists;
- implement one generic schema-driven Module Detail;
- use FPS and Armor Status as the first real modules;
- remove Modules from generic Settings.

Exit gate: both modules can be opened, changed, persisted, and revisited from
every approved entry path without route or state drift.

### Phase 5 - Live HUD Editor (source complete; runtime/persistence pending)

- replace the SPA fake grid and boxes;
- expose native editor snapshot and real widget bounds;
- implement select, drag, resize, snap, hide, gear, and persistence;
- keep CEF chrome transparent and minimal;
- verify restart and resolution-change behavior.

Exit gate: all HUD gates pass using native widget output, not an HTML preview.

### Phase 6 - Title, pause, and supporting workflows (in progress)

- align title and pause composition with their screen contracts;
- complete real world and server lifecycle operations;
- reduce Accounts to real running-session capability;
- persist interface preferences through core;
- add only supported secondary settings.

Current progress: integrated world create/edit/delete, server edit/remove,
fabricated server ping/state, in-world Accounts, and local-only interface
settings are omitted. Real metadata, ping, persistence, and launcher account
handoff remain.

Exit gate: no visible command is local-only, mocked, or a `console.info` stub.

### Phase 7 - Visual quality, performance, and release evidence (browser responsive pass; runtime pending)

- tune typography, density, responsive constraints, dim/blur, and motion;
- measure CEF paint, upload, draw, input latency, CPU, and memory;
- run browser screenshots plus real Minecraft captures;
- verify repeated open/close and route round trips;
- record artifact hashes only after real-game acceptance.

Exit gate: all product, data, HUD, and runtime gates pass in the installed game.

## 14. Completion definition

The UI goal is complete only when all of the following are true:

1. Target routes exist and follow the transition contract.
2. Java/Core owns navigation and every canonical domain state.
3. Quick Hub, Mods Catalog, Module Detail, and HUD Editor are distinct and
   connected surfaces.
4. HUD Editor manipulates native widgets through one shared model.
5. No integrated screen relies on mock data or local-only mutations.
6. No `UiRuntime` product page or `OpusVanillaTerminalOverlay` remains in the
   production compositor/input path.
7. CEF transport, GL state, input, scale, and lifecycle gates pass.
8. Browser checks pass and real in-game screenshots/interactions verify the
   same result.
9. Persistence is verified across a full client restart.

Until then, the goal remains active even if individual pages look complete in
the standalone browser.
