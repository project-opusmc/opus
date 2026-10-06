# Native input and CEF system screens Implementation Plan

> **For agentic workers:** Use test-driven changes and independent native-input/frontend workers; the main agent implements the Minecraft lifecycle adapter and reviews integration.

**Goal:** Restore native GUI hit testing and present connection/loading/disconnect states through the existing CEF client.

**Architecture:** Normalize vanilla GUI mouse reads at the Retina boundary. Retain native system screens as lifecycle delegates inside the persistent Opus CEF host, and publish their state through revisioned navigation.

**Tech Stack:** Java 8, Forge 1.8.9, ASM, CEF OSR, React/TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-30-native-input-system-cef-design.md`

## Global Constraints

- Preserve existing dirty changes and the current design/assets.
- Keep CEF's logical mouse mapping and Minecraft's relative camera input unchanged.
- Minecraft owns connection lifecycle and actual error reasons.
- Do not use physical mouse/keyboard automation.
- No dependency additions, remote publishing or Git commits are required for this local update.

## Review Focus

- Retina native hover/click after resize and fullscreen must hit the displayed control.
- Cancel followed by a late connector response must retain Minecraft's native cancellation checks.
- Consecutive system states with the same route must reject stale bridge actions.
- CEF failure must preserve native system tick, cancellation and return behavior.
- Long/escaped server messages must display as text without overflowing or injecting markup.

### Task 1: Native input correction

**Files:** `runtime/legacy/1.8.9/patches` and `runtime/legacy/1.8.9/forge`, including tests.
**Produces:** Correct framebuffer coordinate reads only for vanilla GUI consumers.

- [x] Add regression coverage for scale 2 hover/click/list coordinates.
- [x] Implement the normalization and transformer registration.
- [x] Run patches/forge tests and inspect unscaled/non-Mac behavior.

**Evidence:** The main agent reran both complete test tasks with `--rerun-tasks`; all passed. CEF/custom screens, relative camera deltas, wheel input, non-Mac and scale-1 input remain outside the normalization. Native physical hover/click acceptance is still user-driven.

### Task 2: Minecraft system lifecycle bridge

**Files:** Client `NativeSystemScreenSession`, `interop/ConnectionUiState`, `OpusClientScreen`, `ClientOverlayController`, `UiRoute`, `UiNavigationManager`; system-screen harness and Gradle task.
**Produces:** Host `connection` route with immutable state, native delegate ticking, one-shot primary action and retained CEF transitions.

- [x] Run a failing system-screen harness for missing lifecycle/payload behavior.
- [x] Implement native initialization/tick/action/close and revisioned state serialization.
- [x] Reuse existing CEF screens for system transitions and returns; preserve native fallback.
- [x] Run system, bridge and navigation harnesses.

**Verified:** System, bridge, actual CEF host-navigation, input and W7 lifecycle harnesses all passed. Red/green regressions cover deferred network failures, early constructor failures, one-shot cancellation, exact native Settings root ownership, and rendered-revision actions. The real vanilla terrain delegate sent two keep-alive packets over 40 ticks. Packaging is tracked separately below.

### Task 3: CEF connection surface

**Files:** `ui-v2/src` and relevant frontend tests.
**Consumes:** `NavigationState.connection` and revision-checked `bridge.back(renderedRevision)`.

- [x] Add route acceptance and behavioral tests for status/cancel safety.
- [x] Implement neutral liquid glass connection, loading and disconnected states.
- [x] Run typecheck/build/tests and inspect rendered wide/narrow states.

**Evidence:** 18 frontend tests passed; TypeScript check and production build passed. Actual CEF renders and Cancel/Back dispatch passed at 427x240 CSS/DPR 2; a 1280x720 CSS/DPR 1 frame was also captured and visually inspected. No physical input automation was used.

### Task 4: Package and local handoff

**Files:** Runtime artifact output, existing launcher bundle/install pipeline; documentation status.

- [x] Review integrated changes and correct concrete findings.
- [x] Build/verify runtime and CEF navigation; package launcher with the fresh runtime.
- [x] Install the verified bundle through the recoverable app replacement script.
- [x] Record exact automated results and remaining user-driven acceptance.

**Review corrections:** Reject late connector failures after Cancel without losing errors raised before delegate installation; send the committed-render revision instead of fetching a newer revision before acting; retain the exact explicitly opened `GuiOptions` instance across Video Settings/Controls returns.

**Handoff:** Runtime verification and the signed Tauri app build passed. Launcher artifact pins were updated from the exact verified coremod/UI bytes; the launch-contract verifier and 50 engine tests passed. After an initial locked-console refusal, the user's follow-up installation request completed with the console unlocked. The old installed app was moved to Trash; the new `/Applications/Opus Launcher.app` passed fresh installed artifact, exact byte, executable, codesign and file-only checks and was reopened in the background. Physical game/fullscreen acceptance is still user-driven; see `docs/OPUS_NATIVE_INPUT_SYSTEM_CEF_2026-10-01.md` for evidence and that boundary.
