import { createElement } from "react";
import type { ConnectionState } from "../bridge/types";

export interface ConnectionScreenProps {
  connection: ConnectionState;
  canGoBack: boolean;
  onBack: () => void;
}

type ConnectionAction = { kind: "cancel" | "back"; label: "Cancel" | "Back" } | null;

function connectionAction(connection: ConnectionState, canGoBack: boolean): ConnectionAction {
  if (connection.phase === "loading") return null;
  if (connection.phase === "connecting" && connection.canCancel) {
    return { kind: "cancel", label: "Cancel" };
  }
  if (canGoBack || connection.phase === "disconnected") {
    return { kind: "back", label: "Back" };
  }
  return null;
}

/** Simple animated spinner — three dots rotating, Lunar-style */
function Spinner({ phase }: { phase: ConnectionState["phase"] }) {
  if (phase === "disconnected") {
    return createElement("svg", {
      className: "conn__icon-svg",
      width: 32, height: 32, viewBox: "0 0 32 32", fill: "none",
      stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round",
      "aria-hidden": true,
    },
      createElement("rect", { x: 4, y: 5, width: 24, height: 9, rx: 2.5 }),
      createElement("rect", { x: 4, y: 18, width: 24, height: 9, rx: 2.5 }),
      createElement("path", { d: "M8 9.5h.01M8 22.5h.01M13 9.5h8M13 22.5h8" }),
      createElement("line", { x1: 6, y1: 4, x2: 26, y2: 28, stroke: "currentColor", strokeWidth: 2.25, className: "conn__slash" }),
    );
  }
  // Connecting / loading: spinning arc
  return createElement("svg", {
    className: "conn__icon-svg",
    width: 32, height: 32, viewBox: "0 0 32 32", fill: "none",
    "aria-hidden": true,
  },
    // ghost track
    createElement("circle", { cx: 16, cy: 16, r: 13, stroke: "currentColor", strokeWidth: 2, opacity: 0.12, fill: "none" }),
    // spinning arc
    createElement("circle", {
      cx: 16, cy: 16, r: 13,
      stroke: "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeDasharray: "22 60",
      fill: "none",
      className: "conn__arc",
    }),
  );
}

export function ConnectionScreen({ connection, canGoBack, onBack }: ConnectionScreenProps) {
  const action = connectionAction(connection, canGoBack);
  const hasDetail = connection.detail.trim().length > 0;
  const serverName = connection.serverName.trim();
  const serverAddress = connection.serverAddress.trim();
  const isDisconnected = connection.phase === "disconnected";

  return createElement("section", {
    className: "conn",
    "data-opus-connection-phase": connection.phase,
    "aria-labelledby": "conn-title",
    "aria-live": isDisconnected ? "assertive" : "polite",
  },
    // Icon
    createElement("div", { className: "conn__icon", "aria-hidden": true },
      createElement(Spinner, { phase: connection.phase })),

    // Title
    createElement("div", { className: "conn__text" },
      createElement("h1", { id: "conn-title", className: "conn__title" }, connection.title),
      (serverName || serverAddress) && createElement("p", { className: "conn__server" },
        serverAddress || serverName),
    ),

    // Keep the action position stable when native progress briefly has no text.
    createElement("div", {
      className: `conn__detail${hasDetail ? "" : " conn__detail--empty"}`,
      tabIndex: hasDetail ? 0 : undefined,
      "aria-label": hasDetail ? "Connection details" : undefined,
      "aria-hidden": hasDetail ? undefined : true,
      "data-opus-connection-detail": true,
      "data-opus-connection-detail-empty": !hasDetail,
    }, hasDetail ? createElement("p", null, connection.detail) : null),

    // Action button
    action && createElement("button", {
      type: "button",
      className: "conn__btn",
      onClick: onBack,
      "data-opus-connection-action": action.kind,
    }, action.label),
  );
}
