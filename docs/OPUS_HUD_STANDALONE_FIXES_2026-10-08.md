# Gameplay HUD and standalone UI repairs — October 8, 2026

## Scope and observed failures

Work continues in the existing `main` checkout, preserving its prior dirty
Runtime, Launcher, UI and release-contract changes. After the user's explicit
installation and cleanup request, the repaired launcher replaced the old app
in Applications. No commit, push, foreground input or game launch was performed.

The user's editor priority is dragging, resizing and saving positions. The
user reports crashes across many actions. The initially inspected crash reports for
instance `9e048b4178f8444886a9098ecf6546b1` (October 8 at 15:34:22 and October 6
at 20:23:46, local time) both fail with `NoSuchFieldError: field_146297_k` in
`OpusClientScreen$1.currentShader`, called while initializing the pause blur.
Earlier reports also contain inherited UI field/method linkage failures.
The subsequent October 8 16:33:01 crash reached the correctly mapped field but
failed with `IllegalAccessError: tried to access field axu.j from class
OpusClientScreen$1`. Minecraft wrote a crash report despite the launcher showing
exit code 0. Later screenshots show FPS with three times the editor's position
and size in gameplay, and enabled Keystrokes disappearing outside the viewport.

## Root causes and repairs

- **Gameplay FPS:** the standalone overlay hook constructs an overlay parent
  using the actual Notch `ave`/`avr` game classes. Its `Text` event then rebuilt
  a viewport through the compile-only MCP `Minecraft.getMinecraft` method.
  That method is unavailable after class remapping; the hook silently dropped
  the event. The `Text` constructor now retains the parent's real resolution
  and partial ticks. The native HUD editor's direct renderer was unaffected,
  explaining why FPS appeared there.
- **Pause crash:** inherited GUI members were mapped only when the class
  containing the reference was itself a GUI subclass. The anonymous shader
  host references `OpusClientScreen`'s inherited `mc` field from an ordinary
  helper class. Mapping now follows the referenced owner's superclass chain,
  including metadata lookup without initializing a game class. Unrelated
  owners retain their field names. Lookup tries the actual LaunchClassLoader,
  then the context and defining loaders; misses are not permanently cached.
- **Connecting transition:** the standalone reflection shim searched only
  MCP/SRG field names. It now resolves SRG names through the existing pinned
  Notch field mapping, while retaining direct-name lookup. This addresses the
  observed missing `field_146374_i` warning and applies to disconnected-screen
  metadata through the same mapping table.
- **Esc access failure:** vanilla `GuiScreen.mc` is protected, while Forge's
  compile-time access transformer exposes it publicly. The anonymous pause
  shader helper is not a GUI subclass. Its read/load/stop callbacks now call
  private methods on `OpusClientScreen`, where protected field access is valid.
  A regression loads the real compiled host with vanilla protected field
  metadata and reproduces the original `IllegalAccessError` before the repair.
- **Misreported exit 0:** both macOS terminal lifecycle paths now reject the
  current session's Minecraft crash-report marker, even after clean process
  termination. The LaunchServices `open` process's exit code is no longer
  substituted for a failed game lifecycle. The scanner accepts non-UTF-8
  output and ordinary clean shutdown logs, and does not search old crash folders.
- **Editor/game coordinate mismatch:** the editor used framebuffer pixels
  divided by device scale, but gameplay used `ScaledResolution`. At the user's
  GUI scale 3, the two viewports were `1920×1080` and `640×360`. The native GL
  transform consequently magnified saved FPS offsets and size threefold;
  Keystrokes at `(1259, 285)` was outside the gameplay viewport. Both producers
  now share logical window points through `MinecraftUiScale.viewport`; GUI
  scale applies only to the GL transform. Existing saved settings are retained.
- **HUD resize:** the corner-resize path ignored its viewport. Resize previews
  now limit dimensions and clamp offsets through each widget's existing
  anchor-aware movement API. Cancel restores offsets and scale together;
  mouse-up commits them through the existing settings store. Resize direction
  follows the dominant signed motion, so opposite-axis jitter cannot reverse
  a corner gesture. Offset repair also runs when the scale is already at its
  limit, allowing retained positions to fit a smaller viewport.

