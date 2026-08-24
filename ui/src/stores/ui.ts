import { get, writable } from "svelte/store";
import { BridgeError, bridge } from "../integration/api";
import { isStandalone } from "../integration/host";
import type { NavigationState, RouteId, RouteRef } from "../integration/types";

export type { RouteId, RouteRef } from "../integration/types";

export const routes: ReadonlyArray<{ id: RouteId; label: string }> = [
  { id: "title", label: "Title" },
  { id: "singleplayer", label: "Singleplayer" },
  { id: "multiplayer", label: "Multiplayer" },
  { id: "settings", label: "Settings" },
  { id: "accounts", label: "Accounts" },
  { id: "game_menu", label: "Game Menu" },
  { id: "quick_hub", label: "Quick Hub" },
  { id: "mods_catalog", label: "Mods Catalog" },
  { id: "module_detail", label: "Module Detail" },
  { id: "hud_editor", label: "HUD Editor" },
  { id: "none", label: "In Game" },
];

const initial: NavigationState = {
  revision: 0,
  current: { id: "title" },
  entryPoint: "launch",
  returnTo: null,
  worldContext: "none",
  presentation: "opaque",
  pausePolicy: "not_applicable",
  canGoBack: false,
  canCloseToGame: false,
};

export const navigation = writable<NavigationState>(initial);
type HistoryEntry = {
  route: RouteRef;
  entryPoint: NavigationState["entryPoint"];
};
const standaloneHistory: HistoryEntry[] = [];

function sameRoute(left: RouteRef, right: RouteRef): boolean {
  return left.id === right.id
    && left.params?.moduleId === right.params?.moduleId
    && left.params?.settingsSection === right.params?.settingsSection;
}

function writeStandaloneHash(route: RouteRef) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (route.params?.moduleId) params.set("moduleId", route.params.moduleId);
  if (route.params?.settingsSection) params.set("settingsSection", route.params.settingsSection);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const base = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", `${base}#/${route.id}${query}`);
}

export function commitNavigation(state: NavigationState) {
  navigation.set(state);
  if (isStandalone) writeStandaloneHash(state.current);
}

export async function navigate(next: RouteId | RouteRef) {
  const route = typeof next === "string" ? { id: next } : next;
  if (isStandalone) {
    const current = get(navigation);
    if (sameRoute(current.current, route)) return;
    standaloneHistory.push({ route: current.current, entryPoint: current.entryPoint });
    commitNavigation({
      ...current,
      revision: current.revision + 1,
      current: route,
      entryPoint: entryPointForTransition(current.current.id, route.id, current.entryPoint),
      returnTo: current.current,
      canGoBack: true,
    });
    return;
  }
  const current = get(navigation);
  try {
    commitNavigation(await bridge.navigate(route, current.revision));
  } catch (failure) {
    if (!commitRevisionConflict(failure)) throw failure;
  }
}

export async function back() {
  if (isStandalone) {
    const current = get(navigation);
    const previous = standaloneHistory.pop();
    if (previous) {
      commitNavigation({
        ...current,
        revision: current.revision + 1,
        current: previous.route,
        entryPoint: previous.entryPoint,
        returnTo: standaloneHistory.at(-1)?.route ?? null,
        canGoBack: standaloneHistory.length > 0,
      });
    } else if (current.current.id !== "title") {
      commitNavigation({
        ...current,
        revision: current.revision + 1,
        current: { id: "title" },
        entryPoint: "title",
        returnTo: null,
        canGoBack: false,
      });
    }
    return;
  }
  try {
    commitNavigation(await bridge.back(get(navigation).revision));
  } catch (failure) {
    if (!commitRevisionConflict(failure)) throw failure;
  }
}

export async function close() {
  if (isStandalone) {
    standaloneHistory.length = 0;
    const current = get(navigation);
    if (current.current.id !== "title") {
      commitNavigation({
        ...current,
        revision: current.revision + 1,
        current: { id: "title" },
        entryPoint: "title",
        returnTo: null,
        canGoBack: false,
      });
    }
    return;
  }
  try {
    commitNavigation(await bridge.close(get(navigation).revision));
  } catch (failure) {
    if (!commitRevisionConflict(failure)) throw failure;
  }
}

export function initHashRoute() {
  if (!isStandalone || typeof window === "undefined") return;
  standaloneHistory.length = 0;
  const read = () => {
    const match = window.location.hash.match(/^#\/([a-z0-9_-]+)(?:\?(.+))?/);
    const id = asRouteId(match?.[1] ?? "title");
    const params = new URLSearchParams(match?.[2] ?? "");
    const moduleId = params.get("moduleId") ?? undefined;
    const settingsSection = params.get("settingsSection");
    commitNavigation({
      ...get(navigation),
      revision: get(navigation).revision + 1,
      current: {
        id,
        params: moduleId || settingsSection === "interface" || settingsSection === "game"
          ? {
              moduleId,
              settingsSection:
                settingsSection === "interface" || settingsSection === "game"
                  ? settingsSection
                  : undefined,
            }
          : undefined,
      },
      entryPoint: id === "title" ? "title" : get(navigation).entryPoint,
      returnTo: null,
      canGoBack: id !== "title",
    });
  };
  read();
  window.addEventListener("hashchange", read);
}

export function asRouteId(name: string): RouteId {
  return routes.some((item) => item.id === name) ? (name as RouteId) : "none";
}

function entryPointForTransition(
  previous: RouteId,
  next: RouteId,
  current: NavigationState["entryPoint"],
): NavigationState["entryPoint"] {
  if (next === "module_detail" && previous === "mods_catalog") return "mods_catalog";
  if (next === "module_detail" && previous === "hud_editor") return "hud_widget";
  return current;
}

function commitRevisionConflict(failure: unknown): boolean {
  if (!(failure instanceof BridgeError) || failure.status !== 409) return false;
  const state = failure.payload;
  if (!state || typeof state !== "object") return false;
  const candidate = state as Partial<NavigationState>;
  if (typeof candidate.revision !== "number" || !candidate.current) return false;
  commitNavigation(candidate as NavigationState);
  return true;
}
