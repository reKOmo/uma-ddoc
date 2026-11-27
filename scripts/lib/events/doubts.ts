// The fragment type and what building one takes from its lines: its rewards, its doubts, its key for a stored model answer.

import type { DateRef, Lexicon } from '../news/lang/index.ts';
import type { EventCard, EventItem, Race } from '../../../shared/schemas/event.ts';
import type { PostPhase } from './dates.ts';
import { type cardIndex, cardsIn, copiesDoubt, itemDoubt, itemsIn, missionsIn, titlesIn } from './rewards.ts';
import { nameDoubt } from '../ai/questions.ts';
import { type ScoutWindow, scoutWindows } from './freeScouts.ts';

// One event as one post describes it, before posts about the same event are merged (`GameEvent` plus what merging and
// the model's questions need; `output()` keeps only the schema's fields).
export type Fragment = {
  id: string;
  kind: string;
  name: string | null;
  parent: string | null;
  start: string | null;
  end: string | null;
  cards: EventCard[];
  items: EventItem[];
  titles: string[];
  phases?: PostPhase[];
  races?: Race[];
  news_url: string;
  image: string | null;
  source: 'news';
  posted: string;
  phase: string | null;
  // Announced without dates: joins the event when its dated post comes.
  undated?: boolean;
  // What the rules aren't sure of, { field: why }; the event's text and its key for a stored model answer.
  doubts: Record<string, string>;
  text: string;
  aiKey: string;
  // Lines elsewhere in the post about its cards.
  context?: string[];
  // Mission sets it lists (taken out into bars of their own by missionBars()).
  missions?: { name: string; start: string; end: string | null }[];
  // A daily free scout campaign's windows (freeScouts.ts).
  scouts?: ScoutWindow[];
};

// FNV-1a: an event's text in a short key, so a stored answer is reused until the post changes.
const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return h.toString(36);
};
export const aiKey = (id: string, text: string): string => `${id}:${hash(text)}`;

// What the rules aren't sure of in an event, { field: why }: the fields a model is asked about (its answers fill them in
// at build time, applyAnswer()). Fields: items, cards (copies), name, kind, dates.
export function withDoubts(
  event: Omit<Fragment, 'doubts' | 'text' | 'aiKey'>,
  lines: string[],
  lang: Lexicon,
  more: Record<string, string | null | false> = {}
): Fragment {
  const found = {
    items: itemDoubt(lines, event.items, lang),
    cards: copiesDoubt(lines, event.cards, lang),
    ...more,
    name: more.name || nameDoubt(event.name, lang),
  };
  const doubts = Object.fromEntries(Object.entries(found).filter((entry): entry is [string, string] => !!entry[1]));
  const text = lines.join('\n');
  return { ...event, doubts, text, aiKey: aiKey(event.id, text) };
}

// What an event's lines give (`fields`, spread into the event) and what is doubtful about its free scout windows.
export function rewards(lines: string[], index: ReturnType<typeof cardIndex>, year: DateRef, lang: Lexicon) {
  const free = scoutWindows(lines, year, lang);
  return {
    fields: {
      cards: cardsIn(lines, index, lang),
      items: itemsIn(lines, lang),
      titles: titlesIn(lines, lang),
      missions: missionsIn(lines, year, lang),
      ...(free && { scouts: free.scouts }),
    },
    scoutsDoubt: free?.doubt ?? null,
  };
}
