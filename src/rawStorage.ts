import type { PersistStorage } from 'zustand/middleware';

// The persisted stores' storage (src/settingsStore.ts, src/tierListFilters.ts, src/timeline/*): zustand's persist would
// wrap the state as `{ state, version }`; this keeps each store's own plain format. `parse(raw)` → the state, or null
// for anything invalid (then the defaults stay); `serialize(state)` → the string stored. Every access to
// localStorage is guarded: it can be missing or throw, and then nothing is remembered across reloads.
export function rawStorage<S>(parse: (raw: string) => S | null, serialize: (state: S) => string): PersistStorage<S> {
  return {
    getItem: (name) => {
      try {
        const raw = globalThis.localStorage?.getItem(name);
        const state = raw == null ? null : parse(raw);
        return state ? { state, version: 0 } : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        globalThis.localStorage?.setItem(name, serialize(value.state));
      } catch {
        // Not remembered across reloads; still kept while the page is open.
      }
    },
    removeItem: (name) => {
      try {
        globalThis.localStorage?.removeItem(name);
      } catch {
        // Nothing to remove.
      }
    },
  };
}
