import { writable } from "svelte/store";

// Client-side preferences only. Persistence belongs to Client Core in the
// integrated build (architecture doc section 28); this store is a thin
// session-local cache for the standalone preview.

export const uiScale = writable<number>(1.0);
export const reduceMotion = writable<boolean>(false);
export const searchHistory = writable<string[]>([]);

export function pushSearch(value: string) {
  searchHistory.update((history) => {
    const next = [value, ...history.filter((item) => item !== value)];
    return next.slice(0, 10);
  });
}
