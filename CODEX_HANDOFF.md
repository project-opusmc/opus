# CODEX_HANDOFF.md

Recovery handoff for the Opus in-game web UI work. Reconstructed from the slim
rollout transcript (~/.codex/sessions/2026/08/15/rollout-...01a00480...slim.jsonl)
and reconciled against the current working tree, which is the source of truth.

Last updated: 2026-08-21 (canonical UI consolidation; legacy product path removed;
Codex credential and app-server health invariants recorded).

> **Current-source warning:** this handoff contains historical filenames and
> failure notes below. The canonical contract is
> [`docs/ui-game-goal-and-plan.md`](docs/ui-game-goal-and-plan.md).
> `UiRuntime`, `Opus*Page`, `OpusVanillaTerminalOverlay`, external-browser
> auto-open, and `OpusVirtualScreenManager` are retired; do not restore them
> from the historical sections of this file.

## Objective

Replace the vanilla Minecraft 1.8.9 UI of Opus Client with the Opus web UI
(Svelte SPA) rendered inside the Minecraft window as an OpenGL texture.

Hard requirements from the user (zvwgvx, communicates in Vietnamese):

- No external browser tab/window. The UI lives inside the game window.
- No vanilla Minecraft UI leaking through.
- Web/Svelte UI is hosted by the game process and drawn as a GL texture.
- The in-game terminal UI (TUI) is retired. It is not a fallback, renderer,
  input owner, or boot/loading path.
- Visual style: black/white with restrained highlights, pane/list layout,
  keyboard and mouse support.
- Active goal (verbatim): "tiếp tục làm để đảm bảo không còn lỗi tan nát main
  menu như hiện tại" -- keep working so the in-game main menu is no longer
  broken/shattered.

Explicit working-style preferences the user stated repeatedly:

- Give a concise status (where we are / what was found / what will change / how
  it will be verified) before major actions.
- When only the user can validate real in-game UI, ask them to test instead of
  claiming completion. Do not auto-launch the game.
- Project moved to /Users/zvwgvx/Project/Opus. There is no rbw-client project
  anymore; all "RBW" naming is retired in favor of Opus.

Credential-prompt invariant (Codex tooling, separate from the game launcher):

- Codex must not use the macOS Keychain for cached session credentials. The
  user-level `/Users/zvwgvx/.codex/config.toml` sets
  `cli_auth_credentials_store = "file"` and
  `mcp_oauth_credentials_store = "file"`; credentials stay in
  `/Users/zvwgvx/.codex/auth.json` with mode `0600`.
- Do not switch these settings back to `auto` or `keyring`, and do not ask the
  user to unlock the Mac Keychain for routine tests. OpenAI's Codex
  authentication documentation defines `file` as `auth.json` under
  `CODEX_HOME`; `keyring` and `auto` may use the operating-system credential
  store. If this policy changes, an unsafe live app-server must be restarted.
  Routine acceptance uses the repository's non-interactive process gate, not
  `codex doctor` or `/usr/bin/security`.
- The same config must keep `model_catalog_json =
  "/Users/zvwgvx/.codex/models-polydevs.json"`. The provider's `/models`
  endpoint can stall over HTTP/2 even while `/responses` works; local model
  discovery prevents `model/list` from blocking startup or every turn. The
  catalog is a non-secret list of eight approved model descriptors and is
  checked by `check-file-only.sh`.

Toolchain credential invariant:

- Git must not inherit the system `osxkeychain` helper. The empty helper entry
  in `/Users/zvwgvx/.gitconfig` resets that inherited value, then Git uses only
  `/Users/zvwgvx/.config/opus/git-credentials` (mode `0600`). The existing
  GitHub token was migrated from `gh`'s keyring into that file; `gh` itself now
  uses `/Users/zvwgvx/.config/gh/hosts.yml` (mode `0600`) instead of Keychain,
  with interactive prompts disabled in `/Users/zvwgvx/.config/gh/config.yml`.
  Do not add another helper or move these credentials back to Keychain.
