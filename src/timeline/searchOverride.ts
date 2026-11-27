// Whether the Timeline's search shows matches the filter hides (default on; the filter's Show tab switches it).
import { booleanStore } from '../state/rawStorage.ts';

const override = booleanStore('uma-ddoc.timelineSearchOverride', true);

export const useSearchOverride = override.use;
export const saveSearchOverride = override.save;
