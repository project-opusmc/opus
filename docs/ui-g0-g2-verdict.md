# UI G0–G2 bounded execution verdict

Date: 2026-09-18
Execution contract: `docs/UI_G0_G2_EXECUTION.md`
Decision boundary: `docs/decisions/0008-opus-client-launcher-ui-first-mainline.md`

## Scope observed and preserved

This pass read the execution contract, Decision 0008, `ui-v2/HOME_SPEC.md`,
and the current UI, bridge, launcher, and Forge/CEF route sources before
changing `ui-v2`. It did not select a renderer, revive Elementa/OneConfig,
change Java/runtime/launcher/CEF/injector/packaging code, add a dependency,
run production packaging, or make a commit.

The worktree was already dirty. The starting inventory is recorded in
`docs/ui-g0-audit.md`. In particular, `launcher`, `runtime`,
`ui-v2/src/bridge/bridge.ts`, `ui-v2/src/bridge/types.ts`, the execution
contract, the Home specification, the helper script, and public brand assets
were pre-existing work and were left in place. `ui-v2/src/App.tsx` and
`ui-v2/src/styles.css` were already dirty candidate files; their scoped G2
refactor is the only implementation change made in this pass.

`ui-v2/dist/` is ignored build output (`ui-v2/.gitignore`); building the
browser fixture did not stage or modify a production package.

## Gate verdicts

| Gate | Verdict | Evidence |
| --- | --- | --- |
| G0 — repository/legacy UI audit | **PASS** | `docs/ui-g0-audit.md` maps the single normal-package CEF/web compositor path, route/state/input/data owners, legacy Svelte and Elementa/OneConfig lanes, packaging reintroduction risks, and current dirty state. There is no production-relevant UI owner left UNKNOWN. |
| G1 — product state/interaction contract | **PASS** | `docs/ui-g1-interaction-contract.md` defines all required semantic states, a renderer-independent graph, action/owner/failure/back tables, Java bridge mapping, RSHIFT/RCONTROL separation, and explicit later runtime dependencies. |
| G2 — interactive browser prototype | **PASS (browser fixture only)** | `ui-v2/src/App.tsx` and `ui-v2/src/styles.css` now provide a focused Minecraft-client Home and the required fixture-backed routes, selections, toggles, keyboard behavior, scrolling, and explicit development boundaries. Build, type, static, and local-browser smoke evidence passed below. |

None of these results is a claim of production-renderer selection, CEF/Forge
runtime readiness, Minecraft gameplay behavior, or in-game input evidence.

## G2 implementation result

- Home is a dedicated dark Minecraft-client surface with direct, stable
  `data-opus-home-action` controls for `singleplayer`, `multiplayer`,
  `client-settings`, `minecraft-settings`, `accounts`, and `quit`.
- The standalone fixture owns only local browser selections, module state, and
  prototype-only display settings. Hashes can deep-link or mirror fixture
  state, but do not replace Java navigation authority in an embedded client.
- Host-dependent commands (world launch, server connect, Minecraft Settings,
  and Quit) use an explicit development-boundary dialog in standalone mode;
  they do not emit a fake success, log-only result, or terminate the local
  development host.
- In host mode, the same controls retain the current typed bridge calls and
  use the existing revisioned navigation model; the implementation does not
  change bridge APIs.
- Module toggle is optimistic only while the bridge call is pending and rolls
  back with an inline error on rejection. Back/ESC use the fixture stack in
  standalone mode and the existing bridge action in host mode.

## Exact bounded checks

All commands below ran from the indicated working directory and exited `0`.
`npm run` exposes only `dev`, `build`, and `check`; the development server was
used for the browser-fixture record and both bounded validation scripts ran.

```text
cd ui-v2 && npm run build
```

Result: `tsc -b && vite build` passed; 18 modules transformed and the browser
bundle was produced. Vite retained `/api/v1/client/assets/title-background` as
a runtime-resolved URL, which is expected for the current bridge-served asset
and is not a build failure.

```text
cd ui-v2 && npm run check
```

Result: `tsc --noEmit` passed.

```text
git diff --check
```

Result: passed for tracked changes.

