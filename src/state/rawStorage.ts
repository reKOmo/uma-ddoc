import type { PersistStorage } from 'zustand/middleware';

// zustand's persist would wrap each state as `{ state, version }`; this keeps every store's own plain format (stored
// formats never change). Every localStorage access is guarded: it can be missing or throw (private windows).
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
      } catch {}
    },
  };
}
