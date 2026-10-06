import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { bridge, isStandalone } from "./bridge/bridge";
import { classifyHostNavigation, shouldPlayAmbientVideo, syncAmbientVideo } from "./surfaceSession";
import { AccountMenu, AccountsRoute } from "./components/Accounts";
import type { AccountCatalogStatus, AccountFeedbackState, AccountView } from "./components/Accounts";
import { UiIcon } from "./components/ui/UiIcon";
import type { UiIconName } from "./components/ui/UiIcon";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { OpusControlCenter } from "./components/OpusControlCenter";
import { HudEditor } from "./components/HudEditor";
import { HomeScene } from "./components/HomeScene";
import { ActionRow, Button, Modal, Panel, ScrollArea, SearchField, Toggle } from "./components/ui";
import type {
  AccountSummary,
  ClientInfo,
  ConnectionState,
  OpusModule,
  NavigationState,
  RouteId,
  RouteRef,
  ServerInfo,
  ServerStatus,
  UiSettings,
  WorldInfo,
} from "./bridge/types";

type DevelopmentBoundaryKind =
  | "connect-server"
  | "disconnect"
  | "load-world"
  | "create-world"
  | "minecraft-settings"
  | "quit"
  | "resume";

type DevelopmentBoundary = {
  kind: DevelopmentBoundaryKind;
  subject?: string;
};

const routeTitles: Record<RouteId, string> = {
  title: "Home",
  singleplayer: "Singleplayer",
  multiplayer: "Multiplayer",
  connection: "Connection",
  settings: "Client Settings",
  accounts: "Accounts",
  game_menu: "Pause Menu",
  quick_hub: "Client",
  mods_catalog: "Modules",
  module_detail: "Module Detail",
  hud_editor: "HUD Editor",
};

const validRoutes: readonly RouteId[] = [
  "title",
  "singleplayer",
  "multiplayer",
  "connection",
  "settings",
  "accounts",
  "game_menu",
  "quick_hub",
  "mods_catalog",
  "module_detail",
  "hud_editor",
];

const showBootPreview = isStandalone
  && new URLSearchParams(window.location.search).get("preview") === "boot";

function bootPreviewProgress(): number {
  const raw = Number(new URLSearchParams(window.location.search).get("progress"));
  if (!Number.isFinite(raw)) return 68;
  return Math.max(8, Math.min(96, Math.round(raw)));
}

