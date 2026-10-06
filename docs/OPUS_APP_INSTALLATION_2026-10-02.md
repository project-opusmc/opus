# Opus installed app — 2026-10-02

## Current installed follow-up — Oct 3

[Launcher Remove and visibly blurred shared Client wallpaper](OPUS_REMOVE_AMBIENT_DELIVERY_2026-10-03.md)
are built, signed and installed at `/Applications/Opus Launcher.app`.
Current executable SHA-256:
`615ba601e2a056740aad199b6b6c0facfaa01ccc540345daece3fc36bd2e0d6b`.
Current Client SHA-256:
`24cbcfb97c1d0465e03905002834c6cce2a082a893a81cc4179cf0ce107de272`.
Installed signatures, contracts, four JARs, two manifests and 22 UI entries
were verified. The previous app is recoverable in Trash.

Native visual acceptance remains open: the background-opened Launcher showed
a blank client area in passive captures despite WebKit completing its main
load while the window was occluded. The owner was asked to bring it forward;
no activation or physical input was performed. Launcher was no longer running
at the final process check; no cause of exit was established. The full CEF navigation suite
also has two open failed contracts, detailed in the current delivery receipt.
Do not read the historical PASS records below as current native acceptance.

## Earlier Oct 3 Client delivery — superseded identity

The preceding verified replacement used the same installed path.
Its executable SHA-256 was:
`4c916345be5d99bb3dbcf0c8fd86e0d924c11642d57e19ebc3357fdff23db470`.
Its Client SHA-256 was:
`eaa1fe66577b48fb1793bfd165a59d3a65bfd4a548434f8c89a625b056ca278b`.
See [Oct 3 scope, evidence, installed identity and remaining physical acceptance](OPUS_CLIENT_FULLSCREEN_INPUT_AMBIENT_2026-10-03.md).
All sections below retain the earlier Oct 2 delivery history.

## Oct 2 follow-up: full-window Launcher

The subsequent approved Launcher window-layout fix is installed at the same app
path. Executable SHA-256 at that delivery:
`365251824795388e9af6249d5c7c65ad9637b97fea135bd3247bc73ca90b662a`.
The Client JAR was unchanged from the identity below at that point. See
[full-window layout delivery and fresh verification](OPUS_LAUNCHER_WINDOW_LAYOUT_2026-10-02.md)
for that delivery's frontend assets, native-window observation, regression checks and
recoverable backups. The sections below retain the earlier installation record,
not the current Launcher executable identity or PID.

## Earlier delivery on this date

The owner explicitly requested the completed work inside the real application.
The approved Client and Launcher baseline was installed at
`/Applications/Opus Launcher.app`. This is not a web-preview-only delivery.
The Launcher was opened in the background with `open -gj`; its executable was
observed running from the installed path (PID 38265). This proves process startup,
not physical acceptance of every native game window.

Included frontend work:

- Current Ranked-inspired matte UI in Client and Launcher.
- Client's anchored account disclosure, account manager/settings and Launcher Add
  guide, including async recovery, literal IGN and next-launch-only selection.
- Minecraft Settings stays left and Client Settings stays right. Their icon and
  label columns now align left with the corresponding play action above without
  changing button bounds, palette or action handlers.
- Launcher IGN writing-assistance hints and literal-case display guards. No real
  account was renamed, merged or selected by this workflow; already-saved case is
  not silently repaired.

## Earlier verified build and installed identity

Source bundle:
`/Users/zvwgvx/Project/Opus/launcher/target/release/bundle/macos/Opus Launcher.app`

Installed Launcher executable SHA-256:
`6cb09d3e45c9449847384540441ae6e8d3fedb9c6c4f228cd8c30828b55989c1`

Installed Client JAR:
`/Applications/Opus Launcher.app/Contents/Resources/bootstrap/opus-native-ui-1.8.9-0.1.0.jar`

Client SHA-256:
`ccfa52b14d96234a95c37e8c85d52d4ddaee449e360b747873b3673c9ca09e7f`

