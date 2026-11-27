import i18n from '../i18n/index.ts';
import { DAY } from '../lib/dates.ts';
import type { Entry } from './entries.ts';

export const daysOf = (entry: Pick<Entry, 'start' | 'end'>): number | null =>
  entry.end ? Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / DAY) : null;

export const kindName = (entry: Pick<Entry, 'group' | 'kind'>): string =>
  i18n.t(entry.group === 'event' ? `events.kind.${entry.kind}` : `timeline.kind.${entry.kind}`);

// A bar's label: a banner by its main featured item (and how many more), else its name; an event's name, else its
// kind's (Legend Races, Transfer Requests).
// An event whose name stayed Japanese in English says its kind first.
type Labelled = Pick<Entry, 'main' | 'name' | 'kind' | 'group'> & Partial<Pick<Entry, 'untranslated'>>;
export function barLabel(entry: Labelled): string {
  if (entry.main)
    return entry.main.others > 0
      ? i18n.t('timeline.barLabel', { name: entry.main.name, count: entry.main.others })
      : entry.main.name;
  if (entry.name && entry.untranslated)
    return i18n.t('timeline.untranslated', { kind: kindName(entry), name: entry.name });
  return entry.name ?? kindName(entry);
}

// Whether the bar's label (`title`: the sheet's title) shows a fan translation (src/timeline/translate.ts).
export function labelIsFan(entry: Pick<Entry, 'main' | 'name' | 'fan'>, { title = false } = {}): boolean {
  const shown = entry.main && !(title && entry.name) ? entry.main.name : entry.name;
  return shown != null && entry.fan.has(shown);
}

// The bar's course: its first race with a distance ("Nakayama 2500m"), or null.
export function raceLabel(entry: Pick<Entry, 'races'>): string | null {
  const race = entry.races.find((r) => r.distance);
  return race ? courseName(race) : null;
}

export const courseName = (race: Pick<Entry['races'][number], 'track' | 'distance'>): string =>
  `${i18n.t(`events.race.track.${race.track}`, { defaultValue: race.track })} ${race.distance}m`;

export const entryTitle = (entry: Pick<Entry, 'name' | 'main' | 'kind' | 'group'>): string =>
  entry.name ?? barLabel(entry);
