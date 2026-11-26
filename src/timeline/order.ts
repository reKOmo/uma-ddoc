import { persistedValue, stringArray } from '../state/rawStorage.ts';
import { LANE_GROUPS } from './layout.ts';

const KEY = 'uma-ddoc.timelineOrder';
export const DEFAULT_ORDER: string[] = LANE_GROUPS.map((group) => group.key);

export const isDefaultOrder = (keys: string[]) => keys.every((key, i) => key === DEFAULT_ORDER[i]);

// Known keys only, each once, then any group missing after the one before it by default.
function normalize(keys: string[]): string[] {
  const known = [...new Set(keys.filter((key) => DEFAULT_ORDER.includes(key)))];
  DEFAULT_ORDER.forEach((key, i) => {
    if (known.includes(key)) return;
    const before = DEFAULT_ORDER.slice(0, i).findLast((k) => known.includes(k));
    known.splice(before ? known.indexOf(before) + 1 : 0, 0, key);
  });
  return known;
}

const order = persistedValue(
  KEY,
  DEFAULT_ORDER,
  (raw) => {
    const keys = stringArray(raw);
    return keys && normalize(keys);
  },
  (keys) => JSON.stringify(keys)
);

export const useOrder = order.use;
export const getOrder = order.get;
export const saveOrder = order.save;

export function orderedGroups(keys: string[]) {
  const byKey = new Map(LANE_GROUPS.map((group) => [group.key, group]));
  return normalize(keys).flatMap((key) => byKey.get(key) ?? []);
}

export function reorderGroups(keys: string[], shown: string[], from: number, to: number) {
  const visible = keys.filter((k) => shown.includes(k));
  if (from === to || !visible[from] || !visible[to]) return keys;
  const [moved] = visible.splice(from, 1) as [string];
  visible.splice(to, 0, moved);
  let i = 0;
  return keys.map((k) => (shown.includes(k) ? (visible[i++] as string) : k));
}
