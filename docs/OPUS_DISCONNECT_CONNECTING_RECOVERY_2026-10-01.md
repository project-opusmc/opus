# Disconnect and Connecting recovery — 2026-10-01

## Observed live evidence

The latest launcher session (`1790815329022-65668`) committed pause-menu revision 19. Its bridge reported `leaveWorld` timing out after two seconds; no subsequent title-route commit was logged. The existing timeout incorrectly returned success from the write facade even when the operation had not completed.

The later JVM crash occurred during shutdown. Its native stack contains the old OpenAL playback backend and a null instruction pointer. This does **not** establish that CEF caused the crash, or that this patch repairs the audio-library shutdown defect. There is no live blocked-thread dump from that session.

Inspection of the exact cached Forge/Minecraft bytecode shows that `Minecraft.runGameLoop` executes scheduled tasks while holding the `scheduledTasks` monitor. `NetworkManager.closeChannel` waits for a Netty close future. UI/native teardown callbacks that need to enqueue Minecraft work can therefore contend with the same monitor. The old bridge executed Disconnect and native Cancel inside that lock-held drain.

## Changes

- `ClientFrameTasks` dispatches bridge work on the Minecraft thread at client-tick/render-tick start, outside the vanilla scheduler monitor. It does not move game state, networking lifecycle delegates, or OpenGL work to a background thread.
- Route actions and typed reads/writes share the dispatcher. Tasks can be cancelled only before the client claims them. Claim and queue closure share a short lifecycle monitor; native work executes outside that monitor. A polled-but-not-started task cannot run after closure. Already-running native work is neither forcibly interrupted nor falsely marked cancelled.
- Typed writes that have started remain pending past the two-second diagnostic threshold until their real completion or shutdown. Reads and not-yet-started tasks retain bounded waits. Thus an executing Disconnect does not release React's single-flight guard merely because native teardown is slow.
- A failed or timed-out write no longer returns a successful completion through the bridge facade.
- Disconnect is a no-op after the world is already absent. Stage timing logs distinguish network close, world unload and title commit. A timed-out running operation logs Java stack frames only, not JVM arguments, credentials or packet data.
- Connecting no longer selects native UI immediately merely because the first CEF texture is absent. A changed framebuffer size/pixel scale starts a fresh bounded frame grace; unchanged geometry does not restart that timer indefinitely. The existing one-second stalled-surface fallback and immediate real-failure fallback remain available, including native Cancel.
- Connector-worker failures are correlated to their exact retained native `GuiConnecting`, discovered by field type rather than an obfuscated/synthetic field name. A late failure from A cannot overwrite B, even with a shared return parent. Constructor-before-install and Cancel/retry cases are covered; a connector failure with unknown origin is not attributed to the current connector.
- Pause Disconnect is single-flight. While its request is pending, the same liquid-glass row reads `Disconnecting…`, carries accessible busy state, and competing pause/navigation actions are disabled/guarded. No new product layout, colors or assets were introduced. This follows the targeted UI/UX Pro Max guidance to preserve transition continuity and provide honest loading feedback.

## Regression evidence

The following failures were observed before their fixes:

1. The actual bridge marshalling with a headless Minecraft instance placed its action inside vanilla's lock-held scheduled queue.
2. An actual `OpusClientScreen` in Connecting/STARTING selected its native fallback before receiving its first CEF frame.
3. Real headless CEF pause-menu input submitted two overlapping world-leave requests when Disconnect was clicked twice while the first response was delayed.

After implementation, all three passed. The scheduler test verifies client-thread ownership and that a simulated network-close callback can enqueue work through the real Minecraft scheduler while the UI action waits. It is not a live server teardown or a proof that native teardown is always bounded.

The previously held candidate was not installed. After the user's approval, the additional corrections exposed by review also followed observed RED → GREEN regressions:

1. The real controller's bridge boundary returned a failure while a modeled Disconnect was still executing after 2.3 seconds. It now retains pending state until the action completes and commits Home.
2. Connector A's late failure was accepted while B was current. Exact originating connector correlation now rejects A and accepts B, including shared-parent, immediate constructor failure, closed-session and Cancel/retry orderings. The real `GuiConnecting$1` origin test constructs its worker without starting networking.
3. A Connecting screen older than one second immediately selected native fallback after changing its viewport. Its grace now restarts for changed geometry, while true failure/stall fallback remains available.
4. A queued task already polled before queue closure could still run afterward. Closure/claim linearization now cancels that not-yet-started task; an already-claimed task retains its truthful result.

The real CEF host-navigation test delays its Disconnect provider for 3.2 seconds and clicks again after 2.2 seconds. It observes exactly one request, disabled busy pause controls, and eventual Home revision ACK. The provider models native teardown; this is not a real server/world leave. An optional screenshot initially caused an artificial duplicate because the old capture utility reloaded React; the harness now requests a committed frame without reloading. Production UI was not changed to accommodate that test issue.

Fresh checks on the integrated source:

