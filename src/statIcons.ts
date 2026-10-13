// The game's stat icons (70×70, from upstream's src/icons/utx_ico_obtain_00–05), by stat key. Bundled: not hotlinked.

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
