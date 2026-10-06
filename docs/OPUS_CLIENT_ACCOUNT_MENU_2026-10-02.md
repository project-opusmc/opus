# Opus Client account management — 2026-10-02

## Delivered state

Implemented in the actual Client CEF frontend, built into the Forge client JAR,
and exercised through the real headless CEF helper. **Now packaged and installed
in `/Applications/Opus Launcher.app`**, including the settings alignment follow-up.
See [the installed-app record](OPUS_APP_INSTALLATION_2026-10-02.md). Earlier
local-build-only statements below describe their original verification stages;
installation does not replace physical in-game acceptance.

The owner approved a Lunar-like account disclosure and management layout. This
follow-up adopts its information hierarchy, not Lunar branding/assets or its cyan
palette. The current Ranked-inspired matte zinc/black design remains in place.
Decision 0008 / Client + Launcher UI-first scope and frozen M3 evidence are unchanged.

## Implemented behavior

- The top-left literal IGN/avatar opens an anchored account panel locally on Home.
  Opening and dismissing it do not navigate, reload the document, remount the Home
  video or request a new CEF surface generation.
- The panel has current identity, Account Settings, Other Accounts, Add, saved
  account rows and a pinned Manage Accounts footer. Compact windows scroll the
  content under that footer instead of placing controls outside the viewport.
- Escape restores focus to the trigger. Outside pointer/focus movement dismisses
  the panel. Enter, Space and ArrowDown open it; controls remain keyboard reachable.
- The manager, read-only account settings and Launcher add guide share the existing
  spacing, outline icons, literal-name typography and matte controls.
- Selecting a saved account persists its exact ID **for the next launch only**.
  Current identity comes from the host's game session, not the selected profile.
  `zvwgvx` and `Zvwgvx` remain different literal saved names.
- Add/authentication, account editing and removal remain Launcher-owned. The Client
  guide explains the existing Launcher flow and provides a real Refresh action;
  it does not pretend to open the Launcher or sign in inside Minecraft.
- Avatars use supplied safe catalog metadata when available, otherwise the bundled
  default head. The current native endpoint does not supply live skin/full-body
  metadata; live skin rendering and membership dates are not claimed or fabricated.

## Async correctness / reviewed fixes

Six regressions were first reproduced against rendered React, then fixed:

1. A POST can persist successfully but lose its response. Selection now re-reads
   the catalog before claiming a result, retaining the single-flight guard.
2. If both the write response and reconciliation read fail, the outcome is marked
   unconfirmed. Old rows remain visible without a confirmed next-launch marker;
   another selection is blocked until Refresh succeeds. The UI no longer promises
   that the previous saved choice was kept.
3. Manager row activation transfers focus before disabling the row.
4. Guide Refresh transfers focus before disabling the button, so Escape still
   returns to the account list instead of falling through to the global Back action.
5. A late Refresh response updates data without undoing a newer Add/settings view.
6. A failed initial read is unavailable data, not an empty account list or a known
   “Not selected” value. Refresh can recover to a genuinely empty catalog.

A focused independent source re-review reported no remaining important findings
in these changes. The reviewer did not rerun browser/native checks; the rendered
and packaging evidence below comes from the main agent's fresh runs.

## Source and regression tests

- `ui-v2/src/components/Accounts.tsx`: disclosure, shared rows, manager/settings/
  guide, accessibility, catalog availability and stable focus handoff.
- `ui-v2/src/components/AccountAvatar.tsx`: shared head avatar/fallback sizes.
- `ui-v2/src/components/ui/UiIcon.tsx`: shared original outline icon family.
- `ui-v2/src/App.tsx`: actual session identity, async selection/reconciliation,
  account catalog state and route wiring.
- `ui-v2/src/styles.css`: scoped panel geometry, pinned footer, compact scroll and
  literal IGN styling; no delayed entrance animation.
- `ui-v2/test/account-menu-contract.js`, `account-menu-states.js`,
  `account-menu-async.js`: real rendered interactions with isolated fixtures.
