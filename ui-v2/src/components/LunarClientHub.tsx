import { useState, useMemo, useEffect } from "react";
import type { OpusModule, UiSettings } from "../bridge/types";

export interface LunarClientHubProps {
  modules: OpusModule[];
  settings?: UiSettings;
  onUpdateSettings?: (next: UiSettings) => void;
  onToggleModule: (id: string) => void;
  onHud: () => void;
  onClose: () => void;
  initialTab?: "MODS" | "SETTINGS" | "WAYPOINTS";
}

// ── Profile Type ─────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  name: string;
  icon?: "swords" | "apple" | "hypixel" | "default";
}

// ── Hotkey Entry Type for Auto Text Hot Key ──────────────────────────────────
interface HotkeyItem {
  id: string;
  label: string;
  text: string;
  key: string;
}

// ── Sub-options State Types ──────────────────────────────────────────────────
interface TimeChangerOptions {
  time: number; // 0 to 24000
  overworldSky: string;
  horizonY: number;
  useRealTime: boolean;
  increaseKey: string;
  decreaseKey: string;
  timePassage: boolean;
}

interface ChatOptions {
  commandAliases: boolean;
  unlimitedChat: boolean;
  modernChatLength: boolean;
  superLongChat: boolean;
  stackSpam: boolean;
  chatHeightFix: boolean;
  textShadow: boolean;
  hideIncoming: boolean;
  keepHistory: boolean;
  soundOnMention: boolean;
  chatHeads: boolean;
  copyChat: boolean;
  hoverImagePreview: boolean;
  smoothChat: boolean;
  peekKey: string;
  visibilityKey: string;
  highlightColor: string;
  highlightBold: boolean;
  highlightItalic: boolean;
  highlightUnderline: boolean;
  highlightStrikethrough: boolean;
  highlightObfuscated: boolean;
}

interface NickHiderOptions {
  hideYourNick: boolean;
  hideYourRealName: boolean;
  hideOthersNames: boolean;
  hideHypixelLobbyId: boolean;
  hideYourSkin: boolean;
  showRealSkin: boolean;
  hideOthersSkins: boolean;
}

interface FreelookOptions {
  key: string;
  invertPitch: boolean;
  toggleMode: boolean;
  snapBack: boolean;
}

interface LightingOptions {
  fullbright: boolean;
  gammaBoost: number;
  dynamicLights: boolean;
}

// ── Lunar-style Icons ────────────────────────────────────────────────────────
function LunarLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M23 16c0 6.075-4.925 11-11 11-2.42 0-4.663-.78-6.48-2.106A11.025 11.025 0 0 0 16 27c6.075 0 11-4.925 11-11 0-4.2-2.355-7.85-5.836-9.72A10.97 10.97 0 0 1 23 16Z"
        fill="#FFFFFF"
      />
      <circle cx="9" cy="11" r="1.5" fill="#FFFFFF" />
      <circle cx="14" cy="7" r="1.2" fill="#FFFFFF" />
      <circle cx="7" cy="17" r="1" fill="#FFFFFF" />
    </svg>
  );
}

function ModGlyph({ name }: { name: string }) {
  const common = {
    width: 36,
    height: 36,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "time-changer":
      // Sun & Crescent Moon
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          <path d="M15 9a5 5 0 0 1 5 5 5 5 0 0 1-5 5c-.7 0-1.37-.14-2-.4A7 7 0 0 0 17 9c-.7 0-1.35.14-2 .4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "freelook":
      // Person standing on circular pedestal
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.5" />
          <path d="M9 10h6l1 6-2.5 5h-3L8 16l1-6Z" />
          <ellipse cx="12" cy="20.5" rx="6.5" ry="2" strokeWidth="1.4" />
          <path d="M12 18.5v4" strokeWidth="1.4" />
        </svg>
      );
    case "auto-text":
      // Tag / keyboard / message box
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="3" />
          <path d="M8 10h4M8 14h8M2 10v4M22 10v4" />
        </svg>
      );
    case "chat":
      // Speech bubble with 3 dots
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          <circle cx="9" cy="11.5" r="1" fill="currentColor" />
          <circle cx="12.5" cy="11.5" r="1" fill="currentColor" />
          <circle cx="16" cy="11.5" r="1" fill="currentColor" />
        </svg>
      );
    case "nick-hider":
      // Drama / Comedy masks
      return (
        <svg {...common}>
          <path d="M5 4h8a4 4 0 0 1 4 4v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8a4 4 0 0 1 4-4Z" />
          <circle cx="7.5" cy="9" r="1" fill="currentColor" />
          <circle cx="12.5" cy="9" r="1" fill="currentColor" />
          <path d="M7.5 13a3.5 3.5 0 0 0 5 0" />
          <path d="M17 9.5a4 4 0 0 1 4 4v4a5 5 0 0 1-5 5h-1" strokeDasharray="3 3" />
        </svg>
      );
    case "lighting":
      // Lightbulb
      return (
        <svg {...common}>
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7Z" />
          <path d="M12 6v3M9.5 7.5l2.5 2.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
  }
}

