# Opus Ranked-inspired UI redesign — 2026-10-01

## Status and authority

Candidate implemented in the actual Client CEF frontend and Launcher frontend.
The owner requested rankedbw.com as the new visual direction, explicitly including
both Launcher and Client. This supersedes earlier Lunar/liquid-glass visual
candidates, not their working action, input, navigation, or runtime contracts.

This is a visual redesign of existing flows, not a renderer selection or an
architecture migration. Decision 0008 / Client + Launcher UI-first product scope
is unchanged. Historical M3/injector evidence and gate status are untouched.

**Not installed or release-packaged in this redesign pass.** Both production
frontends compile; the Client also runs through the real headless CEF integration
harness. Owner visual approval remains the next step before release packaging and
replacing the installed application. Browser fixtures are not live game/server or
account evidence.

## Visual direction

Reference inspected: https://rankedbw.com/ and its leaderboard.
Borrow composition discipline, not its branding, data, assets, or features.

- Opaque black/zinc canvas, constrained 960px operational content.
- Matte controls, 12px control / 16px panel radii, structural hairlines.
- Soft-gray primary action, quieter gray secondary controls.
- Local Inter typography, restrained headings, normal-case action labels.
- The supplied Opus logo and existing Minecraft night-sky media are retained.
- Moving media is bounded on Home, absent from ordinary data/configuration pages.
- No decorative gradients, glass layers, glow, blinking, particles, or delayed
  entrance reveals. Fast color feedback does not shift button geometry.
- Semantic status/danger colors remain accompanied by text.
- Keyboard focus stays visible; mouse clicks do not leave a keyboard-only outline.

Shared palette: canvas `#09090b`, surface `#18181b`, raised `#202023`,
hover `#27272a`, border `#2b2b2e`, text `#f4f4f5`, muted `#a1a1aa`,
subtle `#94949e`, primary `#d4d4d8` / primary text `#18181b`.

## Client implementation

Files:

- `ui-v2/src/ui/tokens.css`: coherent role-based palette and scale.
- `ui-v2/src/ui/primitives.css`: flat buttons, forms, panels, focus and states.
- `ui-v2/src/styles.css`: replacement route compositions and compact fallbacks.
- `ui-v2/src/App.tsx`: visual composition and media lifecycle.
- `ui-v2/test/visual-contract.js`: rendered-page interaction/geometry checks.
- `runtime/legacy/1.8.9/client/preview/harness/HostNavigationAckHarness.java`:
  test-only updates for intentional Home geometry/media placement changes.

Implemented surfaces:

- Home: bounded Minecraft banner, correct person/group icons, aligned two-column
  play actions; Minecraft Settings left and Client Settings right.
- Singleplayer and Multiplayer: constrained lists, selected-item details and clear
  bottom actions. Existing MOTD, address, online/player/ping telemetry is retained.
- Add/Edit/Direct server composers retain validation, cancel, and focus restoration.
- Accounts, module catalog/details, HUD editor and settings share the matte system.
- Pause: centered menu over a transparent route with a light scrim; no Home video.
  Existing native game-background/blur ownership is preserved.
- Boot, Connecting, terrain Loading, Disconnect/Kick use the same system.
  Loading does not fabricate a Cancel; native reasons are safe text.
- Home/Boot media respects application and system reduced motion, visibility, and
  explicit pause on component cleanup. UI input is not gated by video readiness.

Existing revision-based action dispatch, host-owned routes, current-frame gating,
single-flight Disconnect and Java/native recovery behavior were not replaced.
No production Java, CEF helper, launcher engine, or bridge schema was changed by
this visual redesign.

## Launcher implementation

Files:

- `launcher/desktop/src/ui/LauncherTui.tsx`
- `launcher/desktop/src/ui/liquid-glass.css` (legacy filename, now matte styling)
- `launcher/desktop/test/launcher-ranked-visual.js`

All seven existing destinations are present: Home, Install, Account, Modules,
Utilities, Settings, Logs. Existing props/callbacks, launch-readiness and developer
profile handling, account/session controls, utility preferences, memory settings,
installation progress, and error/busy messages are preserved.

