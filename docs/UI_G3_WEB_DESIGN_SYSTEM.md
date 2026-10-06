# Opus UI — G3 web design system

Status: active web-first implementation contract — 2026-09-18

## Purpose

Make the browser prototype the canonical UI development environment while keeping the same React/TypeScript/CSS output suitable for the embedded CEF host.

G3 does not select or alter the production renderer. It standardizes the UI language consumed by both standalone browser development and later CEF integration.

## Rules

- One token source for color, spacing, radius, typography, control size, focus and motion.
- One primitive library for common interactive controls.
- Product screens may compose primitives, but may not redefine generic button/toggle/search/modal behavior locally.
- Home keeps its Minecraft-client-specific composition and hierarchy.
- No glassmorphism, neon decoration, generic SaaS dashboard layout, or oversized pill components.
- No new dependency.
- Browser-only fixture behavior must remain explicit and must not claim live Minecraft actions.
- Preserve the existing bridge contract and production runtime boundaries.

## Web development surfaces

### Product preview

`http://127.0.0.1:5174/`

Used for complete fixture-backed product flow.

### Design lab

`http://127.0.0.1:5174/?lab=1`

Standalone-only visual/interaction gallery for tokens and primitives. It exists to iterate on component behavior without entering Minecraft.

## Initial primitive set

- Button: primary, secondary, ghost, danger, active
- Panel
- Toggle
- SearchField
- Modal
- ActionRow
- ScrollArea vocabulary through shared CSS

## Acceptance

1. `npm run build` passes.
2. `npm run check` passes.
3. Existing G2 route/action markers remain intact.
4. Product preview flow still works.
5. Design lab renders and all controls are keyboard-operable.
6. No package dependency changes.
7. Focus, hover, pressed, selected, disabled, and danger states come from shared primitives/tokens where applicable.
8. Home remains a dedicated Minecraft client Home rather than a generic application dashboard.