- Cursor must not initialize native secret storage. Keep
  `/Users/zvwgvx/Library/Application Support/Cursor/argv.json` with
  `use-inmemory-secretstorage: true`, `use-mock-keychain: true`, and
  `password-store: "basic"`; a full
  Cursor restart is required after changing it. Disable
  `vscode.github-authentication` for the routine Opus profile because that
  extension directly probes the OS keychain even when the editor's general
  secret store is in-memory.
- OpenSSH is fail-closed in `/Users/zvwgvx/.ssh/config`: `UseKeychain no`,
  `AddKeysToAgent no`, `IdentityAgent none`, `IdentitiesOnly yes`, `ForwardAgent no`, and
  `BatchMode yes`. The file-only command wrapper also unsets `SSH_AUTH_SOCK`
  and passes the same options to Git's SSH transport. A missing private-key
  passphrase must fail the command, never open a macOS prompt.

Credential-prompt recovery boundary (added 2026-08-21):

- Never run `/usr/bin/security` (`find-*`, `dump-*`, or any other subcommand)
  and never ask the user to unlock the macOS Keychain for routine tests.
- If the Mac is locked, do not use that as a reason to request the login
  password or unlock action; continue with shell-only checks and defer the
  app-process acceptance check until the user next opens the session.
- An earlier shell observation reported `IOConsoleLocked=true`; all file-only
  test entry points now fail closed with exit `78` and do not open a credential
  prompt whenever the session is locked.
- A direct process audit earlier on 2026-08-21 found that ChatGPT's Codex app-server
  (`PID 7921`) was started before the file-only config was written. Its
  environment still contains an ambient `SSH_AUTH_SOCK`, and its log contains
  `codex_keyring_store` loads plus analytics events. This is the concrete
  reason that old runtime could trigger a password prompt. It was a genuine
  stale process, distinct from the later false-positive described below.
- A Cursor extension log from the same audit contains `Reading sessions from
  keychain...` from `vscode.github-authentication`. The disable entry in
  `argv.json` was written after Cursor PID 22228 and its extension hosts were
  already running, so changing the file alone could not unload that live
  extension. The preflight now compares Cursor and all descendants with
  `argv.json` and rejects any stale tree.
- The ChatGPT PID 991 and Cursor PID 22228 observed earlier on 2026-08-21 were started
  before the file-only switches and cannot be retrofitted in place. Do not kill either
  process from automation. Those historical processes were not accepted until
  each app was closed normally and restarted through
  `tools/no-keychain/launch-chatgpt-file-store.sh` or
  `tools/no-keychain/launch-cursor-file-store.sh`.
- Those launchers pass Chromium `--use-mock-keychain` and
  `--password-store=basic`; the Cursor launcher also passes
  `--use-inmemory-secretstorage` and disables
  `vscode.github-authentication`. They refuse to hand flags to an old process,
  set `SSH_AUTH_SOCK=/dev/null` for every child, and refuse to report a stale
  process or extension host as fixed. They now write a non-secret launch
  attestation before starting a new GUI process. If a live process already has
  the exact flags and environment, the launcher attests that PID in place and
  exits without forcing another restart.
- `tools/no-keychain/install-file-only-environment.sh` is installed as
  `~/Library/LaunchAgents/com.opus.file-only-environment.plist`. It keeps
  future GUI launches on `/dev/null` for `SSH_AUTH_SOCK`, disables Git/GCM/GH
  prompts, forces file-backed Git credentials, puts the refusing `security`
  stub first in `PATH`, and points TLS verification at filesystem certificate
  bundles. It stores no secret and does not affect an already-running process.
- Direct Opus installer and CEF-helper build entry points now refuse with exit
  `78` while the console is locked, before invoking `codesign`; a locked Mac
  must never be turned into a signing or credential prompt by a test command.
- The user Codex config also has a `[shell_environment_policy]` file-only
  boundary. It injects `OPUS_FILE_ONLY_CREDENTIALS=1`, `/dev/null` for
  `SSH_AUTH_SOCK`, non-interactive Git/SSH settings, and puts the repository's
  refusing `security` stub first in `PATH` for every Codex-spawned command.
  This policy cannot retrofit an unsafe process such as the historical PID
  991/7921 trees; those still require a normal restart.