## Verification

Each newly reproduced defect was observed failing before its production
repair. Successful final checks:

- Runtime `check` and standalone artifact verification, including 15
  standalone tests: event dispatch with Notch-only game classes, inherited
  shader-host field mapping, unrelated-owner preservation and Connecting
  return-parent lookup and helper-before-owner metadata lookup with an
  unrelated context classloader.
- Native `harnessHudLifecycle`, `harnessHudEditor`, `harnessHudSettings`,
  `harnessKeystrokes`, `harnessSystemScreens`, `harnessScreenInput` and
  `verifyClientArtifact`. These include the gameplay render/disable guard,
  preview/cancel/save behavior, unknown-setting preservation and 32 repeated
  screen input transitions.
- Additional four-anchor editor tests cover multiple drag events before a
  redraw, persisted position after disk reload, resize at the viewport edge,
  cancel restoring both offsets and scale, and committed resize after reload.
  Mixed-axis inward/outward gestures verify direction despite minor jitter;
  maximum-scale edge cases verify offset repair and persistence at all anchors.
- Runtime `verifyRuntimeArtifacts -x buildWebClient`, after the separate
  successful client artifact build. The exclusion avoids a redundant clean
  client rebuild; it does not substitute an unbuilt client.
- Launcher `opus-engine`: 64 tests passed. The existing test requiring live
  Mojang endpoints remains ignored.
- Desktop runtime staging, CEF helper signature verification, runtime launch
  contract, active release-lock manifest validation and whitespace checks.
  All five staged JARs match the verified Runtime output byte-for-byte.
- The final client `check`, `harnessSystemScreens` and `harnessScreenInput`
  passed together, including the protected pause shader regression. The new
  coordinate regression uses both actual viewport producers and real saved
  FPS/Keystrokes widgets: four anchors, GUI scales 1/2/3/4/Auto and device scales
  1/2, totaling 40 configurations. Its failing receipt reports the original
  gameplay `640×360` viewport. No native game window or physical input is used.
- The launcher workspace passed 14 auth, 64 engine, 27 launcher and six
  platform unit tests after the Esc changes. Final engine tests passed again
  after updating artifact pins for the coordinate repair.

Evidence logs are in `/tmp/opus-hud-standalone-red-20261008.log`,
`/tmp/opus-hud-runtime-check-20261008.log`,
`/tmp/opus-system-screen-red-20261008.log`,
`/tmp/opus-hud-editor-edge-red-20261008.log`,
`/tmp/opus-hud-client-green-20261008.log`,
`/tmp/opus-hud-editor-anchors-green-20261008.log`,
`/tmp/opus-hud-runtime-artifacts-20261008.log`,
`/tmp/opus-hud-launcher-tests-20261008.log` and
`/tmp/opus-hud-launcher-staging-20261008.log`.

The existing settings failure tests deliberately log rejected writes to a
directory. Legacy ForgeGradle/deprecated API/Unsafe warnings remain; none of
these are claimed to be absent. The old global file-only preflight fails on
unrelated desktop configuration/process attestations. Headless tests/builds
used the wrapper's documented diagnostic mode with its file-only environment;
no credential CLI, signing request, foreground app or Minecraft was launched.

Independent review identified context-loader fallback, mixed-axis resize
direction, and unchanged-scale offset-clamp issues. Each received a failing
regression before its repair. Their RED receipts are
`/tmp/opus-hud-review-loader-red-20261008.log`,
`/tmp/opus-hud-review-resize-red-20261008.log` and
`/tmp/opus-hud-review-scale-limit-red-20261008.log`.
Follow-up independent review found no remaining actionable issue in those
repairs. The complete Runtime/client checks and Launcher engine tests passed
again after the last production change, and final staged bytes/manifest/pins
were verified together.
An independent review attempt for the later Esc repair was unavailable due to
the review agent's quota limit; no successful independent review of that repair
is claimed. Its production-class regression and launcher lifecycle tests passed.

## Artifact state and acceptance limits

