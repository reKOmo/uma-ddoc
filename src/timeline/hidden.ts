// Which banner sections and event kinds the Timeline's filter hides, a zustand store so they survive leaving the page,
// and in this browser's storage (a JSON array of strings, as it always was) so they survive a reload. Storage can be
// missing or throw (private windows, blocked site data); then they're only kept until the page is closed. The same
// for both servers (a kind a server hasn't got is just ignored there).
//   getHidden() → Set of kinds ('characters', 'cards': banner sections; 'story', 'gift'…: EVENT_KINDS) and
//     'pull:<verdict>' (support card banners by their cards' pull advice: VERDICTS in src/pullGuide.ts)
//   saveHidden(set)

import * as z from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../settingsStore.ts';

const KEY = 'uma-ddoc.timelineHidden';

type State = { hidden: Set<string>; setHidden: (hidden: Set<string>) => void };

export const useHiddenStore = create<State>()(
  persist(
    (set) => ({
      hidden: new Set<string>(),
      setHidden: (hidden) => set({ hidden }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'hidden'>>(
        (raw) => {
          const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
          if (!parsed.success) return null;
          return { hidden: new Set(parsed.data.filter((k): k is string => typeof k === 'string')) };
        },
        ({ hidden }) => JSON.stringify([...hidden])
      ),
      partialize: ({ hidden }) => ({ hidden }),
    }
  )
);

export const getHidden = (): Set<string> => useHiddenStore.getState().hidden;
export const saveHidden = (hidden: Set<string>) => useHiddenStore.getState().setHidden(hidden);
