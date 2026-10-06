# Opus live HUD editor — 2026-10-05

## Delivery status

Implemented, packaged, and installed into `/Applications/Opus Launcher.app`. The installed launcher, all four runtime JARs, both manifests, all 22 embedded web assets, and the tested CEF helper were verified after installation. This is an actual client/app delivery, not only a web preview.

**Fresh physical in-game acceptance remains manual.** No game was launched, no foreground window was controlled, and no system mouse, keyboard, clipboard, accounts, or credentials were used for automated tests. Fullscreen stability is not claimed from these HUD tests.

## Approved behavior

- RShift opens the full-game HUD editor, with the approved Opus aperture logo and Mods in the center. No emotes/cosmetics.
- The HUD editor keeps the actual game background unchanged: no wallpaper, dimming, or blur. Existing Pause blur is retained.
- FPS uses `Minecraft.getDebugFPS()`. Keystrokes reads actual assigned movement, attack/use, and jump keycodes, including mouse/keyboard remapping and physical press/release. Unavailable or inactive devices fail closed.
- Enabled widgets are outlined immediately. Native drag/resize previews are committed on release; cancellation restores the saved values. X disables without deleting the module or its layout. The gear opens the exact module; Escape from that direct module path returns to editor, then gameplay.
- Widgets remain opt-in. Existing FPS/Armor preferences are not reset. Keystrokes has scale, opacity, anchor, offset, mouse-row and jump-row controls.
- Native canvas ownership excludes CEF chrome, so a widget placed beneath Mods/Done cannot steal its click. Reports retain current navigation revision, clipping, validation and balanced release/cancellation guards.

## Source changes

- Added `KeystrokesSettings`, `KeystrokesInputReader`, `KeystrokesLayout`, `KeystrokesModule`, native harnesses and rendered editor contract.
- Integrated the module into `UtilitySettingsStore`, `ClientOverlayController`, the genuine module catalog/settings and `HudManager`.
- Added `HudEditor.tsx`/CSS; CEF renders editor chrome only. Native widgets are the same objects used during gameplay, not browser mock HUDs.
- Extended the existing HUD canvas report with bounded chrome exclusions, including its HTTP/provider/client-thread/screen forwarding path.
- Fixed preference failure rollback: failed writes restore both the preview and the JSON document, so later saves cannot leak rejected settings.
- Fixed shared Launcher normalization/serialization so native options, valid additional HUD modules (including Armor), and root metadata survive. Unsupported arbitrary utility object shapes are not introduced as a new Rust schema.
- Updated the launcher artifact pin to the exact rebuilt client size/SHA-1. Launcher copy for FPS/Keystrokes describes implemented behavior rather than a nonexistent frame-time/Sprint feature.

## Verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| UI node suite and TypeScript | 21 passed; check succeeded | `/tmp/opus-hud-ui-final-20261005.log` |
| Rendered editor/control center | Both passed; four viewports each | `/tmp/opus-hud-rendered-final-20261005.log` |
| Native + actual CEF suite | All nine tasks passed | `/tmp/opus-hud-full-harnesses-20261005.log` |
| Runtime artifact build/check | Successful | `/tmp/opus-hud-runtime-final-20261005.log` |
| Launcher Rust workspace | 105 passed; one official-network test explicitly ignored | `/tmp/opus-hud-launcher-workspace-20261005.log` |
| Launcher shared HUD normalization | Two passed | `/tmp/opus-hud-launcher-node-final-20261005.log` |
| Signed macOS bundle | Successful; file-only and launch contract passed | `/tmp/opus-hud-bundle-20261005.log` |
| Installation | Successful; previous app retained | `/tmp/opus-hud-install-20261005.log` |

The nine native/CEF tasks were `harnessWebSurfaceHostNavigation`, `harnessCefRouteInput`, `harnessScreenInput`, `harnessSystemScreens`, `harnessBridge`, `harnessNativeMusic`, `harnessHudEditor`, `harnessHudSettings`, and `harnessKeystrokes`. They include 32 held-press route transitions, lost release/focus cancellation, native widget drag/resize/hide/gear/history, real CEF transparent pixels/Mods/root Escape, and existing Pause/system-screen checks. Negative save-failure fixtures deliberately log warnings while verifying rollback; old Forge/Gradle deprecation warnings remain.

