import { stringSetStore } from '../state/rawStorage.ts';

const collapsed = stringSetStore('uma-ddoc.timelineCollapsed');

export const useCollapsed = collapsed.use;
export const getCollapsed = collapsed.get;
export const saveCollapsed = collapsed.save;
