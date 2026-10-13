import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ModuleSetting, OpusModule, UiSettings } from "../bridge/types";
import { FpsSettings } from "./FpsSettings";
import { buildFpsResetOperations } from "./fpsSettingsModel";
import { UiIcon } from "./ui/UiIcon";
import { OPUS_LOGO } from "../precision/PrecisionFrame";

interface Props {
  modules: OpusModule[];
  loading: boolean;
  unconfirmed: boolean;
  initialModuleId?: string;
  preview: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onSetting: (id: string, key: string, value: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onHud: () => void;
  onClose: () => void;
  initialPage?: "overview" | "modules" | "detail";
  settings: UiSettings | null;
  onUiSettings: (settings: UiSettings) => Promise<void>;
  onMinecraft: () => void;
}

function Switch({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: () => void;
}) {
  return <button type="button" className="control-switch" role="switch" aria-label={label}
    aria-checked={checked} disabled={disabled} onClick={onChange}><span /></button>;
}

function NumberOption({ setting, disabled, onSave }: {
  setting: ModuleSetting; disabled: boolean; onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(setting.value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(setting.value); setInvalid(false); }, [setting.value]);
  async function commit() {
    if (disabled || draft === setting.value) return;
    const value = Number(draft), min = Number(setting.min), max = Number(setting.max), step = Number(setting.step);
    if (!draft.trim() || !Number.isSafeInteger(value) || value < min || value > max
      || (step > 0 && (value - min) % step !== 0)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (!await onSave(String(value))) setDraft(setting.value);
  }
  return <div className="control-number">
    <input type="number" aria-label={setting.label} aria-invalid={invalid || undefined}
      min={setting.min} max={setting.max} step={setting.step} value={draft} disabled={disabled}
      onChange={event => { setDraft(event.target.value); setInvalid(false); }} onBlur={() => void commit()}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); void commit(); }
        if (event.key === "Escape" && (draft !== setting.value || invalid)) {
          event.preventDefault(); setDraft(setting.value); setInvalid(false);
        }
      }} />
    {invalid && <small role="alert">{setting.min}–{setting.max}, step {setting.step}</small>}
  </div>;
}

function EnumOption({ setting, disabled, onSave }: {
  setting: ModuleSetting; disabled: boolean; onSave: (value: string) => void;
}) {
  const choices = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="control-radio" role="radiogroup" aria-label={setting.label}>
    {setting.options.map((option, index) => <button type="button" key={option.value}
      ref={element => { choices.current[index] = element; }} role="radio" aria-checked={option.value === setting.value}
      aria-label={`${setting.label}: ${option.label}`} tabIndex={option.value === setting.value ? 0 : -1}
      disabled={disabled} onClick={() => onSave(option.value)} onKeyDown={event => {
        let target: number;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") target = (index + 1) % setting.options.length;
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") target = (index + setting.options.length - 1) % setting.options.length;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = setting.options.length - 1;
        else return;
        event.preventDefault();
        choices.current[target]?.focus({ preventScroll: true });
        onSave(setting.options[target].value);
      }}>{option.label.replaceAll("-", " ")}</button>)}
  </div>;
}