- `runtime/legacy/1.8.9/client/preview/harness/HostNavigationAckHarness.java`:
  real CEF disclosure/input/persistence coverage using a temporary catalog;
  repeated Pause first-frame checks and diagnostic-only raster capture.
- `runtime/legacy/1.8.9/client/preview/harness/WebViewHarness.java`: test-only
  pointer/hover coordinates updated to the measured current 640x480 Singleplayer
  bounds `(16,296,298,56)`, center `(165,324)`. Native Java action assertions remain.

No account/auth bridge schema, game-session setter or CEF helper implementation
was introduced by this account-management follow-up.

## Fresh verification

| Check | Result / boundary |
| --- | --- |
| Client TypeScript and production frontend build | PASS; JS 293.12 kB, CSS 46.64 kB uncompressed |
| Client Node contracts | PASS, 18/18; revisions, connections and media/session behavior |
| Rendered account menu contract | PASS; same-document/video, literal IGN, keyboard/dismissal, async selection/failure, settings/Add |
| Account geometry / hit testing | PASS at 1280x720, 900x600, 854x480, 427x240, 375x667; reachable controls at least 24px |
| Rendered edge-state contract | PASS; empty/single/9 case-distinct accounts, compact scroll, reduced motion, failed selection/Refresh, guide Escape, no uncaught page errors |
| New async regression contract | PASS, all six reproduced failures, including initial-read recovery |
| Existing Client visual contract | PASS; four sizes, forms/focus, Pause transparency, media cleanup/reduced motion |
| Full local Gradle build | PASS, 32.171s; Bridge and real CEF WebView harnesses, artifact verification |
| Host Navigation ACK harness | PASS; actual native CEF clicks/keys and exact next-launch persistence through React → HTTP → disposable JSON |
| Home/park/Pause first committed frame | PASS in final 20-cycle run; this is headless evidence, not proof of a root-cause fix or live game background |
| W7 lifecycle harness | PASS; 20 park/show cycles, 12 resize/DPR transitions, 60 rapid resize steps |
| Native System Screens harness | PASS; Minecraft delegates, connection/Disconnect and lifecycle contracts |
| Packaged frontend integrity | PASS; every `ui-v2/dist` file equals its `opusui/` JAR entry byte-for-byte; ZIP test passed |
| Whitespace and new browser-script syntax | PASS |

Final Host/W7/System batch: `BUILD SUCCESSFUL`, 47.891s. W7 observations:
854x480@1x warm-show median 28ms / p95 42ms; 427x240@2x median 26ms / p95 30ms;
60 rapid resize steps converged in 59ms. These are headless timing samples, not
in-game FPS/smoothness promises. Parked sampled CPU was 0.1%, aggregate RSS
601,344 KiB (sums shared pages).

The CEF distribution source cache was absent, so `buildWebViewHelper` was SKIPPED;
checks used the existing tested helper binary. This is not a fresh native-helper
build. Legacy ForgeGradle/deprecation/Unsafe warnings remain; deliberately stalled
Disconnect and forced-helper-death checks emit their expected diagnostic warnings.
The clipboard harness was not run: no physical mouse, keyboard or system clipboard
was taken over.

## Account-menu baseline artifact and previews

JAR: `runtime/legacy/1.8.9/client/build/libs/opus-forge-client-0.0.1-preview.3.jar`

The hash and entry names in this baseline section identify the account-menu build
before the settings alignment follow-up. The current artifact is recorded below.

SHA-256: `51b8cc9e0e185e4df77634f119d365e4e58521f8896147028cd6f7994c67e900`

Bundled current entry assets: `index-CE3UYxkj.js` / `index-7RW00kiT.css`.

Rendered browser previews under `output/playwright/ranked/`:

- `client-account-menu-2026-10-02.png`
- `client-account-menu-compact-2026-10-02.png`
- `client-accounts-2026-10-02.png`
- `client-accounts-add-2026-10-02.png`

