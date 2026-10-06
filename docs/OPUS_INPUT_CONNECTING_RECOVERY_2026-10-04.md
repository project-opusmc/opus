# Client input and Connecting recovery — 2026-10-04

## Approved scope and current delivery state

The owner approved repairing the existing Client input/Connecting flows and
building/installing the final app after the native Minecraft preset was held
by failing UI contracts. Preserve the approved UI style, title-only section
headers, macOS logical-pointer mapping and Quake Pro 110° preset. This is not
a web-only delivery, a native renderer replacement or an M3/injector change.

The repaired Runtime and Launcher were built, reviewed and installed into
`/Applications/Opus Launcher.app`. Final installed-byte/signature checks passed
as recorded below. The concurrent installation described in the native-default
receipt is historical and is not attributed to this work. No app/game was
opened after installation; physical game acceptance remains separate.

## Fresh failures reproduced and repairs

- The actual `GuiScreen.handleMouseInput` harness failed on an unowned repeated
  release. `mouseReleased` also forwarded deliberately suppressed old-route
  releases. It now balances only a button owned by this visible browser lease;
  cancellation already released the old capture. Independent held buttons,
  focus/lost-release cleanup and release-before-park remain intact.
- After that repair the same harness failed on a stale Home click: a retained
  texture was being treated as input permission. New input now requires the
  current host ACK and committed frame plus the visible lease and window focus.
  An already accepted down still receives its up even if readiness changes.
- `harnessSystemScreens` failed because Connecting → Disconnected kept the
  same revision. The complete native payload/context, not merely the route
  name, now determines a new revision. Changed states revoke old actions/ACKs.
  Identical same-revision commits are idempotent before and after confirmation.
- Two web contracts failed: an empty progress detail removed its layout row,
  and Loading fabricated a Back action from a stale `canGoBack` flag. The
  current `.conn` design reserves an empty noninteractive detail row, restores
  its actual compact selectors and omits loading actions. A rendered-browser
  test also reproduced Escape submitting `back` while loading; the shared Back
  availability now rejects that keyboard path as well.
- A rendered contract found the section header had regressed to
  `OPUS / Multiplayer`. The previously approved title-only identity is restored;
  Back and version placement are unchanged.
- Create World error recovery reproduced a hidden control at 854×480: the
  error alert and library were siblings in a horizontal flex row, squeezing
  the library and moving Create World outside the viewport. The shared route
  content now stacks vertically and keeps the alert unshrunk. The real control
  is visible and hit-testable after a rejected host action at four sizes.
- Final read-only review found stale Back/Close exceptions in the HTTP bridge
  and a native-system early return before the main-thread revision check.
  Separate RED tests reproduced both stale HTTP dispatch and a request admitted
  before a replacement native session. Both layers now reject stale non-Quit
  actions before dispatch. Current Back/Close still work; Quit retains its
  intentionally revision-independent contract. The old synthetic transition
  release also completed clicks at the pressed control; a RED actual GuiScreen
  contract caught this. Route/viewport/close cleanup now leaves and releases
  outside the viewport, balancing capture without activating the old control.

## Fresh final test layers

- Fresh actual GuiScreen contract: PASS, including 32 held-press transitions,
  Retina points, ACK loss, overlapping buttons, close/retry, inactive input,
  lost releases and stale/unconfirmed/revoked input. No hardware input device
  or game window was created by that fixture.
- Fresh native system-screen and loopback bridge contracts: PASS. The native
  Music subscriber contract also passed; other sound categories are unchanged.
  Additional review regressions now pass stale/current HTTP Back/Close, stale
  native replacement-session execution and current native action single-flight.
- Client Node contracts: 19 passed, zero failed. Client TypeScript passed.
- Rendered Connection layout/input contract: PASS at 427×240, 854×480,
  900×600 and 1280×720, including literal multiline kick text, unobstructed
  controls, stable empty-detail Cancel, visible focus and inert loading Escape.
- Rendered visual contract: PASS after restoring the approved header, including
  four sizes, server composer/focus guards, pause transparency and media lifecycle.
- Launcher Rust workspace: 104 passed, zero failed; one official-network test
  remains intentionally ignored.
