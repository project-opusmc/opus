import type { ModuleSetting } from "../bridge/types";

export const FPS_SETTING_DEFAULTS = [
  { key: "scale", value: "100" },
  { key: "reverseOrder", value: "1" },
  { key: "textShadow", value: "1" },
  { key: "showBrackets", value: "1" },
  { key: "bracketColor", value: "#ffffffff" },
  { key: "showBackground", value: "0" },
  { key: "staticBackgroundWidth", value: "1" },
  { key: "backgroundWidth", value: "56" },
  { key: "backgroundHeight", value: "18" },
  { key: "border", value: "0" },
  { key: "borderThickness", value: "50" },
  { key: "borderColor", value: "#9f000000" },
  { key: "backgroundColor", value: "#6f000000" },
  { key: "textColor", value: "#ffffffff" },
] as const;

export type FpsResetOperation = { key: string; value: string };

export function buildFpsResetOperations(
  settings: ReadonlyArray<Pick<ModuleSetting, "key" | "value">>,
): FpsResetOperation[] {
  const current = new Map(settings.map((setting) => [setting.key, setting.value]));
  return FPS_SETTING_DEFAULTS
    .filter(({ key, value }) => current.has(key) && current.get(key) !== value)
    .map(({ key, value }) => ({ key, value }));
}

export type ArgbChannels = { alpha: number; red: number; green: number; blue: number };

export function parseArgb(value: string): ArgbChannels | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  if (!match) return null;
  return {
    alpha: Number.parseInt(match[1], 16),
    red: Number.parseInt(match[2], 16),
    green: Number.parseInt(match[3], 16),
    blue: Number.parseInt(match[4], 16),
  };
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function formatArgb({ alpha, red, green, blue }: ArgbChannels): string {
  return `#${[alpha, red, green, blue].map((part) => byte(part).toString(16).padStart(2, "0")).join("")}`;
}

export function argbToCss(value: string): string {
  const color = parseArgb(value);
  return color ? `rgba(${color.red}, ${color.green}, ${color.blue}, ${(color.alpha / 255).toFixed(3)})` : "transparent";
}
