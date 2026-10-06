# Launcher full-window layout — 2026-10-02

## Delivered artifact

The approved window-layout fix is built and installed in the real application:
`/Applications/Opus Launcher.app`.

Installed executable SHA-256:
`365251824795388e9af6249d5c7c65ad9637b97fea135bd3247bc73ca90b662a`.

Production frontend assets: `index-L7jAKWQ8.js`, `index-DPkoCyXK.css`.
The installed executable equals the verified release-bundle executable byte for
byte. The installed app was reopened in the background; PID 53722 was observed
running from the installed path after two minutes.

Read-only inspection of the installed native window subsequently showed the
actual `tauri://localhost` UI: full-width Home, media left, launch/account/Play
right, compact readiness and sessions below, selected IGN `zvwgvx`, and zero
running instances. The initial passive capture during the earlier intermediate
startup showed blank content; it is not counted as successful UI verification.
The final build's accessibility tree and window image both displayed the UI.
No native clicks, keyboard input, resize drags or game launch were performed.

## Approved scope and implementation

Preserve the existing matte zinc palette, top navigation, logo/media, stack,
account identities and callbacks. Replace the centered document-style layout with
an application workspace that uses the window's width and available height.

- Header and body no longer have 1240px/960px maximum-width caps.
- Body has a consistent 16px gutter and fills the remaining window height.
- Each destination owns a keyed scroll viewport. Settings scroll position cannot
  hide Home's heading, and reentering a destination starts at its top.
- Home's media/workspace grows vertically with the window. The launch column is
  bounded between 320px and 400px; its account control and 44px primary action
  stay inside that workspace.
- Verbose verified bundle paths are replaced by a concise Home status. The full
  diagnostic remains available in Installation and the Home status tooltip.
- Readiness and active sessions use a compact lower strip. Only the session list
  scrolls for multiple sessions; it retains the actual Stop callback/session ID.
- A 330px middle-row floor prevents stacked notice+busy/error banners from
  compressing Play behind the card's overflow clipping. Exceptional long state
  content can scroll inside the destination, not behind the fixed header. A local
  launch-panel overflow fallback keeps enlarged content reachable.
- The session scroller has an authored inset keyboard focus indicator.

Source changes are limited to the existing Launcher frontend and rendered
regression contracts. No Client UI, runtime renderer, authentication backend,
artifact-role contract, dependency or window minimum was changed in this fix.
Existing dirty work was preserved; no commit, branch change or push was made.

## Reproduction and fresh verification

Before implementation, the rendered regression failed all six original cases:
the body stayed at 960px, the header at 1240px, media at 280px, and a retained
Settings scroll of 120px moved the Home heading to y=2 behind the header.

Read-only review later identified stacked banners as another valid clipping
case. A real App/isolated native-IPC fixture reproduced notice+busy and
notice+error with Play's center failing hit testing. These cases passed after
the middle-row floor and local overflow fallback were applied.

| Rendered viewport / state | Result |
| --- | --- |
| 980×650, 1220×760, 1440×900, 1920×1080 ready Home | Full-window geometry, visible/hittable 44px Play, no Home or shared-body scroll |
| 980×622 content area (650px window/title-bar allowance) | Home fits; Play remains visible/hittable |
| Scrolled Settings → Home → Settings | Headings remain below navigation; scroll does not leak between destinations |
| 980×650, nine case-distinct accounts, eight sessions | Correct selector/running guard/launch payload; session list scrolls locally; final Stop reaches the correct isolated session |
| Notice + busy, notice + error; missing setup; unavailable service/retry | Primary action remains accessible; busy/unavailable guards are preserved |
| 820×760, reduced motion, keyboard focus | No document horizontal overflow; poster instead of playback; visible focus |

Fresh checks:

- Launcher TypeScript and production build: PASS.
- Window geometry regression: PASS, 7 checks.
- Window state regression: PASS, 5 checks, including stacked banners and natural
  Tab navigation into the session scroller.
- Existing rendered visual/interaction contract: PASS, 14 checks.
- Literal IGN contract: PASS, 4 checks across five case-distinct names.
- Rust engine/Launcher unit tests: PASS, 50 + 25.
- Release bundle build, strict/deep code signature, file-only bundle gate and
  runtime-launch-contract checks: PASS.
- Post-install signature, bundle gate, launch contract, executable identity and
  all four runtime-artifact byte comparisons: PASS.
- Whitespace/diff check: PASS.

Browser fixtures run the real App and UI while replacing only native IPC and,
for the isolated Stop action, the external confirmation dialog. No real account,
credential, clipboard or game process is used by those fixtures. Browser
confirmation/native key behavior is not claimed from that test.

Preview artifacts (illustrative browser data, not the user's native catalog):

- `output/playwright/ranked/launcher-window-layout.png` — 1220×760 Home.
- `output/playwright/ranked/launcher-window-states.png` — minimum-size account and
  session fixture.

## Runtime preservation and recovery

All four installed JARs equal the already-verified runtime build. The Client JAR
remains SHA-256
`ccfa52b14d96234a95c37e8c85d52d4ddaee449e360b747873b3673c9ca09e7f`;
it was not rebuilt or silently replaced by another Client version in this
Launcher-only change. Existing CEF-helper binary/source limitations remain.

The pre-layout installed application was moved recoverably to:
`/Users/zvwgvx/.Trash/Opus Launcher backup.xUkAxv/Opus Launcher.app`.
Its executable hash was verified as
`6cb09d3e45c9449847384540441ae6e8d3fedb9c6c4f228cd8c30828b55989c1`.

The intermediate layout package before the stacked-banner follow-up was also
retained at:
`/Users/zvwgvx/.Trash/Opus Launcher backup.8Nmhex/Opus Launcher.app`.
Its executable hash was verified as
`a8cd7a849794b0a71186900fcc313bb03d83fde8606bdc159c1faafa4b8f3e47`.

The installer used verified temporary stages and stopped only the identified
installed Launcher processes. No active Opus game was present in those checks;
no worlds/accounts or unrelated applications were removed or stopped. The older
backup documented in the earlier installation record was left intact.

## Acceptance boundaries

The actual installed Home was visually inspected read-only. Physical native
clicks/keys, continuous window-resize smoothness and the game's fullscreen,
connection/disconnect and Pause behavior still require owner acceptance. This
layout delivery is not a fix claim for those historical runtime issues.
