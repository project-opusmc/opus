import { writable } from "svelte/store";

export type RouteId =
  | "title"
  | "singleplayer"
  | "multiplayer"
  | "settings"
  | "accounts"
  | "hud"
  | "game_menu"
  | "none";

export const routes: ReadonlyArray<{ id: RouteId; label: string }> = [
  { id: "title", label: "Title" },
  { id: "singleplayer", label: "Singleplayer" },
  { id: "multiplayer", label: "Multiplayer" },
  { id: "settings", label: "Client Settings" },
  { id: "accounts", label: "Accounts" },
  { id: "hud", label: "HUD Editor" },
  { id: "game_menu", label: "Game Menu" },
  { id: "none", label: "In Game" },
];

export const route = writable<RouteId>("title");

export function navigate(next: RouteId) {
  route.set(next);
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", `${base}#/${next}`);
  }
}

export function initHashRoute() {
  if (typeof window === "undefined") {
    return;
  }
  const read = () => {
    const match = window.location.hash.match(/^#\/([a-z0-9_-]+)/);
    const id = match?.[1] as RouteId | undefined;
    if (id && routes.some((item) => item.id === id)) {
      route.set(id);
    }
  };
  read();
  window.addEventListener("hashchange", read);
}

export function asRouteId(name: string): RouteId {
  return routes.some((item) => item.id === name) ? (name as RouteId) : "none";
}