- `tools/no-keychain/check-file-only.sh` is the required pre-test gate. It
  checks configuration and process launch state without printing credentials,
  without invoking the `security` CLI, and without invoking `codex doctor` (the
  latter can perform TLS/Security.framework work and wake a Keychain prompt).
  Its `bin/security` refusal stub is
  placed first in the file-only `PATH`, so an accidental Keychain CLI call
  exits without opening a prompt. GUI app-servers are matched to a launch
  attestation, exact parent PID/start time, Chromium flags, and live
  environment. The gate deliberately does not compare the GUI PID with the
  current `config.toml` inode mtime: Codex Desktop atomically replaces that file
  during startup, and the old comparison caused an endless false-stale loop.
  If a live ChatGPT process proves the complete file-only contract but its
  non-secret attestation file is missing, the gate recreates the attestation
  in place; it never asks for a restart merely to repair bookkeeping.
  Nested code-mode children under that attested GUI process are validated by
  their live refusal-stub PATH and SSH boundary rather than unrelated config
  mtime changes; direct unknown app-servers retain the mtime fallback.
- `~/.codex/config.toml` pins `analytics.enabled = false` alongside the
  file-backed auth stores and avoids background telemetry security work while
  the console is locked.
- Repository commands must be run through `tools/no-keychain/run-file-only.sh`.
  It keeps the refusal stub first in `PATH` and disables Git, GCM, SSH, and
  GitHub CLI, and terminal credential prompts; SSH uses `BatchMode` with no
  agent or Keychain; missing file credentials fail closed.
- `/Users/zvwgvx/.zshenv` also sources
  `tools/no-keychain/zshenv-file-only.zsh`, making the same file-only boundary
  the default for every zsh command instead of relying on caller discipline.
- macOS login and interactive startup can run `path_helper` or later PATH
  mutations after `.zshenv`. The boundary is therefore re-applied at the end
  of `~/.zprofile` and `~/.zshrc`, and `check-file-only.sh` verifies that both
  shell modes resolve the refusing `security` stub before `/usr/bin/security`.
- Every test entry point also checks `IOConsoleLocked` and refuses to start
  while the macOS console is locked. This prevents a locked screen from being
  mistaken for a credential-store failure and never asks for the login or
  Keychain password.
- That wrapper runs `check-file-only.sh` before ordinary commands and refuses
  to start tests while an unattested or unsafe ChatGPT/Cursor process is alive. Set
  `OPUS_SKIP_FILE_ONLY_GATE=1` only for diagnostics that cannot launch an app.
- Residual Keychain calls observed from the old ChatGPT/Cursor processes are
  third-party Electron/editor behavior, not the Opus CEF helper or the Codex
  CLI file store. Keep this distinction in every future handoff.

Latest live audit (2026-08-21): ChatGPT PID `68127` and primary Codex
app-server PID `68178` pass the file-only gate. ChatGPT has
`--use-mock-keychain` and `--password-store=basic`; the primary server has
`OPUS_FILE_ONLY_CREDENTIALS=1`, `SSH_AUTH_SOCK=/dev/null`, and the refusing
`security` stub. The previously running nested tool server `75446` was an old
child from before the catalog/policy update and was terminated in place; the
gate now passes with no live unsafe child. A fresh stdio app-server smoke test
under the same environment loads all eight local catalog models and returns
`model/list` without network or password prompts. Cursor is not running and is
therefore only a warning.

The repeated restart failure was a gate bug, not user error. Before the latest
restart, `config.toml` already existed and passed the file-only checks. During
Codex Desktop startup it was atomically replaced, giving the new inode an mtime
four seconds after the app-server start. Comparing a GUI PID to that inode
mtime therefore marked every correct restart stale forever. Launch attestation
is now the authoritative startup proof; do not restore the raw GUI
`config.toml` mtime comparison. A matching live ChatGPT process can also repair
missing attestation state without restarting. The process-time parser is forced
to the C locale, so localized macOS `ps lstart` output cannot create a second
false stale result.