Observed RED before fixes included missing outline before hover, malformed CEF exclusions being accepted, absent native Keystrokes APIs, repeated environment probes per cell, cached settings not rolling back after failed writes, and Launcher serialization dropping a false native option to null. Added missing-type/interface tests also initially failed to compile. The corresponding final suites passed; compilation failures are not described as runtime acceptance.

The actual isolated CEF capture is `/tmp/opus-hud-cef.uRg6rQ/connection-hud-editor.png`. Its areas outside chrome have alpha zero; image viewers may display that transparency as black. It is **not** a screenshot of gameplay or a replacement game background.

## Installed artifact identity

Runtime → signed bundle → installed app were compared byte-for-byte. Each JAR passed archive validation; all embedded `opusui/` files match the fresh `ui-v2/dist` file set and bytes.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `opus-native-ui-1.8.9-0.1.0.jar` | 10,213,728 | `999c7f4e31eb910dfea319879654c1cb08a43020cb173a719d25949b63683ddf` |
| `opus-lwjgl-macos-compat-2.9.2-nightly-20140822.jar` | 1,202,775 | `2a5c91b98a88ff5d30bd6b6b46568a961a7d2d52804cb3e1a99bf2b0bdce8a6e` |
| `opus-runtime-legacy-1.8.9-0.0.1.jar` | 72,454 | `5204d3c9eff2d18c5aec9ee3a4e1974ecd3c0c97799f3cfae94e47f380775375` |
| `opus-bootstrap-0.0.1.jar` | 10,745 | `c3e95a4d798a2276417aedd54e4640bf5ec1b4eed1a09adf6f0f05b382a9dc55` |

- Client SHA-1 pin: `5aafebecde0d41fc182697db588bc3739e8422ef`.
- Installed launcher executable SHA-256: `e0e07d4b33b18a3182eb8069996f8594d4e56ce402affd1c23acded5ff5a9c4d`.
- CEF helper executable SHA-256, unchanged from tested helper: `de373ae08a324bfcc9ceb4d5bc708e18137de7baaf3ec358907a7dd4f621ab22`.
- Production input freeze: 208 source/artifact entries; aggregate SHA-256 `fe2aa404704f51db5805d25e4da6fb4b3fe76339b90a8c1feb4b5d246055b2ec`, unchanged before packaging, before installation and after installation.
- macOS console was unlocked and the installed Opus app/game idle before replacement. No running game was killed.
- Recoverable previous app: `/Users/zvwgvx/.Trash/Opus Launcher backup.IVaYEJ/Opus Launcher.app`.
- No user worlds, accounts, preferences, synced project references or unrelated source changes were removed. No commit, merge or push was made.

The launch engine validates the new pinned client artifact before staging it for a subsequent launch. This receipt does not claim that the game cache or running gameplay was tested by launching the game.

## Review and integration decisions

Independent review was requested, but the reviewer failed with the account usage limit and returned no verdict. A separate author self-review checked binding reads, storage transaction rollback, capture cancellation, native/CEF overlap, navigation revisions and transparency against the approved plan and passing suites. This is weaker than independent review and is not represented as its approval.

- Retained the user's dirty active checkout, without committing/pushing. Cost: reproducibility is recorded by the frozen input and artifact hashes rather than a clean task commit.
- Corrected the narrow shared Launcher schema seam to preserve native HUD settings. Cost/boundary: valid HUD preference objects and extra fields survive, but arbitrary unsupported Rust utility shapes remain unsupported; simultaneous external preference edits were not a new concurrency protocol in this task.
- Applied no-blur only to HUD editor. Cost: Pause retains its earlier blur, intentionally.

## Manual acceptance sequence

1. Open the installed Launcher, Play, and enter a world/server. Press RShift: actual game should remain visible and unblurred behind the editor.
2. In Mods, enable **Performance overlay (FPS)** and **Keystrokes** as desired, then return to editor. Check actual frame-rate and assigned-key press/release behavior; rebound controls should show their actual labels.
3. Drag and resize widgets; use the gear to change scale/opacity/rows; Escape should return from gear settings to editor, then game. Reopen and verify saved layout. X should hide without losing layout/settings.
4. Test focus loss and resize during a held gesture, Mods/Done with a widget underneath, and fullscreen/restore. These physical/window checks remain unverified until performed by the human; report any failure with the new launcher-launched session.
