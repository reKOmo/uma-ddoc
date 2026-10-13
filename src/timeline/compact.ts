import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rawStorage } from '../rawStorage.ts';

const KEY = 'uma-ddoc.timelineCompact';

type State = { compact: boolean; setCompact: (compact: boolean) => void };

export const useCompactStore = create<State>()(
  persist(
    (set) => ({
      compact: true,
      setCompact: (compact) => set({ compact }),
    }),
    {
      name: KEY,
      storage: rawStorage<Pick<State, 'compact'>>(
        // Stored as the string 'false' or 'true', not JSON: anything but 'false' is on.
        (raw) => ({ compact: raw !== 'false' }),
        ({ compact }) => String(compact)
      ),
      partialize: ({ compact }) => ({ compact }),
    }
  )
);

export const getCompact = (): boolean => useCompactStore.getState().compact;
export const saveCompact = (compact: boolean) => useCompactStore.getState().setCompact(compact);
