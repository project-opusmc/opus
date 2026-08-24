# OPUS Core-Mod-first goal and execution plan

Status: **canonical plan — 2026-08-22**

## Authority and scope

The attached `opus_ui_architecture_handoff_for_claude_code.md` is historical
review context. It records CEF/UI experiments and their failures; it is not the
current implementation authority. The project owner's direct decision
supersedes it for the production architecture.

This plan preserves the lesson, not the parallel UI runtime: there must be one
production path, one owner for GUI/input, and no stale artifact that can revive
a retired surface.

## Goal

Return the production Minecraft client to the smallest auditable path:

```text
Opus Launcher
  -> ForgeBootstrapMain (technical hand-off only; no UI)
  -> Forge 1.8.9 + OptiFine HD U M5
  -> OPUS Core Mod, loaded by Forge from mods/
  -> vanilla Minecraft title, pause/ESC, menus, options, HUD, resize, and input
```

`ForgeBootstrapMain` is a tiny launcher-to-Forge argument hand-off, not a
second client, class-loader chain, or UI runtime. Forge/LaunchWrapper remains
the Minecraft loader; OptiFine and OPUS Core Mod are the only managed Forge
mods. The Core Mod may initially be small or unfinished. That is acceptable.
The first goal is a clean, deterministic baseline from which to stabilize it —
not to add another UI system on top of it.

Here, “client” means the stock Minecraft 1.8.9 runtime that Forge launches;
there is no separate OPUS client JAR. The launcher hands off to Forge +
OptiFine, and Forge loads the one OPUS Core Mod from `mods/`.

## Hard invariants

- Production Runtime manifest has exactly `opus-bootstrap` (the technical
  Forge hand-off) and `opus-runtime-legacy-1.8.9` (the OPUS Core Mod)
  artifacts.
- Forge's managed `mods/` directory has exactly locked OptiFine and OPUS Core
  Mod. The launcher removes a known stale OPUS client JAR before Forge scans.
- No production build, bundle, staging script, JVM property, or launch command
  includes `opus-client`, CEF, a webview helper, T-UI, native replacement UI,
  a browser texture, or a parallel input/resize path.
- The Core Mod does not replace a Minecraft screen or own product UI/input. It
  is limited to its verified lifecycle, telemetry, and non-UI patch boundary.
- Vanilla Minecraft is authoritative for title, ESC/pause, menus, options,
  HUD, window resize, and ordinary input.
- Build, verification, and test routes remain file-only and non-interactive:
  no macOS Keychain access and no credential prompt.

## Explicitly out of scope

- Designing, porting, or debugging an in-game product UI.
- CEF/Svelte, webview helpers, native UI replacements, T-UI, and HUD editors.
- Treating a UI failure as evidence about Core Mod correctness.
- Destructively deleting quarantined CEF/client research source from the dirty
  worktree. It is isolated from production; archival/removal needs a separate,
  explicit cleanup decision.

## Execution plan

| Step | Deliverable | Exit evidence | Status |
| --- | --- | --- | --- |
| 1. Freeze the runtime contract | Bootstrap + Core Mod only; vanilla UI decision recorded | Manifest/resource/launcher static checks show no client JAR or CEF helper | Complete |
| 2. Stabilize Core Mod boundary | Small, testable loader/telemetry/patch chain with no UI hooks | Core Mod artifact verifier and Forge/patch tests pass | Complete for the no-UI boundary |
| 3. Rebuild production launcher | One unified bundle consumes the two-artifact contract and supports official + unofficial profiles | Bundle contains neither client JAR nor webview helper; launch contract check passes | Complete — one verified unified bundle remains |
| 4. Real-game baseline | Launch a clean isolated profile with imported OptiFine | Log registers Core Mod; managed mods are correct; vanilla menus/ESC/resize/input work | In progress — visible checks remain manual |
| 5. Work on Core Mod | Add or repair only deliberately scoped non-UI behavior | Each change has unit/bytecode/Forge evidence and a clean-game retest as appropriate | Pending the baseline confirmation |
| 6. Re-authorize UI later | Separate architecture decision and clean scope | Only after Core Mod baseline is stable and the owner explicitly requests UI work | Explicitly deferred |

## Current state — evidence recorded 2026-08-22

- Production build/staging contract is reduced to bootstrap plus Core Mod.
- Launcher resources contain exactly the two OPUS runtime JARs; inspection found
  no OPUS client JAR, CEF helper, or webview artifact.
- Core Mod/patch/runtime verification and the launcher engine/CLI/desktop tests
  passed in the non-interactive, file-only test environment. The test wrapper
  did not access Keychain or require a credential prompt.
- The verification was repeated against the current worktree: Gradle Core Mod
  tests/artifact gates, 43 engine tests, 25 unified-launcher tests, 5 platform
  tests, the full launcher check, the packaged
  runtime-contract verifier, and the file-only bundle verifier all passed. The
  broad desktop-process audit was intentionally not used as a test gate because
  it reports unrelated running Codex/Cursor state and is not an OPUS runtime
  requirement.
- This is a verified workspace bundle, not a release-lock-ready deliverable:
  `release/opus.lock.json` is a pre-existing dirty change whose recorded
  manifest digest does not match the present working-tree manifest. It is
  deliberately not rewritten until the Runtime and Launcher changes have a
  reviewed release boundary.
