// GameTora's JP event history (story events, Champions Meetings, Legend Races) filled into JP's events
// (data/jp_events.json) where the JP news has none: our JP news archive is thin before mid-2022 (2021: 96 posts), and
// GameTora's history goes back to the 2021 launch. From mid-2022 on the two agree exactly (checked on 2026-10-11), so a
// GameTora event is only added before then (FILL_BEFORE), where no news event of its kind overlaps it: a newer one
// GameTora lists first (the next cup, before the JP news dates it) waits for the news. Pure, except the reader/writer.
//
// generated/raw/gametora_events.json (pnpm scrape-gametora), GameTora's files cut to the fields read here:
//   { story: [{ id, name_ja, start_ja, end_ja, event_support_ids }],
//     champions_meeting: [{ id, name, start, end }]                      start = round 1 (not the league selection)
//     legend_race: [{ id, name_ja, start, end, races: [{ card_id, start, end }] }] }   times in unix seconds
//
// A filled event has the news events' shape with `source: 'gametora'`, no news_url, no art, no items or titles:
//   story              name: GameTora's Japanese name, cards: the event's own cards (event_support_ids)
//   champions_meeting  name: the cup's Japanese name as the news has it (タウラス杯… then SPRINT / MILE / CLASSIC…);
//                      start = round 1: GameTora doesn't know the league selection (3 or 4 days earlier in the news,
//                      never the same), so it's left out; phases from round 1 on (every cup since 2022 has the same
//                      schedule: two 2-day rounds, half a day each to register and match, a 1-day final)
//   legend_race        name null like the news' (the kind says it)
// An event the news announced without dates ("coming soon": a 1-day bar on its post day) of the same kind and name,
// up to SAME_EVENT_DAYS before GameTora's, takes GameTora's dates and phases instead (it keeps its id, link and
// source 'news'), as buildEvents() does with a later dated post.

import { existsSync, readFileSync } from 'node:fs';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { EventCard, EventKind, GameEvent, Phase } from '../../shared/schemas/event.ts';
import type { GametoraEventsFile } from '../../shared/schemas/gametora.ts';
import { DAY } from './news-text.ts';
import { norm } from './event-rewards.ts';
import { GENERATED_DIR } from './paths.ts';

export const GAMETORA_EVENTS_FILE = `${GENERATED_DIR}raw/gametora_events.json`;

// GameTora's data files and the fields kept from each (scripts/scrape-gametora.js).
export const GAMETORA_EVENT_FILES = {
  story: { file: 'events/story-events', fields: ['id', 'name_ja', 'start_ja', 'end_ja', 'event_support_ids'] },
  champions_meeting: { file: 'events/champions-meeting', fields: ['id', 'name', 'start', 'end'] },
  legend_race: { file: 'events/legend-race', fields: ['id', 'name_ja', 'start', 'end', 'races'] },
};
const RACE_FIELDS = ['card_id', 'start', 'end'];
// One record of a GameTora data file (external JSON: its fields are picked by name).
export type GametoraRecord = Record<string, unknown>;

const SAME_EVENT_DAYS = 45;
// GameTora's events are only filled in before this (where the news archive is thin); later ones only date a news event.
export const FILL_BEFORE = '2022-07-01T00:00:00.000Z';
const HOUR = DAY / 24;
// A cup's schedule from round 1 (ms after its start; the last phase ends with the event).
const CM_SCHEDULE: [key: string, from: number, to: number | null][] = [
  ['round_1', 0, 2 * DAY],
  ['round_2', 2 * DAY, 4 * DAY],
  ['final_registration', 4 * DAY, 4 * DAY + 12 * HOUR],
  ['final_matching', 4 * DAY + 12 * HOUR, 5 * DAY],
  ['final_race', 5 * DAY, null],
];

// GameTora's files → what raw/gametora_events.json keeps.
export function cutEvents(files: Record<string, GametoraRecord[]>): GametoraEventsFile {
  const pick = (obj: GametoraRecord, fields: string[]): GametoraRecord =>
    Object.fromEntries(fields.map((f): [string, unknown] => [f, obj[f] ?? null]));
  // TODO(ts): GameTora's JSON is unchecked here: the fields picked are the raw file's (GametoraEventsFile).
  return Object.fromEntries(
    Object.entries(GAMETORA_EVENT_FILES).map(([kind, { file, fields }]): [string, GametoraRecord[]] => [
      kind,
      files[file].map((e) => {
        const out = pick(e, fields);
        // TODO(ts): the races are GameTora's JSON too (see above).
        if (kind === 'legend_race') out.races = ((e.races ?? []) as GametoraRecord[]).map((r) => pick(r, RACE_FIELDS));
        return out;
      }),
    ])
  ) as GametoraEventsFile;
}

const iso = (ms: number) => new Date(ms).toISOString();
// GameTora ends events on the last second of a minute, the news on the minute itself.
const time = (unix: number) => unix * 1000;
const minute = (unix: number) => Math.floor(unix / 60) * 60_000;

