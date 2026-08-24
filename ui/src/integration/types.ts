// Typed contract between the Opus Client Core and the Opus UI frontend.
// The frontend never imports Minecraft or Forge types; this file is the API.

// A launch identity. Microsoft accounts are "official"; offline identities are
// "unofficial". The account type is surfaced once (as a badge), so we do not
// carry a separate label/note that just repeats it.
export type AccountKind = "official" | "unofficial";

export interface Account {
  id: string;
  username: string;
  kind: AccountKind;
  uuid?: string;
  // The identity that launches the game. Exactly one account is active.
  active?: boolean;
}

export type ServerState = "unknown" | "offline" | "online" | "pinging" | "connecting";

export interface Server {
  id: string;
  name: string;
  address: string;
  version?: string;
  latencyMs?: number;
  state: ServerState;
}

export type ModuleSettingType =
  | "boolean"
  | "integer"
  | "float"
  | "enum"
  | "color"
  | "key"
  | "string";

export interface ModuleSetting {
  key: string;
  label: string;
  type: ModuleSettingType;
  value: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
}

export interface Module {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  settings: ModuleSetting[];
}

export interface World {
  id: string;
  name: string;
  fileName: string;
  mode?: string;
  lastPlayed?: string;
  size?: string;
}

export interface ClientInfo {
  version: string;
  minecraft: string;
  forge: string;
  optifine: string;
  session: string;
  runtime: string;
}

export interface BridgeStatus {
  connected: boolean;
  port?: number;
  host: string;
  protocol: "rest" | "ws";
}

export interface ScreenRouteInfo {
  id: string;
  label: string;
}

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
  | "hud_editor"
  | "none";

export interface RouteRef {
  id: RouteId;
  params?: {
    moduleId?: string;
    settingsSection?: "interface" | "game";
  };
}

export type EntryPoint =
  | "launch"
  | "title"
  | "pause"
  | "hotkey"
  | "mods_catalog"
  | "hud_widget";

export interface NavigationState {
  revision: number;
  current: RouteRef;
  entryPoint: EntryPoint;
  returnTo: RouteRef | null;
  worldContext: "none" | "singleplayer" | "multiplayer";
  presentation: "opaque" | "workspace" | "quick" | "hud_editor";
  pausePolicy: "not_applicable" | "paused" | "live";
  canGoBack: boolean;
  canCloseToGame: boolean;
}

export interface BridgeHello {
  name: string;
  version: string;
  minecraft: string;
  forge: string;
  optifine: string;
  session?: string;
  accountKind: AccountKind;
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

export interface HudModule {
  id: string;
  name: string;
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  scale: number;
  anchor: string;
}
