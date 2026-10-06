# Opus CEF regression recovery — 2026-09-23

> Superseded as a live-game acceptance result by the boot-route correction
> below. The previous headless host test opened `title` before CEF startup;
> that did not reproduce the installed game's boot order.

## Scope and observed failure

This corrects the 2026-09-23 optimization pass described in
`OPUS_PERFORMANCE_AND_CEF_FIXES_2026-09-23.md`. In the installed session
`~/.opus-launcher/logs/1790148460572-19946/minecraft.latest.log`, one
57-step AppKit live resize produced roughly 60 repeated `open -> title`
commits at revision 1, then `generation 60 has not painted yet` and an
8-second navigation-ACK timeout/reload. This is direct evidence of route
reinitialization and CEF paint starvation, not evidence that the earlier
"live resize fixed" claim was true. The owner also reported delayed buttons
and clicks that did not work.

## Changes

- `OpusClientScreen.initGui()` now opens/commits the route and acquires CEF
  only on the first initialization of that screen. Subsequent Minecraft
  resize-driven `initGui()` calls update geometry without restarting route
  ACK or navigation.
- Removed the 50 ms browser-resize throttle. The current geometry is sent
  immediately; the native helper coalesces queued `VIEW` messages to its
  newest geometry before calling Chromium's `WasResized()`.
- Prewarm uses the framebuffer/logical DPR contract and never makes the
  Minecraft render thread wait on the controller monitor while Chromium
  starts. A failed prewarm enters the explicit failed state rather than
  restarting the helper implicitly from the draw loop.
- Restored the pre-optimization LWJGL framebuffer-to-CSS pointer mapping.
  The Antigravity-added synthetic logical-coordinate test did not establish
  what the live patched LWJGL mouse reports. A live pointer check remains
  necessary for final acceptance.
- A browser frame is published and uploaded only for its current generation
  and exact raster dimensions. The previous image may stay visible during a
  transition, but stale geometry cannot become an input-active frame.
- Restored the explicit GL state snapshot boundary in place of the
  unprofiled `GL_ALL_ATTRIB_BITS` push/pop change.
- Updated the compact Home bridge test's Minecraft/Client Settings click
  coordinates from the retired layout to the currently rendered buttons.

## Verification and installed artifact

- Real CEF W4 input oracle: PASS (pointer, buttons, edit shortcuts).
- Real CEF W5 React oracle: PASS (Home, Singleplayer, Multiplayer, compact
  Home click after resize).
- Host navigation/ACK oracle: PASS for all four Home actions and a hash-route
  ACK; the corrected compact click points were checked against a current
  427x240 CSS / DPR 2 CEF capture.
- W7 lifecycle oracle: PASS for 12 resize/DPR transitions, forced-helper
  failure/recovery, and a 60-request rapid resize sequence. The final CEF
  frame arrived 76 ms after starting that synthetic sequence on this host;
  this is *not* a measurement of AppKit drag-to-screen latency.
- `prepareRuntime` and `verifyRuntimeArtifacts`: PASS. Launcher bundle,
  file-only/Web-Surface gate, runtime launch contract, app signature, and
  installed JAR/helper byte comparisons: PASS.
- Installed `/Applications/Opus Launcher.app` runtime JAR SHA-256:
  `a9a779f6df9c650d43b5600867a9889757620caaef2f0a4cc91aafaaba6a359d`;
  size: 10,156,121 bytes. Previous app is recoverable at
  `/Users/zvwgvx/.Trash/Opus Launcher backup.3x4AjQ/Opus Launcher.app`.

## Not yet verified

The installed game was not brought to the foreground or driven with the
owner's mouse/keyboard. Therefore actual in-game live-resize smoothness,
physical click alignment, and fullscreen-during-boot crash freedom remain
open acceptance checks. Headless CEF tests and package integrity do not prove
those outcomes.

## Subsequent owner report and boot-route correction

The owner-provided screenshot after this install showed the night-sky
background and `OPUS CLIENT` header, but no Home content or buttons. The
installed session log at
`~/.opus-launcher/logs/1790150890909-75115/minecraft.latest.log`
shows CEF prewarming and loading `#/title` before Java logs
`Opus UI navigation r1 open -> title`. Eight seconds later Java reported
an unacknowledged revision and reloaded CEF. React had read revision 0,
`current.id = "none"`, then rendered a route with no main content. Opening
the already loaded `#/title` URL did not generate a `hashchange`, so React
never read revision 1. This explains the exact header-only screenshot and
why no Home button could be clicked. It also added a needless eight-second
reload to perceived startup latency.

The frontend now ignores the uncommitted `none` route, subscribes to Java's
`uiNavigationChanged` WebSocket event, and re-reads authoritative state on
socket connection. A short-lived 250 ms poll covers only the initial route
until a valid revision arrives. Older asynchronous responses cannot replace
a newer revision. The host CEF harness now reproduces the real order:
CEF first loads `#/title` with revision 0, then Java opens `title` at the
same URL. The new test passed that ACK and all four Home action clicks through
CEF to the Java bridge at 427x240 CSS / DPR 2. It also passed a second
same-URL title commit after bootstrap polling had stopped, exercising the
WebSocket event path. The first harness attempt used
an incomplete `PATH` for `npm`; after correcting it, the headless CEF test
passed. `prepareRuntime` and `verifyRuntimeArtifacts` passed again.

The replacement installed at `/Applications/Opus Launcher.app` contains the
byte-matched native UI JAR with SHA-256
`a10d736e191baa7357abc1909f7eb8cf6ee83d215c1fcc545aa325ab817aabe9`.
Its runtime launch contract and deep code signature passed verification.
The preceding installed app is recoverable at
`/Users/zvwgvx/.Trash/Opus Launcher backup.5oUfRv/Opus Launcher.app`.

This correction has **not** yet been observed in an actual game-window
session. The CEF harness proves event delivery and synthetic CEF click
dispatch, not physical LWJGL pointer alignment, live startup latency,
fullscreen behavior, or AppKit resize smoothness. The launcher was left
closed after installation to preserve the owner's mouse and keyboard control.
