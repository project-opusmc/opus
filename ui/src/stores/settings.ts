import { writable } from "svelte/store";

// Client-side preferences only. Persistence belongs to Client Core in the
// integrated build (architecture doc section 28); this store is a thin
// session-local cache for the standalone preview.

export const uiScale = writable<number>(1.0);
export const reduceMotion = writable<boolean>(false);

// Which Settings tab to show when the page opens next. The in-game pause menu
// sets this to "game" so "Game Options" lands on real game options directly.
export const settingsTab = writable<"interface" | "game">("interface");
