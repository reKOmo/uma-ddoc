import * as z from 'zod/mini';
import { create } from 'zustand';
import { type PersistStorage, persist } from 'zustand/middleware';

// zustand's persist would wrap each state as `{ state, version }`; this keeps every store's own plain format (stored
// formats never change). Every localStorage access is guarded: it can be missing or throw (private windows).
function rawStorage<S>(parse: (raw: string) => S | null, serialize: (state: S) => string): PersistStorage<S> {
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

// A zustand store remembered under `key`: `parse` gives the fields it could read from the stored text (null: none, the
// initial state stays), `serialize` writes the store's own format.
export function persisted<S extends object>(
  key: string,
  initial: S,
  parse: (raw: string) => Partial<S> | null,
  serialize: (state: S) => string
) {
  return create<S>()(
    persist(() => initial, {
      name: key,
      storage: rawStorage<S>((raw) => {
        const read = parse(raw);
        return read && { ...initial, ...read };
      }, serialize),
    })
  );
}

// One remembered value, read and written outside React too.
export function persistedValue<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string
) {
  const store = persisted<{ value: T }>(
    key,
    { value: initial },
    (raw) => {
      const value = parse(raw);
      return value === null ? null : { value };
    },
    ({ value }) => serialize(value)
  );
  return {
    use: (): T => store((state) => state.value),
    get: (): T => store.getState().value,
    save: (value: T) => store.setState({ value }),
  };
}

// A stored JSON array's strings (other items dropped); null if it isn't an array.
export function stringArray(raw: string): string[] | null {
  const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.filter((item): item is string => typeof item === 'string') : null;
}

// Stored as a JSON array.
export function stringSetStore(key: string) {
  return persistedValue<Set<string>>(
    key,
    new Set(),
    (raw) => {
      const keys = stringArray(raw);
      return keys && new Set(keys);
    },
    (set) => JSON.stringify([...set])
  );
}

// Stored as the string 'false' or 'true', not JSON: anything else stored reads as `initial`.
export function booleanStore(key: string, initial: boolean) {
  return persistedValue(
    key,
    initial,
    (raw) => (raw === String(!initial) ? !initial : initial),
    (value) => String(value)
  );
}
