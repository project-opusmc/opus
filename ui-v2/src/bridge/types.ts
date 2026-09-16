export type RouteId =
  | "title"
  | "singleplayer"
  | "multiplayer"
  | "settings"
  | "accounts"
  | "game_menu"
  | "quick_hub"
  | "mods_catalog"
  | "module_detail"
  | "hud_editor";

export interface RouteRef {
  id: RouteId;
  params?: { moduleId?: string; settingsSection?: "interface" | "game" };
}

export interface NavigationState {
  revision: number;
  current: RouteRef;
  canGoBack: boolean;
  canCloseToGame: boolean;
}

export interface ClientInfo {
  version: string;
  minecraft: string;
  runtime: string;
  account: string;
  session: "online" | "offline";
}

export interface WorldInfo { id: string; name: string; }
export interface ServerInfo { id: string; name: string; address: string; }

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
  getNavigationState(): Promise<NavigationState>;
  navigate(route: RouteRef): Promise<NavigationState>;
  back(): Promise<NavigationState>;
  close(): Promise<NavigationState>;
  getWorlds(): Promise<WorldInfo[]>;
  loadWorld(id: string): Promise<void>;
  getServers(): Promise<ServerInfo[]>;
  connectServer(address: string): Promise<void>;
  leaveWorld(): Promise<void>;
  reportHudEditorCanvas(revision: number, region: { x: number; y: number; width: number; height: number }): Promise<void>;
  getModules(): Promise<OpusModule[]>;
  setModuleEnabled(id: string, enabled: boolean): Promise<void>;
  getUiSettings(): Promise<UiSettings>;
  setUiSettings(settings: UiSettings): Promise<void>;
  performAction(action: "quit"): Promise<void>;
}
