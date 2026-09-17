import type { GameOption, NavigationState, OpusBridge, OpusModule, RouteRef, UiSettings } from "./types";

const search = new URLSearchParams(window.location.search);
const port = Number(search.get("port"));
const hostMode = Number.isFinite(port) && port > 0;
const base = hostMode ? `http://127.0.0.1:${port}` : "";

const mockModules: OpusModule[] = [
  {
    id: "fireball-warning",
    name: "Fireball Warning",
    description: "Predict incoming fireballs and surface impact risk before they enter your focus.",
    category: "analysis",
    enabled: true,
    status: "stable",
  },
  {
    id: "resource-intel",
    name: "Resource Intel",
    description: "Turn generator timing and observed pickups into a compact enemy-resource estimate.",
    category: "information",
    enabled: true,
    status: "experimental",
  },
  {
    id: "enemy-motion",
    name: "Motion Analysis",
    description: "Highlight movement trends, approach vectors and recent direction changes.",
    category: "analysis",
    enabled: false,
    status: "experimental",
  },
  {
    id: "team-overlay",
    name: "Team Overlay",
    description: "Condense team state, distance and objective context into one quiet HUD layer.",
    category: "visual",
    enabled: true,
    status: "stable",
  },
  {
    id: "queue-tools",
    name: "Queue Tools",
    description: "Small competitive workflow utilities for queueing, parties and session context.",
    category: "utility",
    enabled: false,
    status: "stable",
  },
];


const mockGameOptions: GameOption[] = [
  { key: "FOV", label: "FOV", type: "float", value: 0.5, min: 0, max: 1, step: 0.05 },
  { key: "GAMMA", label: "Brightness", type: "float", value: 0.5, min: 0, max: 1, step: 0.05 },
  { key: "RENDER_DISTANCE", label: "Render Distance", type: "float", value: 0.5, min: 0, max: 1, step: 0.05 },
  { key: "ENABLE_VSYNC", label: "VSync", type: "boolean", value: 0, min: 0, max: 1, step: 1 },
];

let settings: UiSettings = {
  uiScale: 1,
  reduceMotion: false,
  backgroundBlur: 22,
  compactMode: false,
  accent: "violet",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) throw new Error(`Opus bridge ${path} failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function navigateRequest(action: "navigate" | "back" | "close", route?: RouteRef): Promise<NavigationState> {
  const state = await request<NavigationState>("/api/v1/client/ui-state");
  return request<NavigationState>("/api/v1/client/ui-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, route, revision: state.revision }),
  });
}

const mockBridge: OpusBridge = {
  async getClient() {
    return {
      version: "0.1.0-dev",
      minecraft: "1.8.9",
      runtime: "Java 8 · macOS ARM64",
      account: "zvwgvx",
      session: "online",
    };
  },
  async getNavigationState() { return { revision: 1, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async ackNavigation() {},
  async navigate(route) { return { revision: 2, current: route, canGoBack: true, canCloseToGame: false }; },
  async back() { return { revision: 3, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async close() { return { revision: 4, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async getWorlds() { return [{ id: "world-1", name: "Practice World" }]; },
  async loadWorld(id) { console.info(`[opus-v2] load-world=${id}`); },
  async getServers() { return [{ id: "hypixel", name: "Hypixel", address: "mc.hypixel.net" }]; },
  async connectServer(address) { console.info(`[opus-v2] connect=${address}`); },
  async getGameOptions() { return mockGameOptions.map((option) => ({ ...option })); },
  async adjustGameOption(key, delta) {
    const option = mockGameOptions.find((item) => item.key === key);
    if (option) option.value = option.type === "float"
      ? Math.max(option.min, Math.min(option.max, option.value + delta * option.step))
      : option.value >= 0.5 ? 0 : 1;
  },
  async setGameOptionFloat(key, value) {
    const option = mockGameOptions.find((item) => item.key === key);
    if (option) option.value = value;
  },
  async leaveWorld() { console.info("[opus-v2] leave-world"); },
  async reportHudEditorCanvas(revision, region) { console.info(`[opus-v2] hud-region=${revision}`, region); },
  async getModules() {
    return mockModules.map((module) => ({ ...module }));
  },
  async setModuleEnabled(id, enabled) {
    const module = mockModules.find((item) => item.id === id);
    if (module) module.enabled = enabled;
  },
  async getUiSettings() {
    return { ...settings };
  },
  async setUiSettings(next) {
    settings = { ...next };
  },
  async performAction(action) {
    console.info(`[opus-v2] action=${action}`);
  },
};

const hostBridge: OpusBridge = {
  async getClient() {
    const hello = await request<{
      version: string;
      minecraft: string;
      session?: string;
    }>("/api/v1/client");
    return {
      version: hello.version,
      minecraft: hello.minecraft,
      runtime: "Minecraft JVM",
      account: hello.session || "Active account",
      session: "online",
    };
  },
  async getNavigationState() { return request<NavigationState>("/api/v1/client/ui-state"); },
  async ackNavigation(revision) {
    await request<void>("/api/v1/client/ui-state/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    });
  },
  async navigate(route) { return navigateRequest("navigate", route); },
  async back() { return navigateRequest("back"); },
  async close() { return navigateRequest("close"); },
  async getWorlds() {
    const data = await request<{ worlds: Array<{ file: string; name: string }> }>("/api/v1/client/worlds");
    return data.worlds.map((world) => ({ id: world.file, name: world.name }));
  },
  async loadWorld(id) {
    await request<void>("/api/v1/client/worlds/load", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: id }) });
  },
  async getServers() {
    const data = await request<{ servers: Array<{ name: string; address: string }> }>("/api/v1/client/servers");
    return data.servers.map((server) => ({ id: server.address, name: server.name || server.address, address: server.address }));
  },
  async connectServer(address) {
    await request<void>("/api/v1/client/servers/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
  },
  async getGameOptions() {
    const data = await request<{ options: Array<{ key: string; label: string; type: "float" | "boolean" | "enum"; value: string; min: string; max: string; step: string }> }>("/api/v1/client/options");
    return data.options.map((option) => ({
      key: option.key, label: option.label, type: option.type,
      value: Number(option.value), min: Number(option.min), max: Number(option.max), step: Number(option.step),
    }));
  },
  async adjustGameOption(key, delta) {
    await request<void>("/api/v1/client/options/adjust", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, delta }),
    });
  },
  async setGameOptionFloat(key, value) {
    await request<void>("/api/v1/client/options/set", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }),
    });
  },
  async leaveWorld() {
    await request<void>("/api/v1/client/world/leave", { method: "POST" });
  },
  async reportHudEditorCanvas(revision, region) {
    await request<void>("/api/v1/client/ui-input-region", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, ...region }),
    });
  },
  async getModules() {
    const response = await request<{ modules: Array<{ id: string; name: string; enabled: boolean }> }>(
      "/api/v1/client/modules",
    );
    return response.modules.map((module) => ({
      id: module.id,
      name: module.name,
      description: "Runtime module",
      category: "utility",
      enabled: module.enabled,
      status: "stable",
    }));
  },
  async setModuleEnabled(id, enabled) {
    await request<void>("/api/v1/client/modules/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  },
  async getUiSettings() {
    return { ...settings };
  },
  async setUiSettings(next) {
    settings = { ...next };
  },
  async performAction(action) {
    if (action === "quit") {
      await request<void>("/api/v1/client/ui-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quit" }),
      });
      return;
    }
    console.info(`[opus-v2] host-action=${action}`);
  },
};

export const bridge = hostMode ? hostBridge : mockBridge;
export const isStandalone = !hostMode;
