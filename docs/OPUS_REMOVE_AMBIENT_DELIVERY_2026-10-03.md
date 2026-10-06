# Launcher Remove and visible shared Client ambience — 2026-10-03

## Approved scope and current delivery state

The owner confirmed that Client controls now work and approved two bounded
changes: repair Launcher Remove with an in-Launcher confirmation, and make the
existing shared blurred wallpaper visible around the Client Home hero.
Central layout, logo, palette, input mapping, fullscreen/resize code and the
transparent in-game Pause route are unchanged in this follow-up.

**The replacement is built, signed and installed at
`/Applications/Opus Launcher.app`; installed-byte and package checks passed.
Native visual acceptance is still open.** Launcher was started in the
background without activation. Passive observations showed a blank client area;
WebKit logs show a completed main-frame load but an occluded window. This does
not establish whether foreground startup works. The owner was asked to bring
the window forward manually; no input or foreground activation was performed.

Earlier in this delivery the console guard returned 78 and packaging was
deferred until unlock. The guard subsequently passed, and signing/installing
completed. Lock state was not the cause of the CEF helper failure described
below. The earlier installation/recovery record is retained in
[the first Oct 3 delivery](OPUS_CLIENT_FULLSCREEN_INPUT_AMBIENT_2026-10-03.md).

## Root causes and implementation

- Remove previously called `window.confirm`. The actual locked dependency,
  wry 0.55.1, does not implement WKWebView's JavaScript confirm delegate.
  Apple's installed WKUIDelegate header documents Cancel as the default in
  this situation. The real React App was reproduced with that default: no
  visible confirmation, no native remove request, catalog unchanged.
- Remove now opens a web-layer modal with Cancel initially focused, keyboard
  containment, Escape cancellation and return focus. The literal username
  and account ID are captured when opening. An explicit confirmation invokes
  the existing native operation once. Accounts remain visible until native
  success; failure stays in the dialog with retry/cancel. After success the
  selected identity is refreshed from the native catalog. No native confirm
  delegate, renderer, authentication model or dependency was added.
  The native boolean result is checked: `false` is an unconfirmed outcome,
  not removal success. Successful removal returns keyboard focus to the next
  profile, or the explicitly focusable Account heading when the list is empty.
- Home already reused the same video, but its canvas brightness reduction
  and dark overlay made the surround nearly black. On 52 outer-margin pixels
  at 1280x720, the original composed mean RGB intensity was approximately
  17.86/255. The revised composed moving/static means were 49.93 and 50.35.
  These are screenshot intensity measurements, not WCAG luminance values.
- The same mounted hero video still feeds a bounded 160x90 canvas, sampled at
  most 8 Hz. Blur remains; the severe darkening is removed, exposure is lifted
  and the scrim reduced. No second video decoder is mounted. Reduced motion
  retains the brighter blurred poster; hidden/unmounted Home stops playback
  and pending sampling. Decorative layers remain pointer-transparent.

## Fresh checks

- Both frontends: TypeScript checks and production builds passed.
- Client Node contracts: 19 passed, zero failures.
- Eleven rendered browser contracts passed: Client ambient, visual layout,
  Create World, account disclosure, async accounts and account states;
  Launcher Remove, literal username, visual layout, window layout and states.
  Remove tests run the real App/UI with only native IPC and an isolated
  disposable catalog substituted. Cancel/Escape, single-flight pending state,
  rejection and resolved-false recovery, case-distinct IDs, and next/last
  profile return focus are covered. All five Launcher contracts were freshly
  rerun after the review corrections.
- The two new regressions failed against the old behavior before the fixes:
  missing Remove confirmation, and near-black composed wallpaper.
- Full Launcher Rust workspace tests: 95 passed; one official Mojang network
  test is intentionally ignored by the suite. No failed tests.
- Root runtime `prepareRuntime verifyRuntimeArtifacts` passed and produced
  fresh Client media assets. Root `check` passed; ordinary unit-test tasks
  were cached, while drawable-ownership verification executed. Legacy Forge,
  Java Unsafe/deprecation and Gradle warnings remain visible.
- Real CEF testing and its failed contracts are detailed below. The complete
  host-navigation suite did **not** pass in this delivery. Scoped browser
  passes must not be represented as a full CEF or physical game PASS.
- A separate read-only review caught the ignored native boolean and missing
  post-success focus. Both defects were independently observed as failing
  tests, corrected, and passed. Follow-up review found no remaining critical
  or important scoped issues; its additional non-interactive TypeScript and
  JavaScript syntax checks passed. It did not claim native acceptance.
- No real stored accounts/worlds were removed or changed. No physical input,
  clipboard editing tests, game launch, native input patch, M3/injector work,
  commit or push was performed in this follow-up.

## Real CEF investigation and remaining failures

Running the helper directly inside the nested Launcher bundle failed with
`helper did not accept a loopback connection`, including after console unlock.
An owned `about:blank` debugger probe showed a SIGTRAP during `CefInitialize`:
Chromium searched for its framework under the outer Launcher app's
`Contents/Frameworks`, not the nested helper's framework directory.

