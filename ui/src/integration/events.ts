// Typed event names (architecture doc section 7). The WebSocket bridge maps
// Core events onto these keys; the mock phase dispatches a few manually.

export type OpusEvent =
  | "socketReady"
  | "clientChanged"
  | "moduleChanged"
  | "settingChanged"
  | "serverPingUpdated"
  | "screenChanged"
  | "playerChanged"
  | "hudChanged"
  | "windowChanged"
  | "themeChanged"
  | "accountChanged";

export type EventListener<T = unknown> = (payload: T) => void;

const listeners = new Map<OpusEvent, Set<EventListener>>();

export function subscribe<T>(event: OpusEvent, listener: EventListener<T>) {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener as EventListener);
  return () => set.delete(listener as EventListener);
}

export function emit<T>(event: OpusEvent, payload: T) {
  const set = listeners.get(event);
  if (!set) {
    return;
  }
  for (const listener of set) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`[opus-ui] event listener failed for ${event}`, error);
    }
  }
}
