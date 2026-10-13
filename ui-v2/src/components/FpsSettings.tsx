import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ModuleSetting, OpusModule } from "../bridge/types";
import { UiIcon } from "./ui/UiIcon";
import { argbToCss, buildFpsResetOperations, formatArgb, parseArgb } from "./fpsSettingsModel";
import "./FpsSettings.css";

interface Props {
  module: OpusModule;
  disabled: boolean;
  onReset: () => Promise<void>;
  onSave: (label: string, key: string, value: string) => Promise<boolean>;
}

const FAVORITES_KEY = "opus.fps.color-favorites.v1";

function readFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && parseArgb(item) !== null) : [];
  } catch { return []; }
}

function writeFavorites(favorites: string[]) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* Browser-local convenience only. */ }
}

function isOn(setting: ModuleSetting): boolean {
  return setting.value === "1" || setting.value === "true";
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
    <path d="m12 3 2.65 5.36 5.92.86-4.28 4.17 1.01 5.89L12 16.5l-5.3 2.78 1.01-5.89-4.28-4.17 5.92-.86L12 3Z" />
  </svg>;
}

function FpsSwitch({ setting, disabled, onSave }: {
  setting: ModuleSetting;
  disabled: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const checked = isOn(setting);
  return <button type="button" className="control-switch" role="switch" aria-label={setting.label}
    aria-checked={checked} disabled={disabled} onClick={() => void onSave(checked ? "0" : "1")}>
    <span />
  </button>;
}

function SwitchRow({ setting, disabled, onSave, className = "" }: {
  setting?: ModuleSetting;
  disabled: boolean;
  onSave: (label: string, key: string, value: string) => Promise<boolean>;
  className?: string;
}) {
  if (!setting) return null;
  return <div className={`fps-settings__row fps-settings__switch-row ${className}`.trim()}>
    <span className="fps-settings__row-label">{setting.label}</span>
    <FpsSwitch setting={setting} disabled={disabled}
      onSave={(value) => onSave(setting.label, setting.key, value)} />
  </div>;
}

function ExpandableSwitchRow({ setting, expanded, disabled, onExpand, onSave }: {
  setting?: ModuleSetting;
  expanded: boolean;
  disabled: boolean;
  onExpand: () => void;
  onSave: (label: string, key: string, value: string) => Promise<boolean>;
}) {
  if (!setting) return null;
  return <div className="fps-settings__row fps-settings__switch-row fps-settings__expandable-row">
    <span className="fps-settings__row-label">{setting.label}</span>
    <FpsSwitch setting={setting} disabled={disabled}
      onSave={(value) => onSave(setting.label, setting.key, value)} />
    <button type="button" className="fps-settings__chevron" aria-label={`${expanded ? "Collapse" : "Expand"} ${setting.label} options`}
      aria-expanded={expanded} onClick={onExpand}><UiIcon name="chevron" /></button>
  </div>;
}

function RangeRow({ setting, disabled, formatValue, resetValue, onSave }: {
  setting?: ModuleSetting;
  disabled: boolean;
  formatValue: (value: number) => string;
  resetValue?: string;
  onSave: (label: string, key: string, value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(setting?.value ?? "0");
  const draftRef = useRef(draft);
  const pointerActive = useRef(false);
  const committing = useRef(false);
  useEffect(() => {
    const value = setting?.value ?? "0";
    draftRef.current = value;
    setDraft(value);
  }, [setting?.value]);
  if (!setting) return null;
  const activeSetting = setting;
  const min = Number(activeSetting.min), max = Number(activeSetting.max), step = Number(activeSetting.step) || 1;
  const parsed = Number(draft);
  const value = Number.isFinite(parsed) ? parsed : Number(activeSetting.value);
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const style = { "--fps-range-progress": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties;

  function update(next: string) {
    draftRef.current = next;
    setDraft(next);
  }
  async function commit(next = draftRef.current) {
    if (disabled || committing.current || next === activeSetting.value) return;
    committing.current = true;
    const saved = await onSave(activeSetting.label, activeSetting.key, next);
    if (!saved) update(activeSetting.value);
    committing.current = false;
  }
  const keyboardKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

  return <div className="fps-settings__row fps-settings__range-row">
    <label htmlFor={`fps-range-${activeSetting.key}`} className="fps-settings__row-label">{activeSetting.label}</label>
    <output htmlFor={`fps-range-${activeSetting.key}`}>{formatValue(value)}</output>
    <input id={`fps-range-${activeSetting.key}`} type="range" aria-label={activeSetting.label} aria-valuetext={formatValue(value)}
      min={min} max={max} step={step} value={value} disabled={disabled} style={style}
      onChange={(event) => update(event.currentTarget.value)}
      onPointerDown={(event) => {
        pointerActive.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        pointerActive.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        void commit(event.currentTarget.value);
      }}
      onPointerCancel={() => { pointerActive.current = false; update(activeSetting.value); }}
      onKeyUp={(event) => { if (keyboardKeys.has(event.key)) void commit(event.currentTarget.value); }}
      onBlur={(event) => { if (!pointerActive.current) void commit(event.currentTarget.value); }} />
    {resetValue !== undefined ? <button type="button" className="fps-settings__row-reset"
      aria-label={`Reset ${activeSetting.label} to ${formatValue(Number(resetValue))}`}
      disabled={disabled || activeSetting.value === resetValue} onClick={() => void commit(resetValue)}><UiIcon name="refresh" /></button> : <span />}
  </div>;
}

function ColorControl({ setting, disabled, favorites, onToggleFavorite, onSave }: {
  setting?: ModuleSetting;
  disabled: boolean;
  favorites: string[];
  onToggleFavorite: (value: string) => void;
  onSave: (label: string, key: string, value: string) => Promise<boolean>;
}) {
  const editorId = useId();
  const swatchRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(setting?.value ?? "#ffffffff");
  const [invalid, setInvalid] = useState(false);
  const committing = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    const value = setting?.value ?? "#ffffffff";
    draftRef.current = value;
    setDraft(value);
    setInvalid(false);
  }, [setting?.value]);
  if (!setting) return null;
  const activeSetting = setting;
  const authoritative = parseArgb(activeSetting.value) ? activeSetting.value.toLowerCase() : "#ffffffff";
  const parsed = parseArgb(draft) ?? parseArgb(authoritative)!;
  const rgb = `#${[parsed.red, parsed.green, parsed.blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  const favoriteValue = parseArgb(draft) ? draft.toLowerCase() : authoritative;
  const favorite = favorites.includes(favoriteValue);

  function update(next: string) {
    draftRef.current = next;
    setDraft(next);
    setInvalid(false);
  }
  function closeEditor() {
    setOpen(false);
    window.requestAnimationFrame(() => swatchRef.current?.focus({ preventScroll: true }));
  }
  function cancelEditor() { update(authoritative); closeEditor(); }
  async function commit(next = draftRef.current) {
    const normalized = next.trim().toLowerCase();
    if (!parseArgb(normalized)) { setInvalid(true); return; }
    if (disabled || committing.current || normalized === authoritative) {
      if (normalized === authoritative) { update(authoritative); if (open) closeEditor(); }
      return;
    }
    committing.current = true;
    const saved = await onSave(activeSetting.label, activeSetting.key, normalized);
    if (saved) { update(normalized); if (open) closeEditor(); }
    else update(authoritative);
    committing.current = false;
  }
  function updateChannel(channel: "alpha" | "red" | "green" | "blue", value: number) {
    update(formatArgb({ ...parsed, [channel]: value }));
  }

  return <div className="fps-settings__row fps-settings__color-row">
    <span className="fps-settings__row-label">{activeSetting.label}</span>
    <div className="fps-color-control">
      <button type="button" ref={swatchRef} className="fps-color-control__swatch" style={{ background: argbToCss(authoritative) }}
        aria-label={`Edit ${activeSetting.label}`} aria-expanded={open} aria-controls={editorId} disabled={disabled}
        onClick={() => setOpen((current) => !current)} />
      <input className="fps-color-control__hex" type="text" inputMode="text" spellCheck={false}
        aria-label={`${activeSetting.label} ARGB value`} aria-invalid={invalid || undefined} value={draft} disabled={disabled}
        onChange={(event) => update(event.currentTarget.value)} onBlur={() => { if (!open) void commit(); }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void commit(); } }} />
      <button type="button" className="fps-color-control__favorite" aria-label={`${favorite ? "Remove" : "Add"} ${favoriteValue} ${favorite ? "from" : "to"} favorites`}
        aria-pressed={favorite} disabled={disabled} onClick={() => onToggleFavorite(favoriteValue)}><StarIcon filled={favorite} /></button>
    </div>
    {invalid && <small className="fps-color-control__error" role="alert">Use #AARRGGBB.</small>}
    {open && <div id={editorId} className="fps-color-editor" role="dialog" aria-label={`${activeSetting.label} editor`}
      onKeyDown={event => { if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); cancelEditor();
      } }}>
      <label className="fps-color-editor__native"><span>RGB</span><input type="color" value={rgb} disabled={disabled}
        onChange={(event) => {
          const value = event.currentTarget.value;
          update(formatArgb({ ...parsed, red: Number.parseInt(value.slice(1, 3), 16),
            green: Number.parseInt(value.slice(3, 5), 16), blue: Number.parseInt(value.slice(5, 7), 16) }));
        }} /></label>
      <label className="fps-color-editor__alpha"><span>Alpha</span><input type="range" min="0" max="255" step="1"
        value={parsed.alpha} disabled={disabled} onChange={(event) => updateChannel("alpha", Number(event.currentTarget.value))} />
        <output>{parsed.alpha}</output></label>
      <div className="fps-color-editor__channels">
        {(["red", "green", "blue", "alpha"] as const).map((channel) => <label key={channel}>
          <span>{channel === "alpha" ? "A" : channel[0].toUpperCase()}</span>
          <input type="number" min="0" max="255" step="1" value={parsed[channel]} disabled={disabled}
            onChange={(event) => updateChannel(channel, Number(event.currentTarget.value))} />
        </label>)}
      </div>
      {favorites.length > 0 && <div className="fps-color-editor__favorites" aria-label="Favorite colors">
        {favorites.map((color) => <button type="button" key={color} aria-label={`Use favorite ${color}`}
          style={{ background: argbToCss(color) }} onClick={() => update(color)} />)}
      </div>}
      <div className="fps-color-editor__actions">
        <button type="button" onClick={cancelEditor}>Cancel</button>
        <button type="button" disabled={disabled || !parseArgb(draft)} onClick={() => void commit()}>Apply</button>
      </div>
    </div>}
  </div>;
}

export function FpsSettings({ module, disabled, onReset, onSave }: Props) {
  const [bracketsExpanded, setBracketsExpanded] = useState(true);
  const [backgroundExpanded, setBackgroundExpanded] = useState(true);
  const [borderExpanded, setBorderExpanded] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const settings = new Map((module.settings ?? []).map((setting) => [setting.key, setting]));
  const setting = (key: string) => settings.get(key);
  const missing = ["scale", "reverseOrder", "textShadow", "showBrackets", "bracketColor", "showBackground",
    "staticBackgroundWidth", "backgroundWidth", "backgroundHeight", "border", "borderThickness", "borderColor",
    "backgroundColor", "textColor"].filter((key) => !settings.has(key));
  const hasResetChanges = buildFpsResetOperations(module.settings ?? []).length > 0;

  function toggleFavorite(value: string) {
    const next = favorites.includes(value) ? favorites.filter((favorite) => favorite !== value) : [...favorites, value];
    setFavorites(next);
    writeFavorites(next);
  }
  const color = (key: string) => <ColorControl setting={setting(key)} disabled={disabled} favorites={favorites}
    onToggleFavorite={toggleFavorite} onSave={onSave} />;

  return <div className="fps-settings" data-opus-fps-settings>
    <div className="fps-settings__content" aria-label="FPS options">
      <section className="fps-settings__section" aria-labelledby="fps-display-heading">
        <h2 id="fps-display-heading">Display</h2>
        <RangeRow setting={setting("scale")} disabled={disabled} resetValue="100"
          formatValue={(value) => `${(value / 100).toFixed(2)}×`} onSave={onSave} />
        <SwitchRow setting={setting("reverseOrder")} disabled={disabled} onSave={onSave} />
        <SwitchRow setting={setting("textShadow")} disabled={disabled} onSave={onSave} />
        <ExpandableSwitchRow setting={setting("showBrackets")} expanded={bracketsExpanded}
          disabled={disabled} onSave={onSave} onExpand={() => setBracketsExpanded((current) => !current)} />
        {bracketsExpanded && <div className="fps-settings__inset">{color("bracketColor")}</div>}
        {color("textColor")}
      </section>
      <section className="fps-settings__section" aria-labelledby="fps-background-heading">
        <h2 id="fps-background-heading">Background</h2>
        <ExpandableSwitchRow setting={setting("showBackground")} expanded={backgroundExpanded}
          disabled={disabled} onSave={onSave} onExpand={() => setBackgroundExpanded((current) => !current)} />
        {backgroundExpanded && <div className="fps-settings__inset">
          <SwitchRow setting={setting("staticBackgroundWidth")} disabled={disabled} onSave={onSave} />
          <RangeRow setting={setting("backgroundWidth")} disabled={disabled}
            formatValue={(value) => `${value} px`} onSave={onSave} />
          <RangeRow setting={setting("backgroundHeight")} disabled={disabled}
            formatValue={(value) => `${value} px`} onSave={onSave} />
          <ExpandableSwitchRow setting={setting("border")} expanded={borderExpanded} disabled={disabled} onSave={onSave}
            onExpand={() => setBorderExpanded((current) => !current)} />
          {borderExpanded && <div className="fps-settings__inset">
            <RangeRow setting={setting("borderThickness")} disabled={disabled}
              formatValue={(value) => `${(value / 100).toFixed(2)} px`} onSave={onSave} />
            {color("borderColor")}
          </div>}
          {color("backgroundColor")}
        </div>}
      </section>
    </div>
    <div className="fps-settings__actions">
      <button type="button" aria-label="Reset FPS appearance" disabled={disabled || !hasResetChanges || missing.length > 0}
        onClick={() => void onReset()}><UiIcon name="refresh" /><span>Reset appearance</span></button>
    </div>
    {missing.length > 0 && <p className="fps-settings__empty" role="alert">
      This runtime is missing {missing.length} FPS appearance option{missing.length === 1 ? "" : "s"}.
    </p>}
  </div>;
}
