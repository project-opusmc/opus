# Client section header and input lifecycle — 2026-10-03

## Approved scope and delivery state

The owner approved a section-title-only header: Back remains on the left,
the section name is centered, and version remains on the right. The repeated
`OPUS CLIENT` label is removed from these headers only. Home geometry, palette,
wallpaper, Launcher UI, native fullscreen and resize code are unchanged.

Input work addresses the reported intermittent buttons, text entry and
unintended dragging after route/screen changes. New presses still require the
current route ACK, committed raster and visible browser lease. These guards
were not disabled to make controls appear responsive.

Final Runtime/Launcher rebuilding, deep/strict signing and byte checks passed
after the additional focus/retry fixes below.
Installation is pending the final scoped review and installed-byte checks.
This receipt does not yet assert that `/Applications/Opus Launcher.app`
contains this build.

## Reproduced defects and fixes

1. Closing `OpusClientScreen` discarded its browser reference/lease before
   releasing input. Cleanup then could not send mouse-up to the persistent
   CEF browser before parking it. Cleanup now occurs while this screen still
   owns the visible browser, before dispose/release/park.
2. A down accepted by CEF could lose its matching up when ACK/readiness
   changed between the two. Releases now balance an already-owned button even
   during that readiness change; the visible current lease is still required.
   Unowned/orphan releases and all new unconfirmed presses are rejected.
3. A single capture slot forgot an earlier held button when another button
   was pressed/released. Capture and stale-release suppression are now tracked
   independently for left, right and middle buttons. Transition cleanup
   releases all owned buttons. A stale physical release cannot cancel another
   button on the newly committed route.
4. A physical release omitted from the event queue left capture latched.
   The screen now reconciles accepted button ownership with window focus and
   polled LWJGL buttons only in `updateScreen`, after queued input. Lost
   releases/focus cancel only owned buttons outside the viewport, preventing
   an accidental click on the previously pressed control. New presses, text
   and movement are rejected while the game window is inactive; fresh input
   resumes when focus returns. HUD input capture is canceled without erasing
   its still-current canvas geometry.
5. Retry detached the old helper without cleaning pointer ownership. Retry
   now cancels outside old controls and clears ownership before detach/park.
   This also prevents a still-live helper from interpreting retry cleanup as
   a click on the old control.

Each failure was observed in a disposable synthetic LWJGL-event test against
the old behavior before its fix. Pointer coordinate mapping is unchanged.

A follow-up review caught an important intermediate regression: performing
physical-button reconciliation while rendering could cancel a normal release
that was already polled but still queued for the next client tick. A real
`drawScreen` preamble test reproduced the premature outside up. Reconciliation
was removed from rendering; only the post-dispatch tick performs it. The test
also dispatches the queued normal up and checks that the original click completes.
The no-window harness fences off only the later expected GL-context failure.
No intermediate bundle containing that defect was installed.

## Fresh verification

- The actual `GuiScreen.handleMouseInput` path passed raw macOS Retina clicks,
  ACK loss between down/up, overlapping buttons, 32 held-press route
  transitions, stale-release isolation, resumed text forwarding and release
  before `SURFACE HIDE`. Polled lost releases and focus loss cancel outside;
  held presses are retained, late releases are suppressed, inactive new input
  is rejected and focus return resumes clicks/text. Retry cancellation
  precedes detach/park. Stale/unconfirmed/revoked input remains rejected.
- `harnessSystemScreens` and `harnessBridge` passed, including create-world
  native delegation/history, slow disconnect, connecting, kick and revisioned
  navigation contracts.
- A new actual-CEF harness passed six Singleplayer → Home → Multiplayer cycles,
  with pointer-activated Direct Connect/Add Server, exact typed address/name
  delivery and park/reveal of the same helper. Each cycle also proves that an
  outside cancellation does not activate the pressed Home button, while the
  next ordinary click on that exact button still works. This uses the production UI,
  real helper and real HTTP bridge with a disposable provider/catalog.
  No external server was contacted and no real account/world was modified.
- Client TypeScript and production build passed; Node contracts: 19 passed,
  zero failed. Rendered layout/input contracts passed at four viewport sizes,
  including the title-only header and existing focus/composer guards.
- Runtime `prepareRuntime verifyRuntimeArtifacts check` passed and rebuilt the JAR.
  Ordinary root unit-test tasks were up-to-date; drawable-ownership verification
  executed. The four scoped Client harnesses were executed fresh separately.
- Launcher Rust workspace: 95 passed; one official-network test intentionally
  ignored. Launcher frontend check/build and runtime staging passed.
- Tauri packaging with auto-install disabled, deep/strict signing and the
  file-only/Web-Surface bundle gate passed. Dirty work was preserved.

Automated events were confined to disposable/headless processes. No physical
mouse/keyboard, system clipboard, foreground activation or game launch was
performed. Synthetic release tests and CEF fixture tests are different layers;
neither is owner acceptance in a running Minecraft world.

## Built artifact identity

Client: `runtime/build/runtime/artifacts/opus-native-ui-1.8.9-0.1.0.jar`.

- Size: `10183304` bytes.
- SHA-1: `8746b498e22d69bd337495683015381f3d2120a3`.
- SHA-256: `eb4b290767324e091b3f3b87cb9b767139ae46ed68b7691ce35c0f7fbb6985ff`.
- JS: `index-Cr4eJxsJ.js`; CSS: `index-BDDfNfH4.css`.
- Launcher compile-time Client size/SHA-1 constants and unit assertions match
  these bytes. Other managed runtime artifacts are unchanged.
- Launcher JS/CSS remain `index-BQU0kJuq.js` / `index-Dnnlg-Nu.css`.
- Existing signature-verified CEF helper reused without native source changes.
  It was tested as a byte-exact independent app, consistent with production
  content-addressed staging; it was not executed directly inside the outer
  nested Launcher bundle.
- Final signed bundle Launcher executable SHA-256:
  `3efc4bb1477246488ad291883ca0e558968960a8a0019968575e08852b037243`.
- Four bundled JARs and both manifests equal the final Runtime build; all ZIP
  checks and all 22 UI entry comparisons passed. Compiled lifecycle methods are
  present in the packaged Client, not just the frontend preview.

## Open boundaries and owner acceptance

Java-side focus/polled-button reconciliation and retry cleanup are now included.
The focus query was substituted in a disposable JVM; no actual macOS focus
switch was performed. CEF cancellation was tested separately against the real
helper. These checks do not certify every physical lost-event condition, or
native fullscreen/resize stability.

The preceding full host-navigation suite's next-launch account-selection and
first-committed-Pause-raster failures remain open. The six-cycle scoped harness
does not replace or turn those failed contracts into a full-suite PASS. See
[previous delivery and failed contracts](OPUS_REMOVE_AMBIENT_DELIVERY_2026-10-03.md).

After the installed app is updated, the owner should start Minecraft from
that Launcher and repeat Singleplayer → Back → Multiplayer, Direct Connect,
Add Server and typing after several returns. Check that moving the pointer
without a held button no longer selects text. Physical fullscreen, live resize,
Pause over a real world and Launcher foreground startup remain separate checks.
