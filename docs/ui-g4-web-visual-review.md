# Opus UI G4 — browser visual review checkpoint

Date: 2026-09-18
Execution mode: direct LocalMCP editing and live Vite browser validation.

## Status

**Structural visual review: PASS.**
**Owner visual sign-off: pending.**

The browser UI is now ready to be judged visually without entering Minecraft. G4 is not promoted to final visual acceptance until the owner reviews the live Home and route surfaces.

## What was corrected in this pass

### Removed web-dashboard repetition

The route header is now the authoritative screen title for normal product routes. Repeated card headers and explanatory paragraphs were removed from:

- Singleplayer
- Multiplayer
- Client Settings
- Modules
- Accounts
- Public Client
- Pause Menu
- HUD Editor

Module Detail retains a content header because the module name, category and description are actual module data rather than duplicated navigation chrome.

This reduces the previous website/SaaS feel and makes the client screens read more like game-client surfaces.

### Removed development language from normal product screens

Technical explanations such as host ownership and browser-fixture semantics are no longer shown as normal screen copy. They remain only inside explicit development-boundary dialogs in standalone browser mode.

### Unified interaction appearance

Shared G3 primitives now own generic:

- buttons;
- toggles;
- search/select/slider inputs;
- keybind capture;
- panels;
- action rows;
- modal;
- toast;
- scroll areas;
- tabs;
- tooltips.

Product-specific Home controls remain screen-specific by design.

### Functional presentation settings

The browser fixture now applies stored UI settings on initial load, not only after a setting is changed.

Verified root states:

- density: normal / compact;
- accent: violet / blue / mono;
- reduce motion: true / false.

Compact density changes shared control sizing and product-row spacing. Reduce motion removes non-essential transition/animation duration.

### Browser-first route review

The design lab now includes direct links to:

- Home
- Singleplayer
- Multiplayer
- Client Settings
- Accounts
- Modules
- Public Client
- Pause Menu
- HUD Editor

This makes browser review the fast canonical UI iteration loop before CEF integration.

## Visual guardrails from the 2026-09-18 structural pass

The current candidate intentionally avoids:

- neon and RGB-gamer decoration;
- purple SaaS gradients and oversized glow;
- generic dashboard statistic cards;
- marketing hero copy;
- arbitrary status metrics on Home;
- renderer/transport/debug terminology in normal product UI;
- duplicated page title + card title + explanation stacks.

The older bright/aqua material proposal below was later rejected. The current
direction, recorded in the 2026-09-23 section, uses the selected Minecraft
video with monochrome white/smoke/graphite liquid-glass surfaces and restrained
neutral borders.

## Evidence

Repeated after the G4 structural cleanup:

```
cd ui-v2
npm run check
npm run build
cd ..
git diff --check
```

All passed.

The browser fixture also verified:

- Multiplayer selection and Back;
- Client Settings -> Modules;
- shared ScrollArea route content;
- Compact density root state;
- G3 design-lab control interaction.

## Selected background asset — 2026-09-22

The owner explicitly selected `minecraft-night-sky-moewalls-com.mp4`. The real
Home and routed client surfaces now use an optimized local 1920 x 1080 H.264
30 fps copy at `ui-v2/public/media/opus-night-sky-v1.mp4`. A 1920 x 1080 poster
extracted from the same video prevents a flash to unrelated artwork while the
video starts and provides the reduced-motion fallback. The runtime serves MP4
byte ranges and the JPEG poster with explicit MIME types.

## Rejected bright visual candidate — 2026-09-22

This candidate was rejected by the owner after live visual review. It remains
documented only as provenance and is not the current product direction.

The previous near-black rectangular controls were replaced in the real web
surface, not in a detached mockup:

- Home play actions use a cold silver material with dark text;
- Client Settings uses the sole aqua gradient accent;
- Minecraft Settings uses a quieter metallic treatment;
- no blinking, particles, animated sheen or decorative button ornament was
  introduced;
- Singleplayer and Multiplayer now use a compact toolbar, bright library
  surface and focused detail/action surface;
- Multiplayer keeps live MOTD, availability, population, latency and version
  presentation as real data fields.

CEF captures were retained for Home, Singleplayer and Multiplayer at the
1280 x 720 CSS review size and DPR 2. The production Web Surface checks passed
Home/route navigation, compact 427 x 240 hit targets, 900 x 600 resize,
12 consecutive resize/DPR transitions, helper recovery, and native editing
shortcuts including Control/Command A, C, X, V, Z and Y.

The candidate is packaged and installed, but G4 remains pending owner visual
sign-off and fullscreen behavior still requires a fresh launcher-started
Minecraft acceptance run.

## Tonal web-workspace replacement — 2026-09-22

The rejected bright-card treatment was replaced from first principles in the
real React surface:

- Home uses an asymmetric launch rail instead of a centered stack of generic
  app buttons;
- the selected night-sky video remains visible and is no longer covered by
  white or silver high-contrast surfaces;
