import type {
  Account,
  ClientInfo,
  Module,
  Server,
  World,
} from "./types";

// Mock data first (architecture doc section 39). The real REST bridge will
// replace these functions with typed calls to the Client Core.

export const mockClient: ClientInfo = {
  version: "0.0.1",
  minecraft: "1.8.9",
  forge: "11.15.1.2318",
  optifine: "HD U M5",
  session: "Ready",
  runtime: "forge-optifine-1.8.9",
};

export const mockAccounts: Account[] = [
  {
    id: "acc-official-1",
    username: "zvwgvx",
    kind: "official",
    uuid: "0f8d1b0c-0000-0000-0000-000000000001",
    active: true,
  },
  {
    id: "acc-unofficial-1",
    username: "opus-player",
    kind: "unofficial",
  },
];

export const mockServers: Server[] = [
  {
    id: "srv-1",
    name: "Opus Network",
    address: "play.opus.example:25565",
    version: "1.8.9",
    latencyMs: 24,
    state: "online",
  },
  {
    id: "srv-2",
    name: "Fallen Kingdom",
    address: "mc.fallen.example",
    version: "1.8.9",
    latencyMs: 89,
    state: "online",
  },
  {
    id: "srv-3",
    name: "Vanilla Survival",
    address: "survival.example:25565",
    version: "1.8.9",
    state: "offline",
  },
];

export const mockWorlds: World[] = [
  {
    id: "world-1",
    name: "New World",
    fileName: "New World",
    mode: "Survival",
    lastPlayed: "2 hours ago",
    size: "1.4 GB",
  },
  {
    id: "world-2",
    name: "Creative Lab",
    fileName: "Creative Lab",
    mode: "Creative",
    lastPlayed: "Yesterday",
    size: "820 MB",
  },
  {
    id: "world-3",
    name: "Hardcore Run",
    fileName: "Hardcore Run",
    mode: "Hardcore",
    lastPlayed: "3 days ago",
    size: "610 MB",
  },
];

export const mockModules: Module[] = [
  {
    id: "fps",
    name: "FPS Display",
    description: "Show frames per second in the HUD.",
    enabled: true,
    settings: [
      {
        key: "position",
        label: "Position",
        type: "enum",
        value: "top-left",
        options: [
          { value: "top-left", label: "Top left" },
          { value: "top-right", label: "Top right" },
          { value: "bottom-left", label: "Bottom left" },
          { value: "bottom-right", label: "Bottom right" },
        ],
      },
      {
        key: "show-average",
        label: "Show average",
        type: "boolean",
        value: true,
      },
    ],
  },
  {
    id: "armor",
    name: "Armor Status",
    description: "Show armor durability next to the hotbar.",
    enabled: true,
    settings: [
      {
        key: "detail",
        label: "Detail",
        type: "enum",
        value: "compact",
        options: [
          { value: "compact", label: "Compact" },
          { value: "full", label: "Full" },
        ],
      },
    ],
  },
  {
    id: "keystrokes",
    name: "Keystrokes",
    description: "Visualize movement and action keys.",
    enabled: false,
    settings: [
      {
        key: "opacity",
        label: "Opacity",
        type: "float",
        value: 0.8,
        min: 0.1,
        max: 1,
        step: 0.05,
      },
    ],
  },
];
