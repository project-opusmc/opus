import type { ClientInfo, OpusBridge, OpusModule, UiSettings } from "./types";

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
