// Usage: pnpm news:events [--server jp]   (prints the events the stored news makes, writes nothing)

import type { EventItem } from '../shared/schemas/event.ts';
import { serverArg } from './lib/news/api.ts';
import { minuteText } from './lib/news/text.ts';
import { newsContext } from './lib/events/context.ts';

const events = newsContext(serverArg()).events();

const day = (iso: string | null): string => (iso ? minuteText(iso) : '…');
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
