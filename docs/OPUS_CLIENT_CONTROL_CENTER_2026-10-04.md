# Opus Client control center — 2026-10-04

## Scope and delivery state

The owner approved replacing the in-game Client Settings/Mod Hub and repairing
its buttons and Escape handling. This is a Client release, not a web-only
preview. Home, Launcher layout, the native Minecraft performance preset, and
the frozen M3/injector work remain outside this redesign.

Current state: production Runtime built, Launcher packaged and signed, final
review completed, and the real app installed into `/Applications/Opus Launcher.app`.
Post-install byte/signature/launch-contract checks passed. Work began October 4
and the final handoff is October 5, 2026. Physical Minecraft acceptance has not
been performed.

## What changed

- The active Lunar-style hub is replaced by `OpusControlCenter`: the owner's
  aperture logo, neutral graphite/silver surfaces, a module library on the
  left and native options on the right. The old untracked hub source is retained
  for recovery but is absent from the built JavaScript.
- Only the two modules actually registered by this Runtime are listed:
  Performance overlay (`fps`) and Armor Status (`armor-status`). Fake profiles,
  unsupported module cards, neon enabled/disabled bars and decorative controls
  were removed from the active panel. This does not implement new AI modules.
- The frontend now preserves native settings metadata and submits real toggle
  and option requests. Scale, opacity, anchor, offsets and Armor Status
  durability are read from the host rather than fabricated in the UI.
- A write is successful only after a native reread confirms its value. A lost
  POST response can recover through that read. If reads also fail, values are
  marked unconfirmed and editors stay disabled until Refresh succeeds.
- Reopening the retained CEF surface or returning from HUD editing rereads
  current native values. If a previous operation is still running, one trailing
  reread is queued rather than silently dropped. Numeric saves and automatic
  rereads preserve keyboard focus without overriding the user's new target.
- Anchor selection uses an in-DOM radio grid with arrow/Home/End navigation.
  It does not depend on an OS select popup that is absent from the CEF view
  raster. Numeric drafts validate against native bounds and step.
- Escape and the panel's close button follow native context: nested Settings
  returns to its parent; a root in-game Pause closes to gameplay. Duplicate
  dismissal is guarded, dirty numeric Escape can revert its draft, and loading
  screens still reject unavailable actions. Native revision, ACK, focus and
  lease protections remain enabled.
- A reproduced first-Pause-frame defect came from ACKing a React commit before
  Chromium painted it: CEF could publish the old opaque Home raster. The ACK
  now crosses two cancellable animation frames before requesting the native
  generation. This is paint scheduling, not a startup timeout or a relaxed
  input gate.

## Reproduced failures and verification

- Module bridge tests were RED when native settings were dropped and the option
  write method was missing; both contracts are now GREEN.
- Rendered regressions were RED for delayed-save focus loss, a persisted write
  reported as failed after a lost response, and stale values after returning
  from HUD editing. The repaired contract covers all three, rejected writes,
  unreadable values/Refresh recovery, root/nested Escape and close-button input.
- Final review found two overlap variants. Held-snapshot tests reproduced both:
  HUD return while an older GET is pending dropped its required reread, and a
  delayed automatic GET on retained same-route reopening disabled the focused
  input without restoring it. Both are now GREEN with queued rereads and
  guarded focus restoration. The reopen fixture asserts the same DOM input was
  retained; it does not hide the defect with a page reload or remount.
- Client Node contracts: 21 passed, zero failed; TypeScript passed.
- Rendered control-center, visual, connection and Create World contracts
  passed. Panel bounds and hit-testable module/close controls were checked at
  427×240, 854×480, 900×600 and 1470×923.
- Final production CEF host-navigation, repeated server composer, actual
  GuiScreen ownership, system-screen, loopback bridge and native Music harnesses
  passed again on the rebuilt overlap/focus fixes in
  `/tmp/opus-control-center-harnesses-overlap-release-final-20261004.log`.
  This includes six server-composer cycles and 20 Home/park/Pause transitions
  whose first committed frame is transparent.
