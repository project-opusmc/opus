import type { ConnectionState, NavigationState, RouteId, RouteRef } from "./bridge/types";

type HostNavigationResult =
  | { kind: "ignored" }
  | { kind: "closed"; revision: number }
  | { kind: "route"; revision: number; route: RouteRef; connection?: ConnectionState | null };

const routeIds: ReadonlySet<string> = new Set<RouteId>([
  "title", "singleplayer", "multiplayer", "connection", "settings", "accounts",
  "game_menu", "quick_hub", "mods_catalog", "module_detail", "hud_editor",
]);

export function classifyHostNavigation(
  state: NavigationState,
  lastRevision: number,
): HostNavigationResult {
  if (!state?.current || !Number.isSafeInteger(state.revision)
      || state.revision < 0 || state.revision < lastRevision) {
    return { kind: "ignored" };
  }
  if (state.current.id === "none") {
    return { kind: "closed", revision: state.revision };
  }
  if (state.revision === 0 || !routeIds.has(state.current.id)) {
    return { kind: "ignored" };
  }
  if (state.current.id === "connection") {
    return {
      kind: "route",
      revision: state.revision,
      route: state.current,
      connection: state.connection ?? null,
    };
  }
  return { kind: "route", revision: state.revision, route: state.current };
}

export function shouldPlayAmbientVideo(
  active: boolean,
  pageVisible: boolean,
  reducedMotion: boolean,
): boolean {
  return active && pageVisible && !reducedMotion;
}

export function syncAmbientVideo(video: HTMLVideoElement, shouldPlay: boolean): void {
  if (!shouldPlay) {
    video.pause();
    return;
  }
  if (video.paused) {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      void playPromise.catch(() => {
        // Autoplay may be blocked until the user interacts with the surface.
      });
    }
  }
}