- controls use restrained navy/slate tonal separation, with one solid muted
  aqua primary action and no gradients, glow, blinking, particles or sheen;
- Singleplayer and Multiplayer use one cohesive list workspace with a
  contextual command footer instead of separate dashboard cards;
- Multiplayer presents MOTD, address, availability, population, latency and
  connection actions in the same information hierarchy;
- Direct Connect and Add Server use progressive inline composers, with a
  compact overlay treatment at the emergency 427 x 240 viewport.

Validation for the current candidate passed TypeScript/build checks, the
production CEF Home/route oracle at DPR 2, native editing shortcuts, repeated
resize/DPR transitions, helper recovery, runtime artifact integrity, launcher
tests, release bundling and post-install bundle verification. The release is
installed at `/Applications/Opus Launcher.app`. G4 remains pending owner visual
sign-off, and the automated resize checks do not replace a fresh in-game
fullscreen-during-boot acceptance run.

## Packaged client and verification record — 2026-09-23

The current React production bundle is embedded in the Forge runtime JAR and
installed in the desktop launcher. This is the current release state, not a
browser-only preview.

Runtime artifact:

- Build output: `runtime/build/runtime/artifacts/opus-native-ui-1.8.9-0.1.0.jar`
- Installed copy: `/Applications/Opus Launcher.app/Contents/Resources/bootstrap/opus-native-ui-1.8.9-0.1.0.jar`
- SHA-256 for both copies: `2fa3bc3b800c078acbeaae19414e5d02eb0cc9c5bcaed0d1246adbec644e0c36`
- Size: 9,055,197 bytes; installed JAR archive check passed.
- The app signature, file-only/Web Surface bundle check, and launcher runtime
  contract check passed. The previous app was retained at
  `/Users/zvwgvx/.Trash/Opus Launcher backup.KNYheX/Opus Launcher.app`.

Fresh CEF evidence from this pass:

- The production React bundle rendered in CEF at 1280x720 CSS / DPR 2.
- Native pointer navigation passed: Home -> Singleplayer -> Back -> Home ->
  Multiplayer.
- Multiplayer remained current after a 900x600 / DPR 2 resize. Home and the
  Singleplayer action remained usable at 427x240 / DPR 2.
- The W7 lifecycle run passed 12 consecutive size/DPR transitions, fail-closed
  behavior after forced CEF helper death, and recovery with a fresh helper.
- Captures from real CEF frames: `output/cef-mono/home.png`,
  `output/cef-mono/singleplayer.png`, and `output/cef-mono/multiplayer.png`.
- The separate W4 input harness records successful Control/Command+A, C, X,
  V, Z and Y editing shortcuts. The fresh W5 navigation run did not repeat the
  clipboard-shortcut checks.

These checks exercise the production CEF renderer and its resize/lifecycle
path. They do not constitute a Minecraft launch or a fullscreen-during-boot
acceptance run. The crash reported when enabling fullscreen during game boot
remains open until it is retested from the installed launcher in Minecraft.

## What still requires owner sign-off

Before G4 is marked fully accepted, review the live browser product for:

- overall Home composition;
- button width/height;
- typography weight and scale;
- route density;
- border contrast;
- account control;
- module-list density;
- whether the visual identity feels sufficiently Opus and sufficiently Minecraft-client-like.

The 2026-09-23 CEF captures show the installed visual candidate; owner review is
still required before G4 can be marked accepted. A browser visual adjustment
should be reviewed in the browser before producing another client build.

## Readability and account identity correction — 2026-09-18

Owner review found two blocking visual problems: the interface was physically too small to read comfortably, and the account control used an invented initial badge instead of the Minecraft account identity.

The browser baseline was corrected before any further visual work:

- Home primary actions increased from 32 px / 10 px text to 46 px / 14 px text at the normal review viewport.
- Home action width increased from 324 px to 420 px.
- Account control increased from 32 px high / 10 px name text to 44 px / 14 px.
- Footer metadata increased from 7 px to 11 px.
- Route header increased to 56 px with 16 px title text.
- Shared design-system controls now use 40 px normal control height and 13 px normal UI text.
- Normal route panels may expand to 860 px instead of the previous 700 px.
- The former 427 x 240 CSS target is now treated as an emergency compact compatibility case rather than the typography baseline.

The Home action icons were removed because the text labels already communicate Singleplayer, Multiplayer, Client Settings, Minecraft Settings and Quit. Only functional navigation affordances remain.

The account initial badge was removed. The standalone fixture now renders the real current Minecraft skin head for zvwgvx, generated from the official Mojang session/profile texture and stored as a local fixture asset. The Accounts screen uses the same avatar component. Offline/failure state uses a local Minecraft default-skin head; the web UI does not depend on a third-party avatar service.

Post-change validation:

- npm run check: PASS
- npm run build: PASS
- git diff --check: PASS
- Home avatar image: 64 x 64 loaded, pixelated rendering enabled
- Home decorative action SVG count: zero