The existing production launch engine already stages the signed helper into
an independent content-addressed runtime app (`stage_macos_webview_helper`).
The test was corrected to use an independent, byte-exact, signature-verified
copy of the fresh bundle's helper. No product CEF changes were made. Temporary
startup instrumentation was removed from the harness after investigation.

With that copy, actual CEF loaded the new assets and rendered the brighter
blurred Home surround. An initial run reached Home actions, resize, initial
transparent Pause and slow Disconnect checks, but failed `pause-stress-19`:
the first committed Pause raster had opaque corners; a later transparent
raster does not make the first-frame contract pass.

A subsequent clean run failed earlier with
`CEF did not persist the selected next-launch account`. The same account
test failed against the previous installed UI using the same current Java
classes and helper. All 109 Client class entries and the complete helper
compare byte-for-byte with that baseline. This narrows the account failure
away from the two scoped changes; it does not determine whether the defect
is test timing or native keyboard behavior. The baseline run stopped before
Pause, so it does not prove that the Pause failure predates this delivery.

Logs: `output/playwright/ranked/cef-host-navigation-oct3.log` and
`output/playwright/ranked/cef-baseline-host-navigation-oct3.log`. Both end in
failure, not `HOST NAVIGATION ACK: ALL PASSED`. No clipboard-writing W4 test
was run. These tests use disposable providers/catalogs, not a live game.

## Installed artifact identity and recovery

Fresh runtime Client JAR:
`runtime/build/runtime/artifacts/opus-native-ui-1.8.9-0.1.0.jar`

- Size: `10182530` bytes.
- SHA-1: `968ed909815bef4487751e34d4f1e25114b5fae9`.
- SHA-256: `24cbcfb97c1d0465e03905002834c6cce2a082a893a81cc4179cf0ce107de272`.
- Launcher compile-time Client size/SHA-1 pins match these bytes.
- Client JS: `index-3akYlIcN.js`; CSS: `index-_ECXZZiv.css`.
- Launcher JS: `index-BQU0kJuq.js`; CSS: `index-Dnnlg-Nu.css`.
- The other three runtime JARs, LWJGL guard and signed CEF helper are unchanged.
- Runtime staging into Launcher resources and the launch-contract gate passed.
- All 22 production Client UI files compare byte-for-byte with their entries
  in the actual installed JAR.
- Installed executable SHA-256:
  `615ba601e2a056740aad199b6b6c0facfaa01ccc540345daece3fc36bd2e0d6b`.

Tauri packaging completed with automatic installation disabled and
`OPUS_RUNTIME_ARTIFACT_DIR=/Users/zvwgvx/Project/Opus/runtime/build/runtime`
(the manifest directory, not its nested `artifacts` directory). The complete
bundle was signed before source/stage gates and scoped installation.

Fresh post-install deep/strict signature verification, file-only/Web-Surface
bundle gate and runtime launch-contract gate passed. The actual installed
executable equals the signed source bundle. All four installed runtime JARs
equal both the fresh runtime artifacts and the signed source bundle; all four
ZIP integrity checks passed. Both installed manifest/checksum files match
the fresh runtime and signed bundle. The helper matches the signed bundle.

The previous app was moved recoverably, not deleted:
`/Users/zvwgvx/.Trash/Opus Launcher backup.RifyBl/Opus Launcher.app`.
Its verified executable SHA-256 is
`4c916345be5d99bb3dbcf0c8fd86e0d924c11642d57e19ebc3357fdff23db470`.
Earlier backups remain untouched. No blanket purge was performed.

Inspect the browser captures at
`output/playwright/ranked/client-visible-ambient.png` and
`output/playwright/ranked/launcher-remove-confirmation.png`.
They are real rendered browser output, not screenshots of the installed game.
`output/playwright/ranked/client-cef-ambient-oct3.png` is actual CEF output
with the fresh UI and disposable provider at compact Retina geometry, not a
launcher-launched Minecraft screenshot.

## Passive installed-Launcher observation

PID 34947 was observed running from the exact installed executable. Its main
thread sample was idle in the normal AppKit event loop, not blocked in startup.
WebKit reported `didFinishLoadForFrame` for the main frame at 13:05:51 local
time and `window visible 1, view hidden 0, window occluded 1`. Passive window
captures and accessibility state still showed only the native frame and blank
client area. These facts do not prove a frontend crash, nor a healthy foreground
UI. No speculative native startup patch or forced activation was applied.
At the final process check PID 34947 was gone and no executable was running
from the installed Launcher path. No new Launcher crash report was found.
The cause of exit was not established; it is not recorded as either a crash
or an owner close. The app was not automatically relaunched after that check.

## Remaining owner-controlled acceptance and open checks

1. Open the installed Launcher manually and confirm its foreground contents
   appear. If it remains blank, investigate that fresh foreground observation
   before treating the package as a working native UI delivery.
2. Verify that Remove opens the in-Launcher confirmation. Real profile
   deletion remains owner-controlled; test fixtures did not touch real accounts.
3. Launch from the installed Launcher to stage the fresh Client, then confirm
   the shared animated blur in the Home surround. No game was auto-started.
4. Investigate the two failed CEF contracts separately before closing them.
   Fullscreen, continuous resize and Pause over a real world remain manual
   acceptance items; this follow-up does not re-certify them.
