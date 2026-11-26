// Usage: pnpm news:events   (prints the events the stored news makes, writes nothing)

import type { CardsFile } from '../shared/schemas/card.ts';
import type { EventItem } from '../shared/schemas/event.ts';
import { readJson } from './lib/json.ts';
import { CARDS_JSON } from './lib/paths.ts';
import { loadPosts } from './lib/news/api.ts';
import { buildEvents } from './lib/events/build.ts';
import { readAnswers, readCmTable } from './lib/events/files.ts';

const cards = readJson<CardsFile>(CARDS_JSON, {});
const events = buildEvents([...loadPosts().values()], {
  cmTable: readCmTable(),
  cards,
  answers: readAnswers(),
});

const day = (iso: string | null): string => (iso ? iso.slice(0, 16).replace('T', ' ') : '…');
const count = (c: EventItem['count']): string =>
  c == null ? '?' : typeof c === 'number' ? c.toLocaleString('en') : `${c.min}–${c.max}`;
for (const e of events) {
  const head = `${day(e.start.date)} → ${day(e.end?.date ?? null)}  ${e.kind.padEnd(17)} ${e.parent ? '  ' : ''}${e.name ?? '—'}  [${e.id}]`;
  console.log(head);
  for (const c of e.cards)
    console.log(`      CARD ${c.rarity} [${c.title}] ${c.name} (${c.id ?? 'no id'})${c.copies ? ` ×${c.copies}` : ''}`);
  if (e.items.length) console.log(`      items: ${e.items.map((i) => `${i.name} ${count(i.count)}`).join(', ')}`);
  if (e.titles.length) console.log(`      titles: ${e.titles.join(', ')}`);
}
console.log(`\n${events.length} events`);
