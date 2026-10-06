export type RouteId =
  | "title"
  | "singleplayer"
  | "multiplayer"
  | "connection"
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

export interface ConnectionState {
  phase: "connecting" | "loading" | "disconnected";
  title: string;
  detail: string;
  serverName: string;
  serverAddress: string;
  canCancel: boolean;
}

export interface NavigationState {
  revision: number;
  current: RouteRef | { id: "none" };
  canGoBack: boolean;
  canCloseToGame: boolean;
  connection?: ConnectionState | null;
}

export interface ClientInfo {
  version: string;
  minecraft: string;
  runtime: string;
  account: string;
  accountKind: "official" | "unofficial";
  session: "online" | "offline";
}

export interface AccountSummary {
  id: string;
  username: string;
  uuid?: string;
  avatarUrl?: string;
  kind: "microsoft" | "offline";
  badge: string;
  selected: boolean;
  current: boolean;
}

export interface WorldInfo { id: string; name: string; }
export interface ServerInfo { id: string; name: string; address: string; }
export interface ServerStatus {
  address: string;
  state: "checking" | "online" | "offline";
  motd?: string;
  onlinePlayers?: number;
  maxPlayers?: number;
  version?: string;
  pingMs?: number;
}
export interface GameOption {
  key: string;
  label: string;
  type: "float" | "boolean" | "enum";
  value: number;
  min: number;
  max: number;
  step: number;
}

export type ModuleCategory = "information" | "analysis" | "utility" | "visual";
export interface ModuleSetting {
  key: string;
  label: string;
  type: "boolean" | "integer" | "enum";
  value: string;
  min: string;
  max: string;
  step: string;
  options: Array<{ value: string; label: string }>;
}
export interface OpusModule {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  enabled: boolean;
  status?: "stable" | "experimental";
  settings?: ModuleSetting[];
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
  getAccounts(): Promise<AccountSummary[]>;
  selectAccount(id: string): Promise<AccountSummary[]>;
  ackNavigation(revision: number): Promise<void>;
  navigate(route: RouteRef, revision: number): Promise<NavigationState>;
  back(revision: number): Promise<NavigationState>;
  close(revision: number): Promise<NavigationState>;
  getWorlds(): Promise<WorldInfo[]>;
  loadWorld(id: string): Promise<void>;
  getServers(): Promise<ServerInfo[]>;
  getServerStatuses(refresh?: boolean): Promise<ServerStatus[]>;
  addServer(name: string, address: string): Promise<void>;
  connectServer(address: string): Promise<void>;
  getGameOptions(): Promise<GameOption[]>;
  adjustGameOption(key: string, delta: number): Promise<void>;
  setGameOptionFloat(key: string, value: number): Promise<void>;
  leaveWorld(): Promise<void>;
  reportHudEditorCanvas(revision: number, region: { x: number; y: number; width: number; height: number;
    exclusions?: Array<{ x: number; y: number; width: number; height: number }> }): Promise<void>;
  getModules(): Promise<OpusModule[]>;
  setModuleEnabled(id: string, enabled: boolean): Promise<void>;
  setModuleSetting(id: string, key: string, value: string): Promise<void>;
  getUiSettings(): Promise<UiSettings>;
  setUiSettings(settings: UiSettings): Promise<void>;
  performAction(action: "quit"): Promise<void>;
  performAction(action: "minecraft-settings" | "create-world", revision: number): Promise<void>;
}
