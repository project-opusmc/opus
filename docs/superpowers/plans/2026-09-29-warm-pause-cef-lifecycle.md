# Warm Pause CEF Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reopen the in-game Opus pause menu without launching a new CEF helper on every Esc, while keeping hidden-browser paint and video work off the gameplay path.

**Architecture:** Keep the existing `OpusWebViewClient` process in `ClientOverlayController`, but give each visible `OpusClientScreen` a revocable lease. A `SURFACE HIDE|SHOW` helper command parks/unparks windowless CEF; React treats the existing Java navigation `none` state as inactive and pauses media. Only a current-generation frame enables input.

**Tech Stack:** Java 8/Forge 1.8.9, LWJGL, macOS CEF 144 OSR helper (Objective-C++), React 19/TypeScript, Gradle, Tauri/Rust Launcher.

**Spec:** `docs/superpowers/specs/2026-09-29-warm-pause-cef-lifecycle-design.md`

## Global Constraints

- Preserve Decision 0008: this improves the current CEF implementation, not renderer selection or the Launcher/Runtime artifact contract.
- Keep the existing three-slot shared-memory/generation protocol and Java-owned `uiNavigationChanged`/ACK authority; do not introduce a second menu compositor.
- Hidden CEF must stop continuous `OnPaint`; background video must pause. No browser input is accepted while parked or before a current frame is uploaded.
- Show a text-free neutral lifecycle scrim for at most the first **180 ms** of a normal wait; show explicit failure immediately.
- Run at least **20** park/show cycles at standard and Retina DPR; record median and p95. Warm 854×480 logical-pixel target: **p95 ≤150 ms**. Record idle CPU/RAM delta and no sustained paint stream during a 10-second park.
- The user retains physical mouse/keyboard control. Automated harness, package checks, installed state, and user-visible game acceptance are separate claims.
- Preserve the current dirty `runtime`, `launcher`, and `ui-v2` work. Before each edit capture path-level diffs; stage/commit only owned hunks. If a touched file contains pre-existing edits that cannot be isolated in the index, leave the task uncommitted and report that rather than sweeping user changes into a commit.

## Review Focus

1. Rapid Esc close/reopen before the first paint must not expose a stale clickable frame — Task 1 W7/W4 tests, Task 2 screen gate.
2. An old `OpusClientScreen` closing after a new lease attaches must not hide the new screen — Task 2 lease test.
3. A helper dying while parked or visible must fail closed and retry off the render thread — Task 1 W7 death test, Task 2 retry-thread verification and installed-session log.
4. A resize/DPR/fullscreen change while parked must deliver current geometry before accepting input — Task 1 W7 resize test.
5. Revision 0 `none`, later close, and same-hash `game_menu` reopen must pause/resume video, clear transient UI, and ACK the new revision — Task 3 Node and host-CEF tests.

## File ownership map

- CEF transport: `runtime/legacy/1.8.9/client/native/opus-cef-helper/src/opus_main.mm` handles helper visibility; `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/embed/OpusWebViewClient.java` owns wire commands and frame slots.
- Java host: `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/ClientOverlayController.java` owns the persistent helper; `OpusClientScreen.java` owns one visible lease and GL texture. New small `EmbeddedSurfaceLeaseState.java` and `UiLifecycleShellPolicy.java` keep ownership and loading timing testable.
- Web: `ui-v2/src/bridge/types.ts` describes `none`; `ui-v2/src/surfaceSession.ts` classifies host session/media activity; `ui-v2/src/App.tsx` applies it and pauses/resumes the video.
- Verification: existing `W7LifecycleHarness.java`, `W4InputHarness.java`, `HostNavigationAckHarness.java`, plus new `ui-v2/test/surfaceSession.test.mjs`.

---

### Task 1: Suspend and resume the real CEF transport

**Files:**
- Modify: `runtime/legacy/1.8.9/client/native/opus-cef-helper/src/opus_main.mm`
- Modify: `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/embed/OpusWebViewClient.java`
- Test: `runtime/legacy/1.8.9/client/preview/harness/W7LifecycleHarness.java`, `W4InputHarness.java`

**Interfaces:**
- Produces: `public void setSurfaceVisible(boolean visible)` and `public boolean isSurfaceVisible()` on `OpusWebViewClient`.
- Wire: idempotent `SURFACE HIDE` and `SURFACE SHOW`; helper applies on CEF UI thread and remembers the state before `OnAfterCreated`.