- Independent review caught a harness-only timing defect: sending Enter after
  an Anchor arrow could trigger a second save on a fast roundtrip. The harness
  now commits numeric fields with Enter but waits directly for radio writes.
  The corrected real-CEF host gate passed again in
  `/tmp/opus-control-center-harness-host-review-final-20261004.log`.
- Launcher Rust workspace: 104 passed, zero failed; one official-network test
  is intentionally ignored. Log:
  `/tmp/opus-control-center-launcher-tests-overlap-final-20261004.log`.
- Final sequential Runtime build passed in 30s. Build-only Launcher release
  passed with `OPUS_AUTO_INSTALL=0`; all 133 captured production inputs remained
  unchanged. No root Runtime clean/build ran concurrently with a legacy harness.
- Final independent read-only source review found no remaining Critical or
  Important defect in this approved scope after the two overlap repairs.
  That verdict does not replace packaging or physical acceptance evidence.

These browser and Java/CEF fixtures use disposable providers/catalogs and
synthetic input, not the owner's physical mouse/keyboard or real world/server.
No real game was opened, no system clipboard test was repeated, and no commit
or push was made.

## Artifact evidence

- Bundle: `launcher/target/release/bundle/macos/Opus Launcher.app`.
- Packaged Launcher executable SHA-256:
  `4d7116ddc1e5fdc467f3b5eb61b13e22793f07ebdc0762aef80a2e0bff541b5d`.
- Client JAR (`opus-native-ui-1.8.9-0.1.0.jar`): 10190203 bytes.
  SHA-1: `def02032440cd655be6244116bbfbc501b359b2d`.
  SHA-256: `5fa85710a83b299adea89519e60c188c2b522af83e010807618731e5820ca583`.
- The Launcher compile-time pin agrees with the Client artifact. All four
  Runtime JARs and both manifests match the bundle byte-for-byte. All 22 current
  frontend files match its embedded `opusui/` entries; old fake hub labels are
  absent from the compiled JavaScript.
- Deep strict signature verification, file-only/Web-Surface bundle check and
  Runtime launch-contract validation passed before installation. ZIP integrity
  also passed for all four packaged Runtime JARs.
- The same checks passed on the installed app. All four Runtime JARs and both
  manifests compare byte-for-byte Runtime → bundle → installed app. All 22
  installed `opusui/` files match the built frontend; installed Launcher and
  CEF helper executables match the signed bundle. The 133 production inputs
  remained unchanged through the final installed-byte check.
- Installation was gated on an unlocked console and an idle installed process
  guard. An earlier locked-console check stopped installation; it was not
  bypassed and no password was requested. Final installer log:
  `/tmp/opus-control-center-install-final-20261004.log`.
- Only the installed Opus app was replaced. The previous app is recoverable at
  `/Users/zvwgvx/.Trash/Opus Launcher backup.s3AOuh/Opus Launcher.app`.
  No real game was opened after installation. The disposable headless browser
  and the task-owned test preview server were closed; no user browser was
  controlled or closed. The installed app serves its packaged UI and does not
  depend on that development server.
- A fresh actual CEF screenshot from the disposable native harness is retained
  at `ui-v2/output/playwright/opus-control-center-cef-final.png`. It is not a
  screenshot of a Launcher-launched Minecraft world.

## Acceptance boundaries

The release repairs this panel and the shared dismissal/paint lifecycle, but
does not declare every Minecraft control accepted. Physical click/typing,
Right Shift open/close, actual HUD editing, fullscreen/live-resize stability
and real-world Pause blur still need testing in the installed game.

Fast Render and the owner's Quake Pro/Music preset are unchanged. With OptiFine
M5, Fast Render can prevent the framebuffer required by blur; a transparent
dim overlay is a fallback, not proof of successful real-world blur.

Previous installed-release evidence is historical in
[input/Connecting recovery](OPUS_INPUT_CONNECTING_RECOVERY_2026-10-04.md).
Do not substitute its older hashes for this release.
