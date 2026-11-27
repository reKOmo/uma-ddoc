// The Timeline filter's picked pull-advice verdicts: none picked shows every banner, else only the support card banners
// where one of their cards has a picked one. Shared by both servers, like the hidden kinds.
import { type Verdict, VERDICTS } from '../lib/pullGuide.ts';
import { persistedValue, stringArray } from '../state/rawStorage.ts';

export const isVerdict = (key: string): key is Verdict => VERDICTS.some((verdict) => verdict === key);

const pulls = persistedValue<Set<Verdict>>(
  'uma-ddoc.timelinePulls',
  new Set(),
  (raw) => {
    const keys = stringArray(raw);
    return keys && new Set(keys.filter(isVerdict));
  },
  (set) => JSON.stringify([...set])
);

export const usePulls = pulls.use;
export const getPulls = pulls.get;
export const savePulls = pulls.save;