- [ ] **Step 1: Write failing CEF tests.** In W7, after an initial frame, hide for 10 seconds and assert the same helper PID stays alive, no new frames arrive, no shared slot remains owned; show and await a fresh current frame. Repeat 20 times across 854×480@1x and 427×240@2x, including a resize while hidden; print median/p95. In W4, click while hidden and assert the DOM color does not change, then show and assert the next click does.
- [ ] **Step 2: Verify red.** Run `runtime/web-surface-v2/scripts/run-w7-lifecycle.sh` and `runtime/web-surface-v2/scripts/run-w4-cef-input-oracle.sh`; expect compilation failure for the absent `setSurfaceVisible` API, not an unrelated setup failure.
- [ ] **Step 3: Implement the interface.** `setSurfaceVisible(false)` releases `latest`, sends `SURFACE HIDE`, and suppresses Java input; `true` sends `SURFACE SHOW`. In the helper, `HIDE` removes focus and calls `WasHidden(true)`; `SHOW` calls `WasHidden(false)`, restores focus, and invalidates `PET_VIEW`. Gate late `OnPaint` and `INPUT` while hidden; preserve generation/resize checks and explicit `stop()` behavior.
- [ ] **Step 4: Verify green.** Re-run both scripts. Record 20-cycle latency and parked paint counts; a p95 miss remains an open performance failure even if functional assertions pass.
- [ ] **Step 5: Review/commit the owned patch.** Diff these exact files against their pre-task snapshots and run `git diff --check` in `runtime`. Commit only isolatable owned hunks; do not include pre-existing native/Java edits.

### Task 2: Keep one helper across Minecraft screen lifetimes

**Files:**
- Create: `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/EmbeddedSurfaceLeaseState.java`
- Create: `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/UiLifecycleShellPolicy.java`
- Modify: `runtime/legacy/1.8.9/client/src/main/java/org/polydevs/opusmc/client/ClientOverlayController.java`, `OpusClientScreen.java`
- Test: `runtime/legacy/1.8.9/client/preview/harness/W7LifecycleHarness.java`

**Interfaces:**
- Consumes: `OpusWebViewClient.setSurfaceVisible(boolean)` from Task 1.
- Produces: package-private `EmbeddedSurfaceLeaseState.attach(): long`, `detach(long id): boolean`, `isCurrent(long id): boolean`, `clear(): void`; `UiLifecycleShellPolicy.showText(long elapsedMillis, boolean failed): boolean` with the 180 ms boundary. Controller adds `claimEmbeddedWebView(OpusWebViewClient view): long` and replaces release with `releaseEmbeddedWebView(OpusWebViewClient view, long leaseId): void`.

- [ ] **Step 1: Write failing host tests.** Extend W7 to assert lease A → lease B → release A returns false and B remains current; release B returns true; `clear()` invalidates both. Assert loading text is hidden at 179 ms, shown at 180 ms, and failure text immediate.
- [ ] **Step 2: Verify red.** Run `runtime/web-surface-v2/scripts/run-w7-lifecycle.sh`; expect absent lease/policy symbols or the pre-existing close-to-stop behavior, not a CEF setup error.
- [ ] **Step 3: Implement one-owner lifecycle.** Boot prewarm parks the helper when no screen owns it. `OpusClientScreen` acquires and stores a lease ID, claims/show after the route/viewport update, and releases only that ID on close while disposing its own GL texture. The controller parks instead of stopping on the current lease's release, ignores stale releases, and stops on shutdown/explicit failure. An explicit retry reuses the background prewarm worker; no draw-loop or render-thread process start. Apply `UiLifecycleShellPolicy` at the screen's first pending frame, not per resize step.
- [ ] **Step 4: Verify green.** Re-run W7 and `runtime/web-surface-v2/scripts/run-w6.sh` (production compile/route/input gate). Inspect the retry path to confirm `prewarmEmbeddedWebView()` owns process startup; leave the actual screen handoff and thread-name log check for installed-game acceptance.
- [ ] **Step 5: Review/commit the owned patch.** Check only the four host files and W7 additions. Commit new files and cleanly isolatable owned hunks; leave overlapping dirty-file edits uncommitted.

### Task 3: Make the hidden React session truly idle

