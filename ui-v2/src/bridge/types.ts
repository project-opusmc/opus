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
  stage?: "network" | "session" | "terrain" | "resources" | "world";
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
  canOpenLan?:boolean;
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
export interface MinecraftTextRun { text:string; color?:string; bold?:boolean; italic?:boolean; underlined?:boolean; strikethrough?:boolean; }
export interface HudEditorWidget { id:string; enabled:boolean; x:number; y:number; width:number; height:number; scale:number; minScale:number; maxScale:number; }
export interface HudEditorState { editing:boolean; grid:boolean; snap:boolean; canUndo:boolean; inspecting?:boolean; pointerCaptured?:boolean; canvasWidth?:number; canvasHeight?:number; selected?:HudEditorWidget; }
export type HudEditorOperation = 'select'|'close-properties'|'position'|'scale'|'reset'|'nudge'|'align-left'|'align-center'|'align-right'|'align-top'|'align-middle'|'align-bottom';
export interface ServerStatus {
  address: string;
  state: "checking" | "online" | "offline";
  motd?: string;
  motdRuns?: MinecraftTextRun[];
  favicon?:string;
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
  formatted?: string;
  available?: boolean;
}

export interface GameSettingChoice { id:string; label:string; detail:string; selected:boolean; order:number; compatible:boolean; }

export type ModuleCategory = "information" | "analysis" | "utility" | "visual";
export interface ModuleSetting {
  key: string;
  label: string;
  type: "boolean" | "integer" | "enum" | "color";
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
  getGameSettingChoices(kind:"language"|"packs"|"shaders"):Promise<GameSettingChoice[]>;
  setGameSettingChoices(kind:"language"|"packs"|"shaders",ids:string[]):Promise<void>;
  adjustGameOption(key: string, delta: number): Promise<void>;
  setGameOptionFloat(key: string, value: number): Promise<void>;
  leaveWorld(): Promise<void>;
  reportHudEditorCanvas(revision: number, region: { x: number; y: number; width: number; height: number;
    exclusions?: Array<{ x: number; y: number; width: number; height: number }> }): Promise<void>;
  getHudEditorState():Promise<HudEditorState>;
  updateHudEditor(revision:number,operation:HudEditorOperation,id:string,x?:number,y?:number):Promise<void>;
  getModules(): Promise<OpusModule[]>;
  setModuleEnabled(id: string, enabled: boolean): Promise<void>;
  setModuleSetting(id: string, key: string, value: string): Promise<void>;
  getUiSettings(): Promise<UiSettings>;
  setUiSettings(settings: UiSettings): Promise<void>;
  performAction(action: "quit"): Promise<void>;
  performAction(action: "minecraft-settings" | "create-world", revision: number): Promise<void>;
  performAction(action: "achievements" | "statistics" | "open-lan", revision: number): Promise<void>;
  performAction(action: "hud-edit" | "hud-preview" | "hud-grid" | "hud-snap" | "hud-undo", revision:number):Promise<void>;
}