Client SHA-1 / size: `adc321d5f03ddf7f5dc8c172200d0e6fd132ad90` / 10,180,742 bytes.
Launcher compile-time expectations and their regression assertions were updated
to this exact rebuilt artifact before packaging. Other pinned runtime identities
were unchanged by this installation follow-up.

Client entry assets: `index-e0UFanwr.js`, `index-ERuGiceD.css`.
Launcher production assets: `index-CAoZk9WK.js`, `index-C6mr801i.css`.

Runtime contains the existing four managed roles: bootstrap, coremod,
LWJGL macOS compatibility and CEF Client. M3/injector work was not resumed, and
retained seven-role/injector release documentation was not used to package this app.

## Fresh verification during this installation

- `runtime ./gradlew --no-daemon prepareRuntime verifyRuntimeArtifacts`: PASS,
  27s, including rebuilt/reobfuscated Client JAR and artifact integrity gates.
- `cargo test -p opus-engine -p opus-launcher --lib`: PASS, 50 engine and 25
  Launcher tests; includes real temporary-file IGN persistence and launch staging.
- Launcher TypeScript check and production build: PASS.
- Client Node contracts: PASS, 18/18.
- Client rendered visual contract: PASS at four sizes, including both settings
  icon/label alignment, hit testing, focus, Pause transparency and media lifecycle.
- Client rendered account menu, edge-state and six async regression contracts:
  PASS using isolated fixtures; no user account writes.
- Launcher rendered visual contract: PASS, 14 checks.
- Launcher IGN contract: PASS, four checks with five case-distinct names and an
  isolated native IPC fixture. Not physical macOS typing acceptance.
- Fresh `harnessWebSurfaceHostNavigation`: PASS, `HOST NAVIGATION ACK: ALL PASSED`,
  32.722s. Actual CEF clicks reached Java for Singleplayer, Multiplayer and both
  Settings actions; keyboard account selection persisted the exact next-launch ID
  through the real HTTP bridge to a disposable catalog. Twenty Home/park/Pause
  transitions and native connection/Cancel/kick return assertions also passed.
  The harness supplies a stub Minecraft provider; it is not a live game test.
- `OPUS_AUTO_INSTALL=0 scripts/build-tauri-bundle.sh`: PASS; frontend compiled,
  release executable rebuilt, complete app signed and bundle gate passed.
- Installer source/stage checks and staged signature verification: PASS. Opus
  process guard was idle before replacement, so no game process was killed.
- Post-install deep/strict code-signature, file-only/Web-Surface bundle and
  runtime-launch-contract checks: PASS.
- Installed executable equals the verified bundle executable byte-for-byte.
  All four installed runtime JARs equal the verified runtime build.
- All 22 `ui-v2/dist` files equal their installed `opusui/` JAR entries byte-for-byte;
  the Client ZIP integrity check passed.
- Previous executable backup SHA-256 equals the pre-install executable hash.

Playwright used a separate headless browser session. No physical mouse, keyboard,
system clipboard or real authentication flow was controlled.

## Recovery and scope preservation

The previous application was moved, not deleted:
`/Users/zvwgvx/.Trash/Opus Launcher backup.FIOrwK/Opus Launcher.app`.

Its Launcher executable SHA-256:
`98249ab23bc346351914731da9e1ac943111861d3c39f7f2ade3b26e242616a0`.

The installer uses a verified temporary stage and restores the previous app if
replacement fails. Existing dirty work, saved worlds, real accounts and read-only
synced project references were preserved. No commit, merge, push, blanket old-build
purge or unrelated Java process termination was performed.

## Owner-controlled acceptance

Use the installed Launcher and press Play to stage the new Client into the
selected account's managed game instance. No game launch or account selection was
automated in this installation pass.

Physical clicks/keys, early-boot fullscreen, continuous live resize, real server
connection/Disconnect and Pause over a real world still need owner testing.
The earlier intermittent first-Pause-frame issue has not been root-caused in
production native code; headless passes must not be represented as that fix.
CEF helper source distribution remains unavailable, so this package carries the
existing signed helper binary, not a freshly compiled native helper.