**Files:**
- Create: `ui-v2/src/surfaceSession.ts`, `ui-v2/test/surfaceSession.test.mjs`
- Modify: `ui-v2/src/bridge/types.ts`, `ui-v2/src/App.tsx`
- Test: `runtime/legacy/1.8.9/client/preview/harness/HostNavigationAckHarness.java`

**Interfaces:**
- Consumes: the existing `NavigationState.revision/current` and `uiNavigationChanged` close/open broadcast; no new bridge endpoint.
- Produces: `classifyHostNavigation(state: NavigationState, lastRevision: number)` returning `ignored | closed | route`; `shouldPlayAmbientVideo(active: boolean, pageVisible: boolean, reducedMotion: boolean): boolean`; `syncAmbientVideo(video: HTMLVideoElement, shouldPlay: boolean): void` for the actual `pause()`/`play()` call. `NavigationState.current` includes `{ id: "none" }`.

- [ ] **Step 1: Write failing tests.** Node tests assert revision 0/`none` and later `none` classify as closed, an older response is ignored, same-hash `game_menu` with a new revision classifies as route/ACK, and `syncAmbientVideo(video, shouldPlayAmbientVideo(...))` pauses a test video whenever inactive, hidden, or reduced-motion. Extend HostNavigationAckHarness with close → open `game_menu` → close → reopen the same URL and assert both revisions ACK and current CEF frames arrive.
- [ ] **Step 2: Verify red.** Run `node --test ui-v2/test/surfaceSession.test.mjs`; expect missing module/functions. The host harness is also a regression guard and may already pass before the frontend change; do not mislabel that as red evidence.
- [ ] **Step 3: Implement frontend reconciliation.** `App` processes `none` without replacing it with a visual route, sets surface inactive, and clears modal/error state; committed routes reactivate and ACK their revision even if the hash is unchanged. `AmbientVideoBackdrop` receives `active`, pauses its video whenever `shouldPlayAmbientVideo` is false, and resumes safely without an unhandled rejected `play()` promise. Remove unconditional mount autoplay.
- [ ] **Step 4: Verify green.** Re-run the Node test, `npm --prefix ui-v2 run check`, `npm --prefix ui-v2 run build`, and `runtime/web-surface-v2/scripts/run-w6.sh`. Inspect `video.paused` in a browser preview and verify the fresh route in the real CEF harness. Verify actual CEF media suspension with a scoped diagnostic probe or CEF DevTools before accepting hidden-idle behavior; if neither is available, keep this acceptance item open and report the gap.
- [ ] **Step 5: Review/commit the owned patch.** Stage only new files and separable additions in the already-dirty `App.tsx`/`types.ts` and host harness; otherwise leave overlaps uncommitted and report them.

## Integration, packaging, and owner acceptance

- [ ] Run `runtime/web-surface-v2/scripts/run-w4-cef-input-oracle.sh`, `run-w6.sh`, and `run-w7-lifecycle.sh` from the repository root with their full paths. Record functional results separately from 20-cycle latency and 10-second hidden idle measurements.
- [ ] From `runtime/`, run `./gradlew --no-daemon prepareRuntime verifyRuntimeArtifacts`. Hash `runtime/build/bootstrap/opus-native-ui-1.8.9-0.1.0.jar` with `shasum -a 1` and `stat -f %z`; update only `launcher/crates/engine/src/forge.rs` pinned SHA-1/size if the rebuilt JAR differs.
- [ ] From `launcher/`, run `cargo test -p opus-engine` and `cargo test -p opus-launcher --lib`. Build without auto-install using `OPUS_AUTO_INSTALL=0 launcher/scripts/build-tauri-bundle.sh`; run `node launcher/scripts/verify-runtime-launch-contract.mjs`, `launcher/scripts/assert-file-only-bundle.sh` on the staged app, and `codesign --verify --deep --strict` on it. Compare staged/runtime JAR bytes.
- [ ] Inspect `launcher/scripts/opus-process-guard.sh status`, then use the scoped `launcher/scripts/install-opus-launcher.sh` to stop/reinstall only the installed Opus app. Confirm `/Applications/Opus Launcher.app` matches the verified bundle and retain the recoverable backup path. Do not control the owner's mouse/keyboard.
- [ ] Ask the owner to launch the installed client and test first/repeated Esc, clicks, resize/fullscreen, and gameplay FPS. Report automated, bundled, installed, and live-tested status separately. A source/build PASS alone is not completion.
