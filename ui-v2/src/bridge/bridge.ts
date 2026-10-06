import type { AccountSummary, GameOption, ModuleSetting, NavigationState, OpusBridge, OpusModule, RouteRef, ServerStatus, UiSettings } from "./types";

const search = new URLSearchParams(window.location.search);
const port = Number(search.get("port"));
const hostMode = Number.isFinite(port) && port > 0;
const base = hostMode ? `http://127.0.0.1:${port}` : "";

const moduleDescriptions: Record<string, string> = {
  fps: "Keep your frame rate in view without leaving the game.",
  "armor-status": "See equipped armor and its remaining durability at a glance.",
  keystrokes: "See movement, jump and mouse inputs using your current Minecraft key bindings.",
};
function mockHudSettings(): ModuleSetting[] {
  return [
    { key: "enabled", label: "Enabled", type: "boolean", value: "0", min: "0", max: "1", step: "1", options: [] },
    { key: "scale", label: "Scale", type: "integer", value: "100", min: "50", max: "150", step: "1", options: [] },
    { key: "opacity", label: "Opacity", type: "integer", value: "100", min: "25", max: "100", step: "1", options: [] },
    { key: "anchor", label: "Anchor", type: "enum", value: "top-left", min: "0", max: "0", step: "1",
      options: ["top-left", "top-right", "bottom-left", "bottom-right"].map(value => ({ value, label: value.replace("-", " ") })) },
    { key: "offsetX", label: "Offset X", type: "integer", value: "12", min: "0", max: "4096", step: "1", options: [] },
    { key: "offsetY", label: "Offset Y", type: "integer", value: "12", min: "0", max: "4096", step: "1", options: [] },
  ];
}
// Preview only mirrors capabilities implemented by ClientOverlayController.
const mockModules: OpusModule[] = [
  { id: "fps", name: "Performance overlay", description: moduleDescriptions.fps, category: "visual",
    enabled: false, settings: mockHudSettings() },
  { id: "armor-status", name: "Armor Status", description: moduleDescriptions["armor-status"], category: "visual",
    enabled: false, settings: mockHudSettings().map(setting => setting.key === "anchor" ? { ...setting, value: "top-right" } : setting).concat([
      { key: "showDurability", label: "Durability", type: "boolean", value: "1", min: "0", max: "1", step: "1", options: [] },
    ]) },
  { id: "keystrokes", name: "Keystrokes", description: moduleDescriptions.keystrokes, category: "visual",
    enabled: false, settings: mockHudSettings().map(setting => setting.key === "offsetY" ? { ...setting, value: "50" } : setting).concat([
      { key: "showMouseButtons", label: "Mouse buttons", type: "boolean", value: "1", min: "0", max: "1", step: "1", options: [] },
      { key: "showJump", label: "Jump key", type: "boolean", value: "1", min: "0", max: "1", step: "1", options: [] },
    ]) },
];



const mockAccounts: AccountSummary[] = [
  {
    id: "microsoft:zvwgvx",
    username: "zvwgvx",
    uuid: "9e048b4178f8444886a9098ecf6546b1",
    avatarUrl: "/avatars/zvwgvx.png",
    kind: "microsoft",
    badge: "official",
    selected: true,
    current: true,
  },
  {
    id: "offline:opus",
    username: "opus_",
    avatarUrl: "/avatars/default.png",
    kind: "offline",
    badge: "unofficial",
    selected: false,
    current: false,
  },
];

const mockWorlds = [
  { id: "practice-world", name: "Practice World" },
  { id: "survival-base", name: "Survival Base" },
  { id: "redstone-lab", name: "Redstone Lab" },
];

const mockServers = [
  { id: "hypixel", name: "Hypixel", address: "mc.hypixel.net" },
  { id: "local-server", name: "Local Server", address: "127.0.0.1:25565" },
];

const mockServerStatuses: ServerStatus[] = [
  {
    address: "mc.hypixel.net",
    state: "online",
    motd: "Hypixel Network · SkyBlock, Bed Wars and more",
    onlinePlayers: 82431,
    maxPlayers: 200000,
    version: "1.8.9–1.21.5",
    pingMs: 42,
  },
  { address: "127.0.0.1:25565", state: "offline" },
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

function renderedRevision(revision: number | undefined): number {
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Opus action requires a committed render revision");
  }
  return revision;
}

async function navigateRequest(
  action: "navigate" | "back" | "close", revision: number, route?: RouteRef,
): Promise<NavigationState> {
  // Never refresh the revision here: a visible Cancel belongs to the native
  // session that produced this render, not whichever session exists at POST.
  const expectedRevision = renderedRevision(revision);
  return request<NavigationState>("/api/v1/client/ui-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, route, revision: expectedRevision }),
  });
}

