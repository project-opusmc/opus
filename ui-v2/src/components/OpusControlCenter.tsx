import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ModuleSetting, OpusModule } from "../bridge/types";
import { UiIcon } from "./ui/UiIcon";

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
  onToggle, onSetting, onRefresh, onHud, onClose }: Props) {
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
  useEffect(() => { if (initialModuleId) setSelectedId(initialModuleId); }, [initialModuleId]);
  const module = modules.find(item => item.id === selectedId) ?? modules[0];
  const filtered = modules.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
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
  return <section ref={root} tabIndex={-1} className="control-center" data-opus-control-center
    role="dialog" aria-modal="true" aria-label="Client settings" onKeyDown={containFocus}
    onFocusCapture={event => {
      if (event.target instanceof HTMLElement && event.target !== root.current) lastFocusedControl.current = event.target;
    }}>
    <header className="control-center__header">
      <div className="control-center__identity">
        <img src="/brand/opus-mark-user.png" alt="Opus" width="36" height="36" />
        <span><strong>OPUS</strong><small>Client controls</small></span>
      </div>
      <button className="control-center__close" type="button" aria-label="Close client settings"
        title="Close client settings (Esc)" onClick={onClose}><span>Esc</span><UiIcon name="close" /></button>
    </header>
    <div className="control-center__body">
      <aside className="control-center__library" aria-label="Module library">
        <div className="control-center__library-heading"><span>Modules</span><small>{modules.length}</small></div>
        <label className="control-center__search"><UiIcon name="search" /><input type="search"
          aria-label="Search modules" placeholder="Search modules" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <nav className="control-center__list" aria-label="Installed modules">
          {filtered.map(item => <button type="button" key={item.id} data-opus-module-id={item.id}
            aria-label={`${item.name}, ${item.enabled ? "Enabled" : "Disabled"}`}
            className="control-module" aria-pressed={item.id === module?.id} onClick={() => { setSelectedId(item.id); setFeedback(null); }}>
            <UiIcon name={item.id === "fps" ? "activity" : item.id === "keystrokes" ? "keyboard" : "hud"} />
            <span><strong>{item.name}</strong><small>{item.enabled ? "Enabled" : "Disabled"}</small></span>
            <i aria-hidden="true" data-enabled={item.enabled} />
          </button>)}
          {!loading && filtered.length === 0 && <p className="control-center__empty">{modules.length ? "No matching modules." : "No modules received from the client."}</p>}
          {loading && <p className="control-center__empty">Reading client modules…</p>}
        </nav>
        <button type="button" className="control-center__hud" onClick={onHud} disabled={pending !== null}
          aria-label="Edit HUD layout"><UiIcon name="hud" /><span>Edit HUD layout</span><UiIcon name="chevron" /></button>
      </aside>
      <div className="control-center__detail">
        {module && <>
          <header className="control-center__module-heading">
            <div><span className="control-center__eyebrow">{module.category === "visual" ? "HUD MODULE" : "CLIENT MODULE"}</span><h1>{module.name}</h1></div>
            <div className="control-center__enable"><span>{module.enabled ? "Enabled" : "Disabled"}</span>
              <Switch label={`Enable ${module.name}`} checked={module.enabled} disabled={disabled}
                onChange={() => void save(module.name, () => onToggle(module.id, !module.enabled))} /></div>
          </header>
          <p className="control-center__description">{module.description}</p>
          <div className="control-center__options" aria-label={`${module.name} options`}>
            <h2>Display &amp; placement</h2>
            {(module.settings ?? []).filter(item => item.key !== "enabled").map(setting => <div className="control-option" key={`${module.id}:${setting.key}`}>
              <div className="control-option__label"><span>{setting.label}</span>
                {setting.type === "integer" && <small>{setting.key === "scale" || setting.key === "opacity" ? "Percent" : "Pixels from anchor"}</small>}
              </div>
              {setting.type === "boolean" && <Switch label={setting.label} checked={setting.value === "1" || setting.value === "true"} disabled={disabled}
                onChange={() => void save(setting.label, () => onSetting(module.id, setting.key, setting.value === "1" || setting.value === "true" ? "0" : "1"))} />}
              {setting.type === "integer" && <NumberOption setting={setting} disabled={disabled}
                onSave={value => save(setting.label, () => onSetting(module.id, setting.key, value))} />}
              {setting.type === "enum" && <EnumOption setting={setting} disabled={disabled}
                onSave={value => void save(setting.label, () => onSetting(module.id, setting.key, value))} />}
            </div>)}
            {!module.settings?.some(item => item.key !== "enabled") && <p className="control-center__empty">This runtime provides an enable switch only.</p>}
          </div>
        </>}
        {!module && !loading && <div className="control-center__unavailable"><UiIcon name="modules" /><h1>Module library unavailable</h1>
          <p>Refresh to read the modules installed in your client.</p></div>}
        <div className="control-center__feedback" role={feedback?.error || unconfirmed ? "alert" : "status"}>
          {pending ? `${pending}…` : feedback?.message ?? (unconfirmed ? "Values are unconfirmed. Refresh before editing again." : preview ? "Browser preview · runtime-compatible controls" : "Values read from your client. Changes save automatically.")}
        </div>
      </div>
    </div>
    <footer className="control-center__footer"><span>{modules.filter(item => item.enabled).length} of {modules.length} modules enabled</span>
      <button type="button" disabled={pending !== null || loading} onClick={() => void save("Refreshing values", onRefresh,
        preview ? "Preview values refreshed." : "Values refreshed from client.")}
        aria-label="Refresh module values"><UiIcon name="refresh" /><span>Refresh values</span></button></footer>
  </section>;
}
