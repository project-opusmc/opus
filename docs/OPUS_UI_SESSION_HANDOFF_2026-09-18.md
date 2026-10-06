# Opus UI — Session Handoff

Created: 2026-09-18
Last updated: 2026-09-23
Purpose: authoritative resume point after this UI session is closed.

> **Latest installed build (2026-09-23):** The Antigravity CEF optimization
> regressed resize, route ACK, and click readiness. The corrective build is
> installed; see `OPUS_CEF_REGRESSION_RECOVERY_2026-09-23.md` for its exact
> SHA-256, tests, backup, and remaining live-game checks. Section 20 below
> records the preceding installed artifact and is historical, not current.

> Current update — 2026-09-23: the current React/Vite UI has been integrated
> into the Forge client through its existing CEF Web Surface path, bundled, and
> installed at `/Applications/Opus Launcher.app`. The visual direction is
> monochrome liquid glass (white/smoke/graphite), with the selected Minecraft
> night-sky video, meaningful one-person/group icons, and a centered pause
> overlay. The CEF route and resize harnesses pass. Owner visual sign-off and a
> launcher-started Minecraft fullscreen-during-boot run are still pending.
> Section 20 records the exact artifact and verification evidence; it
> supersedes conflicting older visual notes and resume steps below.

## 0. Read this first

The current UI is already integrated into the installed client. G4 remains open
for owner visual sign-off, and fullscreen behavior during a real Minecraft boot
still needs a launcher-started acceptance run. Read Section 20 before acting;
older visual experiments and resume steps below are historical where they
conflict with the current implementation.

## 1. Product direction

Opus is a standalone Minecraft 1.8.9 client for Ranked Bedwars. It is an AI-integrated information client acting as a third eye for the player, enriching game/server information.

Current mainline:
- standalone Opus Client;
- Forge + OptiFine 1.8.9 reference host;
- injector work frozen/secondary;
- current release UI built with React/TypeScript/Vite and hosted through the
  existing CEF Web Surface integration;
- one renderer architecture and one visual language; no Elementa/CEF/vanilla Frankenstein flow.

Decision 0008 remains the authority for product direction and renderer
decision boundaries. This handoff records the implementation currently in the
installed artifact; it does not amend that decision.

RSHIFT = public client surface. RCONTROL = Opus Intelligence surface. They must share renderer, components, input model, navigation grammar, and visual language.

## 2. Canonical UI workflow

React/TypeScript/Vite -> browser development and interaction testing -> same production build -> CEF -> Minecraft.

Normal visual and interaction work should be done in browser. Minecraft/CEF testing is for runtime integration such as input forwarding, DPI/GUI scale, framebuffer, fullscreen, texture upload, and lifecycle.

## 3. Gate state

G0 Legacy Audit: PASS.
Evidence: docs/ui-g0-audit.md and docs/ui-g0-g2-verdict.md.

G1 State/Interaction Contract: PASS.
Evidence: docs/ui-g1-interaction-contract.md.

G2 Browser Prototype: PASS, browser fixture only.
Verified flow included Home -> Multiplayer -> select server -> Back -> Client Settings -> Modules -> Module Detail -> toggle -> Back, plus Singleplayer, Accounts, Minecraft Settings/Quit boundaries, keyboard, ESC/back, scroll and selection.

G3 Shared Web Design System: PASS for browser development.
Evidence: docs/UI_G3_WEB_DESIGN_SYSTEM.md and docs/ui-g3-web-design-system-verdict.md.
Shared components live under ui-v2/src/components/ui and ui-v2/src/ui.
Design lab: http://127.0.0.1:5174/?lab=1

G4 Visual Review: OPEN / NOT ACCEPTED.

## 4. Home structure that should be preserved

The user said the current Home button/layout setup was temporarily acceptable before style work began.

Preserve this hierarchy:
1. Account/profile control.
2. Singleplayer.
3. Multiplayer.
4. Client Settings.
5. Minecraft Settings.
6. Quiet version/footer.
7. Quit.

Home must read as a Minecraft client Home, not a SaaS dashboard. No telemetry cards, marketing/news panels, renderer/debug terminology, or dead controls.

Useful size/readability baseline:
- primary Home actions about 72px high, with 14px titles and secondary copy;
- primary Home text about 14px;
- Home action width about 490px at normal desktop review;
- account about 44px high;
- account name about 14px;
- real Minecraft avatar about 32x32;
- footer about 11px;
- route header about 58px;
- route title about 16px;
- shared normal controls about 42px;
- shared normal UI text about 13px.

Do not return to the old microscopic UI.

## 5. Viewport/readability correction

The old 427x240 CSS baseline made the interface too small.