The app-server timeout was a separate configuration bug, also not user error.
The current provider returned successful streaming `/responses` calls but did
not complete `/models` over HTTP/2. At the same time, `models_cache.json` was
from client `0.148.0` while the running Codex expected `0.149.0`, so every
`model/list` retried the stalled endpoint and logged `timeout waiting for child
process to exit`. Restoring the local `model_catalog_json` path removes that
network dependency; the static catalog was validated through a fresh
app-server `initialize` + `model/list` exchange.

## Architecture (chosen approach)

JCEF in-process was spiked and rejected for this Java 8 / macOS setup (see
docs/research-jcef-spike.md). The shipping design is an out-of-process CEF
helper that renders offscreen and streams frames:

    Svelte SPA (ui/)  ->  hosted by the game's loopback interop server
            v
    native CEF helper (offscreen, device-scale-aware)
            v  BGRA frames over authenticated loopback TCP (HELLO/SIZE/URL/INPUT/PING)
    Java 8 client mod (runtime/legacy/1.8.9/client)
            v  uploads frame as an OpenGL texture
    Minecraft window

Superproject pins launcher and runtime as git submodules; ui/ is the Svelte
frontend; tools/ holds a standalone copy of the helper prototype + smoke test.

## Repository layout

    /Users/zvwgvx/Project/Opus
    launcher/   submodule (Rust/Tauri desktop launcher)   branch main @ a5a2d87
    runtime/    submodule (Forge client mod + bootstrap)  branch main @ 9f9f4f6
    ui/         Svelte 5 + Vite SPA (tracked in superproject)
    tools/      opus-webview-helper prototype + protocol_smoke.py (UNTRACKED)
    docs/       architecture + research + protocol notes
    release/    opus.lock.json (pins launcher/runtime commits + runtime manifest)
    scripts/    bootstrap/check/build/package + release-lock verifier

## Key components and files

Runtime (Forge client mod) - runtime/legacy/1.8.9/client:

- native/opus-cef-helper/src/opus_main.mm - CEF OSR renderer. Loopback TCP,
  HELLO <token> auth, SIZE, URL, INPUT, PING, BYE; publishes BGRA frames into
  the shared mapping and sends only frame notifications over the control
  socket. CEF subprocess bundles are built alongside the main helper.
- src/main/java/.../client/embed/OpusWebViewClient.java - starts the CEF helper
  as a child process, connects over loopback, reads frames, forwards input and
  enters an explicit failed lifecycle state when the helper is unavailable.
- src/main/java/.../client/embed/OpusWebTextureSurface.java - BGRA->GL texture
  upload with GL state save/restore, resize/filtering, full-window draw.
- src/main/java/.../client/OpusClientScreen.java - embeds the CEF surface at the
  logical product viewport and owns only lifecycle, input dispatch, texture
  composition, and the native HUD editor boundary.
- src/main/java/.../client/ClientOverlayController.java - routing; replaces
  vanilla GuiMainMenu/GuiIngameMenu/GuiSelectWorld/GuiMultiplayer with the CEF
  product screen. There is no external-browser product path; reload
  renavigates the embedded view and never calls `/usr/bin/open`.
- src/main/java/.../client/interop/OpusInteropServer.java - loopback bridge;
  URL includes &port= -> http://127.0.0.1:<port>/?code=<token>&port=<port>#/<route>.
  Without port the SPA fell into "standalone preview" and never acked screens.
- src/main/java/.../client/interop/UiNavigationManager.java - canonical
  structured-route acknowledgement; ACK_TIMEOUT_MS = 8000.
- src/main/java/.../client/ui/render/MinecraftUiScale.java - 2 framebuffer px per
  unit viewport math.
- build.gradle - adds buildWebViewHelper (Swift swift build -c release) and
  copies the helper into assets/opusclient/bin; buildUiDist runs npm run build in
  ui/; the client jar bundles the SPA under opusui/.

UI - ui/:

