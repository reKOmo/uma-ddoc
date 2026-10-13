// The game's stat type icons (70×70, from the original tier list's repo: utx_ico_obtain_00–05), by stat key (STATS in
// tierlist/index.js). Bundled with the app: no hotlinking.

import speed from './icons/stats/speed.png';
import stamina from './icons/stats/stamina.png';
import power from './icons/stats/power.png';
import guts from './icons/stats/guts.png';
import wisdom from './icons/stats/wisdom.png';
import friend from './icons/stats/friend.png';

export const STAT_ICONS: Record<'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'friend', string> = {
  speed,
  stamina,
  power,
  guts,
  wisdom,
  friend,
};