| Artifact | Bytes | SHA-1 |
| --- | ---: | --- |
| Standalone loader | 444899 | `770674fc857939b1c262d99648aa3011ec8d67bc` |
| Client/native UI | 10215481 | `134188d9b5e5dc06735004a18a0f162410cfd1b5` |

Launcher source pins and fixtures match these generated bytes. The active
`client-cef` manifest SHA-256 is
`0b3449192dc19d977eb9bfb9c6e0f2607e5a5181c17a559c003593abb7fa94ab`.
The development-only profile and existing packaging gate are unchanged.

The installed `/Applications/Opus Launcher.app` now contains the repaired
loader and client listed above. The local Tauri app was built with automatic
installation disabled, validated, then installed through the repository's
installer. The installer stopped the old launcher after validating its staged
replacement. Ad-hoc application and CEF helper signatures, the file-only/Web
Surface bundle gate, and the runtime launch contract passed on the installed
copy. Its launcher executable and all five JARs matched the new bundle
byte-for-byte before build cleanup. The installed executable SHA-256 is
`086a18c6ec7549f337d476378de6955daea30eb6c06bc99766a9ee30b53c2b6a`.
The utility settings file was verified unchanged by SHA-256 before and after
installation and cleanup: `06dde004a02ab99b9a6adc64a59ac4f748066c54003d3bc29c6858b636e518e0`.

The replaced app's temporary Trash backup was permanently deleted after
verification. Generated Launcher/Rust, Runtime/Gradle, CEF helper and frontend
builds were removed in the main checkout and the existing planning worktree,
along with old injector build outputs and its downloaded test toolchain.
Cleanup validated that every project path was ignored and contained no tracked
files, and confirmed tracked Git status was unchanged in all six repositories.
The latest `runtime/build/runtime` artifacts and desktop bootstrap staging are
retained. Source, game instances, accounts, saves and settings were not cleanup
targets. The initial cleanup increased availability from 5.9 GiB to approximately
15 GiB. After intervening builds and the final coordinate repair, a fresh
validated cleanup removed 17 generated directories and the replaced app backup;
tracked Git status remained unchanged in all six repositories. Availability
increased from 9.61 GiB to 12.02 GiB in that cleanup. A second verified obsolete
app backup was also deleted; the final space snapshot was approximately 12.7
GiB after filesystem reclamation. Installed signatures, the runtime contract,
all five artifact bytes and unchanged settings passed again after cleanup.

Installation and cleanup evidence is in
`/tmp/opus-hud-launcher-bundle-install-20261008.log`,
`/tmp/opus-hud-launcher-installed-20261008.log` and
`/tmp/opus-old-build-cleanup-receipt-20261008.json`.
The final coordinate repair's receipts are
`/tmp/opus-hud-coordinates-red-20261008.log`,
`/tmp/opus-hud-coordinates-green-20261008.log`,
`/tmp/opus-hud-coordinate-client-check-20261008.log`,
`/tmp/opus-hud-coordinate-runtime-artifacts-20261008.log`,
`/tmp/opus-hud-coordinate-engine-20261008.log`,
`/tmp/opus-hud-coordinate-bundle-20261008.log`,
`/tmp/opus-hud-coordinate-install-20261008.log`,
`/tmp/opus-hud-coordinate-installed-20261008.log`,
`/tmp/opus-hud-coordinate-installed-receipt-20261008.json` and
`/tmp/opus-hud-coordinate-cleanup-receipt-20261008.json`.
Esc-specific evidence includes
`/tmp/opus-esc-launcher-status-red-20261008.log`,
`/tmp/opus-esc-launcher-workspace-green-20261008.log` and
`/tmp/opus-esc-runtime-check-20261008.log`.

Fresh physical acceptance still requires matching gameplay/editor FPS and
Keystrokes geometry, drag/resize/save/reopen,
repeated HUD/pause/Settings routes and resize/fullscreen tests through the
installed launcher. This installation was not followed by an automated game
launch or physical-input test.

The latest log separately contains scheduled scoreboard/team packet
exceptions before the terminal pause crash. Those were not modified, and
these automated checks do not establish that every game instability is fixed.
