// Which of the Timeline's groups (banner sections, event groups) are collapsed, a zustand store so they survive leaving
// the page, and in this browser's storage (a JSON array of strings, as it always was) so they survive a reload. Storage
// can be missing or throw (private windows, blocked site data); then they're only kept until the page is closed.
//   getCollapsed() → Set of group keys ('characters', 'cards', 'events-story'…)
//   saveCollapsed(set)

import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../settingsStore.ts';

const KEY = 'uma-ddoc.timelineCollapsed';

type State = { collapsed: Set<string>; setCollapsed: (collapsed: Set<string>) => void };

export const useCollapsedStore = create<State>()(
  persist(
    (set) => ({
      collapsed: new Set<string>(),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'collapsed'>>(
        (raw) => {
          const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          return { collapsed: new Set(parsed.data.filter((k): k is string => typeof k === 'string')) };
        },
        ({ collapsed }) => JSON.stringify([...collapsed])
      ),
      partialize: ({ collapsed }) => ({ collapsed }),
    }
  )
);

export const getCollapsed = (): Set<string> => useCollapsedStore.getState().collapsed;
export const saveCollapsed = (collapsed: Set<string>) => useCollapsedStore.getState().setCollapsed(collapsed);
