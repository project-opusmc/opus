# HUD frame and proportional resize — October 9, 2026

## Requested behavior

The user asked for a balanced outer frame that positions its contents, with
corner resizing that enlarges/shrinks the frame and contents together, like
Canva. Work continues in the dirty `main` checkout. Existing coordinate,
standalone mapping and Esc repairs from October 8 are retained.

The old editor added a minimum 68×30 selection region and asymmetric extra
space to the real widget bounds. Its resize path also changed scale without
preserving the corner opposite the pointer. Saved widgets at 150% could not
grow because that was the old settings ceiling.

## Implementation

- The frame follows the real widget bounds with equal 3-point padding on all
  sides. This padding is editor chrome and does not enter position/scale math.
- All four corner handles resize uniformly. Pointer motion is projected onto
  the captured starting diagonal; both frame dimensions and rendered contents
  use the resulting scale. The opposite content corner stays fixed through
  the existing anchor-aware movement API.
- Multiple pointer events before a redraw use current widget geometry. A
  gesture previews changes in memory, saves on release and restores the
  previous position/scale when canceled. Widget disappearance during another
  pointer move cancels its capture and rolls back the preview.
- Handle drawings and hit regions remain inside the viewport. Overlapping
  handles on small widgets choose the nearest corner. Large retained widgets
  can be resized back into a smaller window; cancellation restores their
  original saved layout.
- Settings/Hide actions appear after selection and retain that widget as their
  owner when crossing the gap or another widget. Placement avoids the frame,
  corner hit regions and accepted CEF chrome exclusions. Current-revision
  geometry comes through the real `OpusClientScreen` acknowledgement path.
- HUD scale now supports 50–400%, including matching native and preview
  settings schemas. Existing saved values are retained.

## Verification

Failing regressions were observed before their repairs. RED logs include:

- `/tmp/opus-hud-frame-red-20261009.log`: unbalanced FPS frame.
- `/tmp/opus-hud-frame-fixed-corner-red-20261009.log`: resizing moves the
  opposite corner.
- `/tmp/opus-hud-frame-scale-cap-red-20261009.log`: saved 150% cannot grow.
- `/tmp/opus-hud-frame-visibility-red-20261009.log`: invisible capture skips
  rollback.
- `/tmp/opus-hud-frame-edge-red-20261009.log`: corner handles clipped outside
  the viewport.
- `/tmp/opus-hud-frame-actions-red-20261009.log`: hover exposes inaccessible
  external actions.
- `/tmp/opus-hud-frame-chrome-red-20261009.log`: an action lies under accepted
  CEF chrome.
- `/tmp/opus-hud-frame-small-window-red-20261009.log`: retained 400% Keystrokes
  remains outside a 427×240 window after resize.
- `/tmp/opus-hud-frame-hidden-move-red-20261009.log`: hide then move leaves
  stale pointer capture.
- `/tmp/opus-hud-frame-small-actions-red-20261009.log`: minimum-scale FPS
  toolbar steals corner input at the top edge.

Final client `check harnessSystemScreens harnessScreenInput` passed in
`/tmp/opus-hud-frame-client-check-final-20261009.log`. The new
`harnessHudFrameResize` uses real FPS/Keystrokes widgets, the real settings
store and real manager, with renderer/device boundaries isolated. It checks
four corners × four anchors × two modules, repeated input before redraw,
uniform rendered scale, save/reload/cancel, larger saved scales, visibility
changes, all viewport edges, overlapping widgets, CEF exclusions and retained
oversized layouts. Existing HUD editor/lifecycle/settings, gameplay/editor
coordinate, CEF WebView, protected pause shader and real GuiScreen input
regressions passed in the same run.

Modern Runtime `check verifyRuntimeArtifacts -x buildWebClient` passed in
`/tmp/opus-hud-frame-runtime-final-20261009.log`. The excluded client build had
already passed independently. Standalone's 15 tests and LWJGL compatibility
checks passed earlier this turn. Independent review found capture/toolbar
edge cases, which received the RED regressions above; final follow-up review
found no remaining concrete issue in those repairs.

Launcher `cargo test --offline --release --workspace` passed 14 auth,
64 engine, 27 launcher and six platform unit tests. The existing test that
requires live Mojang endpoints remains ignored. Its log is
`/tmp/opus-hud-frame-launcher-workspace-20261009.log`.

The native Tauri app build, ad-hoc signature and file-only/Web-Surface bundle
gate passed in `/tmp/opus-hud-frame-bundle-20261009.log`. The staged runtime
launch contract also passed. No existing release gate was promoted or bypassed
to claim production release eligibility.

The layout image in `output/hud-frame-2026-10-09/hud-frame-layout.png` derives
geometry from production draw commands at 100% and 200%. Its font is a sample
font and it omits action buttons. It is a renderer geometry diagram, not a
live Minecraft screenshot.

## Artifact state

| Artifact | Bytes | SHA-1 |
| --- | ---: | --- |
| Client/native UI | 10218978 | `7e87e1b64b3db97f011a85b7ae462365217a11d5` |
| Standalone loader | 444899 | `770674fc857939b1c262d99648aa3011ec8d67bc` |

Client SHA-256:
`eab64617b2a3a0dd9ce9ee206ea9e754df491bb0009d92679286268f09fcae39`.
Manifest SHA-256:
`43778f87c8e2795f8e32103b17c9b23da6e33d6683b1614523c69a8a86ed7523`.
Forge constants/fixtures match these generated bytes, and active release-lock
manifest verification passed. The profile remains `development-only`.

The new app replaced `/Applications/Opus Launcher.app` through the repository
installer after bundle validation. Installed executable, all five JARs,
manifest and checksums matched the verified bundle/canonical Runtime output.
Installed file-only/Web-Surface checks and runtime launch contract passed.
Executable SHA-256:
`41ee64b840d984587fd6db8bf3dad5a31b0b1f455da9b4294addc37ebf9b646a`.
The real settings file was fingerprinted immediately before installation;
its SHA-256 remained unchanged through install and cleanup:
`c6e58efb9dffc5a3b952f9e572d6dc292845e8aec5705f149614a183248989c6`.

After installed verification, the exact replaced app backup and 16 generated
build/cache directories were removed. Every project deletion was validated
as ignored, without tracked files, without symlinks and within the project.
Tracked Git status was unchanged across the main and planning checkouts and
their submodules. Canonical `runtime/build/runtime` and desktop bootstrap
staging remain available. Source, game instances, accounts and saves were not
cleanup targets. Free space increased from 13.05 to 15.11 GiB in the measured
cleanup; filesystem reclamation can change later snapshots.
Installed bundle checks, runtime launch contract, canonical artifact hashes,
release-lock validation and the unchanged settings fingerprint passed again
after cleanup. Final whitespace checks passed in all three repositories.

Installation and cleanup receipts:

- `/tmp/opus-hud-frame-install-20261009.log`
- `/tmp/opus-hud-frame-installed-receipt-20261009.json`
- `/tmp/opus-hud-frame-cleanup-receipt-20261009.json`

Fresh physical acceptance remains separate: use the installed launcher to
drag all four corners, move/save/reopen the editor, and compare the editor
with gameplay. This turn does not launch a game or control physical input.
These scoped checks do not claim that every reported game instability or the
previously known unrelated Pause transparency UI-suite failure is resolved.
