import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../rawStorage.ts';
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

type State = { order: string[]; setOrder: (order: string[]) => void };

export const useOrderStore = create<State>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      setOrder: (order) => set({ order }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'order'>>(
        (raw) => {
          const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          return { order: normalize(parsed.data.filter((k): k is string => typeof k === 'string')) };
        },
        ({ order }) => JSON.stringify(order)
      ),
      partialize: ({ order }) => ({ order }),
    }
  )
);

export const getOrder = (): string[] => useOrderStore.getState().order;
export const saveOrder = (keys: string[]) => useOrderStore.getState().setOrder(keys);

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