Current intent:
- normal target around 854x480 CSS and above;
- primary browser review around 1280x720;
- 427x240 is only an emergency compact compatibility case;
- Retina backing resolution must not halve intended visible scale.

See ui-v2/HOME_SPEC.md.

## 6. Account identity correction

The first-letter avatar was rejected as vibe-code/fake UI.

Accepted rule: a normal Minecraft account displays its Minecraft skin head/avatar.

Implementation:
- ui-v2/src/components/AccountAvatar.tsx
- ui-v2/public/avatars/zvwgvx.png
- ui-v2/public/avatars/default.png

The zvwgvx fixture avatar came from the official Mojang session/profile texture and is stored locally. Home and Accounts use the same avatar component.

## 7. Icon and pause-menu direction

Icons should explain the action rather than decorate it. Singleplayer uses a
single-person symbol and Multiplayer uses a group symbol. Settings and
navigation icons are retained where their meaning is clear; avoid unrelated
generic icon spam. The pause menu is centered over the game view, with the
world behind it dimmed/blurred according to the current overlay treatment.

## 8. Earlier visual exploration (historical)

### SENTIA references and desired Opus DNA

The user supplied four SENTIA-style references. Desired shared DNA:
- black/near-black void;
- large negative space;
- fine silver-white / cold-blue filament structures;
- organic information-flow forms;
- sparse luminous nodes;
- vortex/aperture/orbital geometry;
- precise, premium, research-grade and cold;
- not cyberpunk;
- not RGB gamer;
- not purple SaaS AI;
- not generic sparkle AI style.

SENTIA is research/abstract/institutional. Opus is operational/tactical/interactive. Opus should inherit material language, not copy SENTIA branding.

docs/OPUS_VISUAL_LANGUAGE_V1.md contains useful high-level principles, but its current logo implementation is not approved.

## 9. Critical visual workflow decision

The user explicitly rejected imitating rich filament artwork with simplistic SVG curves.

Correct workflow:
reference visual DNA -> create/generate real raster artwork assets -> put those assets directly into the real Home -> compose real HTML/CSS controls -> review actual running Home -> iterate -> only then propagate.

Do not generate a detached full fake UI screenshot and present it as implementation.

Do not approximate rich filament artwork with a few Bezier SVG paths.

## 10. Current button direction

Use a restrained monochrome liquid-glass palette: white/smoke/graphite surfaces,
dark text where contrast allows, and softened neutral borders. Keep button
hierarchy through value, spacing, and weight instead of unrelated accent colors.
No blinking, particles, animated sheen, or decorative button ornament.

The earlier aqua/blue special-button proposal is superseded by the later
monochrome direction. The selected Minecraft night-sky video remains the
background asset.

## 11. Failure modes from this session — do not repeat

Failure A: generating images when the user was only discussing references.
Lesson: showing style references is not automatically an image-generation request.

Failure B: generating detached concept art instead of implementing the real Home.
Lesson: if the task is UI implementation, generated assets are inputs; the deliverable is the running UI.

Failure C: SVG approximation of rich filament material.
Lesson: use proper raster artwork/assets for rich organic filament visuals.

Failure D: misunderstanding which exact generated image the user referred to.
Lesson: when the user points to a specific image, edit/use that exact image. Do not substitute a newly generated interpretation.

Failure E: overproducing before following the literal requested transformation.
Lesson: for image edits, preserve the exact target and do only the requested removal/change.

## 12. Historical image instruction — superseded

This records the image request as it stood on 2026-09-18. Later owner
instructions selected the Minecraft night-sky video and the current UI was
implemented and installed, so this is no longer the active resume task.

The user referred to the specific generated full-UI mockup image shown in this chat. That image contained a Minecraft account card in the upper-left, a cosmic filament background, a central galaxy/vortex-like O/Opus structure, OPUS text, Singleplayer/Multiplayer/Client Settings/Minecraft Settings buttons, and Quit.

The user clarified that they meant THAT EXACT IMAGE, not a newly generated substitute.

The immediate intended image task was: preserve the background from that exact image and remove the UI/text/foreground elements rather than generating a different background.

Earlier wording also mentioned keeping the galaxy/vortex-like O, but the final clarification emphasized: 'anh đang bảo ảnh này cơ mà ? Chỉ giữ lại cái ảnh background hiện tại'. The later owner-selected Minecraft night-sky video superseded this image-only task; the video is now integrated in the installed build.

## 13. Earlier rejected candidate — replaced

The rejected candidate described at the original handoff date has since been
replaced. Do not infer that any current asset is unused or safe to remove from
this historical note. The active Home references
`ui-v2/public/brand/opus-mark-user.png` and the local Minecraft night-sky video;
see Section 20 before changing either asset.

