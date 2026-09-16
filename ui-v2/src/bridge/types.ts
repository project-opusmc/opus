export type RouteId = "home" | "modules" | "settings";

export interface ClientInfo {
  version: string;
  minecraft: string;
  runtime: string;
  account: string;
  session: "online" | "offline";
}

export type ModuleCategory = "information" | "analysis" | "utility" | "visual";

export interface OpusModule {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  enabled: boolean;
  status?: "stable" | "experimental";
}

export interface UiSettings {
  uiScale: number;
  reduceMotion: boolean;
  backgroundBlur: number;
  compactMode: boolean;
  accent: "violet" | "blue" | "mono";
}

export interface OpusBridge {
  getClient(): Promise<ClientInfo>;
  getModules(): Promise<OpusModule[]>;
  setModuleEnabled(id: string, enabled: boolean): Promise<void>;
  getUiSettings(): Promise<UiSettings>;
  setUiSettings(settings: UiSettings): Promise<void>;
  performAction(action: "singleplayer" | "multiplayer" | "quit"): Promise<void>;
}
