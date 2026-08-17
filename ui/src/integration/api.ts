import type {
  Account,
  BridgeHello,
  ClientInfo,
  Module,
  Server,
  VirtualScreen,
  World,
} from "./types";
import { REST_BASE } from "./host";
import {
  mockAccounts,
  mockClient,
  mockModules,
  mockServers,
  mockWorlds,
} from "./mock";

// REST contract (architecture doc section 6). Every call is async so the
// mock-first phase and the real bridge share the same surface.

const latency = (ms = 120) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const api = {
  async getClient(): Promise<ClientInfo> {
    await latency();
    return { ...mockClient };
  },

  async getAccounts(): Promise<Account[]> {
    await latency();
    return mockAccounts.map((account) => ({ ...account }));
  },

  async getServers(): Promise<Server[]> {
    await latency();
    return mockServers.map((server) => ({ ...server }));
  },

  async addServer(name: string, address: string): Promise<Server> {
    await latency();
    const server: Server = {
      id: `srv-${Date.now()}`,
      name,
      address,
      version: "1.8.9",
      state: "offline",
    };
    return server;
  },

  async getWorlds(): Promise<World[]> {
    await latency();
    return mockWorlds.map((world) => ({ ...world }));
  },

  async getModules(): Promise<Module[]> {
    await latency();
    return mockModules.map((module) => ({
      ...module,
      settings: module.settings.map((setting) => ({ ...setting })),
    }));
  },

  async setModuleEnabled(id: string, enabled: boolean): Promise<void> {
    await latency(60);
    console.info(`[opus-ui] module ${id} -> ${enabled}`);
  },

  async setModuleSetting(
    moduleId: string,
    key: string,
    value: boolean | number | string,
  ): Promise<void> {
    await latency(60);
    console.info(`[opus-ui] ${moduleId}.${key} ->`, value);
  },

  async openScreen(route: string): Promise<void> {
    await latency(40);
    console.info(`[opus-ui] open screen ${route}`);
  },

  async closeScreen(): Promise<void> {
    await latency(40);
    console.info("[opus-ui] close screen");
  },
};

// ---- Bridge-backed API (used when the game serves this SPA) --------------

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${REST_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`Opus bridge ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const bridge = {
  async hello(): Promise<BridgeHello> {
    return bridgeFetch<BridgeHello>("/api/v1/client");
  },

  async getVirtualScreen(): Promise<VirtualScreen> {
    return bridgeFetch<VirtualScreen>("/api/v1/client/virtualScreen");
  },

  async confirmVirtualScreen(name: string): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/virtualScreen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },

  async openScreen(name: string): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/screen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },

  async closeScreen(): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/screen", { method: "DELETE" });
  },
};
