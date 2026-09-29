# Warm CEF lifecycle for the in-game pause menu

Status: accepted by owner, 2026-09-29

## Intent and scope

Pressing Esc in a running Minecraft world should reveal the Opus pause menu without restarting Chromium or flashing a loading message on every open. The renderer may use more RAM while gameplay is active, but must not continuously paint the hidden UI or decode its background video. This change is limited to the existing Forge 1.8.9 + CEF client surface; it does not select a new renderer, change the Launcher/Runtime artifact contract, or redesign unrelated screens. Decision 0008 remains the product authority.

The owner has approved keeping CEF warm while playing, provided the hidden renderer is suspended and its gameplay cost is measured. The owner retains mouse and keyboard control during live acceptance.

## Evidence and root cause

`OpusClientScreen.onGuiClosed()` calls `ClientOverlayController.releaseEmbeddedWebView()`, which immediately calls `OpusWebViewClient.stop()`. The next `GuiIngameMenu` interception creates a new `OpusClientScreen`; its first draw cannot use a browser frame and displays `Starting OPUS UI / Loading the embedded interface`. In the 2026-09-27 installed-session log, the helper closed after entering gameplay, and each later Esc created another helper, loaded `#/game_menu`, and only then produced its first frame. This is a lifecycle restart, not merely an unattractive loading label.

## Chosen approach

The controller owns one CEF helper for the game process. A product screen temporarily leases its visible surface. Closing a screen parks the helper; it does not destroy Chromium. Parking hides the windowless browser with `CefBrowserHost::WasHidden(true)`, drops/release any unconsumed shared-memory frame, disables browser input, and relinquishes focus. The pinned CEF header documents that layout and `OnPaint` notifications stop while hidden. Opening a product screen attaches a new lease, updates route/viewport, calls `WasHidden(false)`, and requests a fresh paint. The helper stops only on game shutdown or an explicit failure/retry path.

The existing `uiNavigationChanged` close/open revisions are authoritative for the React UI. On `none`, React marks the surface inactive, pauses the background video, and clears transient modal/error state without inventing a second route. On a committed route, it resumes the video only when the surface is visible and the user has not requested reduced motion. React must ACK the new revision even when the fragment is unchanged (`game_menu` to `game_menu` across two pause sessions).

The first screen frame remains gated by the current CEF generation and viewport dimensions. Old title/pause frames must never be uploaded as a current menu or receive input. A new pause screen may show a neutral in-game scrim while the fresh frame is pending; the textual loading shell appears only after 180 ms, or immediately for an explicit failure. This avoids a one-frame loading flash without pretending the menu is interactive before it is ready.

## Lifecycle contract

| State | Browser | Paint/media | Input | Exit |
| --- | --- | --- | --- | --- |
| Warming | Starting once in background | Initial route may load | None | Visible, Parked, or Failed |
| Visible | One current screen lease | Current-generation paint and media allowed | Only after its frame is uploaded | Parked, Failed, or Stopped |
| Parked | Same helper and socket remain alive | `WasHidden(true)`; no continuous paint; video paused | None | Visible, Failed, or Stopped |
| Failed | Dead/invalid helper is not restarted in a draw loop | None | None | Explicit retry or shutdown |
| Stopped | Process, socket, mapping, and CEF children released | None | None | Terminal for this game process |

The controller tracks a monotonically increasing screen lease ID. Closing an older screen cannot park or stop a helper already leased by a newer screen. `OpusClientScreen` continues disposing its own GL texture and clearing pointer ownership on close; the controller retains only the browser process and transport. `shutdown()` remains the sole normal-process stop. A system-owned Minecraft screen also parks CEF. A forced helper death clears the lease and enters the existing failed shell; retry creates one fresh helper, not an automatic start loop.

The Java-to-helper control protocol gains an idempotent visibility command. The native helper applies it on the CEF UI thread: hide releases focus and calls `WasHidden(true)`; show calls `WasHidden(false)`, updates focus only for the visible product screen, and invalidates `PET_VIEW`. `VIEW`/generation updates continue to coalesce as today. Input is rejected both before a current frame is uploaded in Java and while parked in the helper. Shared-memory slots are released on park so a later paint cannot deadlock waiting for a stale owner.

## Rejected approaches

- A cached pause screenshot would look immediate but could display obsolete server/world state and cannot be safely clicked until a fresh frame arrives.
- Merely delaying or removing the loading text would disguise the restart while preserving the latency.
- Keeping CEF visibly rendering during gameplay would save startup time at the cost of ongoing paint/video work and is not acceptable.

## Verification and acceptance

1. Add a failing lifecycle regression test before implementation: title → gameplay park → pause show → resume park → pause show, including same-URL reopen and an older-screen release. Assert one helper start, fresh current-generation frames, valid route ACKs, no input while parked, and no leaked shared-memory slots.
2. Exercise the real CEF helper for at least 20 park/show cycles at standard and Retina DPR. Count paints during a 10-second parked interval, verify video is paused, and record Esc-equivalent show-to-first-current-frame latency (median and p95). The warm-path target at 854×480 logical pixels is p95 ≤150 ms; a miss is a performance issue to investigate, not a reason to conceal the wait.
3. Kill the helper while parked and while visible. Both cases must enter an explicit failed state and recover only through retry; no render-thread process start, stale-frame click, or crash is acceptable. Repeat after resize/fullscreen geometry changes.
4. Run the existing CEF input, React navigation/ACK, resize, runtime-artifact, Launcher contract, and signing checks. Build and install only after these pass, preserving the prior installed app for rollback.
5. Report separately: automated CEF contract, packaged artifact, installed artifact, and actual game-window acceptance. Source tests or a successful build do not prove the owner-visible Esc latency, FPS, fullscreen, or physical input. The owner will perform the foreground mouse/keyboard check; collect sanitized timestamps and idle CPU/FPS evidence without taking their controls.

Idle acceptance requires no sustained `OnPaint` stream while parked and a recorded memory/CPU delta versus the current close-on-gameplay behavior. The first warm Esc must avoid a visible text flash in the normal path. If the measured idle cost or warm-open latency misses the target, the change is not reported as complete; the implementation plan must revisit suspension or rendering costs.