// Every control belongs to a module/setting supplied by the runtime. No local
// profile catalog, simulated mods, or preferences without a persistence API.
export function OpusControlCenter({ modules, loading, unconfirmed, initialModuleId, preview,
  onToggle, onSetting, onRefresh, onHud, onClose, initialPage = "overview", settings, onUiSettings, onMinecraft }: Props) {
  const [page, setPage] = useState<string>(initialPage);
  useEffect(()=>{setPage(initialPage);},[initialPage]);
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState(initialModuleId ?? "");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const root = useRef<HTMLElement>(null);
  const lastFocusedControl = useRef<HTMLElement | null>(null);
  const wasLoading = useRef(loading);
  function restoreFocus(target: HTMLElement | null) {
    if (target?.isConnected && root.current?.contains(target) && target.getClientRects().length > 0
      && (document.activeElement === document.body || document.activeElement === root.current)
      && !target.matches(":disabled")) target.focus({ preventScroll: true });
  }
  useLayoutEffect(() => {
    const finished = wasLoading.current && !loading;
    wasLoading.current = loading;
    if (!finished) return;
    // Automatic rereads do not pass through save(). Track actual focus before
    // disabling controls, then restore only after the final confirmed render.
    const target = lastFocusedControl.current;
    const frame = window.requestAnimationFrame(() => restoreFocus(target));
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!initialModuleId) return;
    setSelectedId(initialModuleId);
    setPage("detail");
  }, [initialModuleId]);
  const module = modules.find(item => item.id === selectedId) ?? modules[0];
  const displaySettings = (module?.settings ?? []).filter(item => !["enabled", "anchor", "offsetX", "offsetY"].includes(item.key)
    && (module?.id !== "fps" || item.key === "opacity"));
  const fpsModule = modules.find(item => item.id === "fps");
  const filtered = modules.filter(item => (!onlyEnabled || item.enabled) && `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const disabled = loading || pending !== null || unconfirmed;
  async function save(label: string, operation: () => Promise<void>, success?: string): Promise<boolean> {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPending(label); setFeedback(null);
    try {
      await operation();
      setFeedback({ error: false, message: success ?? (preview ? "Preview updated. No game profile was changed." : `${label} saved to client.`) });
      return true;
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Could not confirm this change. Refresh and try again." });
      return false;
    } finally {
      pendingRef.current = false; setPending(null);
      // Temporarily disabled controls lose DOM focus in Chromium. Restore it
      // after the confirmed render, but never override the user's new target
      // or focus a control on a screen that has since been removed.
      window.requestAnimationFrame(() => restoreFocus(previousFocus));
    }
  }
  function containFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])
      .filter(item => item.tabIndex >= 0 && item.getClientRects().length > 0);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function resetFpsAppearance() {
    if (!fpsModule) return;
    const operations = buildFpsResetOperations(fpsModule.settings ?? []);
    if (!operations.length) return;
    await save("Reset FPS appearance", () => onSetting(fpsModule.id, "resetAppearance", "1"), preview ? "Preview FPS appearance reset." : "FPS appearance reset to defaults.");
  }

  return <section ref={root} tabIndex={-1} className="client-window precision-client" data-opus-control-center
    role="dialog" aria-modal="true" aria-label="Client settings" onKeyDown={containFocus}
    onFocusCapture={event => { if(event.target instanceof HTMLElement&&event.target!==root.current)lastFocusedControl.current=event.target; }}>
    <header className="client-window-heading"><div className="client-window-brand"><img src={OPUS_LOGO} alt=""/><span><strong>OPUS</strong>Client settings</span></div><nav><button type="button" className="text-button client-header-hud" aria-label="Edit HUD layout" onClick={onHud}>HUD layout</button><button type="button" className="text-button" onClick={onMinecraft}>Minecraft settings</button></nav><button type="button" className="client-window-close" aria-label="Close client settings" onClick={onClose}>×</button></header>
    <div className="client-layout"><aside className="client-rail"><nav className="client-nav" aria-label="Client sections">
      <span className="nav-category">CLIENT</span>{["overview","interface","modules"].map(id=><button type="button" key={id} className="nav-button" aria-current={page===id?"page":undefined} onClick={()=>setPage(id)}>{id==="overview"?"Overview":id==="interface"?"Interface":"All modules"}</button>)}
      <span className="nav-category">HUD MODULES</span>{modules.map(item=><button type="button" key={item.id} className="nav-button" data-accent="modules" data-opus-module-id={item.id} aria-label={`${item.name}, ${item.enabled?"Enabled":"Disabled"}`} aria-current={page==="detail"&&module?.id===item.id?"page":undefined} onClick={()=>{setSelectedId(item.id);setPage("detail");}}>{item.name}<i className={`module-line-state${item.enabled?" is-on":""}`}/></button>)}
    </nav><div className="client-rail-bottom"><button type="button" className="client-hud-link" aria-label="Edit HUD layout" onClick={onHud}>Edit HUD layout <kbd>RSHIFT</kbd></button><button type="button" className="settings-owner-link" onClick={onMinecraft}>Minecraft settings →</button><span>CLIENT / 1.8.9</span></div></aside>
    <main className="control-center__detail client-main">
      {page==="overview"&&<><header className="client-main-heading"><div><span className="client-breadcrumb">OPUS CLIENT</span><h1 className="holo-text">Your setup</h1><p>Client preferences and the modules on your HUD.</p></div></header><div className="client-body client-overview"><div className="client-overview-main"><section className="client-section"><h2>Preferences</h2><button type="button" className="preference-link" onClick={()=>setPage("interface")}><span><strong>Interface</strong><small>Scale, density and motion.</small></span><span>→</span></button><button type="button" className="preference-link" onClick={onMinecraft}><span><strong>Minecraft settings</strong><small>Video, sound, controls and resource packs.</small></span><span>→</span></button></section><section className="client-section"><div className="section-heading"><h2>On your HUD</h2><span>{modules.filter(item=>item.enabled).length} enabled</span></div>{modules.map(item=><button type="button" key={item.id} className="preference-link" onClick={()=>{setSelectedId(item.id);setPage("detail");}}><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="preference-current">{item.enabled?"On":"Off"} →</span></button>)}</section></div><aside className="client-context"><div className="client-context-heading"><h2>HUD layout</h2></div><p className="context-copy">Arrange your enabled modules directly over the game. The frame and its content resize together.</p><button className="button button--primary" data-accent="modules" type="button" onClick={onHud}>Edit HUD layout <kbd>RSHIFT</kbd></button></aside></div></>}
      {page==="interface"&&<><header className="client-main-heading"><div><span className="client-breadcrumb">OPUS CLIENT / PREFERENCES</span><h1>Interface</h1><p>Keep the client comfortable on your display.</p></div></header><div className="client-body client-control-scroll"><div className="settings-group"><h2>APPEARANCE</h2>{settings&&<><div className="control-option"><span>Reduce motion</span><Switch label="Reduce motion" checked={settings.reduceMotion} disabled={disabled} onChange={()=>void save("Reduce motion",()=>onUiSettings({...settings,reduceMotion:!settings.reduceMotion}))}/></div><div className="control-option"><span>Compact spacing</span><Switch label="Compact spacing" checked={settings.compactMode} disabled={disabled} onChange={()=>void save("Compact spacing",()=>onUiSettings({...settings,compactMode:!settings.compactMode}))}/></div></>}</div></div></>}
      {page==="modules"&&<><header className="client-main-heading"><div><span className="client-breadcrumb">OPUS CLIENT / MODULES</span><h1 className="accent-text" data-accent="modules">Modules</h1><p>Only modules installed in your client.</p></div></header><div className="module-library-toolbar"><div className="segments"><button type="button" aria-pressed={!onlyEnabled} onClick={()=>setOnlyEnabled(false)}>All</button><button type="button" aria-pressed={onlyEnabled} onClick={()=>setOnlyEnabled(true)}>Enabled</button></div><label className="search-field"><input type="search" aria-label="Search modules" placeholder="Find a module" value={search} onChange={event=>setSearch(event.target.value)}/></label></div><div className="client-body module-grid" data-accent="modules">{filtered.map(item=><article key={item.id} className="module-card"><h2>{item.name}</h2><p>{item.description}</p><div className="module-card-actions"><button type="button" className="text-button" onClick={()=>{setSelectedId(item.id);setPage("detail");}}>Settings →</button><Switch label={`Enable ${item.name}`} checked={item.enabled} disabled={disabled} onChange={()=>void save(item.name,()=>onToggle(item.id,!item.enabled))}/></div></article>)}{!filtered.length&&<p className="section-copy">{loading?"Reading modules…":"No modules match your filter."}</p>}</div></>}
        {page === "detail" && module && <>
          <header className="client-main-heading control-center__module-heading">
            <div><span className="control-center__eyebrow">{module.category === "visual" ? "HUD MODULE" : "CLIENT MODULE"}</span><h1>{module.name}</h1></div>
            <div className="control-center__enable"><span>{module.enabled ? "Enabled" : "Disabled"}</span>
              <Switch label={`Enable ${module.name}`} checked={module.enabled} disabled={disabled}
                onChange={() => void save(module.name, () => onToggle(module.id, !module.enabled))} /></div>
          </header>
          <div className="client-control-scroll"><p className="section-copy">{module.description}</p>
          {module.id === "fps" && <FpsSettings module={module} disabled={disabled} onReset={resetFpsAppearance}
            onSave={(label, key, value) => save(label, () => onSetting(module.id, key, value))} />}
          {<div className="control-center__options" aria-label={`${module.name} options`}>
            <h2>{module.id === "fps" ? "Opacity" : "Display"}</h2>
            {displaySettings.map(setting => <div className="control-option" key={`${module.id}:${setting.key}`}>
              <div className="control-option__label"><span>{setting.label}</span>
                {setting.type === "integer" && (setting.key === "scale" || setting.key === "opacity") && <small>Percent</small>}
              </div>
              {setting.type === "boolean" && <Switch label={setting.label} checked={setting.value === "1" || setting.value === "true"} disabled={disabled}
                onChange={() => void save(setting.label, () => onSetting(module.id, setting.key, setting.value === "1" || setting.value === "true" ? "0" : "1"))} />}
              {setting.type === "integer" && <NumberOption setting={setting} disabled={disabled}
                onSave={value => save(setting.label, () => onSetting(module.id, setting.key, value))} />}
              {setting.type === "enum" && <EnumOption setting={setting} disabled={disabled}
                onSave={value => void save(setting.label, () => onSetting(module.id, setting.key, value))} />}
            </div>)}
            {!displaySettings.length && <p className="control-center__empty">Arrange this module in the HUD editor.</p>}
          </div>}
        </div></>}
        {page === "detail" && !module && !loading && <div className="control-center__unavailable"><UiIcon name="modules" /><h1>Module library unavailable</h1>
          <p>Refresh to read the modules installed in your client.</p></div>}
        <div className="control-center__feedback" role={feedback?.error || unconfirmed ? "alert" : "status"}>
          {pending ? `${pending}…` : feedback?.message ?? (unconfirmed ? "Values are unconfirmed. Refresh before editing again." : preview ? "Browser preview · runtime-compatible controls" : "Values read from your client. Changes save automatically.")}
        </div>
    <footer className="client-main-footer"><span>{modules.filter(item => item.enabled).length} / {modules.length} modules enabled</span><button type="button" className="text-button" disabled={pending !== null || loading} onClick={() => void save("Refreshing values", onRefresh)} aria-label="Refresh module values">Refresh values</button></footer></main></div></section>;
}
