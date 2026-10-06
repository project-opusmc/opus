# Native input and CEF system-screen update — 2026-10-01

Historical installation snapshot: the later Disconnect/Connecting corrections and superseding installed artifact identity are recorded in [Disconnect and Connecting recovery](OPUS_DISCONNECT_CONNECTING_RECOVERY_2026-10-01.md).

## Scope implemented

- Vanilla GUI absolute mouse reads now normalize macOS AppKit points to framebuffer pixels before Minecraft's GUI scaling. This covers native hover, click and list hit testing; CEF input, relative camera motion and wheel input remain unchanged.
- Connecting, terrain download and disconnected/kicked presentation use the existing persistent CEF host. Minecraft's original screen remains the lifecycle delegate and owns networking, cancellation, keep-alive packets and its real return parent.
- System-to-system transitions retain the browser/texture lease. A same-route payload update increments the host revision; old Cancel/Back actions cannot target a replacement session.
- Connector errors originating on its worker thread are scheduled onto the game thread. Guards reject errors after Cancel, while accepting immediate constructor failures that belong to the installed delegate's exact native return parent.
- Navigation, Cancel/Back, Resume and Minecraft Settings send the revision of the committed React render directly. They no longer fetch a newer revision before posting an older control's action.
- Explicit Minecraft Settings preserves its exact native root when returning from Video Settings or Controls. Generic/unrelated Options entry points still use the Opus settings route.
- Connection panels retain the approved neutral liquid-glass visual language. Native server reasons are plain text, including quotes, formatting cleanup and multiline content. Terrain loading does not invent a Cancel action.

## Fresh automated verification

```sh
# /Users/zvwgvx/Project/Opus/ui-v2
node --test test/*.test.mjs
npm run check

# /Users/zvwgvx/Project/Opus/runtime
./gradlew --no-daemon :legacy:1.8.9:patches:test :legacy:1.8.9:forge:test --rerun-tasks

# /Users/zvwgvx/Project/Opus/runtime/legacy/1.8.9/client
OPUS_SYSTEM_PNG_DIR=/Users/zvwgvx/Project/Opus/.playwright-cli/system-cef \
  bash ./gradlew --no-daemon harnessSystemScreens harnessBridge \
  harnessWebSurfaceHostNavigation harnessWebSurfaceInput harnessWebSurfaceLifecycleW7
```

All commands above passed on the integrated source. Frontend: 18 tests, zero failures. The action-revision regression was observed failing before its fix; the native Options ownership regression likewise failed before implementation.

The CEF harness exercised real browser input for Home's four primary buttons, connection Cancel/Back/Escape, Ctrl+A/C/X/V, Cmd+A, Ctrl+Z/Y and native key semantics. Terrain loading exposed no action. The real Minecraft terrain delegate sent two keep-alives over 40 ticks and stopped sending after closure.

W7: 20 park/show cycles; 12 resize/DPR transitions; 60 rapid resize steps converged on the final browser layout in 67 ms; renderer-death failure and recovery passed. Warm show measured median/p95 30/78 ms at 854x480 CSS/DPR 1 and 29/41 ms at 427x240 CSS/DPR 2. These are CEF harness measurements, not Minecraft fullscreen acceptance.

Pause-menu current frames had transparent corners, allowing the game scene behind the overlay. Blur ownership lifecycle checks passed; the actual game scene and live shader composition were not manually inspected in this run.

Captured/inspected CEF previews: `.playwright-cli/system-cef/connection-{connecting,loading,disconnected}.png` at 427x240 CSS/DPR 2, and `connection-disconnected-wide.png` at 1280x720 CSS/DPR 1.

## Packaging and installation

Runtime `verifyRuntimeArtifacts` passed, including a clean/reobfuscated client build, coremod verification and LWJGL compatibility verification. The client JAR contains `NativeSystemScreenSession`, `NativeOptionsFlow`, `ConnectionUiState` and the current `index-CNttRhJ8.js` bundle. The coremod JAR contains `RetinaDisplay` and `RetinaGuiInputTransformer`.

