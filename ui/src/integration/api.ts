import type {
  Account,
  BridgeHello,
  ClientInfo,
  GameOption,
  HudModule,
  Module,
  NavigationState,
  RouteRef,
  Server,
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

export class BridgeError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(path: string, status: number, payload: unknown) {
    super(`Opus bridge ${path} failed: ${status}`);
    this.name = "BridgeError";
    this.status = status;
    this.payload = payload;
  }
}

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

};

// ---- Bridge-backed API (used when the game serves this SPA) --------------

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(`${REST_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === "AbortError") {
      throw new Error(`Opus bridge ${path} timed out`);
    }
    throw failure;
  } finally {
    window.clearTimeout(timeout);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }
  if (!response.ok) {
    throw new BridgeError(path, response.status, payload);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return payload as T;
}

export const bridge = {
  async hello(): Promise<BridgeHello> {
    return bridgeFetch<BridgeHello>("/api/v1/client");
  },

  async getNavigationState(): Promise<NavigationState> {
    return bridgeFetch<NavigationState>("/api/v1/client/ui-state");
  },

  async acknowledgeNavigation(revision: number): Promise<void> {
    await bridgeFetch<void>("/api/v1/client/ui-state/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    });
  },

  async navigate(route: RouteRef, revision: number): Promise<NavigationState> {
    return bridgeFetch<NavigationState>("/api/v1/client/ui-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "navigate", route, revision }),
    });
  },

  async back(revision: number): Promise<NavigationState> {
    return bridgeFetch<NavigationState>("/api/v1/client/ui-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "back", revision }),
    });
  },

  async close(revision: number): Promise<NavigationState> {
    return bridgeFetch<NavigationState>("/api/v1/client/ui-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", revision }),
    });
  },

  async quit(): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/ui-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quit" }),
    });
  },

  async getWorlds(): Promise<World[]> {
    const data = await bridgeFetch<{
      worlds: { file: string; name: string }[];
    }>("/api/v1/client/worlds");
    return data.worlds.map((world) => ({
      id: world.file,
      name: world.name,
      fileName: world.file,
    }));
  },

  async loadWorld(file: string): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/worlds/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    });
  },

  async getServers(): Promise<Server[]> {
    const data = await bridgeFetch<{
      servers: { name: string; address: string }[];
    }>("/api/v1/client/servers");
    return data.servers.map((server) => ({
      id: server.address,
      name: server.name || server.address,
      address: server.address,
      state: "unknown",
    }));
  },

  async connectServer(address: string): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/servers/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
  },

  async addServer(name: string, address: string): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
  },

  async getGameOptions(): Promise<GameOption[]> {
    const data = await bridgeFetch<{
      options: {
        key: string;
        label: string;
        type: string;
        value: string;
        min: string;
        max: string;
        step: string;
      }[];
    }>("/api/v1/client/options");
    return data.options.map((option) => ({
      key: option.key,
      label: option.label,
      type:
        option.type === "float" || option.type === "boolean"
          ? option.type
          : "enum",
      value: Number(option.value),
      min: Number(option.min),
      max: Number(option.max),
      step: Number(option.step),
    }));
  },

  async adjustGameOption(key: string, delta: number): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/options/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, delta }),
    });
  },

  async setGameOption(key: string, value: number): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/options/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  },

  async leaveWorld(): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/world/leave", {
      method: "POST",
    });
  },

  async getModules(): Promise<Module[]> {
    const data = await bridgeFetch<{
      modules: {
        id: string;
        name: string;
        enabled: boolean;
        settings: {
          key: string;
          label: string;
          type: string;
          value: string;
          min: string;
          max: string;
          step: string;
          options: { value: string; label: string }[];
        }[];
      }[];
    }>("/api/v1/client/modules");
    return data.modules.map((module) => ({
      id: module.id,
      name: module.name,
      description: "",
      enabled: module.enabled,
      settings: module.settings.map((setting) => {
        const type =
          setting.type === "boolean" || setting.type === "integer"
            ? setting.type
            : setting.type === "float"
              ? "float"
              : "enum";
        return {
          key: setting.key,
          label: setting.label,
          type,
          value:
            type === "boolean"
              ? setting.value === "1"
              : type === "integer" || type === "float"
                ? Number(setting.value)
                : setting.value,
          min: Number(setting.min),
          max: Number(setting.max),
          step: Number(setting.step),
          options: setting.options,
        };
      }),
    }));
  },

  async setModuleEnabled(id: string, enabled: boolean): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/modules/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  },

  async setModuleSetting(
    id: string,
    key: string,
    value: boolean | number | string,
  ): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/modules/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, key, value: String(value) }),
    });
  },

  async getHudModules(): Promise<HudModule[]> {
    const data = await bridgeFetch<{
      hud: {
        id: string;
        name: string;
        enabled: boolean;
        offsetX: string;
        offsetY: string;
        scale: string;
        anchor: string;
      }[];
    }>("/api/v1/client/hud");
    return data.hud.map((module) => ({
      id: module.id,
      name: module.name,
      enabled: module.enabled,
      offsetX: Number(module.offsetX),
      offsetY: Number(module.offsetY),
      scale: Number(module.scale),
      anchor: module.anchor,
    }));
  },

  async moveHudModule(id: string, x: number, y: number): Promise<void> {
    await bridgeFetch<unknown>("/api/v1/client/hud/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, x, y }),
    });
  },

  async reportHudEditorCanvas(
    revision: number,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    await bridgeFetch<void>("/api/v1/client/ui-input-region", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, ...region }),
    });
  },
};
