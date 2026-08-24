// Standalone-preview auto-fit only. The integrated CEF surface always runs at
// zoom 1 and uses the real ScaledResolution shared by Java rendering and input.
// Keeping this preview convenience out of the game path prevents a second,
// fixed-width coordinate model from reappearing during future resize work.

import { uiScale } from "../stores/settings";

const PREVIEW_DESIGN_WIDTH = 1440;
// Never enlarge past the authored size: a viewport at or above the design width
// keeps zoom = 1 (the current, working fullscreen look). Only narrower windows
// scale down. The floor stops the UI from collapsing on a tiny frame.
const MIN_FIT = 0.4;
const MAX_FIT = 1.0;

let userScale = 1;

function fitScale(): number {
  const width = window.innerWidth || PREVIEW_DESIGN_WIDTH;
  const raw = width / PREVIEW_DESIGN_WIDTH;
  return Math.min(MAX_FIT, Math.max(MIN_FIT, raw));
}

function applyZoom(): void {
  const search = new URLSearchParams(window.location.search);
  const integrated = search.has("port");
  const unscaledAudit = import.meta.env.DEV && search.get("uiAudit") === "1";
  const zoom = integrated || unscaledAudit
    ? 1
    : fitScale() * (userScale > 0 ? userScale : 1);
  document.documentElement.style.setProperty("zoom", String(zoom));
}

/**
 * Starts auto-fit scaling: applies the current fit immediately, re-applies on
 * window resize, and folds in the user's interface UI-scale preference.
 */
export function installUiScale(): void {
  uiScale.subscribe((value) => {
    userScale = value;
    applyZoom();
  });
  window.addEventListener("resize", applyZoom);
  applyZoom();
}
