import { useEffect, useMemo, useRef, useState } from "react";
import { bridge, isStandalone } from "./bridge/bridge";
import type { ClientInfo, GameOption, OpusModule, RouteId, UiSettings } from "./bridge/types";
import { Mark } from "./components/Mark";

type NavItem = { id: RouteId; label: string; code: string; section?: string };

const nav: NavItem[] = [
  { id: "title", label: "Overview", code: "01", section: "CLIENT" },
  { id: "singleplayer", label: "Singleplayer", code: "SP", section: "PLAY" },
  { id: "multiplayer", label: "Multiplayer", code: "MP" },
  { id: "mods_catalog", label: "Modules", code: "MD", section: "TOOLS" },
  { id: "settings", label: "Settings", code: "ST", section: "SYSTEM" },
  { id: "accounts", label: "Account", code: "ID" },
];

const routeTitles: Record<RouteId, string> = {
  title: "Overview",
  singleplayer: "Singleplayer",
  multiplayer: "Multiplayer",
  settings: "Settings",
  accounts: "Account",
  game_menu: "Game menu",
  quick_hub: "Quick hub",
  mods_catalog: "Modules",
  module_detail: "Module detail",
  hud_editor: "HUD editor",
};

function initialRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  const allowed: RouteId[] = ["title", "singleplayer", "multiplayer", "settings", "accounts", "game_menu", "quick_hub", "mods_catalog", "module_detail", "hud_editor"];
  return allowed.includes(hash as RouteId) ? (hash as RouteId) : "title";
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(initialRoute());
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
    if (!isStandalone) {
      void bridge.getNavigationState().then((state) => {
        if (state.current.id === route) return bridge.ackNavigation(state.revision);
      });
    }
  }, [route]);

  useEffect(() => {
    const sync = () => setRoute(initialRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "h") void goRoute("title");
      if (event.key.toLowerCase() === "m") void goRoute("mods_catalog");
      if (event.key.toLowerCase() === "s") void goRoute("settings");
      if (event.key === "Escape" && !isStandalone) {
        void bridge.back().then((state) => setRoute(state.current.id));
      }
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

  async function goRoute(next: RouteId) {
    if (isStandalone) {
      window.location.hash = `#/${next}`;
      setRoute(next);
      return;
    }
    const state = await bridge.navigate({ id: next });
    setRoute(state.current.id);
  }

  const oracleState = useMemo(() => {
    if (!client || !settings || modules.length === 0) return "loading";
    if (route === "title") return "home";
    if (route === "mods_catalog") return activeModule?.enabled ? "modules-on" : "modules-off";
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
    document.documentElement.dataset.density = next.compactMode ? "compact" : "normal";
    document.documentElement.dataset.accent = next.accent;
    await bridge.setUiSettings(next);
  }

  return (
    <div className="opus-shell">
      <OraclePixel state={oracleState} />
      <aside className="sidebar">
        <div className="brand-row">
          <Mark />
          <span className="build-tag">V2</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {nav.map((item) => (
            <div className="nav-block" key={item.id}>
              {item.section && <div className="nav-section">{item.section}</div>}
              <button
                className={`nav__item ${route === item.id ? "nav__item--active" : ""}`}
                onClick={() => void goRoute(item.id)}
                title={item.label}
                aria-label={item.label}
                data-opus-nav={item.id}
              >
                <span className="nav__code">{item.code}</span>
                <span className="nav__label">{item.label}</span>
              </button>
            </div>
          ))}
        </nav>
        <div className="identity-strip">
          <span className={`status-led ${client?.session === "online" ? "status-led--ok" : ""}`} />
          <span className="identity-strip__text">{client?.account ?? "Resolving"}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <span className="breadcrumb">OPUS / {route.toUpperCase()}</span>
            <strong>{routeTitles[route]}</strong>
          </div>
          <div className="topbar__meta">
            <span>MC {client?.minecraft ?? "1.8.9"}</span>
            <span>{client?.version ?? "DEV"}</span>
            <span className={`status-chip ${client?.session === "online" ? "status-chip--ok" : ""}`}>
              {client?.session ?? "offline"}
            </span>
          </div>
        </header>

        <section className="content" key={route}>
          {route === "title" && <Home client={client} modules={modules} onRoute={(next) => void goRoute(next)} onQuit={() => void bridge.performAction("quit")} />}
          {(route === "mods_catalog" || route === "module_detail") && (
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
          {route === "singleplayer" && <WorldRoute />}
          {route === "multiplayer" && <ServerRoute />}
          {route === "accounts" && <AccountRoute client={client} />}
          {route === "game_menu" && <GameMenuRoute onRoute={(next) => void goRoute(next)} />}
          {route === "quick_hub" && <QuickHubRoute onRoute={(next) => void goRoute(next)} />}
          {route === "hud_editor" && <HudEditorRoute />}
          {route === "settings" && settings && <Settings settings={settings} onChange={updateSettings} />}
        </section>
      </main>
    </div>
  );
}

function Home({
  client,
  modules,
  onRoute,
  onQuit,
}: {
  client: ClientInfo | null;
  modules: OpusModule[];
  onRoute: (route: RouteId) => void;
  onQuit: () => void;
}) {
  const enabled = modules.filter((module) => module.enabled).length;
  const stable = modules.filter((module) => module.status === "stable").length;
  return (
    <div className="dashboard-grid">
      <section className="surface dashboard-session">
        <PanelHeader index="01" title="Session" meta="LIVE" />
        <dl className="data-list">
          <DataRow label="Account" value={client?.account ?? "Resolving"} />
          <DataRow label="Runtime" value={client?.runtime ?? "Loading"} mono />
          <DataRow label="Minecraft" value={client?.minecraft ?? "1.8.9"} mono />
          <DataRow label="Build" value={client?.version ?? "dev"} mono />
        </dl>
      </section>

      <section className="surface dashboard-actions">
        <PanelHeader index="02" title="Commands" meta="ROUTES" />
        <div className="command-list">
          <CommandButton code="SP" label="Singleplayer" detail="Local worlds" onClick={() => onRoute("singleplayer")} />
          <CommandButton code="MP" label="Multiplayer" detail="Saved servers" onClick={() => onRoute("multiplayer")} />
          <CommandButton code="MD" label="Modules" detail="Information layers" onClick={() => onRoute("mods_catalog")} />
          <CommandButton code="ST" label="Settings" detail="Client + game" onClick={() => onRoute("settings")} />
          <CommandButton code="ID" label="Account" detail="Active identity" onClick={() => onRoute("accounts")} />
          <CommandButton code="X" label="Quit" detail="Close Minecraft" danger onClick={onQuit} />
        </div>
      </section>

      <section className="surface dashboard-modules">
        <PanelHeader index="03" title="Module state" meta={`${modules.length} TOTAL`} />
        <div className="metric-grid">
          <Metric label="Enabled" value={String(enabled).padStart(2, "0")} />
          <Metric label="Disabled" value={String(Math.max(0, modules.length - enabled)).padStart(2, "0")} />
          <Metric label="Stable" value={String(stable).padStart(2, "0")} />
        </div>
      </section>

      <section className="surface dashboard-runtime">
        <PanelHeader index="04" title="Surface" meta="WEB V2" />
        <dl className="data-list data-list--compact">
          <DataRow label="Renderer" value="CEF OSR" mono />
          <DataRow label="Transport" value="SHM / 3 SLOT" mono />
          <DataRow label="Input" value="GENERATION SCOPED" mono />
          <DataRow label="Music" value="DISABLED" mono />
        </dl>
      </section>
    </div>
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
      <section className="surface module-list">
        <div className="table-toolbar">
          <div className="table-toolbar__title"><span>MODULE INDEX</span><strong>{allCount}</strong></div>
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Filter modules" />
        </div>
        <div className="module-table" role="table">
          <div className="module-table__head" role="row">
            <span>STATE</span><span>MODULE</span><span>TYPE</span><span>STATUS</span>
          </div>
          <div className="module-table__body">
            {modules.map((module) => (
              <button
                key={module.id}
                className={`module-row ${selected?.id === module.id ? "module-row--selected" : ""}`}
                onClick={() => onSelect(module.id)}
              >
                <span className={`state-mark ${module.enabled ? "state-mark--on" : ""}`} />
                <span className="module-row__name">{module.name}</span>
                <span className="module-row__category">{module.category}</span>
                <span className="module-row__status">{module.status ?? "stable"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="surface module-detail">
        {selected ? (
          <>
            <PanelHeader index="DETAIL" title={selected.name} meta={selected.id.toUpperCase()} />
            <div className="detail-body">
              <p>{selected.description}</p>
              <dl className="data-list">
                <DataRow label="Category" value={selected.category.toUpperCase()} mono />
                <DataRow label="Status" value={(selected.status ?? "stable").toUpperCase()} mono />
                <DataRow label="Render" value="NATIVE + WEB" mono />
              </dl>
            </div>
            <div className="detail-footer">
              <span>{selected.enabled ? "Module active" : "Module inactive"}</span>
              <button
                className={`toggle-button ${selected.enabled ? "toggle-button--on" : ""}`}
                onClick={() => void onToggle(selected.id)}
                aria-label={`Toggle ${selected.name}`}
                data-opus-module-toggle={selected.id}
              >
                {selected.enabled ? "ENABLED" : "DISABLED"}
              </button>
            </div>
          </>
        ) : <div className="empty-state">No module selected.</div>}
      </aside>
    </div>
  );
}

function Settings({ settings, onChange }: { settings: UiSettings; onChange: (next: UiSettings) => void }) {
  const [options, setOptions] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);

  async function refreshOptions() {
    setLoading(true);
    try {
      setOptions(await bridge.getGameOptions());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshOptions(); }, []);

  async function adjust(option: GameOption, delta: number) {
    await bridge.adjustGameOption(option.key, delta);
    await refreshOptions();
  }

  async function setFloat(option: GameOption, value: number) {
    setOptions((current) => current.map((item) => item.key === option.key ? { ...item, value } : item));
    await bridge.setGameOptionFloat(option.key, value);
  }

  return (
    <div className="settings-layout">
      <section className="surface settings-section">
        <PanelHeader index="01" title="Interface" meta="OPUS" />
        <SettingRow title="Compact density" detail="Reduce vertical spacing and control height.">
          <Toggle value={settings.compactMode} onChange={(value) => void onChange({ ...settings, compactMode: value })} />
        </SettingRow>
        <SettingRow title="Reduce motion" detail="Disable non-essential transitions.">
          <Toggle value={settings.reduceMotion} onChange={(value) => void onChange({ ...settings, reduceMotion: value })} />
        </SettingRow>
        <SettingRow title="Accent" detail="State color only; structure remains monochrome.">
          <div className="segmented">
            {(["violet", "blue", "mono"] as const).map((accent) => (
              <button
                key={accent}
                className={settings.accent === accent ? "segmented__active" : ""}
                onClick={() => void onChange({ ...settings, accent })}
                data-opus-accent={accent}
              >{accent.toUpperCase()}</button>
            ))}
          </div>
        </SettingRow>
      </section>

      <section className="surface settings-section settings-section--game">
        <PanelHeader index="02" title="Game settings" meta={loading ? "READING" : `${options.length} OPTIONS`} />
        <div className="game-options">
          {loading && <div className="empty-state">Reading game settings…</div>}
          {options.map((option) => (
            <GameOptionRow key={option.key} option={option} onAdjust={adjust} onFloat={setFloat} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GameOptionRow({
  option,
  onAdjust,
  onFloat,
}: {
  option: GameOption;
  onAdjust: (option: GameOption, delta: number) => void;
  onFloat: (option: GameOption, value: number) => void;
}) {
  const value = Number.isFinite(option.value) ? option.value : 0;
  return (
    <div className="game-option-row">
      <div className="game-option-row__label">
        <strong>{option.label}</strong>
        <span>{option.key}</span>
      </div>
      {option.type === "float" ? (
        <div className="game-option-row__slider">
          <input
            type="range"
            min={option.min}
            max={option.max}
            step={option.step}
            value={value}
            onChange={(event) => void onFloat(option, Number(event.target.value))}
          />
          <span>{Math.round(value * 100)}%</span>
        </div>
      ) : (
        <button className="cycle-button" onClick={() => void onAdjust(option, 1)}>
          {option.type === "boolean" ? (value >= 0.5 ? "ON" : "OFF") : "CYCLE"}
        </button>
      )}
    </div>
  );
}

function WorldRoute() {
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void bridge.getWorlds().then((items) => { if (active) setWorlds(items); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <section className="surface route-table">
      <PanelHeader index="WORLD" title="Local worlds" meta={loading ? "READING" : `${worlds.length} FOUND`} />
      <div className="route-table__body">
        {loading && <div className="empty-state">Reading worlds…</div>}
        {!loading && worlds.length === 0 && <div className="empty-state">No local worlds found.</div>}
        {worlds.map((world) => (
          <button className="route-row" key={world.id} onClick={() => void bridge.loadWorld(world.id)}>
            <span className="route-row__main"><strong>{world.name}</strong><small>{world.id}</small></span>
            <span className="route-row__action">OPEN</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ServerRoute() {
  const [servers, setServers] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void bridge.getServers().then((items) => { if (active) setServers(items); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <section className="surface route-table">
      <PanelHeader index="NET" title="Saved servers" meta={loading ? "READING" : `${servers.length} FOUND`} />
      <div className="route-table__body">
        {loading && <div className="empty-state">Reading servers…</div>}
        {!loading && servers.length === 0 && <div className="empty-state">No saved servers found.</div>}
        {servers.map((server) => (
          <button className="route-row" key={server.id} onClick={() => void bridge.connectServer(server.address)}>
            <span className="route-row__main"><strong>{server.name}</strong><small>{server.address}</small></span>
            <span className="route-row__action">JOIN</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AccountRoute({ client }: { client: ClientInfo | null }) {
  return (
    <section className="surface account-panel">
      <PanelHeader index="ID" title="Active identity" meta={client?.session?.toUpperCase() ?? "OFFLINE"} />
      <dl className="data-list">
        <DataRow label="Account" value={client?.account ?? "Unknown"} />
        <DataRow label="Session" value={client?.session?.toUpperCase() ?? "OFFLINE"} mono />
        <DataRow label="Runtime" value={client?.runtime ?? "Unknown"} mono />
        <DataRow label="Client build" value={client?.version ?? "dev"} mono />
      </dl>
    </section>
  );
}

function GameMenuRoute({ onRoute }: { onRoute: (route: RouteId) => void }) {
  return (
    <section className="surface command-surface">
      <PanelHeader index="GAME" title="Session commands" meta="PAUSED" />
      <div className="command-list command-list--wide">
        <CommandButton code="ESC" label="Resume" detail="Return to gameplay" onClick={() => void bridge.close()} />
        <CommandButton code="QH" label="Quick hub" detail="Competitive controls" onClick={() => onRoute("quick_hub")} />
        <CommandButton code="MD" label="Modules" detail="Information layers" onClick={() => onRoute("mods_catalog")} />
        <CommandButton code="OUT" label="Leave world" detail="Return to title" danger onClick={() => void bridge.leaveWorld()} />
      </div>
    </section>
  );
}

function QuickHubRoute({ onRoute }: { onRoute: (route: RouteId) => void }) {
  return (
    <section className="surface command-surface">
      <PanelHeader index="QH" title="Quick hub" meta="IN-GAME" />
      <div className="command-list command-list--wide">
        <CommandButton code="MD" label="Modules" detail="Toggle information layers" onClick={() => onRoute("mods_catalog")} />
        <CommandButton code="HUD" label="HUD editor" detail="Arrange native widgets" onClick={() => onRoute("hud_editor")} />
        <CommandButton code="ST" label="Settings" detail="Client + game" onClick={() => onRoute("settings")} />
        <CommandButton code="ESC" label="Close" detail="Return to gameplay" onClick={() => void bridge.close()} />
      </div>
    </section>
  );
}

function HudEditorRoute() {
  const canvas = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const report = async () => {
      if (!canvas.current || cancelled) return;
      const state = await bridge.getNavigationState();
      const rect = canvas.current.getBoundingClientRect();
      await bridge.reportHudEditorCanvas(state.revision, {
        x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height),
      });
    };
    void report();
    window.addEventListener("resize", report);
    return () => { cancelled = true; window.removeEventListener("resize", report); };
  }, []);
  return (
    <section className="surface hud-editor-shell">
      <PanelHeader index="HUD" title="Native layout canvas" meta="LIVE" />
      <div ref={canvas} className="hud-editor-canvas">
        <span className="crosshair crosshair--x" />
        <span className="crosshair crosshair--y" />
        <span className="hud-editor-canvas__label">NATIVE HUD REGION</span>
      </div>
    </section>
  );
}

function PanelHeader({ index, title, meta }: { index: string; title: string; meta: string }) {
  return (
    <div className="panel-header">
      <span className="panel-header__index">{index}</span>
      <strong>{title}</strong>
      <span className="panel-header__meta">{meta}</span>
    </div>
  );
}

function CommandButton({
  code,
  label,
  detail,
  onClick,
  danger = false,
}: {
  code: string;
  label: string;
  detail: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button className={`command-button ${danger ? "command-button--danger" : ""}`} onClick={onClick}>
      <span className="command-button__code">{code}</span>
      <span className="command-button__copy"><strong>{label}</strong><small>{detail}</small></span>
      <span className="command-button__arrow">›</span>
    </button>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="data-row"><dt>{label}</dt><dd className={mono ? "mono" : ""}>{value}</dd></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function SettingRow({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-row__copy"><strong>{title}</strong><small>{detail}</small></div>
      <div className="setting-row__control">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <button className={`binary-toggle ${value ? "binary-toggle--on" : ""}`} onClick={() => onChange(!value)}>{value ? "ON" : "OFF"}</button>;
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
  return <div id="opus-w5-oracle" data-opus-state={state} aria-hidden="true" style={{ backgroundColor: ORACLE_COLORS[state] ?? "#000000" }} />;
}
