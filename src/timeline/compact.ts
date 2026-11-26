import { booleanStore } from '../state/rawStorage.ts';

const compact = booleanStore('uma-ddoc.timelineCompact', true);

export const useCompact = compact.use;
export const getCompact = compact.get;
export const saveCompact = compact.save;
