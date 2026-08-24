# Opus UI

Standalone frontend for the Opus Client. Minecraft hosts this Svelte 5 web
application through the authenticated CEF OSR bridge; the same bundle can be
developed completely outside the game.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 in a browser.

For unscaled responsive QA in the Vite development server, use a route such as
`http://127.0.0.1:5173/?uiAudit=1#/title`. The dev-only flag keeps zoom at 1
while retaining standalone fixtures and hash navigation; it is not an
integrated bridge mode and is disabled in production builds.

## Layout

```text
src/
├── design/         tokens, typography, motion, global styles
├── menu/           shared product controls and layout
├── routes/         title, singleplayer, multiplayer, settings, accounts, HUD,
│                   Quick Hub, Mods Catalog, Module Detail
├── integration/    typed API contract, bridge REST/WS, standalone fixtures
└── stores/         ui router + settings
```

## Rules

- Integrated routes use the Java/Core bridge as their authority. Mock data is
  limited to standalone preview mode and is never an in-game fallback.
- The bridge binds `127.0.0.1` only and uses a per-session token.
- Svelte/CEF is the sole product compositor. Native Java is limited to live HUD
  rendering, HUD-editor hit testing, and the minimal loading/error shell.
