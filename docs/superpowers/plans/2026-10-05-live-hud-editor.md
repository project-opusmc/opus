# Live HUD editor implementation plan

> **For agentic workers:** Use test-driven development and inline execution, with one disjoint native Keystrokes worker and a final independent review. No commits or foreground input are authorized by this task.

**Goal:** RShift opens a full-game HUD editor for actual FPS and Keystrokes, with a central Opus mark and Mods button.

**Architecture:** Minecraft renders the live widgets and owns their drag/resize capture. React/CEF renders only editor chrome, reporting logical viewport and interactive exclusions to the current native navigation revision. Existing module persistence, route history, release cancellation and CEF lease/ACK checks remain authoritative.

**Tech stack:** Minecraft 1.8.9 / Java 8, React / TypeScript, CEF OSR.

**Spec:** Human-approved conversation: keep the game background unchanged and **not blurred**; drag/resize, X disables without deleting data, gear opens that module; Escape returns from Settings to editor, then to gameplay. No emotes/cosmetics or copied Lunar branding.

## Global constraints

- Preserve the approved aperture Opus logo and monochrome style.
- Do not reset existing FPS/Armor preferences. New Keystrokes is opt-in.
- Preserve Pause blur, Retina logical input mapping and current-frame input guards.
- Preserve unrelated dirty work; synced ChatGPT sources remain read-only.
- Never control physical input or launch the game for automated checks.
- Retain the installed app recoverably before replacing it; distinguish packaged/installed from manual acceptance.

## Review focus

- A HUD widget under a CEF button must not steal that button's click.
- Closing/revising/resizing a held gesture must cancel its preview and never leave a browser drag.
- Rebound or unavailable keys must not show stale/fabricated pressed states.
- Narrow/short viewports must retain the Mods/Done controls without scrolling or an opaque backdrop.
- Failed persistence must not be presented as saved; unknown settings must survive updates.

### Task 1: Native widget and settings

**Files:** New `KeystrokesSettings.java`, `KeystrokesModule.java` and focused test harness under the legacy client; modify `UtilitySettingsStore.java` and `ClientOverlayController.java`.
**Interface:** Store exposes `keystrokes`, `updateKeystrokes`, `previewKeystrokes`, `persistKeystrokes`, `cancelKeystrokesPreview`; module implements the existing `ClientModule`/`HudWidget` boundary.

- [x] Write/run RED tests for live/rebound keys, persistence, preview cancellation and existing/unknown preference preservation.
- [x] Implement native Keystrokes and register genuine settings; FPS retains `Minecraft.getDebugFPS()`.
- [x] Run native harnesses GREEN without a display or OS input.

### Task 2: Full-viewport editor and input ownership

**Files:** New `HudEditor.tsx`/CSS and rendered browser contract; modify App routing, bridge types, native HUD/screen and bridge region validation.
**Interface:** Current-revision HUD canvas report includes optional bounded `exclusions` rectangles for CEF chrome, compatible with old providers. RShift root is `hud_editor` with HOTKEY entry point.

- [x] Write/run RED tests for full viewport/no blur, central button routing, real widget drag/resize/X/gear, stale region rejection and balanced capture.
- [x] Implement editor chrome and transparent canvas; keep CEF visually and interactively above widgets; show every enabled widget outline immediately.
- [x] Verify native editor → module → editor → gameplay and responsive rendered geometry GREEN.

### Task 3: Verified app delivery

**Files:** Updated runtime artifact pin in launcher and dated build receipt.

- [x] Run UI checks, native/CEF harnesses, runtime verification and launcher tests; review scoped patch (independent reviewer unavailable; documented author self-review).
- [x] Build fresh artifact, pin exact size/hash, build signed launcher without auto-install; freeze source inputs during packaging.
- [x] Verify every bundled JAR/manifest/frontend asset, signatures and launch contract.
- [x] Install only with console unlocked and installed game/app idle; keep previous app in Trash; verify installed bytes again.
- [x] Document evidence and manual game acceptance limits; no claim that a synthetic check is a physical test.

## Execution record

- Approved no-blur editor design; bounded execution continues without another preference prompt.
- Existing checkout reused: its uncommitted UI/runtime state is the active product baseline and must not be replaced by a clean branch.
- Delivery complete: `/Applications/Opus Launcher.app`, client SHA-1 `5aafebecde0d41fc182697db588bc3739e8422ef`, recoverable old app in `/Users/zvwgvx/.Trash/Opus Launcher backup.IVaYEJ/Opus Launcher.app`.
- Evidence and review/manual limits: `docs/OPUS_LIVE_HUD_EDITOR_2026-10-05.md`.