function routeFromFixtureHash(): RouteRef {
  const source = window.location.hash.replace(/^#\/?/, "");
  const [candidate, query] = source.split("?", 2);
  const id = validRoutes.includes(candidate as RouteId) ? candidate as RouteId : "title";
  const params = new URLSearchParams(query ?? "");

  if (id === "module_detail") {
    const moduleId = params.get("moduleId");
    return moduleId ? { id, params: { moduleId } } : { id };
  }
  if (id === "settings") {
    const settingsSection = params.get("settingsSection");
    return settingsSection === "interface" || settingsSection === "game"
      ? { id, params: { settingsSection } }
      : { id };
  }
  return { id };
}

function connectionFromFixtureHash(): ConnectionState | null {
  const source = window.location.hash.replace(/^#\/?/, "");
  const [candidate, query] = source.split("?", 2);
  if (candidate !== "connection") return null;

  const params = new URLSearchParams(query ?? "");
  const requestedPhase = params.get("phase");
  const phase: ConnectionState["phase"] = requestedPhase === "loading" || requestedPhase === "disconnected"
    ? requestedPhase
    : "connecting";
  const defaults = phase === "loading"
    ? { title: "Loading terrain", detail: "Joining world…" }
    : phase === "disconnected"
      ? { title: "Disconnected", detail: "The connection was closed by the remote host." }
      : { title: "Connecting", detail: "Contacting server…" };

  return {
    phase,
    title: params.get("title") ?? defaults.title,
    detail: params.get("detail") ?? defaults.detail,
    serverName: params.get("serverName") ?? params.get("server") ?? "Example Network",
    serverAddress: params.get("serverAddress") ?? params.get("address") ?? "play.example.net",
    canCancel: phase === "connecting",
  };
}

function fixtureConnectionCanGoBack(connection: ConnectionState | null): boolean {
  return connection?.phase === "disconnected"
    || (connection?.phase === "connecting" && connection.canCancel);
}

const initialFixtureRoute: RouteRef = isStandalone ? routeFromFixtureHash() : { id: "title" };
const initialFixtureConnection = isStandalone ? connectionFromFixtureHash() : null;

function fixtureHash(route: RouteRef): string {
  const query = new URLSearchParams();
  if (route.params?.moduleId) query.set("moduleId", route.params.moduleId);
  if (route.params?.settingsSection) query.set("settingsSection", route.params.settingsSection);
  const suffix = query.toString();
  return `#/${route.id}${suffix ? `?${suffix}` : ""}`;
}

function serverStatusKey(address: string): string {
  return address.trim().toLowerCase();
}

function indexServerStatuses(statuses: ServerStatus[]): Record<string, ServerStatus> {
  const next: Record<string, ServerStatus> = {};
  for (const status of statuses) {
    if (status.address.trim()) next[serverStatusKey(status.address)] = status;
  }
  return next;
}

function serverMessage(status: ServerStatus | null): string {
  if (!status) return "Live status unavailable";
  if (status.state === "checking") return "Checking server status…";
  if (status.state === "offline") return "Server unavailable";
  return status.motd?.trim() || "No server message";
}

function serverStateLabel(status: ServerStatus | null): string {
  if (!status) return "Unavailable";
  if (status.state === "checking") return "Checking";
  if (status.state === "offline") return "Offline";
  return "Online";
}

function serverPopulation(status: ServerStatus | null): string | null {
  if (!status || status.state !== "online" || status.onlinePlayers === undefined) return null;
  return status.maxPlayers === undefined
    ? `${status.onlinePlayers} players`
    : `${status.onlinePlayers} / ${status.maxPlayers}`;
}

function applyUiSettings(settings: UiSettings) {
  const root = document.documentElement;
  root.dataset.density = settings.compactMode ? "compact" : "normal";
  root.dataset.accent = settings.accent;
  root.dataset.reduceMotion = settings.reduceMotion ? "true" : "false";
  root.style.setProperty("--glass-blur", `${Math.max(12, Math.min(34, settings.backgroundBlur))}px`);
}

function textEntryTarget(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (target instanceof HTMLTextAreaElement) return target.readOnly || target.disabled ? null : target;
  if (!(target instanceof HTMLInputElement) || target.readOnly || target.disabled) return null;
  return ["text", "search", "url", "email", "tel", "password"].includes(target.type) ? target : null;
}

function replaceTextSelection(target: HTMLInputElement | HTMLTextAreaElement, replacement: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const next = `${target.value.slice(0, start)}${replacement}${target.value.slice(end)}`;
  const valueSetter = Object.getOwnPropertyDescriptor(
    target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(target, next);
  const caret = start + replacement.length;
  target.setSelectionRange(caret, caret);
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

function boundaryCopy(boundary: DevelopmentBoundary): { title: string; detail: string } {
  switch (boundary.kind) {
    case "create-world":
      return {
        title: "Create world",
        detail: "The embedded client opens Minecraft’s real Create World screen. This browser preview does not create or change a save.",
      };
    case "load-world":
      return {
        title: "Launch world",
        detail: `${boundary.subject ?? "This world"} is a Minecraft-owned action. The browser preview keeps the selected world visible but does not start a game process.`,
      };
    case "connect-server":
      return {
        title: "Connect to server",
        detail: `${boundary.subject ?? "This server"} is a Minecraft-owned network action. The browser preview does not create a session or claim that a connection succeeded.`,
      };
    case "minecraft-settings":
      return {
        title: "Minecraft Settings",
        detail: "The embedded client opens Minecraft’s own settings screen. This browser preview stops at that host boundary.",
      };
    case "quit":
      return {
        title: "Quit Minecraft",
        detail: "The embedded client asks Minecraft to close. The browser preview intentionally leaves this development host running.",
      };
    case "disconnect":
      return {
        title: "Disconnect",
        detail: "Leaving a world belongs to Minecraft. This browser preview does not alter a game session.",
      };
    case "resume":
      return {
        title: "Resume game",
        detail: "Closing an in-game overlay returns focus to Minecraft. This browser preview has no gameplay session to resume.",
      };
  }
}

export default function App() {
  const [route, setRoute] = useState<RouteRef>(initialFixtureRoute);
  const [fixtureHistory, setFixtureHistory] = useState<RouteRef[]>([]);
  const [canGoBack, setCanGoBack] = useState(() => fixtureConnectionCanGoBack(initialFixtureConnection));
  const [canCloseToGame, setCanCloseToGame] = useState(false);
  const [connection, setConnection] = useState<ConnectionState | null>(initialFixtureConnection);
  const [surfaceActive, setSurfaceActive] = useState(isStandalone);
  const [hostRouteRevision, setHostRouteRevision] = useState(0);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [modules, setModules] = useState<OpusModule[]>([]);
  const [moduleValuesUnconfirmed, setModuleValuesUnconfirmed] = useState(false);
  const [moduleValuesRefreshing, setModuleValuesRefreshing] = useState(false);
  const moduleOperationInFlight = useRef(false);
  const moduleRefreshQueued = useRef(false);
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsCatalog, setAccountsCatalog] = useState<AccountCatalogStatus>("unavailable");
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsView, setAccountsView] = useState<AccountView>("list");
  const [accountFeedback, setAccountFeedback] = useState<AccountFeedbackState>({ pendingId: null, message: null, error: null });
  const accountOperationInFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [worldsRefreshing, setWorldsRefreshing] = useState(false);
  const [openingCreateWorld, setOpeningCreateWorld] = useState(false);
  const createWorldInFlight = useRef(false);
  const [serversRefreshing, setServersRefreshing] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [leavingWorld, setLeavingWorld] = useState(false);
  const leaveWorldInFlight = useRef(false);
  const dismissInFlight = useRef(false);
  const [query, setQuery] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<DevelopmentBoundary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fixtureHashChange = useRef(false);
  const lastHostRevision = useRef(0);

  useEffect(() => {
    let active = true;
    async function loadPrototypeData() {
      try {
        const [nextClient, nextModules, nextSettings, nextWorlds, nextServers] = await Promise.all([
          bridge.getClient(),
          bridge.getModules(),
          bridge.getUiSettings(),
          bridge.getWorlds(),
          bridge.getServers(),
        ]);
        if (!active) return;
        setClient(nextClient);
        setModules(nextModules);
        setSettings(nextSettings);
        applyUiSettings(nextSettings);
        setWorlds(nextWorlds);
        setServers(nextServers);
        setSelectedModuleId(nextModules[0]?.id ?? null);
      } catch {
        if (active) setError("The client fixture could not load its initial data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPrototypeData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    bridge.getAccounts().then(next => {
      if (active) { setAccounts(next); setAccountsCatalog("ready"); }
    }).catch(() => {
      if (active) setAccountFeedback({ pendingId: null, message: null,
        error: "Could not read saved accounts. Open Manage Accounts and refresh to try again." });
    }).finally(() => { if (active) setAccountsLoading(false); });
    return () => { active = false; };
  }, []);

  function applyHostNavigation(state: NavigationState): "ignored" | "closed" | "route" {
    const result = classifyHostNavigation(state, lastHostRevision.current);
    if (result.kind === "ignored") return result.kind;
    lastHostRevision.current = result.revision;
    if (result.kind === "closed") {
      // Java has returned to gameplay. Keep the last route in the parked DOM
      // but discard transient UI and stop its background work until reopened.
      setSurfaceActive(false);
      setCanGoBack(false);
      setBoundary(null);
      setError(null);
      return result.kind;
    }
    setSurfaceActive(true);
    setRoute(result.route);
    setHostRouteRevision(result.revision);
    setCanGoBack(state.canGoBack);
    setCanCloseToGame(state.canCloseToGame ?? false);
    setConnection(result.route.id === "connection" ? result.connection ?? null : null);
    if (result.route.params?.moduleId) setSelectedModuleId(result.route.params.moduleId);
    return result.kind;
  }

  useLayoutEffect(() => {
    if (isStandalone || !surfaceActive || hostRouteRevision < 1) return;
    // ACK only after React has committed the new route DOM. Java then asks
    // CEF for a new transport generation, so a retained old-route paint can
    // neither be uploaded as current nor receive input.
    if (new URLSearchParams(window.location.search).has("opusMediaProbe")) {
      console.info(`OPUS_ROUTE_COMMITTED revision=${hostRouteRevision} route=${route.id}`);
    }
    // A React commit precedes Chromium's paint. ACKing in this layout effect
    // lets CEF invalidate its cached Home raster before the new transparent
    // route is painted (observed by the first-Pause-frame contract). Cross a
    // browser paint boundary before asking Java to publish a new generation.
    // This is render scheduling, not a boot timeout or weakened input gate.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        void bridge.ackNavigation(hostRouteRevision).catch(() => {
          // A replacement native revision legitimately revokes this ACK.
        });
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, hostRouteRevision, surfaceActive]);

  useEffect(() => {
    if (isStandalone) return;
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let bootstrapPoll: number | undefined;
    async function syncHostNavigation() {
      try {
        const state = await bridge.getNavigationState();
        if (!active) return;
        if (applyHostNavigation(state) === "route" && bootstrapPoll !== undefined) {
          window.clearInterval(bootstrapPoll);
          bootstrapPoll = undefined;
        }
      } catch {
        if (active) setError("The embedded client could not read the current navigation state.");
      }
    }
    // Java can commit the first title route *after* CEF has loaded #/title.
    // Navigating to that same URL does not fire hashchange. Subscribe to the
    // bridge event, then re-read Java's authoritative revision on connection
    // (which also closes the subscribe/commit race).
    const socketUrl = new URL("/ws", window.location.href);
    socketUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const authCode = new URLSearchParams(window.location.search).get("code");
    if (authCode) socketUrl.searchParams.set("code", authCode);
    function connect() {
      if (!active) return;
      try {
        socket = new WebSocket(socketUrl.href);
        socket.onopen = () => { void syncHostNavigation(); };
        socket.onmessage = (message) => {
          try {
            if (JSON.parse(message.data).name === "uiNavigationChanged") {
              void syncHostNavigation();
            }
          } catch { /* Ignore unrelated or malformed bridge events. */ }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
          if (active) reconnectTimer = window.setTimeout(connect, 500);
        };
      } catch {
        if (active) reconnectTimer = window.setTimeout(connect, 500);
      }
    }
    // Until the first committed route arrives, polling covers a helper that
    // cannot establish its event socket. It stops immediately after revision 1.
    bootstrapPoll = window.setInterval(() => { void syncHostNavigation(); }, 250);
    const onHostFragmentChange = () => { void syncHostNavigation(); };
    window.addEventListener("hashchange", onHostFragmentChange);
    connect();
    void syncHostNavigation();
    return () => {
      active = false;
      window.removeEventListener("hashchange", onHostFragmentChange);
      if (bootstrapPoll !== undefined) window.clearInterval(bootstrapPoll);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (!isStandalone) return;
    const onHashChange = () => {
      if (fixtureHashChange.current) {
        fixtureHashChange.current = false;
        return;
      }
      const next = routeFromFixtureHash();
      const nextConnection = next.id === "connection" ? connectionFromFixtureHash() : null;
      setRoute(next);
      setConnection(nextConnection);
      setCanGoBack(next.id === "connection" ? fixtureConnectionCanGoBack(nextConnection) : false);
      setFixtureHistory([]);
      if (next.params?.moduleId) setSelectedModuleId(next.params.moduleId);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.body.dataset.route = showBootPreview ? "boot" : route.id;
    if (route.params?.moduleId) setSelectedModuleId(route.params.moduleId);
  }, [route]);

  useEffect(() => {
    if (loading || !surfaceActive
      || !["settings", "quick_hub", "mods_catalog", "module_detail"].includes(route.id)) return;
    // Reopening the retained SPA or returning from native HUD editing must
    // read current settings rather than reusing the boot-time snapshot.
    // Keep one trailing read when an earlier request is still in flight: its
    // snapshot may predate a native HUD edit made while this panel was away.
    if (moduleOperationInFlight.current) { moduleRefreshQueued.current = true; return; }
    void refreshModules().catch(() => { /* The panel exposes unconfirmed state and Refresh. */ });
  }, [loading, surfaceActive, route.id, hostRouteRevision]);

  useEffect(() => {
    if (!surfaceActive || route.id !== "multiplayer" || servers.length === 0) return;
    let active = true;

    async function syncStatuses(refresh: boolean) {
      try {
        const nextStatuses = await bridge.getServerStatuses(refresh);
        if (active) setServerStatuses(indexServerStatuses(nextStatuses));
      } catch {
        if (active && refresh) setServerStatuses({});
      }
    }

    void syncStatuses(true);
    const interval = window.setInterval(() => void syncStatuses(false), 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [surfaceActive, route.id, servers]);

  function mirrorFixtureRoute(next: RouteRef) {
    const nextHash = fixtureHash(next);
    if (window.location.hash === nextHash) return;
    fixtureHashChange.current = true;
    window.location.hash = nextHash;
  }

  async function goRoute(id: RouteId, params?: RouteRef["params"]) {
    if (leaveWorldInFlight.current) return;
    const next: RouteRef = params ? { id, params } : { id };
    setError(null);
    if (next.params?.moduleId) setSelectedModuleId(next.params.moduleId);

    if (isStandalone) {
      setFixtureHistory((history) => [...history, route]);
      setRoute(next);
      setConnection(null);
      setCanGoBack(true);
      mirrorFixtureRoute(next);
      return;
    }

    try {
      const state = await bridge.navigate(next, hostRouteRevision);
      applyHostNavigation(state);
    } catch {
      setError("That client route is unavailable right now. You can stay here or try again.");
    }
  }

  async function goBack() {
    if (leaveWorldInFlight.current) return;
    setError(null);
    if (isStandalone) {
      if (fixtureHistory.length === 0) {
        const home: RouteRef = { id: "title" };
        setRoute(home);
        setConnection(null);
        setCanGoBack(false);
        mirrorFixtureRoute(home);
        return;
      }
      const previous = fixtureHistory[fixtureHistory.length - 1];
      setFixtureHistory((history) => history.slice(0, -1));
      setRoute(previous);
      setConnection(null);
      setCanGoBack(fixtureHistory.length > 1);
      mirrorFixtureRoute(previous);
      return;
    }

    try {
      const state = await bridge.back(hostRouteRevision);
      applyHostNavigation(state);
    } catch {
      setError("Back is unavailable until the client navigation state is ready.");
    }
  }

  const hasBack = route.id === "connection"
    ? connection?.phase !== "loading" && canGoBack
    : isStandalone ? route.id !== "title" : canGoBack;

  async function dismissOverlay() {
    if (!surfaceActive || dismissInFlight.current || leaveWorldInFlight.current
      || (route.id === "connection" && connection?.phase === "loading")) return;
    dismissInFlight.current = true;
    try {
      if (hasBack) await goBack();
      else if (canCloseToGame || (isStandalone && route.id === "game_menu")) await closeToGameplay();
    } finally {
      dismissInFlight.current = false;
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const entry = textEntryTarget(event.target);
      if (entry && event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "a") {
          event.preventDefault();
          entry.select();
          return;
        }
        if (key === "c" || key === "x") {
          const start = entry.selectionStart ?? 0;
          const end = entry.selectionEnd ?? start;
          if (end > start) {
            event.preventDefault();
            const selected = entry.value.slice(start, end);
            const copied = document.execCommand("copy");
            if (!copied && navigator.clipboard?.writeText) void navigator.clipboard.writeText(selected);
            if (key === "x") replaceTextSelection(entry, "");
          }
          return;
        }
        if (key === "v" && navigator.clipboard?.readText) {
          event.preventDefault();
          void navigator.clipboard.readText().then((value) => replaceTextSelection(entry, value));
          return;
        }
      }
      if (event.key !== "Escape" || event.defaultPrevented || !surfaceActive) return;
      if (boundary) {
        event.preventDefault();
        setBoundary(null);
        return;
      }
      if (!hasBack && !canCloseToGame && !(isStandalone && route.id === "game_menu")) return;
      event.preventDefault();
      void dismissOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [boundary, fixtureHistory, hasBack, canCloseToGame, route, connection, surfaceActive, hostRouteRevision]);

  const filteredModules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? modules.filter((module) => `${module.name} ${module.description} ${module.category}`.toLowerCase().includes(normalized))
      : modules;
  }, [modules, query]);

  const selectedWorld = worlds.find((world) => world.id === selectedWorldId) ?? null;
  const selectedServer = servers.find((server) => server.id === selectedServerId) ?? null;
  // A next-launch selection must never replace the actual session identity.
  const currentAccount = client
    ? accounts.find(account => account.username === client.account
      && account.kind === (client.accountKind === "official" ? "microsoft" : "offline")) ?? null
    : accounts.find(account => account.current) ?? null;
  const activeModuleId = route.params?.moduleId ?? selectedModuleId;
  const activeModule = modules.find((module) => module.id === activeModuleId) ?? null;
  async function refreshWorlds() {
    setError(null);
    setWorldsRefreshing(true);
    try {
      const nextWorlds = await bridge.getWorlds();
      setWorlds(nextWorlds);
      setSelectedWorldId((current) => current && nextWorlds.some((world) => world.id === current) ? current : null);
    } catch {
      setError("Minecraft could not refresh the local world list. Your last visible list was kept.");
    } finally {
      setWorldsRefreshing(false);
    }
  }

  async function refreshServers() {
    setError(null);
    setServersRefreshing(true);
    try {
      const nextServers = await bridge.getServers();
      setServers(nextServers);
      setSelectedServerId((current) => current && nextServers.some((server) => server.id === current) ? current : null);
    } catch {
      setError("Minecraft could not refresh the saved server list. Your last visible list was kept.");
    } finally {
      setServersRefreshing(false);
    }
  }

  async function launchWorld() {
    if (!selectedWorld) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "load-world", subject: selectedWorld.name });
      return;
    }
    try {
      await bridge.loadWorld(selectedWorld.id);
    } catch {
      setError("Minecraft could not load that world. The selected world is still available.");
    }
  }

  async function createWorld() {
    if (createWorldInFlight.current) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "create-world" });
      return;
    }
    createWorldInFlight.current = true;
    setOpeningCreateWorld(true);
    try {
      await bridge.performAction("create-world", hostRouteRevision);
    } catch {
      setError("Minecraft could not open Create World. Try again from the world list.");
    } finally {
      createWorldInFlight.current = false;
      setOpeningCreateWorld(false);
    }
  }

  async function connectServer(server: Pick<ServerInfo, "name" | "address">) {
    const address = server.address.trim();
    if (!address) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "connect-server", subject: server.name || address });
      return;
    }
    try {
      await bridge.connectServer(address);
    } catch {
      setError("Minecraft could not begin that connection. The selected server is still available.");
    }
  }

  async function addServer(name: string, rawAddress: string): Promise<boolean> {
    const address = rawAddress.trim();
    if (!address) {
      setError("Enter a server address before saving it.");
      return false;
    }

    setError(null);
    setSavingServer(true);
    try {
      await bridge.addServer(name.trim(), address);
      const nextServers = await bridge.getServers();
      const saved = nextServers.find((server) => server.address.toLowerCase() === address.toLowerCase());
      setServers(nextServers);
      setSelectedServerId(saved?.id ?? null);
      return true;
    } catch {
      setError("Minecraft could not save that server. Check the address and try again.");
      return false;
    } finally {
      setSavingServer(false);
    }
  }

  async function performMinecraftSettings() {
    if (leaveWorldInFlight.current) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "minecraft-settings" });
      return;
    }
    try {
      await bridge.performAction("minecraft-settings", hostRouteRevision);
    } catch {
      setError("Minecraft Settings could not open from the current client state.");
    }
  }

  async function performQuit() {
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "quit" });
      return;
    }
    try {
      await bridge.performAction("quit");
    } catch {
      setError("Minecraft did not accept the quit request.");
    }
  }

  async function closeToGameplay() {
    if (leaveWorldInFlight.current) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "resume" });
      return;
    }
    try {
      applyHostNavigation(await bridge.close(hostRouteRevision));
    } catch {
      setError("The client overlay could not close to gameplay.");
    }
  }

  async function leaveWorld() {
    if (leaveWorldInFlight.current) return;
    setError(null);
    if (isStandalone) {
      setBoundary({ kind: "disconnect" });
      return;
    }
    leaveWorldInFlight.current = true;
    setLeavingWorld(true);
    try {
      await bridge.leaveWorld();
    } catch {
      setError("Minecraft could not leave the current world.");
    } finally {
      leaveWorldInFlight.current = false;
      setLeavingWorld(false);
    }
  }

  async function saveModuleValue(id: string, key: string, value: string) {
    if (moduleOperationInFlight.current) throw new Error("A module change is already in progress.");
    if (moduleValuesUnconfirmed) throw new Error("Refresh module values before editing again.");
    const module = modules.find(item => item.id === id);
    if (!module || (key !== "enabled" && !module.settings?.some(item => item.key === key))) {
      throw new Error("This module option is unavailable in your current runtime.");
    }
    moduleOperationInFlight.current = true;
    const confirm = (next: OpusModule[]) => {
      setModules(next);
      setModuleValuesUnconfirmed(false);
      const saved = next.find(item => item.id === id);
      return key === "enabled" ? saved?.enabled === (value === "1")
        : saved?.settings?.find(item => item.key === key)?.value === value;
    };
    try {
      if (key === "enabled") await bridge.setModuleEnabled(id, value === "1");
      else await bridge.setModuleSetting(id, key, value);
      if (!confirm(await bridge.getModules())) throw new Error("The client did not confirm that value.");
    } catch {
      // A lost POST response may still have persisted. Refresh actual values;
      // never paint the requested state as saved based on an optimistic draft.
      try { if (confirm(await bridge.getModules())) return; }
      catch { setModuleValuesUnconfirmed(true); }
      throw new Error("Could not confirm this change. Values were refreshed where possible; try again.");
    } finally { finishModuleOperation(); }
  }

  function finishModuleOperation() {
    moduleOperationInFlight.current = false;
    if (!moduleRefreshQueued.current) return;
    moduleRefreshQueued.current = false;
    void refreshModules().catch(() => { /* Refresh failure is exposed by the panel. */ });
  }

  async function refreshModules() {
    if (moduleOperationInFlight.current) throw new Error("A module change is already in progress.");
    moduleOperationInFlight.current = true;
    setModuleValuesRefreshing(true);
    try { setModules(await bridge.getModules()); setModuleValuesUnconfirmed(false); }
    catch {
      setModuleValuesUnconfirmed(true);
      throw new Error("Could not read module values. Your last values are unconfirmed; refresh again.");
    } finally { setModuleValuesRefreshing(false); finishModuleOperation(); }
  }

  async function toggleModule(id: string) {
    const module = modules.find(item => item.id === id);
    if (!module) return;
    try { await saveModuleValue(id, "enabled", module.enabled ? "0" : "1"); }
    catch (error) {
      setError(error instanceof Error ? error.message : "Could not save module state.");
    }
  }

  async function updateSettings(next: UiSettings) {
    if (!isStandalone) {
      setError("Client setting persistence is not available through the embedded host yet.");
      return;
    }
    setError(null);
    setSettings(next);
    applyUiSettings(next);
    try {
      await bridge.setUiSettings(next);
    } catch {
      setError("The browser fixture could not save that client setting.");
    }
  }

  async function selectAccount(id: string) {
    if (accountOperationInFlight.current || accountsLoading || accountsCatalog !== "ready") return;
    const account = accounts.find(item => item.id === id);
    if (!account || account.selected) return;
    accountOperationInFlight.current = true;
    setAccountFeedback({ pendingId: id, message: `Saving ${account.username} for the next launch…`, error: null });
    const confirm = (next: AccountSummary[]) => {
      setAccounts(next);
      setAccountsCatalog("ready");
      const saved = next.find(item => item.id === id && item.selected);
      setAccountFeedback(saved
        ? { pendingId: null, message: `${saved.username} is selected for the next launch. Your current session stays unchanged.`, error: null }
        : { pendingId: null, message: null, error: "Could not confirm that selection. Saved accounts were refreshed; choose an account and try again." });
    };
    try {
      const next = await bridge.selectAccount(id);
      if (!next.some(item => item.id === id && item.selected)) throw new Error("Selection not confirmed");
      confirm(next);
    } catch {
      // A lost response does not mean the write failed. Read persisted state
      // before asserting a result; keep duplicate submissions blocked meanwhile.
      try { confirm(await bridge.getAccounts()); }
      catch {
        setAccountsCatalog("unconfirmed");
        setAccountFeedback({ pendingId: null, message: null,
          error: "Could not confirm which account was saved. Refresh saved accounts before choosing again. Your current session stays unchanged." });
      }
    } finally {
      accountOperationInFlight.current = false;
    }
  }

  async function refreshAccounts() {
    if (accountOperationInFlight.current || accountsLoading) return;
    accountOperationInFlight.current = true;
    setAccountsLoading(true);
    setAccountFeedback({ pendingId: null, message: null, error: null });
    try {
      setAccounts(await bridge.getAccounts());
      setAccountsCatalog("ready");
      setAccountFeedback({ pendingId: null, message: "Saved accounts refreshed.", error: null });
    } catch {
      setAccountFeedback({ pendingId: null, message: null, error: "Could not refresh saved accounts. Your last list was kept. Try again." });
    } finally {
      accountOperationInFlight.current = false;
      setAccountsLoading(false);
    }
  }

  if (showBootPreview) {
    return <BootScreen progress={bootPreviewProgress()} client={client}
      active={surfaceActive} reduceMotion={settings?.reduceMotion ?? false} />;
  }

  if (route.id === "title") {
    return (
      <>
        <Home
          client={client}
          account={currentAccount}
          accounts={accounts}
          accountsCatalog={accountsCatalog}
          accountsLoading={accountsLoading}
          accountFeedback={accountFeedback}
          active={surfaceActive}
          reduceMotion={settings?.reduceMotion ?? false}
          onRoute={(id, params) => void goRoute(id, params)}
          onAccountSelect={(id) => void selectAccount(id)}
          onAccountManage={(view) => { setAccountsView(view); void goRoute("accounts"); }}
          onMinecraftSettings={() => void performMinecraftSettings()}
          onQuit={() => void performQuit()}
        />
        {boundary && <DevelopmentBoundaryDialog boundary={boundary} onDismiss={() => setBoundary(null)} />}
      </>
    );
  }

  const inGameRoute = canCloseToGame
    || route.id === "quick_hub"
    || route.id === "game_menu"
    || route.id === "hud_editor"
    || route.id === "settings"
    || route.id === "mods_catalog";

  return (
    <div
      className="route-shell"
      data-opus-route={route.id}
      data-opus-in-game={inGameRoute ? "true" : undefined}
    >
      {!inGameRoute && (
        <HomeScene active={surfaceActive} reduceMotion={settings?.reduceMotion ?? false} isInnerRoute />
      )}
      {route.id !== "game_menu" && route.id !== "connection" && route.id !== "quick_hub" && route.id !== "hud_editor" && route.id !== "settings" && route.id !== "mods_catalog" && route.id !== "module_detail" && (
        <RouteHeader title={routeTitles[route.id]} canGoBack={hasBack} onBack={() => void goBack()} client={client} />
      )}
      <main className="route-main">
        {error && <InlineError message={error} onDismiss={() => setError(null)} />}
        {route.id === "connection" && (
          <ConnectionScreen
            connection={connection ?? {
              phase: "connecting",
              title: "Connecting to server…",
              detail: "",
              serverName: "",
              serverAddress: "",
              canCancel: hasBack,
            }}
            canGoBack={hasBack}
            onBack={() => void goBack()}
          />
        )}
        {route.id === "singleplayer" && (
          <SingleplayerRoute
            worlds={worlds}
            loading={loading}
            refreshing={worldsRefreshing}
            openingCreateWorld={openingCreateWorld}
            selectedWorldId={selectedWorldId}
            onSelect={setSelectedWorldId}
            onLaunch={() => void launchWorld()}
            onRefresh={() => void refreshWorlds()}
            onCreate={() => void createWorld()}
          />
        )}
        {route.id === "multiplayer" && (
          <MultiplayerRoute
            servers={servers}
            serverStatuses={serverStatuses}
            loading={loading}
            refreshing={serversRefreshing}
            savingServer={savingServer}
            selectedServerId={selectedServerId}
            onSelect={setSelectedServerId}
            onConnect={(server) => void connectServer(server)}
            onDirectConnect={(server) => void connectServer(server)}
            onAddServer={addServer}
            onRefresh={() => void refreshServers()}
          />
        )}
        {(route.id === "settings" || route.id === "quick_hub" || route.id === "mods_catalog" || route.id === "module_detail") && (
          <OpusControlCenter
            modules={modules}
            loading={loading || moduleValuesRefreshing}
            unconfirmed={moduleValuesUnconfirmed}
            preview={isStandalone}
            initialModuleId={route.params?.moduleId}
            onToggle={(id, enabled) => saveModuleValue(id, "enabled", enabled ? "1" : "0")}
            onSetting={saveModuleValue}
            onRefresh={refreshModules}
            onHud={() => void goRoute("hud_editor")}
            onClose={() => void dismissOverlay()}
          />
        )}
        {route.id === "accounts" && (
          <AccountsRoute client={client} account={currentAccount} accounts={accounts} catalog={accountsCatalog} loading={accountsLoading}
            feedback={accountFeedback} onSelect={(id) => void selectAccount(id)} view={accountsView}
            onView={setAccountsView} onRefresh={() => void refreshAccounts()} />
        )}
        {route.id === "hud_editor" && <HudEditor revision={hostRouteRevision}
          onMods={() => void goRoute("mods_catalog")} onDone={() => void dismissOverlay()} />}
        {route.id === "game_menu" && (
          <PauseMenuRoute
            leavingWorld={leavingWorld}
            onResume={() => void closeToGameplay()}
            onClientSettings={() => void goRoute("settings", { settingsSection: "interface" })}
            onMinecraftSettings={() => void performMinecraftSettings()}
            onDisconnect={() => void leaveWorld()}
          />
        )}
      </main>
      {boundary && <DevelopmentBoundaryDialog boundary={boundary} onDismiss={() => setBoundary(null)} />}
    </div>
  );
}

