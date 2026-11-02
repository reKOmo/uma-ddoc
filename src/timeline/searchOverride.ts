// Whether the Timeline's search shows matches the filter hides (default on; the filter's Show tab switches it).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../rawStorage.ts';

const KEY = 'uma-ddoc.timelineSearchOverride';

type State = { override: boolean; setOverride: (override: boolean) => void };

export const useSearchOverrideStore = create<State>()(
  persist(
    (set) => ({
      override: true,
      setOverride: (override) => set({ override }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'override'>>(
        // Stored as the string 'false' or 'true', not JSON: anything but 'false' is on.
        (raw) => ({ override: raw !== 'false' }),
        ({ override }) => String(override)
      ),
      partialize: ({ override }) => ({ override }),
    }
  )
);

export const saveSearchOverride = (override: boolean) => useSearchOverrideStore.getState().setOverride(override);
