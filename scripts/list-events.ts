// Prints the events the stored news makes (scripts/lib/events.js), newest first, without writing anything: dates,
// kind, name, then cards (the main thing), items and titles. For checking the parser. No requests.
//
// Usage: pnpm news:events

import { existsSync, readFileSync } from 'node:fs';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { EventItem } from '../shared/schemas/event.ts';
import { GENERATED_DIR } from './lib/paths.ts';
import { loadPosts } from './lib/news-api.ts';
import { buildEvents, readAnswers, readCmTable } from './lib/events.ts';

const cardsFile = `${GENERATED_DIR}cards.json`;
// TODO(ts): JSON.parse's any: cards.json is written by build-cards in CardsFile's shape
// (test/schemas.test.ts checks it).
const cards = existsSync(cardsFile) ? (JSON.parse(readFileSync(cardsFile, 'utf8')) as CardsFile) : {};
const events = buildEvents([...loadPosts().values()], {
  cmTable: readCmTable(),
  cards,
  answers: readAnswers(),
});

const day = (iso: string | null): string => (iso ? iso.slice(0, 16).replace('T', ' ') : '…');
const count = (c: EventItem['count']): string =>
  c == null ? '?' : typeof c === 'number' ? c.toLocaleString('en') : `${c.min}–${c.max}`;
for (const e of events) {
  const head = `${day(e.start)} → ${day(e.end)}  ${e.kind.padEnd(17)} ${e.parent ? '  ' : ''}${e.name ?? '—'}  [${e.id}]`;
  console.log(head);
  for (const c of e.cards)
    console.log(`      CARD ${c.rarity} [${c.title}] ${c.name} (${c.id ?? 'no id'})${c.copies ? ` ×${c.copies}` : ''}`);
  if (e.items.length) console.log(`      items: ${e.items.map((i) => `${i.name} ${count(i.count)}`).join(', ')}`);
  if (e.titles.length) console.log(`      titles: ${e.titles.join(', ')}`);
}
console.log(`\n${events.length} events`);