## 14. Build health at session close

Verified immediately before this handoff:
- npm run check: PASS
- npm run build: PASS
- Vite transformed 39 modules
- build succeeded.

The working tree is dirty but compiling.

## 15. Dirty-tree warning

Do not reset, checkout, restore, clean, or bulk-delete the repository. Preserve unrelated dirty work.

At session close git status included changes in launcher, runtime, ui-v2, docs, scripts, shared UI components, public assets and brand experiments.

## 16. Authority order for the next UI session

1. docs/OPUS_UI_SESSION_HANDOFF_2026-09-18.md
2. ui-v2/HOME_SPEC.md
3. docs/ui-g1-interaction-contract.md
4. docs/ui-g0-audit.md and docs/ui-g0-g2-verdict.md
5. docs/UI_G3_WEB_DESIGN_SYSTEM.md and docs/ui-g3-web-design-system-verdict.md
6. docs/ui-g4-web-visual-review.md
7. docs/OPUS_VISUAL_LANGUAGE_V1.md

Old Elementa-era UI plans are historical, not authority.

## 17. Earlier recommended resume sequence — completed/superseded

The older steps to recover artwork, implement Home, and propagate the UI have
been superseded by the installed build. Remaining work is limited to owner
visual sign-off and a fresh launcher-started in-game fullscreen acceptance run;
see Section 20.

## 18. Tooling note — historical

For this phase the user explicitly requested direct LocalMCP work because Codex quota was exhausted.

Do not assume Codex should be used. Preferred execution: ChatGPT for reasoning/design direction + LocalMCP for direct file edits/build/browser validation, unless the user explicitly re-enables Codex.

## 19. Current completion status

The web UI is implemented in the installed client and the CEF route, input,
resize, and recovery checks recorded in Section 20 have passed. G4 still needs
the owner's visual sign-off. Fullscreen during a launcher-started Minecraft
boot remains a separate, unverified runtime acceptance item.

## 20. Current implementation and verification — 2026-09-23

### Implemented and installed

- React/TypeScript/Vite production UI is embedded in the Forge client JAR and
  shipped through the current CEF Web Surface runtime path.
- Home uses the selected local Minecraft night-sky video and the current
  monochrome glass treatment. Singleplayer and Multiplayer use the person and
  group icons respectively.
- Home uses the owner-provided Opus mark at
  `ui-v2/public/brand/opus-mark-user.png`.
- Singleplayer world library and Multiplayer server library are implemented;
  the multiplayer surface presents MOTD/status/player/latency/version fields
  and connection actions. Fixture data in browser/CEF harness runs is not a
  claim of live server or world state.
- The Pause Menu route is implemented as a centered glass overlay with
  blur/dimming on its backdrop. Its compositing over a live paused Minecraft
  world still needs the launcher-started in-game acceptance run below.
- The CEF input harness has verified Control/Command+A, C, X, V, Z and Y in
  editable fields. See `runtime/legacy/1.8.9/client/preview/harness/W4InputHarness.java`.

### Verification recorded

- Production CEF React oracle: Home -> Singleplayer -> Back -> Multiplayer,
  Multiplayer resize at 900x600 @ DPR 2, then Home and a clickable compact
  427x240 @ DPR 2 viewport: PASS. CEF captures are in
  `output/cef-mono/home.png`, `singleplayer.png`, and `multiplayer.png`.
- W7 CEF lifecycle run: 12 consecutive resize/DPR transitions, fail-closed
  handling after forced helper death, and recovery with a fresh helper: PASS.
- UI TypeScript check/build, runtime build, launcher contract tests, launcher
  bundle, installed JAR integrity, app signature, and file-only/Web Surface
  bundle check: PASS.
- `cargo fmt --all -- --check` and `cargo test -p opus-engine forge --lib`
  passed; the Forge contract suite reported 4/4 tests passing.
- Built and installed runtime JARs match byte-for-byte. SHA-256:
  `2fa3bc3b800c078acbeaae19414e5d02eb0cc9c5bcaed0d1246adbec644e0c36`;
  size: `9,055,197` bytes.
- Installed client: `/Applications/Opus Launcher.app`. The prior app remains
  recoverable at `/Users/zvwgvx/.Trash/Opus Launcher backup.KNYheX/Opus Launcher.app`.

### Still pending

- The harnesses exercise the real CEF renderer and resize lifecycle, but they do
  not launch Minecraft or prove the reported fullscreen-during-boot crash is
  fixed. Run the installed client from the launcher, toggle fullscreen during
  boot, and record the game/JVM logs and resulting display state before closing
  the fullscreen acceptance item.
- Owner visual sign-off for G4 remains pending. Automated render/interaction
  passes are not visual approval.
