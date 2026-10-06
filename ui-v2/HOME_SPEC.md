# Opus Minecraft Home — V3 Product Specification

> Visual update — 2026-10-01: the owner requested a rankedbw.com-inspired
> redesign for both Client and Launcher. The current implementation and
> verification are recorded in
> [OPUS_RANKED_UI_REDESIGN_2026-10-01.md](../docs/OPUS_RANKED_UI_REDESIGN_2026-10-01.md).
> That direction supersedes the historical composition, accent, radius, and
> renderer-file scope below. Required actions, product role, bridge ownership,
> and keyboard/input obligations remain applicable. The new candidate has not
> yet replaced the installed app.

## Product role

The `title` route is the Minecraft client home screen, not an analytics dashboard and not a configuration workspace. Its job is to let the player immediately choose where to go next.

The visual reference is the structural discipline of Lunar Client 1.8.9: centered launch actions, account/profile in a corner, quiet utilities/footer, strong alignment, consistent hit targets, restrained branding. Do not copy Lunar branding, store/discover/promotional content, or its exact styling.

Current review candidate — 2026-09-22: the owner subsequently requested a more
web-native, less conventional app composition. The implemented candidate uses
an asymmetric left command rail while preserving the hierarchy and restrained
Minecraft-client discipline below. This visual change is pending owner sign-off.

## Required home actions

Home must expose all of these without opening a secondary dashboard first:

1. Singleplayer — primary action.
2. Multiplayer — primary action.
3. Client Settings — secondary action, routes to Opus settings/interface.
4. Minecraft Settings — secondary action, invokes the host Minecraft settings action.
5. Accounts — available directly from the account/profile control on Home and may also be present as a secondary action when space permits.
6. Quit Minecraft — quiet utility action, visually separated from normal navigation.
7. Modules and HUD Editor may exist as compact utilities, but they must not compete with Singleplayer/Multiplayer.

## Information hierarchy

The hierarchy is fixed:

- Level 1: OPUS identity/wordmark.
- Level 2: Singleplayer / Multiplayer.
- Level 3: Client Settings / Minecraft Settings / Accounts.
- Level 4: Modules / HUD / Quit / version metadata.

No session cards, module metrics, runtime telemetry, renderer/transport labels, technical implementation terms, marketing slogans, hero copy, news cards, store/discover cards, or fake status dashboards on Home.

Forbidden visible Home copy includes concepts such as: `Overview`, `Command center`, `Session`, `Commands`, `Module state`, `Surface`, `CEF`, `SHM`, `WEB V2`, `generation scoped`, or marketing sentences.

## Layout

Home is a dedicated full-viewport layout. Do not show the configuration sidebar/topbar on `title`.

### Readability-first viewport target

The normal design target is a human-readable game/client surface around 854 x 480 CSS px and above, with 1280 x 720 used as a primary browser-review size. Retina backing scale must not halve the intended visual size of controls or typography.

427 x 240 CSS px is now an emergency compact compatibility case, not the baseline that drives typography. The UI must still avoid catastrophic clipping there, but it may use a deliberate compact layout. Default controls must remain comfortably readable at normal client window sizes.

### Regions

- Top-left: account/profile control. Compact, one line at the smallest viewport. It must be an obvious clickable control and route to `accounts`.
- Left command rail at normal desktop sizes: OPUS wordmark followed by the main launch action group, leaving the video artwork readable across the rest of the viewport.
- Main launch group: a single aligned column. `Singleplayer` and `Multiplayer` are full-width peer rows.
- Secondary row: `Client Settings` and `Minecraft Settings` as equal peers. `Accounts` can be included here only if it remains visually subordinate and does not crowd the center.
- Footer: client/Minecraft version on the left or low-emphasis edge; utility icons and Quit on the opposite edge or centered utility strip. Do not create a dock that visually competes with the main actions.

Use a strict 4 px spacing system. All major horizontal edges must align to the same center/action width. Keep the number of unique button heights minimal.

## Visual system

The UI must look deliberately designed, not AI-generated.

Required:

- Account/profile identity uses the Minecraft account skin head/avatar when available. Do not substitute a generated initial/letter badge for a normal Minecraft account.
- Avoid decorative generic line icons on Home actions when text alone communicates the action clearly. Navigation chevrons/back affordances are acceptable when functional.
- Cool silver/graphite controls over the selected Minecraft night-sky background, with one aqua semantic accent for Client Settings and primary route actions. Bright controls must remain restrained and product-like rather than becoming white SaaS cards.
- One restrained Opus accent only for focus/selected/active states.
- Crisp 1 px borders where needed; no decorative multi-layer borders.
- Radius should be restrained (`4-7 px` range). Do not use oversized pill/card radii.
- Use Inter for UI text and existing OPUS wordmark asset for brand identity.
- Primary buttons should read as Minecraft client actions, not SaaS cards.
- Hover: small luminance/border change only. No glow bloom.
- Pressed: immediate 1-step darker/pressed state.
- Focus-visible: clear keyboard focus ring.
- No blinking, particle decoration, looping sheen, or animated button ornament.
- Background blur may be used only if it improves legibility over a real Minecraft background. It must not become glassmorphism.

Forbidden:

- glassmorphism,
- frosted cards,
- radial neon glow,
- purple gradient decoration,
- generic AI dashboard grids,
- pseudo-enterprise tables on Home,
- floating marketing cards,
- large rounded cards containing explanatory prose,
- arbitrary badges/codes with no structural purpose (`SP`, `MP`, `WEB V2`); restrained sequence labels are acceptable only when consistently used as navigation hierarchy,
- excessive uppercase microcopy,
- decorative data that has no user action.

## Interaction contract

Every visible Home control must have a real handler and a stable `data-opus-home-action` attribute.

Required action identifiers:

- `singleplayer`
- `multiplayer`
- `client-settings`
- `minecraft-settings`
- `accounts`
- `quit`

Optional utilities:

- `modules`
- `hud`

Do not add buttons that only log or display placeholder copy.

Minimum hit target at the normal viewport: 40 CSS px for primary text controls and 34 x 34 CSS px for compact/icon controls. Main actions should normally be 44-48 CSS px tall.

## Existing bridge behavior

Preserve existing bridge semantics and route IDs. Do not redesign runtime/bridge contracts as part of this task. The current candidate work already adds `minecraft-settings` action and account support; use those APIs if present.

Do not touch Java/runtime input code, launcher code, CEF native code, or Git history in this UI task.

## Scope

Allowed implementation files:

- `ui-v2/src/App.tsx`
- `ui-v2/src/styles.css`
- existing files under `ui-v2/public/brand/` only if needed for presentation

Do not modify `bridge.ts` or `types.ts` unless compilation proves the existing candidate diff is internally inconsistent; if that happens, report it rather than expanding scope automatically.

## Acceptance criteria

1. `npm run build` passes.
2. `title` has no sidebar/topbar/dashboard.
3. All six required Home actions are present and wired.
4. At normal review sizes (854x480 and 1280x720), typography and controls are immediately readable without visual zoom; the 427x240 compact case remains navigable without driving default sizing.
5. At `900x600`, the layout remains centered and does not become an oversized web landing page.
6. Tab focus order follows account -> Singleplayer -> Multiplayer -> secondary actions -> utilities/Quit.
7. The page contains none of the forbidden Home copy/concepts above.
8. No new dependency is added.
9. Do not commit. Do not reset/checkout/revert unrelated dirty worktree changes.