function Home({
  client,
  account,
  accounts,
  accountsCatalog,
  accountsLoading,
  accountFeedback,
  active,
  reduceMotion,
  onRoute,
  onAccountSelect,
  onAccountManage,
  onMinecraftSettings,
  onQuit,
}: {
  client: ClientInfo | null;
  account: AccountSummary | null;
  accounts: AccountSummary[];
  accountsCatalog: AccountCatalogStatus;
  accountsLoading: boolean;
  accountFeedback: AccountFeedbackState;
  active: boolean;
  reduceMotion: boolean;
  onRoute: (id: RouteId, params?: RouteRef["params"]) => void;
  onAccountSelect: (id: string) => void;
  onAccountManage: (view: AccountView) => void;
  onMinecraftSettings: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="home" data-opus-home data-opus-route="title">
      <header className="home__header">
        <AccountMenu client={client} account={account} accounts={accounts} catalog={accountsCatalog} loading={accountsLoading}
          feedback={accountFeedback} active={active} onSelect={onAccountSelect} onManage={onAccountManage} />
        <div className="home__status" aria-label="Client status">
          <i aria-hidden="true" />
          <span>Opus Client</span>
          <small>Minecraft {client?.minecraft ?? "1.8.9"}</small>
        </div>
      </header>

      <main className="home__content" aria-label="Opus main menu">
        <section className="home__stage" aria-labelledby="opus-home-title">
          <HomeScene active={active} reduceMotion={reduceMotion}>
          <h1 className="home__brand" id="opus-home-title">
            <img
              src="/brand/opus-mark-user.png"
              width="1254"
              height="1254"
              alt=""
              draggable={false}
            />
            <span className="home__brand-copy">
              <strong>OPUS</strong>
            </span>
          </h1>
          </HomeScene>

          <nav className="home__menu" aria-label="Minecraft launch actions">
            <div className="home__play">
            <button
              type="button"
              className="home__button home__button--play"
              onClick={() => onRoute("singleplayer")}
              data-opus-home-action="singleplayer"
            >
              <span className="home__button-icon" aria-hidden="true"><UiIcon name="user" /></span>
              <span className="home__button-copy">
                <strong>Singleplayer</strong>
                <small>Continue from a local world</small>
              </span>
              <UiIcon name="chevron" />
            </button>
            <button
              type="button"
              className="home__button home__button--play home__button--primary"
              onClick={() => onRoute("multiplayer")}
              data-opus-home-action="multiplayer"
            >
              <span className="home__button-icon" aria-hidden="true"><UiIcon name="users" /></span>
              <span className="home__button-copy">
                <strong>Multiplayer</strong>
                <small>Join your saved network</small>
              </span>
              <UiIcon name="chevron" />
            </button>
            </div>

            <div className="home__settings">
            <button
              type="button"
              className="home__button home__button--setting"
              onClick={onMinecraftSettings}
              data-opus-home-action="minecraft-settings"
            >
              <UiIcon name="settings" />
              <span>Minecraft Settings</span>
            </button>
            <button
              type="button"
              className="home__button home__button--setting"
              onClick={() => onRoute("settings", { settingsSection: "interface" })}
              data-opus-home-action="client-settings"
            >
              <UiIcon name="sliders" />
              <span>Client Settings</span>
            </button>
            </div>
          </nav>
        </section>
      </main>

      <footer className="home__footer">
        <div className="home__version" aria-label="Client version">
          <span>Opus {client?.version ?? "dev"}</span>
          <span className="home__version-separator" aria-hidden="true">/</span>
          <span>Minecraft {client?.minecraft ?? "1.8.9"}</span>
        </div>
        <button
          type="button"
          className="home__quit"
          onClick={onQuit}
          data-opus-home-action="quit"
        >
          <UiIcon name="power" />
          <span>Quit Minecraft</span>
        </button>
      </footer>
    </div>
  );
}

