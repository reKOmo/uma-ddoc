// The races an event is run on, from its post's race conditions (a Champions Meeting's, Legend Race's, League of
// Heroes'…): "Nakayama / Turf / 2,500m (Long) / Right-Handed / Inner / Winter / Cloudy / Good". The wording is the
// lexicon's (`lang.race`). Pure.

import type { Race } from '../../shared/schemas/event.ts';
import type { Block, Lexicon, RaceLexicon } from './news-lang/index.ts';

type Fields = Partial<Race>;
export type Conditions = { name: string | null; fields: Fields; unknown: string[] };

const DISTANCE = /^(\d[\d,]*)\s*m$/i;
const HAS_DISTANCE = /\d\s*m(?![a-z])/i;

// The game's distance categories by metres (when a post leaves it out: "2,000m / Right-Handed").
const categoryOf = (m: number): Race['category'] =>
  m <= 1400 ? 'sprint' : m <= 1800 ? 'mile' : m <= 2400 ? 'medium' : 'long';

function word(w: string, r: RaceLexicon): Fields | null {
  const distance = w.match(DISTANCE);
  if (distance) return { distance: Number(distance[1].replace(/,/g, '')) };
  return r.vocabulary[r.key(w)] ?? null;
}

// A line of conditions: what its words set, the race's name (a first part that isn't a word), the words it didn't know.
export function raceConditions(line: string, r: RaceLexicon): Conditions {
  const out: Conditions = { name: null, fields: {}, unknown: [] };
  r.parts(line).forEach((part, i) => {
    const words = r.words(part);
    const known = words.map((w) => word(w, r));
    if (i === 0 && !known[0]) {
      out.name = part;
      return;
    }
    words.forEach((w, j) => {
      const fields = known[j];
      if (fields) Object.assign(out.fields, fields);
      else out.unknown.push(w);
    });
  });
  return out;
}

function race(fields: Fields, name: string | null, opponent: string | null, variable: boolean): Race | null {
  if (!fields.track) return null;
  const distance = fields.distance ?? null;
  return {
    name,
    opponent,
    track: fields.track,
    surface: fields.surface ?? null,
    distance,
    category: fields.category ?? (distance ? categoryOf(distance) : null),
    direction: fields.direction ?? null,
    course: fields.course ?? null,
    season: fields.season ?? null,
    weather: fields.weather ?? null,
    ground: fields.ground ?? null,
    time: fields.time ?? null,
    variable,
  };
}

// A block's races: one per race line, or per opponent when the post gives their conditions apart (one race line);
// Dream Team's one per racecourse. `names`: an opponent's name as shown (JP's → Global's).
export function blockRaces(block: Block, lang: Lexicon, names: Map<string, string> = new Map()): Race[] {
  const r = lang.race;
  const section = block.sections.find((s) => r.heading.test(s.heading));
  if (!section) return [];
  const variable = section.lines.some((line) => r.variable.test(line));
  const lines = section.lines.filter((line) => HAS_DISTANCE.test(line)).map((line) => raceConditions(line, r));
  const raceName = (c: Conditions) => (c.name && (r.name?.(c.name) ?? c.name)) || null;

  if (!lines.length) {
    const tracks = r.tracks && section.lines.map((line) => line.match(r.tracks as RegExp)?.[1]).find(Boolean);
    if (!tracks) return [];
    // Lines of known words only ("Season: Fall") apply to every racecourse.
    const shared = Object.assign(
      {},
      ...section.lines
        .map((line) => raceConditions(line, r))
        .filter((c) => !c.name && !c.unknown.length)
        .map((c) => c.fields)
    );
    return tracks
      .split(/\s*,\s*/)
      .map((track) => race({ ...shared, ...word(track, r) }, null, null, variable))
      .filter((x): x is Race => x !== null);
  }

  const list = block.sections.find((s) => r.opponents.test(s.heading))?.lines ?? [];
  const opponents = list.flatMap((line) => {
    const m = line.match(r.opponent);
    return m ? [{ name: names.get(m[1].trim()) ?? m[1].trim(), fields: raceConditions(m[2], r).fields }] : [];
  });
  const races =
    lines.length === 1 && opponents.length
      ? opponents.map((o) => race({ ...lines[0].fields, ...o.fields }, raceName(lines[0]), o.name, variable))
      : lines.map((c) => race(c.fields, raceName(c), null, variable));
  return races.filter((x): x is Race => x !== null);
}