The first launcher packaging attempt correctly rejected the old coremod/UI pins. `launcher/crates/engine/src/forge.rs` now pins the exact verified replacements:

- Coremod: SHA-1 `67f519ea847ace3637d426db0cfa414626547276`, 72,454 bytes; SHA-256 `5204d3c9eff2d18c5aec9ee3a4e1974ecd3c0c97799f3cfae94e47f380775375`.
- UI: SHA-1 `8de87cccd0ee4b37a5bb1682c5a14adeb062c1a7`, 10,176,294 bytes; SHA-256 `826002257c5de94ed52de9449cda7f3e03294ef225031eb74fb7e4cb4ff93ee7`.
- LWJGL/native/resize-guard pins are unchanged and passed the same verifier.

Launcher TypeScript check and all 50 `cargo test -p opus-engine --lib` tests passed. `OPUS_AUTO_INSTALL=0 bash scripts/build-tauri-bundle.sh` passed after updating the pins; codesign deep/strict verification, the file-only bundle gate and the runtime launch-contract check all passed on the completed app:

`/Users/zvwgvx/Project/Opus/launcher/target/release/bundle/macos/Opus Launcher.app`

**Installation is complete.** The initial attempt returned exit 78 while the macOS console was locked, without changing the installed app. On the user's subsequent request to remove the old version and install, the console guard passed; `install-opus-launcher.sh` validated and signed the staged replacement, verified that installed Opus processes were idle, and replaced `/Applications/Opus Launcher.app`. No lock or Keychain guard was bypassed.

The inventory found one active Opus app bundle. Its old installed version was moved recoverably to:

`/Users/zvwgvx/.Trash/Opus Launcher backup.tV0HXK/Opus Launcher.app`

No Minecraft/Lunar app, worlds, accounts, settings or source-history build evidence was removed.

Fresh post-install checks passed: runtime launch contract; file-only bundle gate; deep/strict codesign; exact byte comparison of both manifests and all four installed runtime JARs against `runtime/build/runtime`; exact comparison of the installed launcher executable against the newly built executable. The installed-process guard was idle before reopening.

`open -g -a '/Applications/Opus Launcher.app'` returned successfully, and the installed launcher process was observed at PID 65668. No physical mouse/keyboard automation or game launch was performed. Installation and background reopening must not be confused with live gameplay/fullscreen acceptance.

The CEF helper source is unchanged by this patch; the existing local helper binary was the one exercised by the fresh CEF harnesses and copied into the new launcher bundle. No fresh CEF helper compilation is claimed: the distribution cache was unavailable and that optional task was skipped.

Completed delivery commands (the installer requires an unlocked console):

```sh
# /Users/zvwgvx/Project/Opus/launcher
bash scripts/install-opus-launcher.sh \
  '/Users/zvwgvx/Project/Opus/launcher/target/release/bundle/macos/Opus Launcher.app'
node scripts/verify-runtime-launch-contract.mjs \
  '/Applications/Opus Launcher.app/Contents/Resources/bootstrap'
open -g -a '/Applications/Opus Launcher.app'
```

The post-install comparisons and installed bundle/codesign checks described above have also been run successfully. Physical game verification remains user-driven.

## Remaining physical acceptance

No physical mouse/keyboard automation was used. The user should test on the installed client:

1. Home and in-game Minecraft Settings → Video Settings/Controls → Done → original Settings → Done.
2. Native buttons, lists and sliders after resizing and after entering/exiting fullscreen.
3. Connection Cancel followed immediately by another attempt; invalid address; actual server kick; return to server list.
4. Successful terrain load into a real world, then Esc with the game visible behind the menu.
5. Fullscreen during boot and rapid live resize. These remain unverified end-to-end; no claim of a crash-free game fullscreen path is made.

Existing dirty work was preserved. No Git commit, remote push or release publishing was performed.