const mockBridge: OpusBridge = {
  async getClient() {
    return {
      version: "0.1.0-dev",
      minecraft: "1.8.9",
      runtime: "Java 8 · macOS ARM64",
      account: "zvwgvx",
      accountKind: "official",
      session: "online",
    };
  },
  async getNavigationState() { return { revision: 1, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async getAccounts() { return mockAccounts.map((account) => ({ ...account })); },
  async selectAccount(id) {
    for (const account of mockAccounts) account.selected = account.id === id;
    return mockAccounts.map((account) => ({ ...account }));
  },
  async ackNavigation() {},
  async navigate(route) { return { revision: 2, current: route, canGoBack: true, canCloseToGame: false }; },
  async back() { return { revision: 3, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async close() { return { revision: 4, current: { id: "title" }, canGoBack: false, canCloseToGame: false }; },
  async getWorlds() { return mockWorlds.map((world) => ({ ...world })); },
  async loadWorld(id) { console.info(`[opus-v2] load-world=${id}`); },
  async getServers() { return mockServers.map((server) => ({ ...server })); },
  async getServerStatuses() { return mockServerStatuses.map((status) => ({ ...status })); },
  async addServer(name, address) {
    const normalizedAddress = address.trim();
    const normalizedName = name.trim() || normalizedAddress;
    const existing = mockServers.find((server) => server.address.toLowerCase() === normalizedAddress.toLowerCase());
    if (existing) {
      existing.name = normalizedName;
      return;
    }
    mockServers.push({
      id: `server-${mockServers.length + 1}`,
      name: normalizedName,
      address: normalizedAddress,
    });
  },
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
    return structuredClone(mockModules);
  },
  async setModuleEnabled(id, enabled) {
    const module = mockModules.find((item) => item.id === id);
    if (!module) throw new Error("Module unavailable");
    module.enabled = enabled;
    const setting = module.settings?.find(item => item.key === "enabled");
    if (setting) setting.value = enabled ? "1" : "0";
  },
  async setModuleSetting(id, key, value) {
    const setting = mockModules.find(item => item.id === id)?.settings?.find(item => item.key === key);
    if (!setting) throw new Error("Module option unavailable");
    setting.value = value;
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
      accountKind?: "official" | "unofficial";
    }>("/api/v1/client");
    return {
      version: hello.version,
      minecraft: hello.minecraft,
      runtime: "Minecraft JVM",
      account: hello.session || "Active account",
      accountKind: hello.accountKind ?? "unofficial",
      session: "online",
    };
  },
  async getNavigationState() { return request<NavigationState>("/api/v1/client/ui-state"); },
  async getAccounts() {
    const data = await request<{ accounts: AccountSummary[] }>("/api/v1/client/accounts");
    return data.accounts;
  },
  async selectAccount(id) {
    const data = await request<{ accounts: AccountSummary[] }>("/api/v1/client/accounts/select", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    return data.accounts;
  },
  async ackNavigation(revision) {
    await request<void>("/api/v1/client/ui-state/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    });
  },
  async navigate(route, revision) { return navigateRequest("navigate", revision, route); },
  async back(revision) { return navigateRequest("back", revision); },
  async close(revision) { return navigateRequest("close", revision); },
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
  async getServerStatuses(refresh = false) {
    const data = await request<{ servers: ServerStatus[] }>("/api/v1/client/servers/status", {
      method: refresh ? "POST" : "GET",
    });
    return data.servers;
  },
  async addServer(name, address) {
    await request<void>("/api/v1/client/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
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
    const response = await request<{ modules: Array<{ id: string; name: string; enabled: boolean; settings?: ModuleSetting[] }> }>(
      "/api/v1/client/modules",
    );
    return response.modules.map((module) => ({
      id: module.id,
      name: module.name,
      description: moduleDescriptions[module.id] ?? "Module provided by your current client runtime.",
      category: module.id in moduleDescriptions ? "visual" : "utility",
      enabled: module.enabled,
      settings: module.settings ?? [],
    }));
  },
  async setModuleEnabled(id, enabled) {
    await request<void>("/api/v1/client/modules/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  },
  async setModuleSetting(id, key, value) {
    await request<void>("/api/v1/client/modules/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, key, value }),
    });
  },
  async getUiSettings() {
    return { ...settings };
  },
  async setUiSettings(next) {
    settings = { ...next };
  },
  async performAction(action: "quit" | "minecraft-settings" | "create-world", revision?: number) {
    const body = action === "quit"
      ? { action }
      : { action, revision: renderedRevision(revision) };
    await request<void>("/api/v1/client/ui-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};

export const bridge = hostMode ? hostBridge : mockBridge;
export const isStandalone = !hostMode;