Native raster evidence: `accounts-native-2026-10-02/connection-account-menu.png`,
its dismissed/reopened variants, and connection/Pause stress captures in that
directory. Headless Minecraft has no real player session; its “Active account”
fallback is not proof of a live player's IGN. Browser images use disposable sample
identities, not the owner's real account records.

## Remaining acceptance / safe handoff — before installation

The earlier intermittent opaque Home raster on the first reopened Pause frame has
not been root-caused or fixed in production native code. The strengthened checks
fail on that first incorrect frame rather than waiting it away; fresh runs passed,
but this remains a release acceptance risk rather than a claimed resolved bug.

Next: owner reviews this preview, then approves the installed-app replacement
workflow. After installation, owner-controlled testing must cover actual native
clicks/keys, early-boot fullscreen, continuous live resize, accounts and Pause over
a real world. The account menu's local CEF proof does not certify every older
fullscreen/resize/connection issue as fixed.

No installed application was replaced, no game process was killed, no old build
or user save was removed, and no real account was added/renamed/selected by these
tests. Existing unrelated dirty changes and read-only synced references were
preserved. No commit, merge or push was made.

## Home settings left alignment — 2026-10-02 follow-up

Owner approved left-aligning the icon and label inside Minecraft Settings and
Client Settings, preserving their left/right placement, button bounds and palette.
Only scoped settings layout rules in `ui-v2/src/styles.css` changed: shared icon/
label columns match the corresponding play action above, including the narrow and
short-height breakpoints. No action callback or native runtime code was changed.

The rendered `ui-v2/test/visual-contract.js` regression first failed on the centered
settings content, then passed with icon and label alignment checks at all four
existing sizes. A separate before/after comparison passed at 1280x720, 854x480,
900x600, 427x240 and 375x667: all Home button bounds remained unchanged, both icon
center and label-start deltas were zero, and neither settings label overflowed.
TypeScript, 18/18 Node tests, existing rendered visual/interaction checks and the
full local Gradle build passed (`BUILD SUCCESSFUL`, 40.795s).

Current JAR path is unchanged. Its new SHA-256 is
`ccfa52b14d96234a95c37e8c85d52d4ddaee449e360b747873b3673c9ca09e7f`.
Entry assets are now `index-e0UFanwr.js` / `index-ERuGiceD.css`; every bundled
frontend file matches the current production dist, and the ZIP test passed.
The CEF helper source build remains skipped; verification uses the existing helper.
Fresh Host Navigation ACK verification also passed (`BUILD SUCCESSFUL`, 35.588s),
including native CEF clicks on both settings actions reaching their Java handlers.
The native compact raster is `output/playwright/ranked/client-settings-left-cef-2026-10-02.png`.

Rest-state render previews: `output/playwright/ranked/client-settings-left-2026-10-02.png`
and `client-settings-left-compact-2026-10-02.png`. The application has not been
installed/restarted by this alignment change. Prior native/fullscreen/Pause
acceptance limitations above remain unchanged.

## Installed-app follow-up — 2026-10-02

Owner explicitly requested delivery into the real app. Runtime was rebuilt and
verified, the Launcher artifact checksum/size constants were updated to those
exact Client bytes, and the current Launcher frontend was compiled into a new
signed macOS bundle. The verified bundle replaced `/Applications/Opus Launcher.app`.
The previous app remains recoverable in
`/Users/zvwgvx/.Trash/Opus Launcher backup.FIOrwK/Opus Launcher.app`.

Post-install checks verified the app signature, four runtime artifacts, launch
contract and all 22 Client production frontend files byte-for-byte. Installed
Client SHA-256 remains `ccfa52b14d96234a95c37e8c85d52d4ddaee449e360b747873b3673c9ca09e7f`.
The installed Launcher was opened in the background without physical input.
See the installed-app record for fresh checks and the owner-controlled acceptance
steps. Account auth/Add delegation and earlier fullscreen/Pause limitations above
remain explicit; installation is not a claim that those broader issues are fixed.