```sh
# ui-v2
node --test test/*.test.mjs
npm run check

# runtime/legacy/1.8.9/client
OPUS_DISCONNECT_PENDING_PNG=/Users/zvwgvx/Project/Opus/.playwright-cli/disconnect-pending.png \
OPUS_SYSTEM_PNG_DIR=/Users/zvwgvx/Project/Opus/.playwright-cli/system-cef \
  bash ./gradlew --no-daemon harnessSystemScreens harnessBridge \
  harnessWebSurfaceHostNavigation harnessWebSurfaceInput harnessWebSurfaceLifecycleW7

# runtime
./gradlew --no-daemon test --rerun-tasks
./gradlew --no-daemon prepareRuntime verifyRuntimeArtifacts

# launcher
cargo test --workspace
# launcher/desktop
npm run check
# launcher
OPUS_AUTO_INSTALL=0 bash scripts/build-tauri-bundle.sh
```

All passed on the final corrected source: frontend 18/18; root Java tests 55/55, zero failures/errors/skips; all five client harnesses in 46.301 seconds. The CEF input harness exercises pointer input, Ctrl/Cmd editing and Unicode without using the user's physical mouse/keyboard. W7 passed 12 resize/DPR transitions, 20 park/show cycles, 60 rapid resize steps converging in 72 ms, and deliberate renderer-death/failure/recovery checks. Warm-show median/p95 were 49/100 ms at 854x480 CSS/DPR 1 and 35/57 ms at 427x240 CSS/DPR 2. These are headless CEF measurements, not Minecraft live resize/fullscreen acceptance.

The captured pending-Disconnect frame was inspected: `Disconnecting…` and disabled controls retain the existing liquid-glass layout, with transparent overlay background. Fresh root/runtime/launcher `git diff --check` checks passed. Expected legacy ForgeGradle, test Unsafe and deliberate failure-path diagnostics are not described as zero-warning output.

## Delivery status

`./gradlew --no-daemon prepareRuntime verifyRuntimeArtifacts` passed after a clean/reobfuscated client build. The UI JAR contains `ClientFrameTasks$FrameTask`, the exact-connector correlation method and the headless viewport boundary. Its `index-C0mUT5hO.js` and `index-BUkNonYC.css` entries were compared byte-for-byte with production `ui-v2/dist`.

The installed UI artifact's verified identity is SHA-1 `7ed2df78a26a3103ce69cccbbb3efec05e47af14`, 10,180,837 bytes, SHA-256 `51b4d88cabaa0db54cb0e60edd5ff34312822ce08d5e6c5d03c357315b9c5849`. Launcher UI pins and their test expectations match these bytes. Bootstrap/coremod/LWJGL hashes are unchanged from the preceding installed build. This supersedes the uninstalled held candidate with SHA-1 `fbe4af80355f1a7c89e686f6c062ba5d94ba5f93`.

Launcher TypeScript check and fresh `cargo test --workspace` passed: auth 14, engine 50, launcher 24, platform 6 tests (94 total). The existing official-Mojang-metadata network test is explicitly ignored and was not run. `OPUS_AUTO_INSTALL=0 bash scripts/build-tauri-bundle.sh` passed. The completed app passed deep/strict codesign, the file-only bundle gate, runtime launch-contract verification, and exact byte comparisons of both manifests and all four bundled JARs against `runtime/build/runtime`.

The existing CEF helper binary was exercised by the headless tests and staged into the bundle; its native source was not changed by this recovery. A fresh helper compilation is not claimed (the optional helper build skipped because its CEF distribution cache was absent).

**Installation completed after the corrective review and gates above.** The unlocked-console guard passed without password/Keychain interaction. The recoverable installer validated the staged replacement and found installed Opus processes idle before replacing `/Applications/Opus Launcher.app`. It did not terminate any unrelated JVM or affect worlds, accounts, settings, other Minecraft clients, or source-history builds.

The previous installation remains recoverable at:

`/Users/zvwgvx/.Trash/Opus Launcher backup.cGq291/Opus Launcher.app`

Fresh post-install checks passed: deep/strict codesign, file-only bundle gate, runtime launch contract, exact comparison of both manifests and all four installed JARs against the freshly generated runtime, and exact installed launcher executable comparison against the new release bundle. The installed-process guard was idle before reopening. `open -g -a '/Applications/Opus Launcher.app'` succeeded; the installed launcher process was observed at PID 8375. No game/server was automatically launched and no physical mouse/keyboard was controlled.

## Corrective review

The earlier independent review correctly held release for the three uncovered cases above; the user approved their bounded correction. The final independent source review of the corrected queue lifecycle, executing-write completion, connector origin and resize grace returned **GO: no critical or important blocker found** in that scope. The reviewer did not rerun the five-harness batch or claim live gameplay/package acceptance; those automated/package checks were performed by the main agent.

Minor review note: the two-second diagnostic threshold still emits one warning and up to 16 stack-frame warnings for an executing slow action. This was retained for the reported stall investigation; it no longer means that the write failed or was cancelled. No speculative logging/native/audio redesign was added.

No additional product layout, colors, assets, public API or renderer change was made in this approved correction.

## Remaining acceptance

User-driven tests on the updated launcher: join a real server, Esc → Disconnect; invalid connection → Cancel → retry; successful Connecting → terrain → world; real kick → Back. If Connecting has a separate layout defect, an image of the observed state is still needed to identify it precisely.

If Disconnect still stalls, inspect the new `Opus leave-world:` stage timings and `Opus stalled leaveWorld at` frames before attributing it to CEF or changing audio/native code. The OpenAL shutdown crash remains separately unverified.

No physical mouse/keyboard automation, Git commit, remote push, or editing of synced ChatGPT reference files was performed.