// ── Lunar Switch Component ───────────────────────────────────────────────────
function LunarSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`lunar-switch ${checked ? "lunar-switch--on" : "lunar-switch--off"}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className="lunar-switch__track">
        <span className="lunar-switch__thumb">{checked ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

// ── Keybind Pill Button ──────────────────────────────────────────────────────
function LunarKeybind({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListening(false);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        onChange("NONE");
        setListening(false);
        return;
      }
      let keyName = e.code.toUpperCase();
      if (keyName.startsWith("KEY")) keyName = keyName.replace("KEY", "");
      if (keyName.startsWith("DIGIT")) keyName = keyName.replace("DIGIT", "");
      if (e.shiftKey && keyName !== "SHIFTLEFT" && keyName !== "SHIFTRIGHT") {
        keyName = `SHIFT + ${keyName}`;
      }
      onChange(keyName);
      setListening(false);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listening, onChange]);

  return (
    <button
      type="button"
      className={`lunar-keybind ${listening ? "lunar-keybind--listening" : ""}`}
      onClick={() => setListening(true)}
    >
      {listening ? "..." : value}
    </button>
  );
}

// ── Stepper / Carousel (e.g. < DEFAULT >) ─────────────────────────────────────
function LunarStepper({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const prev = () => {
    const nextIdx = (idx - 1 + options.length) % options.length;
    onChange(options[nextIdx]);
  };
  const next = () => {
    const nextIdx = (idx + 1) % options.length;
    onChange(options[nextIdx]);
  };

  return (
    <div className="lunar-stepper">
      <button type="button" className="lunar-stepper__arrow" onClick={prev}>
        ‹
      </button>
      <span className="lunar-stepper__value">{value}</span>
      <button type="button" className="lunar-stepper__arrow" onClick={next}>
        ›
      </button>
    </div>
  );
}

// ── Main Lunar Client Hub Component ──────────────────────────────────────────
export function LunarClientHub({
  modules: externalModules,
  settings: initialSettings,
  onUpdateSettings,
  onToggleModule,
  onHud,
  onClose,
  initialTab,
}: LunarClientHubProps) {
  // Navigation tabs: MODS, SETTINGS, WAYPOINTS
  const [activeTab, setActiveTab] = useState<"MODS" | "SETTINGS" | "WAYPOINTS">(initialTab ?? "MODS");
  const [clientSettings, setClientSettings] = useState<UiSettings>(
    initialSettings ?? {
      uiScale: 1,
      reduceMotion: false,
      backgroundBlur: 22,
      compactMode: false,
      accent: "violet",
    }
  );

  const updateSetting = <K extends keyof UiSettings>(key: K, val: UiSettings[K]) => {
    const next = { ...clientSettings, [key]: val };
    setClientSettings(next);
    onUpdateSettings?.(next);
  };

  // Filter pills: ALL, NEW, HUD, SERVER, MECHANIC
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Active Profile
  const [profiles] = useState<Profile[]>([
    { id: "bedwars", name: "Ranked Bedwars", icon: "swords" },
    { id: "default", name: "Default (2)", icon: "default" },
    { id: "profile-num", name: "Profile 1996515297" },
    { id: "uhc", name: "UHC", icon: "apple" },
    { id: "skyblock", name: "Hypixel Skyblock", icon: "hypixel" },
    { id: "arena", name: "Arena PvP", icon: "swords" },
  ]);
  const [activeProfileId, setActiveProfileId] = useState("default");

  // Selected module for options detail view (null means grid view)
  const [selectedModId, setSelectedModId] = useState<string | null>(null);

  // ── Core Lunar Mods List ───────────────────────────────────────────────────
  // We keep the 6 canonical mods from the screenshots:
  const [localModStates, setLocalModStates] = useState<Record<string, boolean>>({
    "time-changer": true,
    freelook: false,
    "auto-text": true,
    chat: true,
    "nick-hider": false,
    lighting: true,
  });

  const toggleMod = (id: string) => {
    setLocalModStates((prev) => {
      const next = !prev[id];
      onToggleModule(id);
      return { ...prev, [id]: next };
    });
  };

  // ── Detailed Settings States for each mod ──────────────────────────────────
  const [timeOptions, setTimeOptions] = useState<TimeChangerOptions>({
    time: 6000,
    overworldSky: "DEFAULT",
    horizonY: 0,
    useRealTime: false,
    increaseKey: "RBRACKET",
    decreaseKey: "LBRACKET",
    timePassage: false,
  });

  const [hotkeys, setHotkeys] = useState<HotkeyItem[]>([
    { id: "1", label: "Key 1", text: "inc", key: "6" },
    { id: "2", label: "Key 2", text: "bed", key: "7" },
    { id: "3", label: "Key 3", text: "invis", key: "8" },
    { id: "4", label: "Key 4", text: "on my way", key: "9" },
    { id: "5", label: "Key 5", text: "help me", key: "0" },
    { id: "6", label: "Key 6", text: "split", key: "MINUS" },
    { id: "7", label: "Key 7", text: "walkout", key: "EQUALS" },
    { id: "8", label: "Key 8", text: "stalling", key: "LBRACKET" },
    { id: "9", label: "Key 9", text: "push", key: "RBRACKET" },
    { id: "10", label: "Key 10", text: "/ping", key: "PERIOD" },
    { id: "11", label: "Key 11", text: "/bw1", key: "SHIFT + 1" },
    { id: "12", label: "Key 12", text: "/bw2", key: "SHIFT + 2" },
    { id: "13", label: "Key 13", text: "/bw4", key: "SHIFT + 4" },
    { id: "14", label: "Key 14", text: "=leave", key: "APOSTROPHE" },
  ]);

  const [chatOptions, setChatOptions] = useState<ChatOptions>({
    commandAliases: true,
    unlimitedChat: true,
    modernChatLength: false,
    superLongChat: false,
    stackSpam: true,
    chatHeightFix: false,
    textShadow: true,
    hideIncoming: false,
    keepHistory: true,
    soundOnMention: true,
    chatHeads: false,
    copyChat: true,
    hoverImagePreview: false,
    smoothChat: true,
    peekKey: "NONE",
    visibilityKey: "NONE",
    highlightColor: "Off",
    highlightBold: false,
    highlightItalic: false,
    highlightUnderline: false,
    highlightStrikethrough: false,
    highlightObfuscated: false,
  });

  const [nickOptions, setNickOptions] = useState<NickHiderOptions>({
    hideYourNick: true,
    hideYourRealName: true,
    hideOthersNames: false,
    hideHypixelLobbyId: false,
    hideYourSkin: true,
    showRealSkin: true,
    hideOthersSkins: false,
  });

  const [freelookOptions, setFreelookOptions] = useState<FreelookOptions>({
    key: "ALT",
    invertPitch: false,
    toggleMode: false,
    snapBack: true,
  });

  const [lightingOptions, setLightingOptions] = useState<LightingOptions>({
    fullbright: true,
    gammaBoost: 100,
    dynamicLights: false,
  });

  // Base list of mods with their categories
  const canonicalMods = useMemo(
    () => [
      {
        id: "time-changer",
        name: "Time Changer",
        category: "MECHANIC",
        description: "Customize the current time of day to a fixed position.",
      },
      {
        id: "freelook",
        name: "Freelook",
        category: "MECHANIC",
        description: "Allows you to look around freely in third person without changing your movement direction.",
      },
      {
        id: "auto-text",
        name: "Auto Text Hot Key",
        category: "SERVER",
        description: "Allows you to set a key or key combination that will send a command or chat message when pressed.",
      },
      {
        id: "chat",
        name: "Chat",
        category: "HUD",
        description: "Customize your chat options to your liking.",
      },
      {
        id: "nick-hider",
        name: "Nick Hider",
        category: "MECHANIC",
        description: "Allows you to hide skins and usernames for yourself or others.",
      },
      {
        id: "lighting",
        name: "Lighting",
        category: "MECHANIC",
        description: "Adjust game brightness and dynamic illumination options.",
      },
    ],
    []
  );

  // Filtered mods
  const filteredMods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return canonicalMods.filter((mod) => {
      const matchesCat =
        categoryFilter === "ALL" ||
        categoryFilter === "NEW" || // New shows all featured mods
        mod.category.toUpperCase() === categoryFilter.toUpperCase();
      const matchesSearch =
        !q ||
        mod.name.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [canonicalMods, categoryFilter, search]);

  const addHotkey = () => {
    const nextIdx = hotkeys.length + 1;
    setHotkeys((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        label: `Key ${nextIdx}`,
        text: "",
        key: "NONE",
      },
    ]);
  };

  const removeHotkey = (id: string) => {
    setHotkeys((prev) => prev.filter((item) => item.id !== id));
  };

  const updateHotkey = (id: string, field: "text" | "key", val: string) => {
    setHotkeys((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  return (
    <div className="lunar-window" role="dialog" aria-label="Opus Mod Manager">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="lunar-header">
        <div className="lunar-header__brand">
          <LunarLogo />
          <span className="lunar-header__title">OPUS CLIENT</span>
        </div>

        <nav className="lunar-header__nav" aria-label="Mod Tabs">
          <button
            type="button"
            className={`lunar-header__tab ${activeTab === "MODS" ? "lunar-header__tab--active" : ""}`}
            onClick={() => {
              setActiveTab("MODS");
              setSelectedModId(null);
            }}
          >
            MODS
          </button>
          <button
            type="button"
            className={`lunar-header__tab ${activeTab === "SETTINGS" ? "lunar-header__tab--active" : ""}`}
            onClick={() => {
              setActiveTab("SETTINGS");
              setSelectedModId(null);
            }}
          >
            SETTINGS
          </button>
          <button
            type="button"
            className={`lunar-header__tab ${activeTab === "WAYPOINTS" ? "lunar-header__tab--active" : ""}`}
            onClick={() => setActiveTab("WAYPOINTS")}
          >
            WAYPOINTS
          </button>
        </nav>

        <button
          type="button"
          className="lunar-header__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      {/* ── MAIN BODY (SIDEBAR + CONTENT) ───────────────────────────────────── */}
      <div className="lunar-body">
        {/* ── LEFT SIDEBAR (PROFILES) ────────────────────────────────────────── */}
        <aside className="lunar-sidebar">
          <div className="lunar-sidebar__profiles">
            {profiles.map((p) => {
              const active = activeProfileId === p.id;
              return (
                <div
                  key={p.id}
                  className={`lunar-profile-row ${active ? "lunar-profile-row--active" : ""}`}
                  onClick={() => setActiveProfileId(p.id)}
                >
                  <div className="lunar-profile-row__left">
                    {p.icon === "swords" && <span className="lunar-icon--sword">⚔</span>}
                    {p.icon === "apple" && <span className="lunar-icon--apple">🍎</span>}
                    {p.icon === "hypixel" && <span className="lunar-icon--h">H</span>}
                    <span className="lunar-profile-row__name">{p.name}</span>
                  </div>
                  <button
                    type="button"
                    className="lunar-profile-row__edit"
                    aria-label={`Edit ${p.name}`}
                  >
                    ✎
                  </button>
                </div>
              );
            })}
          </div>

          <div className="lunar-sidebar__actions">
            <button type="button" className="lunar-btn lunar-btn--dark">
              IMPORT CLIENT
            </button>
            <button type="button" className="lunar-btn lunar-btn--dark">
              SAVE AS NEW PROFILE
            </button>
            <button
              type="button"
              className="lunar-btn lunar-btn--hud"
              onClick={onHud}
            >
              EDIT HUD LAYOUT
            </button>
          </div>
        </aside>

        {/* ── RIGHT MAIN PANEL ───────────────────────────────────────────────── */}
        <main className="lunar-main">
          {activeTab === "SETTINGS" ? (
            <div className="lunar-detail">
              <div className="lunar-detail__header">
                <div className="lunar-detail__title-row">
                  <h2 className="lunar-detail__title">CLIENT SETTINGS</h2>
                </div>
              </div>
              <p className="lunar-detail__desc">Customize your client interface, performance and controls.</p>
              <div className="lunar-detail__content">
                <div className="lunar-form">
                  <div className="lunar-form__section">INTERFACE</div>
                  <div className="lunar-row">
                    <div className="lunar-row__left-switch">
                      <LunarSwitch
                        checked={clientSettings.compactMode}
                        onChange={(val) => updateSetting("compactMode", val)}
                      />
                      <span className="lunar-row__label">Compact Mode</span>
                    </div>
                  </div>
                  <div className="lunar-row">
                    <div className="lunar-row__left-switch">
                      <LunarSwitch
                        checked={clientSettings.reduceMotion}
                        onChange={(val) => updateSetting("reduceMotion", val)}
                      />
                      <span className="lunar-row__label">Reduce Motion</span>
                    </div>
                  </div>
                  <div className="lunar-row lunar-row--slider">
                    <span className="lunar-row__label">Background Blur</span>
                    <div className="lunar-horizon-slider">
                      <span className="lunar-horizon-val">{clientSettings.backgroundBlur}px</span>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={clientSettings.backgroundBlur}
                        onChange={(e) => updateSetting("backgroundBlur", Number(e.target.value))}
                        className="lunar-slider-input"
                      />
                    </div>
                  </div>
                  <div className="lunar-row">
                    <span className="lunar-row__label">Surface Tone</span>
                    <LunarStepper
                      value={clientSettings.accent.toUpperCase()}
                      options={["VIOLET", "BLUE", "MONO"]}
                      onChange={(val) => updateSetting("accent", val.toLowerCase() as any)}
                    />
                  </div>
                  <div className="lunar-form__section" style={{ marginTop: 20 }}>KEYBINDS</div>
                  <div className="lunar-row">
                    <span className="lunar-row__label">Open Mod Menu Key</span>
                    <LunarKeybind value="RSHIFT" onChange={() => {}} />
                  </div>
                  <div className="lunar-row">
                    <span className="lunar-row__label">Edit HUD Layout Key</span>
                    <LunarKeybind value="RSHIFT + H" onChange={() => {}} />
                  </div>
                  <div className="lunar-form__section" style={{ marginTop: 20 }}>PERFORMANCE</div>
                  <div className="lunar-row">
                    <div className="lunar-row__left-switch">
                      <LunarSwitch checked={true} onChange={() => {}} />
                      <span className="lunar-row__label">Optimized HUD Rendering</span>
                    </div>
                  </div>
                  <div className="lunar-row">
                    <div className="lunar-row__left-switch">
                      <LunarSwitch checked={true} onChange={() => {}} />
                      <span className="lunar-row__label">Fast Font Renderer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "WAYPOINTS" ? (
            <div className="lunar-detail">
              <div className="lunar-detail__header">
                <div className="lunar-detail__title-row">
                  <h2 className="lunar-detail__title">WAYPOINTS</h2>
                </div>
              </div>
              <p className="lunar-detail__desc">Manage your in-game world waypoints.</p>
              <div className="lunar-detail__content">
                <p style={{ color: "#8c889a", fontSize: 12, padding: "20px 0" }}>
                  No waypoints created in this world yet.
                </p>
                <button type="button" className="lunar-btn-add-hotkey">
                  + ADD WAYPOINT
                </button>
              </div>
            </div>
          ) : selectedModId ? (
            <div className="lunar-detail">
              {/* Detail Header */}
              <div className="lunar-detail__header">
                <div className="lunar-detail__title-row">
                  <button
                    type="button"
                    className="lunar-detail__back-btn"
                    onClick={() => setSelectedModId(null)}
                    aria-label="Back to mods"
                  >
                    ←
                  </button>
                  <h2 className="lunar-detail__title">
                    {selectedModId.replace("-", " ").toUpperCase()}
                  </h2>
                </div>

                <div className="lunar-detail__header-right">
                  <div className="lunar-search-mini">
                    <span className="lunar-search-mini__icon">🔍</span>
                    <input
                      type="text"
                      placeholder="search..."
                      className="lunar-search-mini__input"
                    />
                  </div>
                  <button type="button" className="lunar-icon-tool" aria-label="Font settings">
                    A
                  </button>
                  <button type="button" className="lunar-icon-tool" aria-label="Module settings">
                    ⚙
                  </button>
                </div>
              </div>

              {/* Subtitle description */}
              <p className="lunar-detail__desc">
                {canonicalMods.find((m) => m.id === selectedModId)?.description}
              </p>
              {selectedModId === "nick-hider" && (
                <p className="lunar-detail__credit">Original creators: Sk1er</p>
              )}

              {/* Specific Mod Settings Form */}
              <div className="lunar-detail__content">
                {/* ── TIME CHANGER OPTIONS ─────────────────────────────────── */}
                {selectedModId === "time-changer" && (
                  <div className="lunar-form">
                    <div className="lunar-form__section">GENERAL</div>

                    {/* Time Slider with Sun / Moon icons */}
                    <div className="lunar-row lunar-row--slider">
                      <span className="lunar-row__label">Time</span>
                      <div className="lunar-time-slider">
                        <span className="lunar-time-slider__icon">🌙</span>
                        <input
                          type="range"
                          min={0}
                          max={24000}
                          step={100}
                          value={timeOptions.time}
                          onChange={(e) =>
                            setTimeOptions({ ...timeOptions, time: Number(e.target.value) })
                          }
                          className="lunar-slider-input"
                        />
                        <span className="lunar-time-slider__icon">☀️</span>
                        <span className="lunar-time-slider__icon">🌙</span>
                      </div>
                    </div>

                    {/* Overworld Sky */}
                    <div className="lunar-row">
                      <span className="lunar-row__label">Overworld Sky</span>
                      <LunarStepper
                        value={timeOptions.overworldSky}
                        options={["DEFAULT", "DAY", "NIGHT", "SUNSET", "CLEAR"]}
                        onChange={(val) => setTimeOptions({ ...timeOptions, overworldSky: val })}
                      />
                    </div>

                    {/* Horizon Y Level */}
                    <div className="lunar-row lunar-row--slider">
                      <span className="lunar-row__label">Horizon Y Level</span>
                      <div className="lunar-horizon-slider">
                        <span className="lunar-horizon-val">{timeOptions.horizonY}</span>
                        <input
                          type="range"
                          min={-64}
                          max={320}
                          value={timeOptions.horizonY}
                          onChange={(e) =>
                            setTimeOptions({ ...timeOptions, horizonY: Number(e.target.value) })
                          }
                          className="lunar-slider-input"
                        />
                        <button
                          type="button"
                          className="lunar-btn-reset"
                          onClick={() => setTimeOptions({ ...timeOptions, horizonY: 0 })}
                          title="Reset"
                        >
                          ↺
                        </button>
                      </div>
                    </div>

                    {/* Use Real Current Time */}
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={timeOptions.useRealTime}
                          onChange={(val) => setTimeOptions({ ...timeOptions, useRealTime: val })}
                        />
                        <span className="lunar-row__label">Use Real Current Time</span>
                      </div>
                    </div>

                    {/* Increase Time Keybind */}
                    <div className="lunar-row">
                      <span className="lunar-row__label">Increase Time Keybind</span>
                      <LunarKeybind
                        value={timeOptions.increaseKey}
                        onChange={(val) => setTimeOptions({ ...timeOptions, increaseKey: val })}
                      />
                    </div>

                    {/* Decrease Time Keybind */}
                    <div className="lunar-row">
                      <span className="lunar-row__label">Decrease Time Keybind</span>
                      <LunarKeybind
                        value={timeOptions.decreaseKey}
                        onChange={(val) => setTimeOptions({ ...timeOptions, decreaseKey: val })}
                      />
                    </div>

                    {/* Time Passage */}
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={timeOptions.timePassage}
                          onChange={(val) => setTimeOptions({ ...timeOptions, timePassage: val })}
                        />
                        <span className="lunar-row__label">Time Passage</span>
                      </div>
                      <span className="lunar-chevron-sub">›</span>
                    </div>
                  </div>
                )}

                {/* ── AUTO TEXT HOT KEY OPTIONS ─────────────────────────────── */}
                {selectedModId === "auto-text" && (
                  <div className="lunar-form">
                    <div className="lunar-hotkey-list">
                      {hotkeys.map((hk) => (
                        <div key={hk.id} className="lunar-hotkey-row">
                          <span className="lunar-hotkey-row__label">{hk.label}</span>
                          <input
                            type="text"
                            value={hk.text}
                            onChange={(e) => updateHotkey(hk.id, "text", e.target.value)}
                            placeholder="command or message..."
                            className="lunar-hotkey-input"
                          />
                          <LunarKeybind
                            value={hk.key}
                            onChange={(val) => updateHotkey(hk.id, "key", val)}
                          />
                          <button
                            type="button"
                            className="lunar-hotkey-del"
                            onClick={() => removeHotkey(hk.id)}
                            aria-label={`Delete ${hk.label}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="lunar-btn-add-hotkey"
                      onClick={addHotkey}
                    >
                      ADD HOTKEY
                    </button>
                  </div>
                )}

                {/* ── CHAT OPTIONS ─────────────────────────────────────────── */}
                {selectedModId === "chat" && (
                  <div className="lunar-form">
                    <div className="lunar-form__section">GENERAL</div>
                    <div className="lunar-two-col-grid">
                      {/* Left col */}
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.commandAliases}
                            onChange={(val) => setChatOptions({ ...chatOptions, commandAliases: val })}
                          />
                          <span>Command Aliases</span>
                          <span className="lunar-icon-gear-inline">⚙</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.modernChatLength}
                            onChange={(val) => setChatOptions({ ...chatOptions, modernChatLength: val })}
                          />
                          <span>Modern Chat Length (Hypixel)</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.stackSpam}
                            onChange={(val) => setChatOptions({ ...chatOptions, stackSpam: val })}
                          />
                          <span>Stack Spam Messages</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.textShadow}
                            onChange={(val) => setChatOptions({ ...chatOptions, textShadow: val })}
                          />
                          <span>Text Shadow in Chat</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.keepHistory}
                            onChange={(val) => setChatOptions({ ...chatOptions, keepHistory: val })}
                          />
                          <span>Keep Chat History</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.chatHeads}
                            onChange={(val) => setChatOptions({ ...chatOptions, chatHeads: val })}
                          />
                          <span>Chat Heads</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.hoverImagePreview}
                            onChange={(val) => setChatOptions({ ...chatOptions, hoverImagePreview: val })}
                          />
                          <span>Hover Image Preview</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                      </div>

                      {/* Right col */}
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.unlimitedChat}
                            onChange={(val) => setChatOptions({ ...chatOptions, unlimitedChat: val })}
                          />
                          <span>Unlimited Chat</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.superLongChat}
                            onChange={(val) => setChatOptions({ ...chatOptions, superLongChat: val })}
                          />
                          <span>Super Long Chat (SinglePlayer)</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.chatHeightFix}
                            onChange={(val) => setChatOptions({ ...chatOptions, chatHeightFix: val })}
                          />
                          <span>Chat Height Fix</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.hideIncoming}
                            onChange={(val) => setChatOptions({ ...chatOptions, hideIncoming: val })}
                          />
                          <span>Hide Incoming Messages</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.soundOnMention}
                            onChange={(val) => setChatOptions({ ...chatOptions, soundOnMention: val })}
                          />
                          <span>Play Sound On Mention</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.copyChat}
                            onChange={(val) => setChatOptions({ ...chatOptions, copyChat: val })}
                          />
                          <span>Copy Chat</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.smoothChat}
                            onChange={(val) => setChatOptions({ ...chatOptions, smoothChat: val })}
                          />
                          <span>Smooth Chat</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Keybinds */}
                    <div className="lunar-row" style={{ marginTop: 14 }}>
                      <span className="lunar-row__label">Chat Peek Key</span>
                      <LunarKeybind
                        value={chatOptions.peekKey}
                        onChange={(val) => setChatOptions({ ...chatOptions, peekKey: val })}
                      />
                    </div>
                    <div className="lunar-row">
                      <span className="lunar-row__label">Toggle Chat Visibility</span>
                      <LunarKeybind
                        value={chatOptions.visibilityKey}
                        onChange={(val) => setChatOptions({ ...chatOptions, visibilityKey: val })}
                      />
                    </div>
                    <div className="lunar-status-badge">CHAT VISIBILITY: ON</div>

                    {/* Name Section */}
                    <div className="lunar-form__section" style={{ marginTop: 20 }}>
                      NAME
                    </div>
                    <div className="lunar-row">
                      <span className="lunar-row__label">Highlighted Name Color</span>
                      <LunarStepper
                        value={chatOptions.highlightColor}
                        options={["Off", "Yellow", "Gold", "Aqua", "Green", "Red"]}
                        onChange={(val) => setChatOptions({ ...chatOptions, highlightColor: val })}
                      />
                    </div>
                    <div className="lunar-two-col-grid" style={{ marginTop: 10 }}>
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.highlightBold}
                            onChange={(val) => setChatOptions({ ...chatOptions, highlightBold: val })}
                          />
                          <span>Highlight Name Bold</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.highlightUnderline}
                            onChange={(val) => setChatOptions({ ...chatOptions, highlightUnderline: val })}
                          />
                          <span>Highlight Name Underline</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.highlightObfuscated}
                            onChange={(val) => setChatOptions({ ...chatOptions, highlightObfuscated: val })}
                          />
                          <span>Highlight Name Obfuscated</span>
                        </div>
                      </div>
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.highlightItalic}
                            onChange={(val) => setChatOptions({ ...chatOptions, highlightItalic: val })}
                          />
                          <span>Highlight Name Italic</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={chatOptions.highlightStrikethrough}
                            onChange={(val) => setChatOptions({ ...chatOptions, highlightStrikethrough: val })}
                          />
                          <span>Highlight Name Strikethrough</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── NICK HIDER OPTIONS ───────────────────────────────────── */}
                {selectedModId === "nick-hider" && (
                  <div className="lunar-form">
                    <div className="lunar-form__section">NAME</div>
                    <div className="lunar-two-col-grid">
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideYourNick}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideYourNick: val })}
                          />
                          <span>Hide Your Nick</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideOthersNames}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideOthersNames: val })}
                          />
                          <span>Hide Others Names</span>
                          <span className="lunar-chevron-sub">›</span>
                        </div>
                      </div>
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideYourRealName}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideYourRealName: val })}
                          />
                          <span>Hide Your Real Name</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideHypixelLobbyId}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideHypixelLobbyId: val })}
                          />
                          <span>Hide Hypixel Lobby ID</span>
                        </div>
                      </div>
                    </div>

                    <div className="lunar-form__section" style={{ marginTop: 20 }}>
                      SKIN OPTIONS
                    </div>
                    <div className="lunar-two-col-grid">
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideYourSkin}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideYourSkin: val })}
                          />
                          <span>Hide Your Skin</span>
                        </div>
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.hideOthersSkins}
                            onChange={(val) => setNickOptions({ ...nickOptions, hideOthersSkins: val })}
                          />
                          <span>Hide Others Skins</span>
                        </div>
                      </div>
                      <div className="lunar-col-switches">
                        <div className="lunar-switch-item">
                          <LunarSwitch
                            checked={nickOptions.showRealSkin}
                            onChange={(val) => setNickOptions({ ...nickOptions, showRealSkin: val })}
                          />
                          <span>Show Real Skin</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FREELOOK OPTIONS ─────────────────────────────────────── */}
                {selectedModId === "freelook" && (
                  <div className="lunar-form">
                    <div className="lunar-form__section">GENERAL</div>
                    <div className="lunar-row">
                      <span className="lunar-row__label">Freelook Key</span>
                      <LunarKeybind
                        value={freelookOptions.key}
                        onChange={(val) => setFreelookOptions({ ...freelookOptions, key: val })}
                      />
                    </div>
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={freelookOptions.invertPitch}
                          onChange={(val) => setFreelookOptions({ ...freelookOptions, invertPitch: val })}
                        />
                        <span className="lunar-row__label">Invert Pitch</span>
                      </div>
                    </div>
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={freelookOptions.toggleMode}
                          onChange={(val) => setFreelookOptions({ ...freelookOptions, toggleMode: val })}
                        />
                        <span className="lunar-row__label">Toggle Mode (instead of Hold)</span>
                      </div>
                    </div>
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={freelookOptions.snapBack}
                          onChange={(val) => setFreelookOptions({ ...freelookOptions, snapBack: val })}
                        />
                        <span className="lunar-row__label">Snap Back on Release</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── LIGHTING OPTIONS ─────────────────────────────────────── */}
                {selectedModId === "lighting" && (
                  <div className="lunar-form">
                    <div className="lunar-form__section">GENERAL</div>
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={lightingOptions.fullbright}
                          onChange={(val) => setLightingOptions({ ...lightingOptions, fullbright: val })}
                        />
                        <span className="lunar-row__label">Fullbright</span>
                      </div>
                    </div>
                    <div className="lunar-row lunar-row--slider">
                      <span className="lunar-row__label">Gamma Level</span>
                      <div className="lunar-horizon-slider">
                        <span className="lunar-horizon-val">{lightingOptions.gammaBoost}%</span>
                        <input
                          type="range"
                          min={0}
                          max={500}
                          step={10}
                          value={lightingOptions.gammaBoost}
                          onChange={(e) =>
                            setLightingOptions({ ...lightingOptions, gammaBoost: Number(e.target.value) })
                          }
                          className="lunar-slider-input"
                        />
                        <button
                          type="button"
                          className="lunar-btn-reset"
                          onClick={() => setLightingOptions({ ...lightingOptions, gammaBoost: 100 })}
                          title="Reset"
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    <div className="lunar-row">
                      <div className="lunar-row__left-switch">
                        <LunarSwitch
                          checked={lightingOptions.dynamicLights}
                          onChange={(val) => setLightingOptions({ ...lightingOptions, dynamicLights: val })}
                        />
                        <span className="lunar-row__label">Dynamic Lights</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 2. MODS GRID VIEW */
            <div className="lunar-grid-view">
              {/* Category Filters Bar */}
              <div className="lunar-filter-bar">
                <div className="lunar-filter-pills" role="tablist">
                  {["ALL", "NEW", "HUD", "SERVER", "MECHANIC"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`lunar-filter-pill ${categoryFilter === cat ? "lunar-filter-pill--active" : ""}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="lunar-filter-right">
                  <div className="lunar-filter-icons">
                    <button type="button" className="lunar-filter-icon-btn" aria-label="Grid view">
                      ⠿
                    </button>
                    <button type="button" className="lunar-filter-icon-btn" aria-label="Sort">
                      ⇅
                    </button>
                  </div>
                  <div className="lunar-search-box">
                    <span className="lunar-search-box__icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search mods..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="lunar-search-box__input"
                    />
                  </div>
                </div>
              </div>

              {/* 3-column Mod Cards Grid */}
              <div className="lunar-cards-grid">
                {filteredMods.map((mod) => {
                  const isEnabled = localModStates[mod.id] ?? false;
                  return (
                    <div key={mod.id} className="lunar-card">
                      {/* Top section: Icon & Title */}
                      <div
                        className="lunar-card__body"
                        onClick={() => setSelectedModId(mod.id)}
                      >
                        <div className="lunar-card__icon">
                          <ModGlyph name={mod.id} />
                        </div>
                        <h3 className="lunar-card__title">{mod.name}</h3>
                      </div>

                      {/* Options row */}
                      <button
                        type="button"
                        className="lunar-card__options"
                        onClick={() => setSelectedModId(mod.id)}
                      >
                        <span>OPTIONS</span>
                        <span className="lunar-card__gear">⚙</span>
                      </button>

                      {/* Full-width Toggle Button */}
                      <button
                        type="button"
                        className={`lunar-card__toggle-btn ${
                          isEnabled
                            ? "lunar-card__toggle-btn--enabled"
                            : "lunar-card__toggle-btn--disabled"
                        }`}
                        onClick={() => toggleMod(mod.id)}
                      >
                        {isEnabled ? "ENABLED" : "DISABLED"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