Home shows bounded media beside the launch profile; operational configuration uses
the same constrained content and controls. Appearance preference IDs remain
compatible; old glass settings now affect only the Home media treatment.

Two concrete verification failures were corrected:

1. Reduced motion hid the Launcher video but still allowed decoding/playback.
   Playback now follows system reduced motion and document visibility, and pauses
   during cleanup. The redundant autoplay attribute was removed.
2. Small launch facts were only 3.67:1 contrast on their surface. Subtle text now
   uses the shared readable gray. Rendered contrast assertions pass.

A persistent focus outline after mouse clicks was also corrected while retaining
the visible keyboard Tab focus indicator.

No real Microsoft login, account removal, installation, process kill, or game
launch was triggered by the browser tests. Those operations still require a live
Tauri/application acceptance pass after packaging.

## Fresh verification

| Check | Result | Scope |
| --- | --- | --- |
| Client TypeScript check | PASS | Current frontend source |
| Client production build | PASS | CSS 40.26 kB; JS 282.90 kB, uncompressed |
| Client Node tests | PASS, 18/18 | Render revisions, connection states, session/media helpers |
| Client rendered visual contract | PASS | 1280x720, 900x600, 854x480, 427x240 |
| Launcher TypeScript / production build | PASS | CSS 23.37 kB; JS 253.45 kB, uncompressed |
| Launcher rendered visual contract | PASS, 14 checks | 1440x900 and 820x760, keyboard, reduced motion, contrast |
| Launcher page/visible-control sweep | PASS | Seven pages at 1280x800, 980x650, 820x760 |
| Native System Screens harness | PASS | Real vanilla fields/delegates and bridge recovery contracts |
| Native Bridge harness | PASS | Action/revision, accounts, worlds, servers/MOTD, modules/HUD |
| Native Host Navigation ACK harness | PASS | Actual CEF clicks, same-route commits, Cancel/Back, slow Disconnect |
| Native W7 lifecycle harness | PASS | 20 park/show cycles, 12 resize/DPR transitions, 60 rapid resize steps |
| Root, Launcher and Runtime diff whitespace checks | PASS | Existing dirty changes preserved |

Final native run: `BUILD SUCCESSFUL`, 50.123 seconds.
The helper build task was **SKIPPED** because its CEF distribution source cache was
absent; harnesses used the existing helper binary. This is not evidence of a fresh
native helper build. Legacy ForgeGradle/deprecation/Unsafe warnings remain.

W7 last-run observations (headless, not in-game FPS promises):

- Warm show: 854x480@1x median 23ms, p95 123ms.
- Warm show: 427x240@2x median 25ms, p95 81ms.
- Sixty rapid resize steps converged to the final browser layout in 69ms.
- Parked CEF: sampled CPU 0.7%; aggregate RSS 596,976 KiB sums shared pages.

Earlier harness failures were investigated, not suppressed:

- Four Home click coordinates still targeted the previous composition.
  Test coordinates were updated from the rendered compact layout; Java action
  assertions were unchanged.
- A video-state wait was attached to Settings, which intentionally has no ambient
  video after this redesign. The harness now returns to Home with a confirmed
  playing video before testing parking. Visibility/pause assertions remain.
- A browser regression assertion caught a detached Home video briefly continuing
  playback before browser cleanup; explicit component cleanup now pauses it.

The native clipboard/input harness was not rerun in this pass because it exercises
system clipboard operations. Existing input implementation was left intact.
Physical mouse and keyboard were not taken over.

## Preview and rendered artifacts

Development previews:

- Client: http://127.0.0.1:5174/#/title
- Launcher: http://127.0.0.1:1421/

Artifacts live under `output/playwright/ranked/`:

- `client-home.png`, `client-home-854.png`, `client-home-cef.png`
- `client-singleplayer.png`, `client-multiplayer.png`, `client-settings.png`
- `client-pause.png`, `client-disconnected.png`
- `launcher-home.png`, `launcher-install.png`, `launcher-account.png`
- `launcher-modules.png`, `launcher-utilities.png`, `launcher-settings.png`,
  `launcher-logs.png`