- The packaged artifacts were inspected directly:
  `opus-bootstrap-0.0.1.jar` is 10,745 bytes (SHA-1
  `b0bc476de840aa4a85b1c057a67734fa3a333e1e`) and its only entry point is
  `org.polydevs.opusmc.bootstrap.ForgeBootstrapMain`; the Core Mod is 59,162
  bytes (SHA-1 `ff7409bde9565d16638d8bcb0047ef43efdbc956`). Neither production
  JAR contains CEF, webview, client-overlay, GUI replacement, browser, or
  key-binding UI symbols.
- The Core Mod artifact verifier also rejects string-dispatched UI escape
  hatches (`displayGuiScreen`, `currentScreen`, `onGuiOpening`, key-bind,
  keyboard, and mouse handler names), so a future reflective UI path cannot
  bypass the direct class/package checks. The production Core Mod also no
  longer contains `WindowTitleTransformer` or the `opus.window.title` property.
- A new isolated unified launcher bundle passed the runtime-contract, file-only, and
  no-CEF/no-client inspection at
  `launcher/target/coremod-unified-verified/release/bundle/macos/Opus Launcher.app`.
  Its package contains no file named for CEF, webview, or `opus-client`, and a
  direct class-string scan found no window-title transformer or custom title
  property. Its macOS Java host displays as `Minecraft`, and the JVM Dock label
  is `Minecraft`; the launcher does not pass any custom game-window title to
  Java. No OPUS app is currently installed in `/Applications`.
- `launcher/scripts/assert-file-only-bundle.sh` is now also the installed-bundle
  Core-Mod-first gate: it requires exactly the bootstrap and Core Mod JARs,
  requires `ForgeBootstrapMain` (and rejects the retired standalone loader),
  rejects CEF/webview/client payloads and retired UI symbols in both JARs, and
  requires the `Minecraft` Dock/host labels. The unified bundle passed this
  gate directly after packaging.
- The former Premium/QA split is retired. The only supported build command now
  produces `Opus Launcher.app`; it exposes both official Microsoft identities
  and explicitly labeled unofficial offline profiles in one account catalog.
  A valid historic QA offline profile is migrated once into that catalog while
  its original data file remains untouched as a fallback. The prior Premium and
  QA workspace targets were deleted after the unified bundle passed its gate.
- Older `coremod-first` launches provided useful Forge/OptiFine/Core Mod startup
  evidence, but they used the prior Core Mod artifact with a window-title patch.
  They are therefore historical startup evidence only, not acceptance evidence
  for the present vanilla-title bundle.
- Read-only profile triage on 2026-08-22 found that the retained Microsoft
  catalog entry has no corresponding file-backed refresh credential. The
  unified launcher marks that identity `RECONNECT REQUIRED` and rejects launch
  before any game process is started; this is an actionable Microsoft login
  state, not a Keychain prompt or a hung Forge launch. The current unofficial
  profile is eligible for launch without an online credential.
- The historical native crash session was from the retired CEF client path: its
  JVM report recorded `SIGSEGV` in `AppleMetalOpenGLRenderer` while CEF/webview
  threads and the old `opus-client` mod were loaded. That payload is absent from
  the present unified bundle, so the crash is kept as the reason for the
  architectural removal, not as evidence against the current Core-Mod-first
  artifact.
- The current worktree was rechecked on 2026-08-22: the file-only source gate
  passed (14 auth, 43 engine, 25 launcher, and 5 platform tests; TypeScript and
  production frontend build), then the unified macOS bundle was rebuilt. Its
  runtime-contract verifier accepted the 59,162-byte Core Mod and
  `assert-file-only-bundle.sh` passed on the freshly packaged bundle.
- Runtime was also rebuilt from a clean Gradle output on 2026-08-22: all 32
  `clean test verifyRuntimeArtifacts` tasks completed successfully. The rebuilt
  Bootstrap and Core Mod SHA-256 values match the two JARs inside the verified
  unified bundle exactly, eliminating a source-artifact/bundle drift gap.
- Standalone debug/intermediate copies of the macOS Java host were moved to
  Trash on 2026-08-22. The technical LaunchServices host was also renamed from
  the misleading `Opus Client.app` to `Minecraft.app` (with executable
  `Minecraft`) so the production package has one visible game owner. Under
  `launcher/target`, the only distributable app is now the verified
  `Opus Launcher.app`; `Minecraft.app` remains only as an implementation
  resource inside that launcher bundle.

### Remaining acceptance boundary

The launcher and Core Mod do not own title, ESC, options, resize, or input, so
their authoritative implementation is vanilla Minecraft. The new bundle has
not been automatically launched over an active user session. macOS
accessibility does not expose this LWJGL window for automated click/key
inspection, and automated input is deliberately withheld while the user is
active in another application so the test does not steal focus. The final live
interaction check is therefore left **pending**, rather than being claimed from
a log or screenshot:

1. enter a throwaway single-player world and press `ESC` — vanilla pause menu
   must appear;
2. open `Options...` from the title menu — vanilla options screen must appear;
3. resize the ordinary game window and use normal mouse/keyboard input — no
   OPUS/T-UI/CEF surface may appear.

No code path remains that is intended to replace those screens. When these
three visible checks are confirmed, Step 4 is complete and subsequent work is
limited to deliberately scoped, non-UI Core Mod behavior.

See [ADR 0004](decisions/0004-vanilla-ui-core-mod-first.md) for the binding
architecture decision and `runtime/docs/game-bootstrap.md` for the loader
contract.
