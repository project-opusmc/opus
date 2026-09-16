import { useEffect, useMemo, useState } from "react";
import { bridge } from "./bridge/bridge";
import type { ClientInfo, OpusModule, RouteId, UiSettings } from "./bridge/types";
import { Mark } from "./components/Mark";

const nav: Array<{ id: RouteId; label: string; key: string }> = [
  { id: "home", label: "Home", key: "H" },
  { id: "modules", label: "Modules", key: "M" },
  { id: "settings", label: "Settings", key: "S" },
];

export default function App() {
  const [route, setRoute] = useState<RouteId>("home");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [modules, setModules] = useState<OpusModule[]>([]);
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [query, setQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([bridge.getClient(), bridge.getModules(), bridge.getUiSettings()]).then(
      ([clientInfo, loadedModules, loadedSettings]) => {
        setClient(clientInfo);
        setModules(loadedModules);
        setSettings(loadedSettings);
        setSelectedModule(loadedModules[0]?.id ?? null);
      },
    );
  }, []);

  useEffect(() => {
    document.body.dataset.route = route;
    console.info(`[opus-v2] route=${route}`);
  }, [route]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "h") setRoute("home");
      if (event.key.toLowerCase() === "m") setRoute("modules");
      if (event.key.toLowerCase() === "s") setRoute("settings");
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const filteredModules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return modules;
    return modules.filter((module) =>
      `${module.name} ${module.description} ${module.category}`.toLowerCase().includes(normalized),
    );
  }, [modules, query]);

  const activeModule = modules.find((module) => module.id === selectedModule) ?? modules[0] ?? null;

  const oracleState = useMemo(() => {
    if (!client || !settings || modules.length === 0) return "loading";
    if (route === "home") return "home";
    if (route === "modules") return activeModule?.enabled ? "modules-on" : "modules-off";
    return settings.accent === "violet" && settings.uiScale === 1 && settings.backgroundBlur === 22
      ? "settings"
      : "settings-changed";
  }, [activeModule?.enabled, client, modules.length, route, settings]);

  async function toggleModule(id: string) {
    const target = modules.find((module) => module.id === id);
    if (!target) return;
    const enabled = !target.enabled;
    setModules((current) => current.map((module) => (module.id === id ? { ...module, enabled } : module)));
    await bridge.setModuleEnabled(id, enabled);
  }

  async function updateSettings(next: UiSettings) {
    setSettings(next);
    document.documentElement.style.setProperty("--ui-scale", String(next.uiScale));
    await bridge.setUiSettings(next);
  }

  return (
    <div className="shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <div className="grid-noise" />
      <OraclePixel state={oracleState} />

      <aside className="rail panel panel--rail">
        <div className="rail__top">
          <Mark compact />
          <nav className="nav" aria-label="Primary">
            {nav.map((item) => (
              <button
                className={`nav__item ${route === item.id ? "nav__item--active" : ""}`}
                key={item.id}
                onClick={() => setRoute(item.id)}
                title={item.label}
                aria-label={item.label}
                data-opus-nav={item.id}
              >
                <span className="nav__dot" />
                <span className="nav__label">{item.label}</span>
                <span className="nav__key">{item.key}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="rail__bottom">
          <div className={`session-dot ${client?.session === "online" ? "session-dot--online" : ""}`} />
          <span>{client?.account ?? "Loading"}</span>
        </div>
      </aside>

      <main className="workspace panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">OPUS / {route.toUpperCase()}</div>
            <h1>{route === "home" ? "Command center" : route === "modules" ? "Modules" : "Settings"}</h1>
          </div>
          <div className="topbar__meta">
            <span>{client?.minecraft ?? "1.8.9"}</span>
            <span className="meta-separator" />
            <span>{client?.version ?? "dev"}</span>
          </div>
        </header>

        <section className="content" key={route}>
          {route === "home" && <Home client={client} onRoute={setRoute} />}
          {route === "modules" && (
            <Modules
              modules={filteredModules}
              allCount={modules.length}
              query={query}
              selected={activeModule}
              onQuery={setQuery}
              onSelect={setSelectedModule}
              onToggle={toggleModule}
            />
          )}
          {route === "settings" && settings && (
            <Settings settings={settings} onChange={updateSettings} />
          )}
        </section>
      </main>
    </div>
  );
}

function Home({ client, onRoute }: { client: ClientInfo | null; onRoute: (route: RouteId) => void }) {
  return (
    <div className="home-layout">
      <section className="hero glass-card">
        <div className="hero__copy">
          <span className="pill">Competitive intelligence layer</span>
          <Mark />
          <h2>See the match before it becomes obvious.</h2>
          <p>
            Opus condenses noisy game state into a quiet information layer built for players who already know how to play.
          </p>
        </div>
        <div className="hero__pulse" aria-hidden="true">
          <div className="pulse-ring pulse-ring--outer" />
          <div className="pulse-ring pulse-ring--inner" />
          <div className="pulse-eye" />
        </div>
      </section>

      <section className="quick-grid">
        <QuickAction title="Singleplayer" subtitle="Open local worlds" badge="LOCAL" onClick={() => void bridge.performAction("singleplayer")} />
        <QuickAction title="Multiplayer" subtitle="Join a server" badge="ONLINE" onClick={() => void bridge.performAction("multiplayer")} />
        <QuickAction title="Modules" subtitle="Tune information layers" badge="05" onClick={() => onRoute("modules")} />
        <QuickAction title="Settings" subtitle="Interface and behavior" badge="UI" onClick={() => onRoute("settings")} />
      </section>

      <section className="status-grid">
        <article className="status-card">
          <span className="status-card__label">Runtime</span>
          <strong>{client?.runtime ?? "Loading runtime"}</strong>
          <span className="status-card__detail">Minecraft {client?.minecraft ?? "1.8.9"}</span>
        </article>
        <article className="status-card">
          <span className="status-card__label">Session</span>
          <strong>{client?.account ?? "Resolving account"}</strong>
          <span className="status-card__detail status-card__detail--good">Authenticated</span>
        </article>
        <article className="status-card status-card--wide">
          <span className="status-card__label">Web Surface V2</span>
          <strong>CEF OSR · Retina aware</strong>
          <span className="status-card__detail">Generation-scoped input / negotiated frame transport</span>
        </article>
      </section>
    </div>
  );
}

function QuickAction({ title, subtitle, badge, onClick }: { title: string; subtitle: string; badge: string; onClick: () => void }) {
  return (
    <button className="quick-action glass-card" onClick={onClick}>
      <span className="quick-action__badge">{badge}</span>
      <span className="quick-action__text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="quick-action__arrow">↗</span>
    </button>
  );
}

function Modules({
  modules,
  allCount,
  query,
  selected,
  onQuery,
  onSelect,
  onToggle,
}: {
  modules: OpusModule[];
  allCount: number;
  query: string;
  selected: OpusModule | null;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="module-layout">
      <section className="module-list glass-card">
        <div className="section-toolbar">
          <div>
            <span className="section-kicker">LIBRARY</span>
            <strong>{allCount} information layers</strong>
          </div>
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search modules" />
        </div>
        <div className="module-list__items">
          {modules.map((module) => (
            <button
              key={module.id}
              className={`module-row ${selected?.id === module.id ? "module-row--selected" : ""}`}
              onClick={() => onSelect(module.id)}
            >
              <span className={`module-row__state ${module.enabled ? "module-row__state--on" : ""}`} />
              <span className="module-row__copy">
                <strong>{module.name}</strong>
                <small>{module.category}</small>
              </span>
              <span className="module-row__status">{module.status}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="module-detail glass-card">
        {selected ? (
          <>
            <div className="module-detail__head">
              <div>
                <span className="section-kicker">{selected.category.toUpperCase()}</span>
                <h2>{selected.name}</h2>
              </div>
              <button
                className={`switch ${selected.enabled ? "switch--on" : ""}`}
                onClick={() => void onToggle(selected.id)}
                aria-label={`Toggle ${selected.name}`}
                data-opus-module-toggle={selected.id}
              >
                <span />
              </button>
            </div>
            <p>{selected.description}</p>
            <div className="detail-divider" />
            <div className="detail-metric"><span>Status</span><strong>{selected.status}</strong></div>
            <div className="detail-metric"><span>Render path</span><strong>Native + Web</strong></div>
            <div className="detail-metric"><span>Profile</span><strong>Ranked Bedwars</strong></div>
          </>
        ) : (
          <div className="empty-state">No module selected.</div>
        )}
      </aside>
    </div>
  );
}

function Settings({ settings, onChange }: { settings: UiSettings; onChange: (next: UiSettings) => void }) {
  return (
    <div className="settings-layout">
      <section className="settings-card glass-card">
        <div className="settings-card__head">
          <div>
            <span className="section-kicker">INTERFACE</span>
            <h2>Presentation</h2>
          </div>
          <span className="settings-value">{Math.round(settings.uiScale * 100)}%</span>
        </div>
        <SettingRow title="UI scale" detail="Layout scale only. Browser zoom stays at 100%.">
          <input
            className="range"
            type="range"
            min="0.85"
            max="1.2"
            step="0.05"
            value={settings.uiScale}
            onChange={(event) => void onChange({ ...settings, uiScale: Number(event.target.value) })}
          />
        </SettingRow>
        <SettingRow title="Background blur" detail="Controls glass depth, not framebuffer resolution.">
          <input
            className="range"
            type="range"
            min="0"
            max="36"
            step="2"
            value={settings.backgroundBlur}
            onChange={(event) => void onChange({ ...settings, backgroundBlur: Number(event.target.value) })}
          />
        </SettingRow>
        <SettingRow title="Reduce motion" detail="Disable decorative transitions while keeping state feedback.">
          <Toggle value={settings.reduceMotion} onChange={(value) => void onChange({ ...settings, reduceMotion: value })} />
        </SettingRow>
        <SettingRow title="Compact mode" detail="Denser cards for smaller competitive setups.">
          <Toggle value={settings.compactMode} onChange={(value) => void onChange({ ...settings, compactMode: value })} />
        </SettingRow>
      </section>

      <section className="settings-card glass-card">
        <div className="settings-card__head">
          <div>
            <span className="section-kicker">ACCENT</span>
            <h2>Visual language</h2>
          </div>
        </div>
        <div className="accent-grid">
          {(["violet", "blue", "mono"] as const).map((accent) => (
            <button
              key={accent}
              className={`accent-card accent-card--${accent} ${settings.accent === accent ? "accent-card--active" : ""}`}
              onClick={() => void onChange({ ...settings, accent })}
              data-opus-accent={accent}
            >
              <span className="accent-card__swatch" />
              <strong>{accent}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}


const ORACLE_COLORS: Record<string, string> = {
  loading: "#081018",
  home: "#2a4cff",
  "modules-on": "#19b87a",
  "modules-off": "#e14e66",
  settings: "#8a5cff",
  "settings-changed": "#e99b39",
};

function OraclePixel({ state }: { state: string }) {
  return (
    <div
      id="opus-w5-oracle"
      data-opus-state={state}
      aria-hidden="true"
      style={{ backgroundColor: ORACLE_COLORS[state] ?? "#000000" }}
    />
  );
}

function SettingRow({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div><strong>{title}</strong><small>{detail}</small></div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`switch ${value ? "switch--on" : ""}`} onClick={() => onChange(!value)}>
      <span />
    </button>
  );
}