- `cef-disconnect-pending.png` and native connection captures in `cef/`

These are rendered application screenshots, not generated image mockups. Browser
fixtures use sample data; pause screenshots are not proof of a live world behind
the overlay.

## Remaining / next acceptance step

1. Owner reviews the Client and Launcher preview composition.
2. Package the approved frontend together with the current Client runtime using
   the established release scripts; verify bundled assets match the new build.
3. Only then replace/install the app and let the owner test real native windows.
4. Manually exercise early-boot fullscreen, continuous resize, native Minecraft
   Settings input, real server connection/Disconnect, and in-game Escape/blur.
   Headless harness passes do not establish these physical acceptance results.

The installed application was not replaced by this pass. No prior build, user
save, account, synced project reference, or unrelated dirty work was deleted.
No commit, merge, or push was made.

## Launcher IGN case integrity — 2026-10-01 follow-up

Owner reported `zvwgvx` appearing as `Zvwgvx` in the Launcher.
Read-only inspection found the selected real offline catalog entry already stores
`Zvwgvx`. The current frontend displays the stored username literally and the
Rust account/launch paths preserve its case. No evidence establishes which earlier
input event or build originally wrote the capitalized record. The client module
detail `text-transform: capitalize` rule is unrelated to Launcher usernames and
was not changed.

Preventive guards now live in the production Launcher frontend:

- Offline IGN input explicitly sets `autocapitalize="none"`, `autocorrect="off"`,
  `autocomplete="off"` and `spellcheck="false"`.
- Literal username elements reset `text-transform: none`: header, Home account
  fact, account summary/selector/options, saved profile rows and active sessions.
- No forced lowercase/title case, catalog rename, UUID change or account merging.

Verification:

- `launcher/desktop/test/launcher-username-contract.js`: four rendered checks
  with `zvwgvx`, `Zvwgvx`, `zVwGvX`, `ZVWGVX`, `player_01`; real App and components,
  isolated mocked native IPC. The failing-before/fixed-after checks cover missing
  writing-assistance hints and inherited title-case styles. Typed values and
  native save payloads were already case-preserving and remain so.
- Rust `accounts::tests::offline_username_case_survives_save_load_and_selection`:
  PASS using a temporary catalog; exact names, UUIDs, distinct IDs and selection
  survive real account persistence.
- Launcher type check and production frontend build: PASS.
- Existing Launcher rendered visual/interaction contract: 14 checks PASS.
- `output/playwright/ranked/launcher-username.png` shows disposable test identities,
  not newly added real accounts.

Native macOS typing/autocorrection acceptance was not physically exercised.
Input hints are not validation, and do not repair a previously saved identity.
The selected real record and installed app remain unchanged. Changing to an
offline `zvwgvx` profile requires an explicit owner choice because its player UUID
differs from `Zvwgvx`; old world/server player data is not automatically migrated.

## Client account-management follow-up — 2026-10-02

The Lunar-like Client disclosure/manager is now implemented and verified in a
local Client JAR, without changing this matte visual direction or installing over
the owner's app. See [the current account-menu handoff](OPUS_CLIENT_ACCOUNT_MENU_2026-10-02.md)
for fresh async, CEF, asset-integrity evidence and the remaining manual acceptance
boundaries. Earlier verification above remains dated evidence, not a replacement
for this follow-up's current results.

## Installed product follow-up — 2026-10-02

The owner authorized delivery into the real app. The current Launcher frontend,
Client account management and left-aligned settings content are now packaged and
installed together in `/Applications/Opus Launcher.app`, with the previous app
preserved recoverably. Earlier uninstalled status entries describe the dated
preview stage, not the current deployment.
See [the installed-app verification record](OPUS_APP_INSTALLATION_2026-10-02.md)
for exact artifact identities, backup location and physical acceptance boundaries.
