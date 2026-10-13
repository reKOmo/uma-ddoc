// The persisted stores keep today's localStorage formats: old data loads, changes write the same shapes, and garbage
// or a throwing localStorage gives the defaults.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let data: Map<string, string>;
let writes: Map<string, string>;

function stubStorage(throwing = false) {
  data = new Map();
  writes = new Map();
  const fail = () => {
    throw new Error('blocked');
  };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (throwing ? fail() : (data.get(key) ?? null)),
    setItem: (key: string, value: string) => {
      if (throwing) fail();
      data.set(key, value);
      writes.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
  });
}

beforeEach(() => {
  vi.resetModules();
  stubStorage();
});
afterEach(() => vi.unstubAllGlobals());

const GARBAGE = ['{not json', 'null', '42', '"text"', '[]', '{"a":'];

describe('settings', () => {
  const KEY = 'uma-ddoc.settings';
  const load = () => import('../src/settingsStore.ts');

  it('loads the stored JSON, each field checked', async () => {
    data.set(KEY, JSON.stringify({ timeZone: 'local', scenarioNames: 'nope', jpNewsLanguage: 'en', extra: 1 }));
    const { getSettings } = await load();
    expect(getSettings()).toEqual({ timeZone: 'local', scenarioNames: 'global', jpNewsLanguage: 'en' });
  });

  it('writes the plain settings object', async () => {
    const { setSetting, getSetting } = await load();
    setSetting('scenarioNames', 'jp');
    expect(getSetting('scenarioNames')).toBe('jp');
    expect(JSON.parse(writes.get(KEY) as string)).toEqual({
      timeZone: 'utc',
      scenarioNames: 'jp',
      jpNewsLanguage: 'jp',
    });
  });

  it('ignores an unknown option', async () => {
    const { setSetting, getSetting } = await load();
    // @ts-expect-error not an option
    setSetting('timeZone', 'mars');
    expect(getSetting('timeZone')).toBe('utc');
  });

  it.each(GARBAGE)('gives the defaults for %s', async (raw) => {
    data.set(KEY, raw);
    const { getSettings } = await load();
    expect(getSettings()).toEqual({ timeZone: 'utc', scenarioNames: 'global', jpNewsLanguage: 'jp' });
  });

  it('survives a throwing localStorage', async () => {
    stubStorage(true);
    const { getSettings, setSetting } = await load();
    expect(getSettings().timeZone).toBe('utc');
    expect(() => setSetting('timeZone', 'local')).not.toThrow();
    expect(getSettings().timeZone).toBe('local');
  });
});

describe('tier list filters', () => {
  const KEY = 'uma-ddoc.tierListFilters';
  const load = () => import('../src/tierListFilters.ts');
  const stored = { stat: 'guts', shown: { SSR: [4], SR: [], R: [0, 4] }, query: 'kita', size: 2 };

  it('loads the stored JSON', async () => {
    data.set(KEY, JSON.stringify(stored));
    const { getFilters } = await load();
    expect(getFilters()).toEqual(stored);
  });

  it('checks each field on its own', async () => {
    data.set(KEY, JSON.stringify({ ...stored, stat: 'luck', shown: { SSR: [9] }, size: 7 }));
    const { getFilters, DEFAULTS } = await load();
    expect(getFilters()).toEqual({ ...DEFAULTS, query: 'kita' });
  });

  it('writes { stat, shown, query, size }', async () => {
    const { saveFilters, getFilters } = await load();
    saveFilters({ ...getFilters(), stat: 'power', query: 'x' });
    expect(JSON.parse(writes.get(KEY) as string)).toEqual({
      stat: 'power',
      shown: { SSR: [0, 3, 4], SR: [0, 3, 4], R: [4] },
      query: 'x',
      size: 3,
    });
  });

  it.each(GARBAGE)('gives the defaults for %s', async (raw) => {
    data.set(KEY, raw);
    const { getFilters, DEFAULTS } = await load();
    expect(getFilters()).toEqual(DEFAULTS);
  });

  it('survives a throwing localStorage', async () => {
    stubStorage(true);
    const { getFilters, saveFilters, DEFAULTS } = await load();
    expect(getFilters()).toEqual(DEFAULTS);
    expect(() => saveFilters({ ...DEFAULTS, size: 1 })).not.toThrow();
    expect(getFilters().size).toBe(1);
  });
});

