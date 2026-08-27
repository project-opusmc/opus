# OPUS Elementa and OpusConfig known issues

Status: **implementation paused for user priority confirmation — August 24, 2026**

This register records defects observed in the packaged Minecraft 1.8.9 client.
It is subordinate to direct user instruction and is linked from the active
production goal and detailed implementation plan.

No Runtime, Launcher, or superproject commit/push may describe the native UI as
accepted while any P0 issue below remains open. The current Launcher/game may
be used to reproduce and diagnose these issues only after the user gives the
go-ahead.

## UI-001 — Minecraft crashes when the window is resized

- Priority: **P0 release blocker**
- State: **open; user-reported in the packaged exact-runtime build**
- Environment: Minecraft 1.8.9, Forge `11.15.1.2318`, OptiFine HD U M5,
  packaged Opus Launcher, Elementa shell visible.
- Observed: dragging the Minecraft window to a new size causes an immediate
  crash.
- Impact: resize, framebuffer, GUI-scale, responsive-layout, and long-running
  stability acceptance cannot pass.

Required resolution and proof:

1. Reproduce from a fresh packaged launch and retain the JVM crash log, game
   log, native UI report, starting size, target size, GUI scale, and display
   scale.
2. Trace the failing display-resize, framebuffer, renderer, or component
   lifecycle path before selecting a fix.
3. Preserve the current route, focus, mouse state, and parent screen through a
   resize.
4. Recalculate viewport, scissor, clipping, and layout safely without stale
   dimensions or resources.
5. Complete repeated grow/shrink cycles in the exact runtime with no JVM
   crash, GL error, clipping failure, or unusable input.

## UI-002 — Current shell layout is visually unacceptable

- Priority: **P1 product blocker**
- State: **open; user-reported**
- Observed: the current Elementa title-shell layout is messy and does not
  resemble an appropriate Minecraft client shell.
- Impact: the existing screen is a technical integration surface, not an
  acceptable product design or release candidate.

Proposed visual direction for user confirmation:

- use **Vanilla Minecraft 1.8.9 as the primary shell structure** so main-menu,
  pause-menu, and settings actions remain familiar and readable;
- use restrained **Lunar Client-inspired polish** for OPUS branding, hierarchy,
  compact panels, hover/focus states, and client-specific routes;
- keep OpusConfig visually related to the shell without turning the Minecraft
  title screen into a generic settings dashboard;
- avoid the current oversized centered panel and arbitrary two-column button
  placement.

This proposed split is not implementation authorization. If the user chooses a
fully Vanilla-faithful or more strongly Lunar-inspired direction instead, the
visual reference must be updated before the shell rewrite begins.

## UI-003 — Buttons and layout do not respond to window size

- Priority: **P0 functional blocker after UI-001**
- State: **open; user-reported**
- Observed: multiple controls retain unsuitable dimensions or positions rather
  than adapting to the available logical UI area.
- Impact: controls can become poorly aligned, clipped, crowded, or detached
  from their intended hierarchy. The resize crash currently prevents a full
  boundary survey.

Required resolution and proof:

1. Define supported minimum, typical, wide, and tall logical layouts.
2. Replace page-level fixed positioning with responsive Elementa constraints,
   stacks, grids, content bounds, and explicit compact-mode breakpoints.
3. Reflow or stack actions when horizontal space is insufficient; do not
   merely stretch every control with the window.
4. Keep readable text, consistent control heights, minimum hit targets,
   predictable spacing, and draw/hit-test alignment.
5. Test title and pause shells independently across GUI scale Auto/1/2/3/4,
   windowed/fullscreen, and standard/HiDPI framebuffers.
6. Retain screenshots at the agreed minimum, reference, and wide sizes.

## Acceptance consequence

Right Shift, OpusConfig open/close restoration, the Elementa pause menu,
persistence, and final packaging remain required by the production goal. They
are not cancelled. Their final acceptance run is sequenced after UI-001 and
UI-003 because a crash-prone, non-responsive shell cannot provide trustworthy
interaction evidence.

