// Typed contract between the Opus Client Core and the Opus UI frontend.
// The frontend never imports Minecraft or Forge types; this file is the API.

export type AccountKind = "official" | "unofficial" | "demo";

export interface Account {
  id: string;
  label: string;
  username: string;
  kind: AccountKind;
  uuid?: string;
  note?: string;
}

export type ServerState = "offline" | "online" | "pinging" | "connecting";

export interface Server {
  id: string;
  name: string;
  address: string;
  version: string;
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
  mode: string;
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

export interface VirtualScreen {
  name: string;
  action?: "open" | "close";
}

export interface VirtualScreenEvent {
  screenName: string;
  action: "open" | "close";
}

export interface BridgeHello {
  name: string;
  version: string;
  minecraft: string;
  forge: string;
  optifine: string;
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