function cardOf(cards: CardsFile, id: string): EventCard {
  const card = cards[id];
  // TODO(ts): a card cards.json lacks (or without a Japanese title or name) gives null here, which EventCard doesn't allow.
  return {
    id: Number(id),
    rarity: card?.rarity ?? null,
    title: card?.title?.jp?.replace(/^\[|\]$/g, '') ?? null,
    name: card?.name?.jp ?? null,
    copies: null,
  } as EventCard;
}

export function cmPhasesFrom(start: number, end: number): Phase[] {
  return CM_SCHEDULE.map(([key, from, to]) => ({
    key,
    start: iso(start + from),
    end: iso(to == null ? end : start + to - 60_000),
  }));
}

// In the news events' key order (scripts/lib/events.js' output()).
const event = ({
  id,
  kind,
  name,
  start,
  end,
  cards = [],
  phases,
}: {
  id: string;
  kind: EventKind;
  name: string | null;
  start: string;
  end: string;
  cards?: EventCard[];
  phases?: Phase[];
}): GameEvent => ({
  id,
  kind,
  name,
  parent: null,
  start,
  end,
  cards,
  items: [],
  titles: [],
  ...(phases ? { phases } : {}),
  news_url: null,
  image: null,
  source: 'gametora',
});

// GameTora's events in the shape of ours (sorted like them: newest first).
export function gametoraEvents(raw: GametoraEventsFile, cards: CardsFile = {}): GameEvent[] {
  const story = (raw.story ?? []).map((e) =>
    event({
      id: `gt-story-${e.id}`,
      kind: 'story',
      name: e.name_ja,
      start: iso(time(e.start_ja)),
      end: iso(minute(e.end_ja)),
      cards: (e.event_support_ids ?? []).map((id) => cardOf(cards, String(id))),
    })
  );
  const cups = (raw.champions_meeting ?? []).map((e) => {
    const [start, end] = [time(e.start), minute(e.end)];
    return event({
      id: `gt-cm-${e.id}`,
      kind: 'champions_meeting',
      name: e.name,
      start: iso(start),
      end: iso(end),
      phases: cmPhasesFrom(start, end),
    });
  });
  const races = (raw.legend_race ?? []).map((e) =>
    event({
      // Newer ones have no id on GameTora yet: their JST start day stands in.
      id: `gt-lr-${e.id ?? new Date(time(e.start) + 9 * HOUR).toISOString().slice(0, 10).replaceAll('-', '')}`,
      kind: 'legend_race',
      name: null,
      start: iso(time(e.start)),
      end: iso(minute(e.end)),
    })
  );
  return [...story, ...cups, ...races].sort((a, b) => b.start.localeCompare(a.start) || b.id.localeCompare(a.id));
}

const endOf = (e: Pick<GameEvent, 'start' | 'end'>) => Date.parse(e.end ?? e.start) || Date.parse(e.start) + DAY;
const overlap = (a: Pick<GameEvent, 'start' | 'end'>, b: Pick<GameEvent, 'start' | 'end'>) =>
  Date.parse(a.start) <= endOf(b) && Date.parse(b.start) <= endOf(a);

// events (data/jp_events.json's, from the news) + GameTora's → events with GameTora's filled in where the news has
// no event of the kind at the time; returns { events, filled, dated } (dated: undated news events given GameTora's
// dates).
export function fillFromGametora(
  events: GameEvent[],
  raw: GametoraEventsFile,
  cards: CardsFile = {}
): { events: GameEvent[]; filled: GameEvent[]; dated: GameEvent[] } {
  const news = events.filter((e) => e.source !== 'gametora');
  const top = news.filter((e) => !e.parent);
  const dated = new Map<string, GameEvent>(); // news event id → its dated copy
  const filled: GameEvent[] = [];
  for (const g of gametoraEvents(raw, cards)) {
    if (top.some((e) => e.kind === g.kind && e.end && overlap(e, g))) continue;
    const announced = top.find(
      (e) =>
        e.kind === g.kind &&
        !e.end &&
        !dated.has(e.id) &&
        norm(e.name ?? '') === norm(g.name ?? '') &&
        Date.parse(e.start) <= Date.parse(g.start) &&
        Date.parse(g.start) - Date.parse(e.start) <= SAME_EVENT_DAYS * DAY
    );
    if (announced) {
      const { start, end, phases, cards: given } = g;
      const out: GameEvent = { ...announced, start, end, cards: announced.cards.length ? announced.cards : given };
      if (phases) out.phases = phases;
      dated.set(announced.id, out);
    } else if (g.start < FILL_BEFORE) filled.push(g);
  }
  const all = [...news.map((e) => dated.get(e.id) ?? e), ...filled].sort(
    (a, b) => b.start.localeCompare(a.start) || b.id.localeCompare(a.id)
  );
  return { events: all, filled, dated: [...dated.values()] };
}

// TODO(ts): JSON.parse gives any; the file is what GametoraEventsFile describes (cutEvents() writes it).
export const readGametoraEvents = (): GametoraEventsFile | null =>
  existsSync(GAMETORA_EVENTS_FILE)
    ? (JSON.parse(readFileSync(GAMETORA_EVENTS_FILE, 'utf8')) as GametoraEventsFile)
    : null;