- src/App.svelte - route host. IMPORTANT (fixed this session): the {#key route}
  page container previously used Svelte in:slide/out:fade transitions. In the
  offscreen helper WebView, requestAnimationFrame is throttled so transitions
  never complete; the out:fade page stayed layered over the new page as a dim
  overlay that ALSO intercepted pointer hits, so hover/click stopped working
  after the first navigation back to the title (the "tan nát" main menu). The
  transitions were removed; pages now swap instantly. This is verified by the
  smoke test's hover.follows_cursor check + a settings<->title roundtrip probe.
- src/routes/title/Title.svelte - centered brand + compact vertical menu
  (LiquidBounce-style) + fixed footer; hardcoded "standalone preview" literal
  removed; padding/gaps reduced to fit 720p.
- src/integration/embeddedInput.ts (UNTRACKED) + src/main.ts - synthetic
  mouse/wheel/keyboard events forwarded from the Java helper; drives :hover via
  a mirrored .opus-embedded-hover class since offscreen WebKit has no real cursor.

Launcher - launcher/:

- crates/engine/src/forge.rs - pins the reviewed client mod jar via
  FORGE_CLIENT_MOD_SHA1 / FORGE_CLIENT_MOD_SIZE (+ unit-test expectations).
- crates/engine/src/launch.rs - macOS legacy game launches as x86_64
  (game_arch: X86_64); Java 8 jre-legacy is Intel-only -> runs under Rosetta.

## IMPORTANT correction to an earlier hypothesis

The prior session suspected the x86_64-only helper on an arm64 M4 was the crash
cause and was about to force an arm64/universal rebuild when it was aborted.
Verified reality: the game JVM itself is x86_64 (Java 8 legacy, game_arch:
X86_64 in launch.rs), so an x86_64 helper is actually consistent and does run
(the standalone helper smoke test produces real frames). The confirmed whole-Mac
freeze fix was the orderBack change, already present in source and binary. A
universal (arm64 + x86_64) helper is still nice-to-have hardening, not the root
cause.

## Historical build state (verified 2026-08-18; superseded)

All three artifacts now match:

| Where | SHA-1 | Size | Embedded SPA |
| --- | --- | --- | --- |
| Freshly built jar (runtime/.../build/libs/opus-forge-client-0.0.1-preview.3.jar) | 84a03f16... | 660_464 | index-CPTXUfV8.js |
| Pin in forge.rs (+ unit tests) | 84a03f16... | 660_464 | (matches) |
| Staged (runtime/build/runtime + desktop resources) | 84a03f16... | 660_464 | index-CPTXUfV8.js |
| Installed app (/Applications/Opus Launcher.app) | 84a03f16... | 660_464 | index-CPTXUfV8.js |

Helper binary arch (tree + jar): x86_64 (.build/release -> x86_64-apple-macosx).
Game is x86_64 -> consistent.

## Current artifact state (verified 2026-08-21)

The installed Premium bundle and the staged Runtime artifacts now match this
release manifest. These are the only artifacts that may be used for the next
real-Minecraft acceptance run:

| Artifact | SHA-256 | Size |
| --- | --- | --- |
| installed/staged client | `ea979a0b6a65e32a9eb10c535d5bc7bcecdcb91511cf5a45e49b5aeccfc59ccb` | 402,017 |
| installed/staged Runtime coremod | `cf6d72e2c63d368cd6f445b0f2c28773a6f66c0a77d388d28d722e0085115c49` | 66,894 |
| installed/staged bootstrap | `f547ea11236a860f1face12c3eb4c39a6ee8ab643f455b3ab98d2a603c66ac49` | 18,285 |

The corresponding stale-install SHA-1 guard values are client
`74873f2c4b996f49365f9b38a4c4b2c6d9cc71a3` and Runtime/coremod
`fe6acdc7e3b120ac1747dfe4b7a45109d215bb62`. Captures and status files made
before this artifact set (including preview revisions 197-208) are historical
iteration evidence only, not release acceptance evidence.

Verification run this session (all green):

- ui: npm run check (0 errors) + npm run build.
- The old `tools/opus-webview-helper` Swift/WKWebView prototype is historical
  only. Its former DOM-synthesis hover probe is intentionally not part of the
  product path; production input is covered by the CEF `harnessWebView` task.
- runtime: ./gradlew verifyClientArtifact + verifyRuntimeArtifacts BUILD SUCCESSFUL.
- launcher: cargo test -p opus-engine forge (4 passed).
- desktop: npm run tauri:build:premium built the .app; installer replaced
  /Applications/Opus Launcher.app (previous moved to ~/.Trash).

## Failed / rejected approaches

- JCEF embedding - not viable on Java 8 / macOS arm64 (see spike doc).
- orderFrontRegardless() for the helper window - caused WindowServer contention
  and froze the whole Mac. Replaced with offscreen orderBack.
- Missing &port= in the bridge URL - SPA entered "standalone preview" and never
  acknowledged virtual screens. Fixed.
- 1.5s screen-ack timeout - too tight for WebKit boot; disruptive reload flash.
  Raised to 8s.
- External browser auto-open and its runtime implementation were removed.
- Fixed 720p design viewport - collapsed the layout to one column on small
  windows; switched to the logical product viewport.
- Svelte page transitions (in:slide/out:fade) - never complete in the throttled
  offscreen WebView; the stale out:fade page overlaid the new one and ate
  pointer events, killing hover/click after the first navigation. Removed this
  session (ui/src/App.svelte). This was the concrete cause of the "tan nát"
  main menu after navigating.

## Unresolved / open items

1. In-game visual confirmation of the current 2026-08-21 artifact is still
   pending - only the user can validate the real embedded main menu. The older
   preview captures are explicitly not evidence for this installed artifact.
2. Helper is x86_64-only; optional hardening = build universal (arm64 + x86_64).
3. Boot/loading uses only the minimal lifecycle shell; no TUI boot or loading
   transformer remains.
4. Nothing is committed yet. When the user confirms the build is good, commit:
   runtime submodule (build.gradle + client Java + native/ + embed/), launcher
   submodule (forge.rs pin), superproject (ui/ changes + tools/ + gitlink bumps +
   release/opus.lock.json). Push component repos first, then bump gitlinks/lock.

## Reproduce the build -> pin -> install cycle

Toolchain present: Node v22, npm 10, cargo 1.92, Swift 6.2 (arm64 host); the
client gradlew auto-provisions its own Gradle 2.14.1 + Temurin JDK 8 lane.

    cd /Users/zvwgvx/Project/Opus
    (cd ui && npm run check && npm run build)
    (cd runtime/legacy/1.8.9/client && ./gradlew verifyClientArtifact --console=plain)
    JAR=runtime/legacy/1.8.9/client/build/libs/opus-forge-client-0.0.1-preview.3.jar
    wc -c "$JAR"; shasum -a 1 "$JAR"
    # Update launcher/crates/engine/src/forge.rs: FORGE_CLIENT_MOD_SHA1 + _SIZE
    #   AND the two matching assert_eq! expectations in mod tests.
    (cd runtime && ./gradlew verifyRuntimeArtifacts --console=plain)
    (cd launcher && cargo test -p opus-engine forge)
    cd launcher
    OPUS_RUNTIME_ARTIFACT_DIR="/Users/zvwgvx/Project/Opus/runtime/build/runtime" \
      bash scripts/prepare-desktop-assets.sh
    cd desktop
    OPUS_RUNTIME_ARTIFACT_DIR="/Users/zvwgvx/Project/Opus/runtime/build/runtime" \
      npm run tauri:build:premium
    cd /Users/zvwgvx/Project/Opus
    bash launcher/scripts/opus-process-guard.sh stop
    bash launcher/scripts/install-opus-launcher.sh
    # Verify installed jar SHA-1/size == pin, embedded SPA + helper.

Headless UI verification without launching the game:

    (cd runtime/legacy/1.8.9/client && ./gradlew harnessWebView --console=plain)
    # The Swift/WKWebView prototype smoke is historical and skips by default.

## Hand-off / test checklist for the user (in-game main menu)

Expected after launch (only the user can confirm):

- No external browser tab/window.
- No macOS freeze/crash.
- No "standalone preview" rail/footer.
- Menu fits the window: brand + vertical menu + footer, nothing clipped/piled up.
- The web UI is drawn inside the game window (not a browser).
- Hover/click keeps working after navigating between pages and back to title
  (this was the regression fixed this session).

Do NOT auto-launch the game; open the launcher only after install and ask the
user to run it.
