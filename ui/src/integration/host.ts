// Bridge host detection (LiquidBounce-style, port 8 security section 48).
// In standalone preview there is no game bridge: every API call falls back to
// mock data. In the integrated build the game serves this SPA from its own
// loopback server, so REST_BASE/WS_BASE point at that random port.

const search = new URLSearchParams(window.location.search);

export const port = search.has("port")
  ? Number(search.get("port"))
  : null;
export const authCode = search.get("code") ?? "";
export const isStandalone = port === null || Number.isNaN(port);

export const REST_BASE = isStandalone ? "" : `http://127.0.0.1:${port}`;
export const WS_BASE = isStandalone ? "" : `ws://127.0.0.1:${port}`;
