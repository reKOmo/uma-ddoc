// Shared by both servers: a kind one server lacks is ignored there.
import { stringSetStore } from '../state/rawStorage.ts';
import { getPulls, isVerdict, savePulls } from './pulls.ts';

const hidden = stringSetStore('uma-ddoc.timelineHidden');

export const useHidden = hidden.use;
export const getHidden = hidden.get;
export const saveHidden = hidden.save;

// Older versions kept the pull-advice picks here, as `pullOnly:<verdict>`: they move to their own store.
const OLD_PICK = 'pullOnly:';
const oldPicks = [...getHidden()].filter((key) => key.startsWith(OLD_PICK));
if (oldPicks.length) {
  savePulls(new Set([...getPulls(), ...oldPicks.map((key) => key.slice(OLD_PICK.length)).filter(isVerdict)]));
  saveHidden(new Set([...getHidden()].filter((key) => !key.startsWith(OLD_PICK))));
}