function BootScreen({ progress, client, active, reduceMotion }: {
  progress: number;
  client: ClientInfo | null;
  active: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="boot-screen" data-opus-boot>
      <AmbientVideoBackdrop className="boot-screen__backdrop" active={active} reduceMotion={reduceMotion} />
      <header className="boot-screen__header">
        <span className="boot-screen__wordmark">OPUS</span>
        <span className="boot-screen__edition">Client runtime</span>
      </header>
      <main className="boot-screen__focus">
        <div className="boot-screen__mark" aria-hidden="true">
          <img src="/brand/opus-mark-user.png" alt="" draggable={false} />
        </div>
        <span className="boot-screen__eyebrow">Opus Client</span>
        <h1>Starting Opus</h1>
        <p>Preparing Minecraft and your client.</p>
        <div
          className="boot-screen__progress"
          role="progressbar"
          aria-label="Opus boot progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="boot-screen__status">
          <span><i aria-hidden="true" />Starting client renderer</span>
          <strong>{progress}%</strong>
        </div>
      </main>
      <footer className="boot-screen__footer">
        <span>Minecraft {client?.minecraft ?? "1.8.9"}</span>
        <span>Opus {client?.version ?? "0.1.0-dev"}</span>
      </footer>
    </div>
  );
}

function AmbientVideoBackdrop({ className, active, reduceMotion }: {
  className: string;
  active: boolean;
  reduceMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePlayback = () => {
      syncAmbientVideo(video, shouldPlayAmbientVideo(active, !document.hidden, reduceMotion || motionPreference.matches));
      if (new URLSearchParams(window.location.search).has("opusMediaProbe")) {
        console.info(`OPUS_MEDIA_STATE active=${active} paused=${video.paused} hidden=${document.hidden}`);
      }
    };
    updatePlayback();
    document.addEventListener("visibilitychange", updatePlayback);
    motionPreference.addEventListener("change", updatePlayback);
    return () => {
      document.removeEventListener("visibilitychange", updatePlayback);
      motionPreference.removeEventListener("change", updatePlayback);
      video.pause();
    };
  }, [active, reduceMotion]);

  return (
    <div className={className} aria-hidden="true">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/opus-night-sky-poster-v1.jpg"
        tabIndex={-1}
      >
        <source src="/media/opus-night-sky-v1.webm" type="video/webm" />
        <source src="/media/opus-night-sky-v1.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

function RouteHeader({ title, canGoBack, onBack, client }: { title: string; canGoBack: boolean; onBack: () => void; client: ClientInfo | null }) {
  return (
    <header className="route-header">
      <div className="route-header__leading">
        {canGoBack ? (
        <Button variant="ghost" size="sm" className="route-back" onClick={onBack} data-opus-back>
          <UiIcon name="back" />
          <span>Back</span>
        </Button>
        ) : (
          <span className="route-header__mark" aria-hidden="true">
            <img src="/brand/opus-mark-user.png" alt="" draggable={false} />
          </span>
        )}
      </div>
      <span className="route-header__identity">
        <strong>{title}</strong>
      </span>
      <span className="route-header__version"><i aria-hidden="true" />Opus {client?.version ?? "dev"}</span>
    </header>
  );
}

function SingleplayerRoute({
  worlds,
  loading,
  refreshing,
  openingCreateWorld,
  selectedWorldId,
  onSelect,
  onLaunch,
  onRefresh,
  onCreate,
}: {
  worlds: WorldInfo[];
  loading: boolean;
  refreshing: boolean;
  openingCreateWorld: boolean;
  selectedWorldId: string | null;
  onSelect: (id: string) => void;
  onLaunch: () => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  const selected = worlds.find((world) => world.id === selectedWorldId) ?? null;
  return (
    <section className="game-library" data-opus-game-library="singleplayer">
      <header className="game-library__toolbar">
        <div>
          <h1>Singleplayer</h1>
          <span className="game-library__eyebrow">Your saved worlds, ready when you are.</span>
        </div>
        <div className="game-library__toolbar-actions">
          <span className="game-library__count">
            {loading ? "Reading saves" : `${worlds.length} ${worlds.length === 1 ? "world" : "worlds"}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="game-library__refresh"
            onClick={onRefresh}
            disabled={refreshing}
            data-opus-world-refresh
          >
            <UiIcon name="refresh" />
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            disabled={openingCreateWorld}
            aria-busy={openingCreateWorld}
            data-opus-world-create
          >
            <UiIcon name="plus" />
            <span>{openingCreateWorld ? "Opening…" : "Create World"}</span>
          </Button>
        </div>
      </header>

      <div className="game-library__workspace">
        <ScrollArea className="selection-list game-library__list" role="list" label="Saved worlds">
          {loading && <p className="route-empty">Reading local worlds…</p>}
          {!loading && worlds.length === 0 && <p className="route-empty">No local worlds are available.</p>}
          {worlds.map((world) => (
            <button
              key={world.id}
              type="button"
              className={`selection-row ${selectedWorldId === world.id ? "selection-row--selected" : ""}`}
              onClick={() => onSelect(world.id)}
              aria-pressed={selectedWorldId === world.id}
              data-opus-world-id={world.id}
            >
              <span className="selection-row__glyph" aria-hidden="true"><UiIcon name="cube" /></span>
              <span className="selection-row__copy"><strong>{world.name}</strong><small>{world.id}</small></span>
              <span className="selection-row__state">{selectedWorldId === world.id ? "Selected" : "Select"}</span>
            </button>
          ))}
        </ScrollArea>

        <footer className="game-library__command" aria-live="polite">
          <div className="game-library__selection-copy">
            <span>{selected ? "Selected world" : "World details"}</span>
            <h2>{selected?.name ?? "Select a world"}</h2>
            <p>{selected ? "Local save" : "Select a world to continue."}</p>
          </div>
          <dl className="game-library__meta">
            <div><dt>Source</dt><dd>{selected ? "Local save" : "—"}</dd></div>
            <div><dt>Folder</dt><dd>{selected?.id ?? "No selection"}</dd></div>
          </dl>
          <div className="game-library__actions">
            <Button
              variant="primary"
              className="game-library__primary"
              onClick={onLaunch}
              disabled={!selected}
              data-opus-world-launch
            >
              <UiIcon name="play" />
              Play world
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}

function MultiplayerRoute({
  servers,
  serverStatuses,
  loading,
  refreshing,
  savingServer,
  selectedServerId,
  onSelect,
  onConnect,
  onDirectConnect,
  onAddServer,
  onRefresh,
}: {
  servers: ServerInfo[];
  serverStatuses: Record<string, ServerStatus>;
  loading: boolean;
  refreshing: boolean;
  savingServer: boolean;
  selectedServerId: string | null;
  onSelect: (id: string) => void;
  onConnect: (server: ServerInfo) => void;
  onDirectConnect: (server: ServerInfo) => void;
  onAddServer: (name: string, address: string) => Promise<boolean>;
  onRefresh: () => void;
}) {
  const selected = servers.find((server) => server.id === selectedServerId) ?? null;
  const selectedStatus = selected ? serverStatuses[serverStatusKey(selected.address)] ?? null : null;
  const [composerMode, setComposerMode] = useState<"direct" | "add" | null>(null);
  const [serverName, setServerName] = useState("");
  const [serverAddress, setServerAddress] = useState("");
  const directButtonRef = useRef<HTMLButtonElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const address = serverAddress.trim();

  useEffect(() => {
    if (composerMode === "direct") addressInputRef.current?.focus();
    if (composerMode === "add") nameInputRef.current?.focus();
  }, [composerMode]);

  function closeComposer() {
    const previousMode = composerMode;
    setComposerMode(null);
    window.requestAnimationFrame(() => {
      const trigger = previousMode === "add" ? addButtonRef.current : directButtonRef.current;
      trigger?.focus();
    });
  }

  useEffect(() => {
    if (!composerMode) return;
    const dismissComposer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeComposer();
    };
    document.addEventListener("keydown", dismissComposer, true);
    return () => document.removeEventListener("keydown", dismissComposer, true);
  }, [composerMode]);

  async function saveServer() {
    const saved = await onAddServer(serverName, address);
    if (saved) {
      setServerName("");
      setServerAddress("");
      closeComposer();
    }
  }

  function connectDirectly() {
    if (!address) return;
    onDirectConnect({
      id: `direct:${address}`,
      name: serverName.trim() || address,
      address,
    });
  }

  function submitComposer() {
    if (composerMode === "add") {
      void saveServer();
      return;
    }
    connectDirectly();
  }

  return (
    <section className="game-library" data-opus-game-library="multiplayer">
      <header className="game-library__toolbar">
        <div>
          <h1>Multiplayer</h1>
          <span className="game-library__eyebrow">Choose a server. Join your people.</span>
        </div>
        <div className="game-library__toolbar-actions">
          <span className="game-library__count">
            {loading ? "Reading servers" : `${servers.length} ${servers.length === 1 ? "server" : "servers"}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="game-library__refresh"
            onClick={onRefresh}
            disabled={refreshing}
            data-opus-server-refresh
          >
            <UiIcon name="refresh" />
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </Button>
        </div>
      </header>

      <div className="game-library__workspace">
        <ScrollArea className="selection-list game-library__list" role="list" label="Saved servers">
          {loading && <p className="route-empty">Reading saved servers…</p>}
          {!loading && servers.length === 0 && <p className="route-empty">No saved servers are available.</p>}
          {servers.map((server) => {
            const status = serverStatuses[serverStatusKey(server.address)] ?? null;
            const population = serverPopulation(status);
            return (
              <button
                key={server.id}
                type="button"
                className={`selection-row server-row ${selectedServerId === server.id ? "selection-row--selected" : ""}`}
                onClick={() => onSelect(server.id)}
                aria-pressed={selectedServerId === server.id}
                data-opus-server-id={server.id}
                data-opus-server-status={status?.state ?? "unavailable"}
                data-opus-server-selected={selectedServerId === server.id || undefined}
              >
                <span className="selection-row__glyph" aria-hidden="true"><UiIcon name="server" /></span>
                <span className="server-row__copy">
                  <strong>{server.name}</strong>
                  <small className="server-row__motd">{serverMessage(status)}</small>
                  <small className="server-row__address">{server.address}</small>
                </span>
                <span className="server-row__metrics">
                  <span className={`server-status server-status--${status?.state ?? "unknown"}`}>
                    <i aria-hidden="true" />{serverStateLabel(status)}
                  </span>
                  {population && <small>{population}</small>}
                  {status?.state === "online" && status.pingMs !== undefined && <small>{status.pingMs} ms</small>}
                </span>
              </button>
            );
          })}
        </ScrollArea>

        {!composerMode && (
          <footer className="game-library__command" aria-live="polite">
            <div className="game-library__selection-copy">
            <span>{selected ? "Selected server" : "Server details"}</span>
              <h2>{selected?.name ?? "Select a server"}</h2>
              <p>{selected ? serverMessage(selectedStatus) : "Choose a saved server, or connect with a new address."}</p>
            </div>
            <dl className="game-library__meta">
              <div><dt>Status</dt><dd className={`server-status-detail server-status--${selectedStatus?.state ?? "unknown"}`}><i aria-hidden="true" />{serverStateLabel(selectedStatus)}</dd></div>
              <div><dt>Players</dt><dd>{serverPopulation(selectedStatus) ?? "—"}</dd></div>
              <div><dt>Latency</dt><dd>{selectedStatus?.state === "online" && selectedStatus.pingMs !== undefined ? `${selectedStatus.pingMs} ms` : "—"}</dd></div>
            </dl>
            <div className="game-library__actions game-library__actions--servers">
              <Button
                ref={directButtonRef}
                variant="secondary"
                onClick={() => setComposerMode("direct")}
                data-opus-server-direct-open
              >
                <UiIcon name="link" />
                Direct connect
              </Button>
              <Button
                ref={addButtonRef}
                variant="secondary"
                onClick={() => setComposerMode("add")}
                data-opus-server-add-open
              >
                <UiIcon name="plus" />
                Add server
              </Button>
              <Button
                variant="primary"
                className="game-library__primary"
                onClick={() => selected && onConnect(selected)}
                disabled={!selected}
                data-opus-server-connect
              >
                <UiIcon name="play" />
                Connect
              </Button>
            </div>
          </footer>
        )}

        {composerMode && (
          <form
            className="game-library__composer"
            aria-label={composerMode === "direct" ? "Direct server connection" : "Add a saved server"}
            data-opus-server-mode={composerMode}
            onSubmit={(event) => {
              event.preventDefault();
              submitComposer();
            }}
          >
            <div className="game-library__composer-heading">
              <div>
                <strong>{composerMode === "direct" ? "Direct connect" : "Add server"}</strong>
                <small>{composerMode === "direct" ? "Connect once without changing the saved list." : "Save this address to your server library."}</small>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeComposer}><UiIcon name="close" />Close</Button>
            </div>
            <label>
              <span>Name <em>optional</em></span>
              <input
                ref={nameInputRef}
                value={serverName}
                onChange={(event) => setServerName(event.target.value)}
                placeholder="Server name"
                autoComplete="off"
                maxLength={64}
                data-opus-server-name
              />
            </label>
            <label>
              <span>Address</span>
              <input
                ref={addressInputRef}
                value={serverAddress}
                onChange={(event) => setServerAddress(event.target.value)}
                placeholder="play.example.net"
                autoCapitalize="none"
                autoComplete="off"
                maxLength={255}
                required
                data-opus-server-address
              />
            </label>
            <div className="game-library__composer-actions">
              <Button
                type="submit"
                variant="primary"
                className="game-library__direct-connect"
                disabled={!address || (composerMode === "add" && savingServer)}
                data-opus-server-direct-connect={composerMode === "direct" || undefined}
                data-opus-server-save={composerMode === "add" || undefined}
              >
                <UiIcon name={composerMode === "add" ? "plus" : "play"} />
                {composerMode === "add" ? (savingServer ? "Saving…" : "Save server") : "Connect"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}



function moduleIconName(module: OpusModule): UiIconName {
  if (module.category === "information") return "database";
  if (module.category === "visual") return "hud";
  if (module.category === "utility") return "tool";
  return "activity";
}

function ModuleDetail({ module, onToggle }: { module: OpusModule; onToggle: () => void }) {
  return (
    <Panel className="route-panel route-panel--detail" data-opus-module-detail={module.id}>
      <RouteIntro eyebrow={module.category.toUpperCase()} title={module.name} detail={module.description} />
      <dl className="detail-list">
        <DetailRow label="Category" value={module.category} />
        <DetailRow label="Status" value={module.status ?? "stable"} />
        <DetailRow label="State" value={module.enabled ? "Enabled" : "Disabled"} />
      </dl>
      <div className="route-actions">
        <Button
          variant={module.enabled ? "active" : "primary"}
          onClick={onToggle}
          aria-pressed={module.enabled}
          data-opus-module-toggle={module.id}
        >
          <UiIcon name="power" />
          {module.enabled ? "Disable module" : "Enable module"}
        </Button>
      </div>
    </Panel>
  );
}




function PauseMenuRoute({
  onResume,
  onClientSettings,
  onMinecraftSettings,
  onDisconnect,
  leavingWorld,
}: {
  onResume: () => void;
  onClientSettings: () => void;
  onMinecraftSettings: () => void;
  onDisconnect: () => void;
  leavingWorld: boolean;
}) {
  return (
    <Panel className="route-panel route-panel--commands pause-menu" aria-labelledby="pause-menu-title" aria-busy={leavingWorld}>
      <div className="pause-menu__header">
        <span>Opus Client</span>
        <h1 id="pause-menu-title">Game menu</h1>
      </div>
      <CommandRow icon="play" label="Resume" detail="Return to gameplay." onClick={onResume} disabled={leavingWorld} />
      <CommandRow icon="sliders" label="Client Settings" detail="Open Opus client preferences." onClick={onClientSettings} disabled={leavingWorld} />
      <CommandRow icon="settings" label="Minecraft Settings" detail="Open Minecraft’s own settings." onClick={onMinecraftSettings} disabled={leavingWorld} />
      <CommandRow icon="logout" label={leavingWorld ? "Disconnecting…" : "Disconnect"} detail="Leave the current world." onClick={onDisconnect} disabled={leavingWorld} danger />
    </Panel>
  );
}

function EmptyRoute({ title, detail }: { title: string; detail: string }) {
  return <Panel className="route-panel"><RouteIntro eyebrow="OPUS" title={title} detail={detail} /></Panel>;
}

function RouteIntro({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="route-intro"><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function SettingToggle({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span><strong>{title}</strong><small>{detail}</small></span>
      <Toggle value={value} onChange={onChange} label={title} />
    </div>
  );
}

function CommandRow({ icon, label, detail, onClick, danger = false, disabled = false }: { icon: UiIconName; label: string; detail: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <ActionRow
      label={label}
      detail={detail}
      onClick={onClick}
      danger={danger}
      disabled={disabled}
      start={<UiIcon name={icon} />}
      end={<UiIcon name="chevron" />}
    />
  );
}

function InlineError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="inline-error" role="alert">
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

function DevelopmentBoundaryDialog({ boundary, onDismiss }: { boundary: DevelopmentBoundary; onDismiss: () => void }) {
  const copy = boundaryCopy(boundary);
  return (
    <Modal
      eyebrow="Development boundary"
      title={copy.title}
      detail={copy.detail}
      titleId="development-boundary-title"
      footer={<Button variant="primary" block onClick={onDismiss} autoFocus>Return to preview</Button>}
    />
  );
}