// hidden and collapsed: the same JSON array of strings ↔ Set.
describe.each([
  ['hidden', 'uma-ddoc.timelineHidden', '../src/timeline/hidden.ts', 'getHidden', 'saveHidden'],
  ['collapsed', 'uma-ddoc.timelineCollapsed', '../src/timeline/collapsed.ts', 'getCollapsed', 'saveCollapsed'],
] as const)('timeline %s', (_name, KEY, path, getter, saver) => {
  const load = async () => {
    const mod = (await import(/* @vite-ignore */ path)) as Record<string, (...args: unknown[]) => unknown>;
    return { get: () => mod[getter]?.() as Set<string>, save: (s: Set<string>) => mod[saver]?.(s) };
  };

  it('loads a JSON array of strings as a Set', async () => {
    data.set(KEY, JSON.stringify(['story', 'pull:yes', 3, null]));
    const { get } = await load();
    expect(get()).toEqual(new Set(['story', 'pull:yes']));
  });

  it('writes a JSON array', async () => {
    const { save } = await load();
    save(new Set(['gift', 'cards']));
    expect(writes.get(KEY)).toBe('["gift","cards"]');
  });

  it.each(GARBAGE.filter((raw) => raw !== '[]'))('gives an empty Set for %s', async (raw) => {
    data.set(KEY, raw);
    const { get } = await load();
    expect(get()).toEqual(new Set());
  });

  it('survives a throwing localStorage', async () => {
    stubStorage(true);
    const { get, save } = await load();
    expect(get()).toEqual(new Set());
    expect(() => save(new Set(['a']))).not.toThrow();
    expect(get()).toEqual(new Set(['a']));
  });
});

describe('timeline compact', () => {
  const KEY = 'uma-ddoc.timelineCompact';
  const load = () => import('../src/timeline/compact.ts');

  it('"false" is off; anything else or nothing is on', async () => {
    data.set(KEY, 'false');
    expect((await load()).getCompact()).toBe(false);
    vi.resetModules();
    data.set(KEY, 'true');
    expect((await load()).getCompact()).toBe(true);
    vi.resetModules();
    data.set(KEY, '{garbage');
    expect((await load()).getCompact()).toBe(true);
    vi.resetModules();
    data.delete(KEY);
    expect((await load()).getCompact()).toBe(true);
  });

  it('writes the string "false" / "true"', async () => {
    const { saveCompact } = await load();
    saveCompact(false);
    expect(writes.get(KEY)).toBe('false');
    saveCompact(true);
    expect(writes.get(KEY)).toBe('true');
  });

  it('survives a throwing localStorage', async () => {
    stubStorage(true);
    const { getCompact, saveCompact } = await load();
    expect(getCompact()).toBe(true);
    expect(() => saveCompact(false)).not.toThrow();
    expect(getCompact()).toBe(false);
  });
});

describe('timeline order', () => {
  const KEY = 'uma-ddoc.timelineOrder';
  const load = () => import('../src/timeline/order.ts');

  it('loads a JSON array, normalised', async () => {
    const { DEFAULT_ORDER } = await load();
    vi.resetModules();
    const [first, second, ...rest] = DEFAULT_ORDER as [string, string, ...string[]];
    const swapped = [second, first, ...rest];
    data.set(KEY, JSON.stringify(['bogus', second, 7, first, second, ...rest]));
    const { getOrder } = await load();
    expect(getOrder()).toEqual(swapped);
  });

  it('adds a group the saved order lacks', async () => {
    const { DEFAULT_ORDER } = await load();
    vi.resetModules();
    data.set(KEY, JSON.stringify(DEFAULT_ORDER.slice(1)));
    const { getOrder } = await load();
    expect(getOrder()).toEqual(DEFAULT_ORDER);
  });

  it('writes a JSON array of keys', async () => {
    const { saveOrder, DEFAULT_ORDER } = await load();
    const next = [...DEFAULT_ORDER].reverse();
    saveOrder(next);
    expect(JSON.parse(writes.get(KEY) as string)).toEqual(next);
  });

  it.each(GARBAGE.filter((raw) => raw !== '[]'))('gives the default order for %s', async (raw) => {
    data.set(KEY, raw);
    const { getOrder, DEFAULT_ORDER } = await load();
    expect(getOrder()).toEqual(DEFAULT_ORDER);
  });

  it('survives a throwing localStorage', async () => {
    stubStorage(true);
    const { getOrder, saveOrder, DEFAULT_ORDER } = await load();
    expect(getOrder()).toEqual(DEFAULT_ORDER);
    const next = [...DEFAULT_ORDER].reverse();
    expect(() => saveOrder(next)).not.toThrow();
    expect(getOrder()).toEqual(next);
  });
});
