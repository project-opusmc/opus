import { WS_BASE, authCode } from "./host";

// WebSocket bridge (architecture doc section 7). The game server binds
// 127.0.0.1 only and authenticates this connection with the per-session code.

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

const listeners = new Map<string, Set<(payload: unknown) => void>>();

export function connectBridge() {
  if (!WS_BASE) {
    return;
  }
  manualClose = false;
  open();
}

export function disconnectBridge() {
  manualClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
}

export function listen<T = unknown>(
  eventName: string,
  callback: (payload: T) => void,
): () => void {
  let set = listeners.get(eventName);
  if (!set) {
    set = new Set();
    listeners.set(eventName, set);
  }
  set.add(callback as (payload: unknown) => void);
  return () => set.delete(callback as (payload: unknown) => void);
}

function open() {
  const query = authCode ? `?code=${encodeURIComponent(authCode)}` : "";
  socket = new WebSocket(`${WS_BASE}/ws${query}`);

  socket.addEventListener("open", () => {
    dispatch("socketReady", undefined);
  });

  socket.addEventListener("message", (event) => {
    let message: { name?: string; event?: unknown } | null = null;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!message?.name) {
      return;
    }
    dispatch(message.name, message.event);
  });

  socket.addEventListener("close", () => {
    if (manualClose) {
      return;
    }
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });
}

function dispatch(eventName: string, payload: unknown) {
  const set = listeners.get(eventName);
  if (!set) {
    return;
  }
  for (const callback of set) {
    try {
      callback(payload);
    } catch (error) {
      console.error(`[opus-ui] listener failed for ${eventName}`, error);
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer || manualClose) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, 1000);
}

// Keep the bridge alive; the game sends pongs for our pings.
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ name: "ping", event: {} }));
  }
}, 5000);
