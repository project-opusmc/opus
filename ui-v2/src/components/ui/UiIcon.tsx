export type UiIconName = "activity" | "back" | "chevron" | "close" | "cube" | "database" | "hud"
  | "link" | "logout" | "modules" | "play" | "plus" | "power" | "refresh" | "search" | "server"
  | "settings" | "sliders" | "tool" | "user" | "users" | "keyboard";

export function UiIcon({ name }: { name: UiIconName }) {
  const common = {
    width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
  };
  if (name === "activity") return <svg {...common}><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" /></svg>;
  if (name === "keyboard") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h.1M12 9h.1M17 9h.1M7 12h.1M12 12h.1M17 12h.1M8 15h8" /></svg>;
  if (name === "back") return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === "close") return <svg {...common}><path d="m7 7 10 10M17 7 7 17" /></svg>;
  if (name === "cube") return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12.1V21" /></svg>;
  if (name === "database") return <svg {...common}><ellipse cx="12" cy="5.5" rx="7.5" ry="3" /><path d="M4.5 5.5v6c0 1.65 3.35 3 7.5 3s7.5-1.35 7.5-3v-6M4.5 11.5v6c0 1.65 3.35 3 7.5 3s7.5-1.35 7.5-3v-6" /></svg>;
  if (name === "hud") return <svg {...common}><path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" /><rect x="9" y="9" width="6" height="6" rx="1.2" /></svg>;
  if (name === "link") return <svg {...common}><path d="m9.5 14.5 5-5M7.2 16.8l-1.5 1.5a3.2 3.2 0 0 1-4.5-4.5l3.2-3.2a3.2 3.2 0 0 1 4.5 0M16.8 7.2l1.5-1.5a3.2 3.2 0 0 1 4.5 4.5l-3.2 3.2a3.2 3.2 0 0 1-4.5 0" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 4H5v16h5M8 12h11M15 8l4 4-4 4" /></svg>;
  if (name === "modules") return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.3" /><rect x="14" y="4" width="6" height="6" rx="1.3" /><rect x="4" y="14" width="6" height="6" rx="1.3" /><rect x="14" y="14" width="6" height="6" rx="1.3" /></svg>;
  if (name === "play") return <svg {...common}><path d="m9 6 9 6-9 6V6Z" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "power") return <svg {...common}><path d="M12 2v10" /><path d="M6.8 5.2a8 8 0 1 0 10.4 0" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.5-1.7L20 9M4 15l2.4 2.7A7 7 0 0 0 17.9 16" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></svg>;
  if (name === "server") return <svg {...common}><rect x="4" y="4" width="16" height="6" rx="1.8" /><rect x="4" y="14" width="16" height="6" rx="1.8" /><circle cx="7.5" cy="7" r=".7" fill="currentColor" stroke="none" /><circle cx="7.5" cy="17" r=".7" fill="currentColor" stroke="none" /><path d="M11 7h6M11 17h6" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
  if (name === "sliders") return <svg {...common}><path d="M4 7h5M15 7h5M4 12h9M17 12h3M4 17h3M13 17h7" /><circle cx="12" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
  if (name === "tool") return <svg {...common}><path d="M14.5 6.5a4 4 0 0 0-5 5L4 17a2.1 2.1 0 1 0 3 3l5.5-5.5a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.45-4.15 2.62-6.25 6.5-6.25s6.05 2.1 6.5 6.25" /></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.4-3.65 2.23-5.5 5.5-5.5s5.1 1.85 5.5 5.5" /><circle cx="17.1" cy="9.1" r="2.25" /><path d="M15.45 14.1c3.1.08 4.76 1.7 5.05 4.9" /></svg>;
  return <svg {...common}><path d="m9 7 5 5-5 5" /></svg>;
}