```text
cd ui-v2 && node --input-type=module -e 'import { readFileSync } from "node:fs"; const source = readFileSync("src/App.tsx", "utf8"); const start = source.indexOf("function Home("); const end = source.indexOf("\nfunction RouteHeader", start); if (start < 0 || end < 0) throw new Error("Home component boundary not found"); const home = source.slice(start, end); for (const id of ["singleplayer", "multiplayer", "client-settings", "minecraft-settings", "accounts", "quit"]) { if (!home.includes(`data-opus-home-action=\"${id}\"`)) throw new Error(`missing home action ${id}`); } for (const forbidden of ["Overview", "Command center", "Session", "Commands", "Module state", "Surface", "CEF", "SHM", "WEB V2", "generation scoped"]) { if (home.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`forbidden Home term: ${forbidden}`); } for (const marker of ["data-opus-server-id", "data-opus-back", "data-opus-settings-action=\"modules\"", "data-opus-module-id", "data-opus-module-detail", "data-opus-module-toggle"]) { if (!source.includes(marker)) throw new Error(`missing interaction marker ${marker}`); } console.log("ui-v2 static interaction contract: PASS");'
```

Result: passed. The assertion verified all six required Home identifiers,
rejected the forbidden Home terms from `HOME_SPEC.md`, and verified the
server/back/settings/module interaction markers in `src/App.tsx`.

```text
if rg -n '[[:blank:]]+$' docs/ui-g0-audit.md docs/ui-g1-interaction-contract.md docs/ui-g0-g2-verdict.md ui-v2/src/App.tsx ui-v2/src/styles.css; then exit 1; fi
```

Result: passed; the changed source and newly added evidence files have no
trailing whitespace.

```text
git diff -- ui-v2/package.json ui-v2/package-lock.json
git check-ignore -v ui-v2/dist/index.html
```

Result: no dependency-manifest change; `dist/` is confirmed ignored build
output.

## Browser-fixture smoke record

The Vite development server was exercised locally at
`http://127.0.0.1:5174/`. These are browser-only results.

| Check | Observed result |
| --- | --- |
| Home at `400x220` CSS viewport | All required Home controls remained available at the stated minimum supported size. |
| Home at `427x240` CSS viewport | All required controls remained visible and usable: account, wordmark, Singleplayer, Multiplayer, Client Settings, Minecraft Settings, version, and Quit. No dashboard shell or clipping was observed. |
| Home at `640x360` CSS viewport | The same launch hierarchy remained centered and all Home controls remained visible. |
| Home at `900x600` CSS viewport | Centered launch group remained compact and client-like rather than expanding into a landing page. |
| Required main path | `Home -> Multiplayer -> Hypixel selected -> Back -> Client Settings -> Modules -> Fireball Warning detail -> toggle -> Back` completed. The selected server enabled Connect; the module changed `Enabled`/`Disable module` to `Disabled`/`Enable module`, and the browser list then showed `OFF`. |
| Singleplayer | `Practice World` selection became selected and enabled its Play control. Choosing it opened the explicit `Launch world` development boundary; Escape dismissed it without a fake launch. |
| Accounts | The account control opened Accounts and the next-launch account selection visibly changed. |
| Minecraft Settings | The action opened the explicit Minecraft-owned development boundary; Escape returned to Home. |
| Quit | Quit opened the explicit development boundary stating that the browser preview remains running; Escape dismissed it. |
| Tab and activation | Actual Tab focus order was `Account -> Singleplayer -> Multiplayer -> Client Settings -> Minecraft Settings -> Quit`. Enter and Space activated the focused Account control and opened Accounts. |
| Back / ESC | Visible Back returned through the fixture stack; Escape returned Modules to Client Settings, Accounts to Home, and dismissed active development boundaries first. |
| Scroll | At `427x240`, the overflowing module list scrolled from Fireball Warning/Resource Intel to Resource Intel/Motion Analysis/Team Overlay, confirming a real scrollable content area. |
| Browser console | No prototype application error was observed. Reported warnings came from an installed browser extension content script, not the localhost Vite application. |

## Changed files for this pass

| Path | Change |
| --- | --- |
| `docs/ui-g0-audit.md` | Added G0 source, ownership, reachability, risk, dirty-state, and verdict record. |
| `docs/ui-g1-interaction-contract.md` | Added semantic state, action, failure, hotkey, and fixture/runtime-boundary contract. |
| `docs/ui-g0-g2-verdict.md` | Added this consolidated evidence and gate verdict. |
| `ui-v2/src/App.tsx` | Refactored presentation into explicit route/state/actions and fixture/host boundary behavior. |
| `ui-v2/src/styles.css` | Replaced dashboard-style presentation with the responsive Home and shared client-surface vocabulary. |

No files in Java runtime, launcher, CEF/native helper, injector, production
packaging, `ui-v2/src/bridge/`, or `ui-v2/src/bridge/types.ts` were changed by
this pass.

## Remaining blockers and non-claims

1. G2 has not exercised Forge, CEF, shared-memory frames, Java route history,
   or Minecraft input. It is not in-game evidence.
2. RCONTROL/Intelligence Overlay lacks a current runtime keybind, route,
   bridge command, and state/data owner. It is intentionally not aliased to
   RSHIFT.
3. Durable integrated persistence for Client Settings is not currently backed
   by a Java API; the browser fixture state is deliberately local.
4. The integrated bridge has no explicit browser route for selected-world,
   selected-server, or connecting semantic states. Minecraft continues to own
   loading and connection screens.
5. Production renderer selection and later CEF/Forge integration need a
   separate authorized gate with live evidence. They were not required or
   attempted here.

No G0–G2 stop condition was reached. The bounded browser foundation is ready
for review, while the listed runtime items remain outside this pass.
