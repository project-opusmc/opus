# Opus UI G3 — web design system verdict

Date: 2026-09-18
Execution mode: direct LocalMCP edits and browser validation; Codex not used.

## Verdict

**G3: PASS for the browser development surface.**

This does not claim CEF/Minecraft runtime integration. It establishes a single web-side design system and a canonical browser development environment that the existing CEF host can later consume from the same React/Vite build.

## What changed

### Canonical token source

Added:

- `ui-v2/src/ui/tokens.css`

It owns the shared color, surface, border, typography, spacing, radius, control height, focus, motion and layer tokens. Historical aliases such as `--bg`, `--surface`, `--accent` remain mapped to the canonical tokens so the current product screens can migrate without a visual reset.

### Shared primitive layer

Added reusable React primitives under:

- `ui-v2/src/components/ui/`

Current set:

- Button
- IconButton
- Panel
- Toggle
- SearchField
- SelectField
- Slider
- Tabs
- KeybindField
- Tooltip
- Toast
- Modal
- ActionRow
- ScrollArea

Shared styling lives in:

- `ui-v2/src/ui/primitives.css`

The local one-off generic implementations for `client-button`, `setting-toggle`, `command-row` and the old boundary modal classes were removed from the product stylesheet.

### Product integration

`ui-v2/src/App.tsx` now consumes shared primitives for:

- route Back button;
- primary world/server/module actions;
- module filter;
- settings toggle;
- public/pause command rows;
- development-boundary modal;
- inline error dismiss action;
- all route panels;
- world/server/account/module scroll areas.

Home remains intentionally screen-specific because it is the Minecraft client launch surface, not a generic application panel.

### Web design lab

Added:

- `ui-v2/src/dev/DesignLab.tsx`

Standalone browser access:

`http://127.0.0.1:5174/?lab=1`

The lab exposes the shared states without Minecraft: buttons, disabled/active/danger states, icon buttons, search, select, slider, toggle, keybind capture, tabs, action rows, toast states, modal and scroll behavior.

`main.tsx` routes to the lab only when the app is standalone and `?lab=1` is present. Embedded production mode continues to render the product app.

## Validation evidence

### Compile and build

Executed from `ui-v2/`:

```
npm run check
npm run build
git diff --check
```

All exited successfully.

Latest Vite build transformed 36 modules and produced the browser bundle successfully. The existing title-background runtime URL remains unresolved at Vite build time by design; it is still a host-served asset boundary and not treated as browser-live evidence.

### Dependency boundary

```
git diff -- ui-v2/package.json ui-v2/package-lock.json
```

No dependency changes.

### Legacy primitive check

A source scan found no remaining uses of:

- `client-button`
- `setting-toggle`
- `command-row`
- `boundary-dialog`
- `boundary-layer`

Generic states are now owned by the shared primitive layer.

### Home contract preservation

All required Home action markers remain present:

- `singleplayer`
- `multiplayer`
- `client-settings`
- `minecraft-settings`
- `accounts`
- `quit`

### Browser product smoke

The live Vite browser fixture was exercised after the G3 refactor.

Verified:

- Home still exposes account, Singleplayer, Multiplayer, Client Settings, Minecraft Settings and Quit.
- Multiplayer -> Hypixel selection -> Back works.
- Home -> Client Settings -> Modules works.
- The module browser remains readable through the shared ScrollArea.
- Earlier G2 module selection/toggle flow remained functional before the final Panel/ScrollArea extraction; the final compile/build and route smoke remained clean.

### Design-lab interaction smoke

The design lab rendered all shared control categories in its accessibility tree.

Verified interaction examples:

- Tabs switch their `aria-selected` state.
- Keybind capture entered listening mode and accepted `K`, updating the displayed binding to `K`.
- Shared modal opened and closed.
- Toggle state changed through the shared Toggle primitive.
- ScrollArea exposes a keyboard-focusable scroll region.

## Scope boundary

G3 does not:

- change Java runtime code;
- change launcher code;
- change CEF/native code;
- change the bridge API;
- select a new production renderer;
- claim in-game mouse/keyboard/DPI/framebuffer behavior.

The existing dirty `ui-v2/src/bridge/bridge.ts`, `ui-v2/src/bridge/types.ts`, `launcher` and `runtime` work predates this G3 pass and was not modified as part of this implementation.

## Next gate

The web foundation is ready for **G4 — visual review and product polish** using the browser as the canonical iteration environment. Only after G4 should the work advance to standalone CEF proof/integration gates.