- The complete native CEF host-navigation contract now passes, including the
  account keyboard-selection write to a disposable catalog, 20 transparent
  first-Pause frames and native Connecting/Loading/Kick Back at compact/wide
  sizes. Compact Cancel moved to y169..201, outside the old click at y206; the
  fixture now uses an observed interior point y185. A separate failure showed
  the fixed Tab-count running while account rows were still loading/disabled.
  The fixture now waits for the actual selectable DOM row, not a longer sleep.
  Opt-in diagnostics confirmed `ready=false selectable=0` before the catalog
  commit and `ready=true selectable=1` afterward; no profile names/IDs are logged.
- Native CEF repeated server-composer contract: six cycles passed with exact
  name/address writes to the disposable provider and Ctrl/Cmd+A selection.
  Independent rendered DOM proof found all three old click points below the
  settled current controls; the old submit point intersected the control only
  briefly during its entrance animation. The fixture centers are now observed
  interior points. No composer geometry/focus behavior was redesigned.
  The account readiness fixture also requires retained panel focus before its
  keyboard sequence; it never forces focus to hide a production failure.
- The Create World rendered contract now passes preview boundary, revisioned
  host submission, single-flight and rejected-action recovery at four sizes.
  Its earlier local-server shutdown was an infrastructure failure, not a UI PASS.

The native CEF W4 oracle passed pointer/key/editing contracts. Unlike the other
fixtures, its Copy/Cut/Paste test invokes the real focused CEF frame clipboard
commands and does not save/restore the system clipboard. It may have replaced
the clipboard with its test string; the owner was notified and no further
clipboard tests will be run in this delivery. No physical mouse/keyboard,
foreground activation, real server connection or actual world launch was used.

## Artifact and installed-byte evidence

- Final sequential `prepareRuntime verifyRuntimeArtifacts check`: PASS in 22s.
  Ordinary unit-test tasks were up-to-date; the drawable ownership check ran.
- After that build, the complete CEF host-navigation, six-cycle server composer,
  actual GuiScreen, native system-screen, loopback bridge and Music harnesses
  passed again in `/tmp/opus-release-harnesses-20261004.log` (exit 0). No W4
  clipboard test was repeated. Scoped final code review approved the stale
  action/cancellation repairs before the release gates.
- Launcher Rust workspace passed again after updating the compile-time Client
  pin: 104 passed, zero failed, one official-network test intentionally ignored
  (`/tmp/opus-launcher-release-workspace-20261004.log`). Final Client TypeScript
  and all 19 Node contracts also passed.
- Build-only Tauri release passed in 20.80s with `OPUS_AUTO_INSTALL=0`, followed
  by deep ad-hoc signature, file-only bundle and Runtime launch-contract checks.
  All 125 captured production input files remained unchanged across bundling.
- Installed Launcher executable SHA-256:
  `0c371fbd01b446a123b4629a66fb9f86219b690034b5a374adb2ac8d832201f6`.
- Installed Client JAR: 10193959 bytes, SHA-1
  `cd8b9f10b897bf8250caca584553ab0f60764205`, SHA-256
  `2caed87d8634d89dcd255ce46a66d08b462aef0bb5c462cbfddc2435c7216b5a`.
  The Launcher compile-time pin, both manifests and these bytes agree.
- All four Runtime JARs compare byte-for-byte from Runtime → signed bundle →
  installed app. ZIP integrity passed for every installed JAR. Both installed
  manifests match Runtime byte-for-byte; all 22 current Client frontend files
  match the embedded `opusui/` entries. Installed Launcher and CEF helper
  executables match the signed bundle; the helper matches the tested fixture.
- Post-install deep strict signature, file-only/Web-Surface and Runtime
  launch-contract checks passed. The process guard was idle before replacement.
  Installation log: `/tmp/opus-launcher-release-install-20261004.log`.
- The previous app is recoverable at
  `/Users/zvwgvx/.Trash/Opus Launcher backup.6fLLLR/Opus Launcher.app`.
  Only this installation was replaced. The disposable browser and owned test
  preview server were closed; no real profile/account/world was modified by
  these UI tests or the installer. Native defaults apply through the engine
  on the next selected managed-profile launch.

## Acceptance boundaries

Automated helper and browser fixtures are not physical acceptance inside a
Launcher-launched Minecraft world. Native fullscreen/live-resize stability and
real-world pause blur remain unverified here. Fast Render stays enabled as
requested; OptiFine M5 may disable the framebuffer required by actual blur, in
which case Opus retains its transparent dim overlay over the game.

See [native preset](OPUS_NATIVE_MINECRAFT_DEFAULTS_2026-10-04.md) and
[previous input receipt](OPUS_CLIENT_INPUT_LIFECYCLE_2026-10-03.md).
