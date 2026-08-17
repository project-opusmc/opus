# Opus UI

Standalone frontend for the Opus Client, following
`OPUS_UI_ARCHITECTURE.md`. Minecraft hosts the UI; the UI is a real web
application (Svelte 5 + TypeScript + SCSS + Vite) and can be developed
completely outside the game.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 in a browser.

## Layout

```text
src/
├── design/         tokens, typography, motion, global styles
├── primitives/     Button, Input, Switch, Slider, Select, Tabs, Modal, ...
├── components/     PageShell, ServerEntry, AccountEntry, ModuleCard, SettingRow
├── routes/         title, singleplayer, multiplayer, settings, accounts, hud
├── integration/    typed API contract, mock data, WS/event stubs
└── stores/         ui router + settings
```

## Rules

- Components use design tokens only; no raw hex/spacing/motion.
- Mock data first; replace `integration/api.ts` with the real REST bridge later.
- The bridge binds `127.0.0.1` only and uses a per-session token.
- The legacy Java TUI/GuiScreen surface stays as fallback/debug only.
