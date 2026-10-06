# Client ambient, fullscreen ownership and Create World — 2026-10-03

## Superseded installation identity

The later [Launcher Remove and visible shared ambience delivery](OPUS_REMOVE_AMBIENT_DELIVERY_2026-10-03.md)
is now installed. This document retains the preceding build's evidence and
identities, not the current executable/UI payload. The later full CEF suite
did not pass, and passive observation of its background-opened Launcher was
blank; see that receipt for current limitations and owner-controlled checks.

## Approved scope and current evidence boundary

This is work on the real Opus Minecraft Client and its packaged Launcher, not
only a preview. The existing central Home geometry, current night-sky media,
Opus logo, palette and left-aligned settings controls are retained. No new
renderer, authentication model, world generator or M3/injector work is added.

This delivery's verified replacement was installed at
`/Applications/Opus Launcher.app` and was subsequently superseded as above.
Its historical delivery identity and recovery path are recorded below.
Automated checks are not physical Minecraft fullscreen or mouse acceptance.

## Implemented changes

- Home uses one video decoder. A 160x90 canvas samples that same video at most
  eight times per second for a blurred full-window surround. The existing
  poster is also blurred before playback and under reduced motion. Decorative
  layers do not intercept input. Hidden/inactive/unmounted Home stops media and
  sampling. Pause remains transparent to the actual game, with no Home media.
- Singleplayer exposes Create World even with no saved world selected. A
  revisioned, single-flight action opens Minecraft's actual `GuiCreateWorld`.
  Its fresh Opus return parent preserves Singleplayer and its Home history.
  Standalone preview explains this native boundary instead of pretending to
  create a save. Failure restores the control and provides recovery.
- Compact Home's account popover is above the footer; Manage Accounts is no
  longer covered at 427x240. Literal account names and next-launch selection
  semantics are preserved. No real accounts or worlds were modified by tests.
- Cocoa `_surfaceNeedsUpdate:`, `update` and `lockFocus` no longer mutate or
  make the game OpenGL context current on AppKit. Notifications coalesce to a
  one-shot dirty flag consumed by Minecraft's render-thread drawable update,
  including ordinary/fullscreen/backing changes outside live edge resizing.
  The existing live-resize handshake is retained, not disabled.
- Guard installation validates all required native selectors before changing
  the method table. Unsupported ABI rejection leaves the class untouched.
- Bounded left-click diagnostics record route revision, input readiness,
  mapped point, viewport, ACK, lease, visibility and texture status. They do
  not bypass frame/revision ownership or log credentials/account names.

## Root-cause evidence and limitations

The supplied crash was the Oct 2 game process 5824, archived in
`~/.opus-launcher/logs/1790922424538-5738/jvm_crash_5824.log` and the matching
macOS diagnostic report. It failed in Apple's OpenGL-over-Metal resource list
on the game render thread. These paths identify historical evidence, not a
current PID or an authorized process-termination target.

The production native hook regression failed before the ownership patch:
ordinary/fullscreen notifications outside live resizing still called the
original context updater. It passes after deferring all three selectors and
retaining NSView focus bookkeeping. A second regression failed when missing
selectors left partial resize hooks installed; it passes after preflight.
The locked native binary was inspected to confirm that it owns all three
selectors. This is a concrete wrong-thread path, not proof that every possible
game fullscreen crash has been eliminated.

The owner's physical Home-click failure has **not been reproduced or
root-caused end-to-end** in this run. The current source passes synthetic raw
LWJGL -> real `GuiScreen.handleMouseInput` -> Opus -> transport checks and the
separate real CEF/HTTP action checks. This does not prove the live AppKit mouse
queue, a game-window focus transition or continuous resize acceptance. No
speculative weakening of ACK, generation, lease or current-frame guards was
made. The new bounded diagnostics are intended to identify that remaining
boundary during the owner's next game test.

## Fresh verification

- Client TypeScript check and production build: PASS.
- Client Node contracts: 19 passed, zero failed.
- Rendered browser contracts: Home ambient, Create World, visual layout,
  account menu, account edge states and six async account scenarios passed in
  an isolated headless session. Home and Singleplayer screenshots were captured
  and inspected at wide/compact sizes.
- `harnessScreenInput`: PASS. Synthetic bottom-origin macOS events enter the
  actual vanilla screen handler and reach all five compact Home targets with
  correct Retina CSS coordinates. Stale, unconfirmed and revoked owners are
  rejected. The test uses a disposable JVM and no display/input device.
- `harnessSystemScreens` and `harnessBridge`: PASS, including the actual
  Minecraft Create World constructor/return parent and missing/stale action
  revisions. Native networking and unload lifecycles remain Minecraft-owned.
- Real CEF host navigation and W4 input harness: PASS, including Home actions,
  local account disclosure/keyboard navigation, park/Pause transitions,
  Cancel/kick return and native editing. Providers/catalogs are disposable.
  W4's Copy/Cut/Paste test **writes sample text to the system clipboard**; it
  was not rerun after that side effect was identified. No physical mouse or
  keyboard was controlled.
- Root runtime checks were freshly rerun, and the revised native compatibility
  artifact check passed. Warnings from the legacy Java/Forge and Gradle lanes
  remain visible; they were not represented as a warning-free build.
- Launcher rendered-window checks: PASS at 980x650, 1220x760, 1440x900 and
  1920x1080, with no document overflow or clipped Home/Play controls. Added
  height is used by the media rather than a fixed-height article. Title-bar
  allowance and navigation back from a long Settings page also passed.
- Launcher edge-state checks: PASS with isolated native IPC, including long
  packaged paths, locally scrolling session lists, case-distinct account
  selection, busy/notices, launch-error retry and guarded setup/unavailable
  actions. This does not start or stop real game instances.

Screenshots are under `output/playwright/ranked/`:
`opus-home-ambient-2026-10-03.png`,
`opus-home-ambient-compact-2026-10-03.png`, and
`opus-create-world-2026-10-03.png`.

## Build and installation

`runtime ./gradlew --no-daemon prepareRuntime verifyRuntimeArtifacts` passed
with a clean/reobfuscated Client build. A verification run attempted concurrently
with that clean build hit a compiler-output race; it was rerun serially and
passed. The final raw-event check also passed after the diagnostics change.

`cargo test -p opus-engine -p opus-launcher --lib` passed: 50 engine and 25
Launcher tests, including updated artifact expectations. Tauri production build,
complete app signing, file-only bundle gate and runtime launch contract passed.
Automatic installation was disabled during packaging so the verified bundle
could be checked before replacement.

Installed executable SHA-256:
`4c916345be5d99bb3dbcf0c8fd86e0d924c11642d57e19ebc3357fdff23db470`.

Installed Client JAR SHA-256:
`eaa1fe66577b48fb1793bfd165a59d3a65bfd4a548434f8c89a625b056ca278b`.
SHA-1 / size: `c097917ff1cf887aa7652aa0ce356f482eff5124` / 10,182,531 bytes.
Client entry assets: `index-Dd_DZBAE.js` and `index-Bp1cjFVA.css`.

LWJGL compatibility JAR SHA-256:
`2a5c91b98a88ff5d30bd6b6b46568a961a7d2d52804cb3e1a99bf2b0bdce8a6e`.
SHA-1 / size: `397a083e0208317aa6f598a3ece58e706d7a75f9` / 1,202,775 bytes.
Its freshly compiled V14 guard has SHA-1
`6005c797463267ed1089231d3b6fb88f3bc0b0fd`, 21,184 bytes.
All compile-time/build/bundle guard pins match these actual compiled bytes.
Bootstrap and coremod identities remain unchanged.

Installer console-unlocked guard, source/stage checks and staged signature
checks passed. Installed Opus processes were idle, so no game was killed. The
previous application was moved recoverably, not deleted:

`/Users/zvwgvx/.Trash/Opus Launcher backup.AKjKwa/Opus Launcher.app`.

Its executable SHA-256 matches the verified pre-install executable:
`365251824795388e9af6249d5c7c65ad9637b97fea135bd3247bc73ca90b662a`.

Fresh post-install deep/strict code-signature, file-only bundle and runtime
launch-contract checks passed. The installed executable equals the verified
bundle executable byte-for-byte; both manifests and all four installed JARs
equal the verified runtime build. All 22 production UI files match their
installed `opusui/` JAR entries, and Client ZIP integrity passed.

The installed Launcher was opened in the background with `open -gj`; the
process was observed at PID 74556 from the exact installed executable path.
This proves Launcher startup, not a game launch or physical Client acceptance.
No account selection or game launch was automated.

A passive screenshot of the installed native Launcher confirmed full-window
Home geometry, an unclipped Play control, Ready state, literal `zvwgvx` and
zero running instances. No focus, pointer, keyboard, window-size or fullscreen
action was taken. Native visual observation is not a native resize test.

## Owner-controlled acceptance

After launching from the installed Opus Launcher, test Home's account,
Singleplayer, Multiplayer and both Settings controls, then Create World and
Cancel/Done back to Singleplayer. Fullscreen during boot, fullscreen after Home,
and continuous resizing still need fresh owner-controlled game testing.

If a click does nothing, the new game log's `Opus input` record distinguishes
blocked readiness/ownership from a forwarded click. Do not interpret automated
CEF or synthetic event checks as physical acceptance.

Existing dirty work and synced read-only project references were preserved.
No commit, merge, push, blanket old-build purge or unrelated process termination
was performed. Packaging retains the existing signed CEF helper because its
source distribution is unavailable; only the LWJGL native guard was freshly
compiled here.
