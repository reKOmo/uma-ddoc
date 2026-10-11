// What an event gives, from the lines of its news post (scripts/lib/event-blocks.js). Pure.
//
// Support cards come first: what the site is for is telling whether an event gives a card. The rest (carats, monies,
// shards, consumables…) are kept as the post names them, with their amounts.
//
//   cardsIn(lines, index)   [{ id, rarity, title, name, copies }]: every "[Title] Name" that is one of our support
//                           cards (`index`: cardIndex(generated/cards.json)), however the post words it ("Event-Exclusive
//                           SSR Support Card: [Title] Name", "gifted with the SSR Support Card "[Title] Name"", a bare
//                           "[Title] Name" under Gift Contents); copies from "a total of five copies" / "up to two
//                           times" in the same line or the next, else null. Trainee outfits never match (not cards).
//   itemsIn(lines)          [{ name, count }]: "Item × N" lines, summed per item ("Login Days 8-12: Support Pt × 1000"
//                           counts five times; "10:00 p.m., Oct 7 (UTC) – Carrot Jelly Mini × 3" rows add up), prose
//                           gifts ("a gift of 3,000 carats"), and items named without an amount (count null: "Main
//                           Rewards: • Carats", "rewards like carats and Rainbow Crystal Shards").
//   titlesIn(lines)         player titles: "Event-Exclusive Title: X", or the bullets under "Event-Exclusive Titles".
//   missionsIn(lines, year) limited-time mission sets: a line "X Missions" followed by its period.

import { norm, parsePeriod } from './news-text.js';

export { norm };

export const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const number = (s) => NUMBERS[s.toLowerCase()] ?? Number(s.replace(/,/g, ''));
export const numberWord = (n) => Object.keys(NUMBERS).find((word) => NUMBERS[word] === n);

// Same item, other spelling → the name we show (keyed without a trailing "gift(s)": "150-carat gifts" are Carats).
const ALIASES = {
  carat: 'Carats',
  carats: 'Carats',
  monies: 'Monies',
  supportpt: 'Support Points',
  supportpoints: 'Support Points',
  friendpt: 'Friend Points',
};

// An item's name as we show it, from the rules' lines or a model's answer: no leading amount ("300 carats",
// "150-carat gifts"; not the "1.5" of "1.5-Year…"), the usual spelling of an alias, capitalised; null for what isn't
// an item name.
export function itemName(raw) {
  const name = raw.trim().replace(/^\d[\d,]*(?=[\s-])[\s-]+/, '');
  if (!/[a-z]/i.test(name) || name.length > 60) return null;
  return ALIASES[norm(name).replace(/gifts?$/, '')] ?? name.replace(/^./, (c) => c.toUpperCase());
}

// Prices, fees and purchases aren't rewards (a sale's "Paid Carats × 1,500", a "30 carats" entry fee).
const NOT_REWARD = /\b(?:fees?|costs?|prices?|purchases?|discount(?:ed)?|paid|limited supply|times only)\b/i;

// title (normalised) → our cards with that English title.
export function cardIndex(cards) {
  const index = new Map();
  for (const [id, card] of Object.entries(cards)) {
    const title = card.title?.en?.replace(/^\[|\]$/g, '');
    if (!title || !card.name?.en) continue;
    const key = norm(title);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ id: Number(id), rarity: card.rarity ?? null, title, name: card.name.en });
  }
  return index;
}

// Lines that talk about cards that only boost an event (story events' bonus cards, rankings), not ones it gives.
const NOT_GIVEN = /bonus card|event bonus|boost|most frequently|ranking|perk|unique|issue/i;
const COPIES = /(?:a total of|up to)\s+(\w+)\s+(?:copies|copy)|(?:obtained|received)\s+up to\s+(\w+)\s+times/i;

export function cardsIn(lines, index) {
  const found = new Map();
  lines.forEach((line, i) => {
    if (NOT_GIVEN.test(line)) return;
    for (const m of line.matchAll(/\[([^\]]+)\]\s*([^\],.!?"”()]+)/g)) {
      const candidates = index.get(norm(m[1])) ?? [];
      const card = candidates.find((c) => norm(m[2]).startsWith(norm(c.name))) ?? null;
      if (!card) continue;
      const copies = (line.match(COPIES) ?? lines[i + 1]?.match(COPIES))?.slice(1).find(Boolean);
      const old = found.get(card.id);
      found.set(card.id, { ...card, copies: copies ? number(copies) : (old?.copies ?? null) });
    }
  });
  return [...found.values()];
}

const LOGIN = /^login days?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*:\s*/i;
// "10:00 p.m., Oct 7, 2026 (UTC) – Item × 3" or, without "(UTC)", "10:00 p.m., Nov 25 – Item × 3"
const DATED =
  /^.*?(?:\(UTC\)|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?)\s*[–-]\s*/i;
const ITEM = /^(?:[•・■*-]\s*)?(.+?)\s*[×x]\s*([\d,]+)\s*$/;
// Rewards worth naming even when the post gives no amount.
const MENTIONED = [
  ['Carats', /\bcarats\b/i],
  ['Monies', /\bmonies\b/i],
  ['Support Points', /\bsupport points?\b/i],
  ['Rainbow Crystal Shards', /rainbow crystal shards?/i],
  ['Support Card Scout Tickets', /support card scout tickets?/i],
  ['Trainee Scout Tickets', /trainee scout tickets?/i],
  // A voucher lets you pick a card (or trainee): named as the post names it ("1.5-Year Anniversary SSR Voucher").
  [null, /(?:[A-Z0-9][\w.-]* ){0,4}SSR (?:Support Card )?Vouchers?/],
];

export function itemsIn(lines) {
  const counts = new Map();
  const add = (name, count) => {
    const shown = itemName(name);
    if (!shown || NOT_REWARD.test(shown)) return;
    const key = norm(shown);
    const old = counts.get(key);
    if (count == null) {
      if (!old) counts.set(key, { name: shown, count: null });
    } else counts.set(key, { name: shown, count: (old?.count ?? 0) + count });
  };
  const prose = []; // amounts from sentences: only when the block's lists don't give that item
  let mainRewards = false;
  for (const raw of lines) {
    let line = raw;
    let times = 1;
    const login = line.match(LOGIN);
    if (login) {
      times = login[2] ? Number(login[2]) - Number(login[1]) + 1 : 1;
      line = line.slice(login[0].length);
    }
    line = line.replace(DATED, '');
    const item = line.match(ITEM);
    if (item && !/[.!?]$/.test(item[1])) {
      add(item[1].replace(/^[•・■*-]\s*/, ''), number(item[2]) * times);
      continue;
    }
    // "we've sent a gift of 3,000 carats", "you can obtain 500 carats as a holiday gift" (not entry fees or prices);
    // "a gift of 564 carats, up to a total maximum of 5,640!" counts the total
    const gift = line.match(/up to a total (?:maximum )?of (\d[\d,]*)/i) ?? line.match(/\b(\d[\d,]*)\s+carats\b/i);
    if (gift && /carat/i.test(line) && /gift|sent|receive|obtain|earn/i.test(line) && !NOT_REWARD.test(line)) {
      prose.push(number(gift[1]));
      continue;
    }
    // "Main Rewards" bullets name rewards without amounts; so do "rewards like/including …" sentences.
    if (/^main rewards$/i.test(line)) mainRewards = true;
    else if (mainRewards && /^[•・]\s*/.test(line)) add(line.replace(/^[•・]\s*/, ''), null);
    else mainRewards = false;
    if (/rewards?,? (?:like|including|such as)/i.test(line))
      for (const [name, re] of MENTIONED) {
        const m = line.match(re);
        if (m) add(name ?? m[0].replace(/s$/, ''), null);
      }
  }
  if (prose.length && !(counts.get('carats')?.count > 0)) add('Carats', Math.max(...prose));
  return [...counts.values()];
}

export function titlesIn(lines) {
  const titles = [];
  let list = false;
  for (const line of lines) {
    const one = line.match(/Event-Exclusive Title:\s*(.+)$/i);
    if (one) titles.push(one[1].trim());
    else if (/Event-Exclusive Titles$/i.test(line)) list = true;
    else if (list && /^[•・]\s*/.test(line)) titles.push(line.replace(/^[•・]\s*/, '').trim());
    else if (list) list = false;
  }
  return [...new Set(titles)];
}

export function missionsIn(lines, year) {
  const sets = [];
  lines.forEach((line, i) => {
    const name = line.replace(/^[•・■]\s*/, '');
    if (!/Missions$/.test(name) || name.split(' ').length > 8) return;
    const { start, end } = parsePeriod(lines[i + 1] ?? '', year);
    if (start) sets.push({ name, start, end });
  });
  return sets;
}

// --- doubts: where the rules may have read a reward wrong (scripts/lib/events.js asks a model about these) ----------

// "150-carat gifts", "500 carats", "50,000 Monies" in a sentence (not an "Item × N" list line).
const AMOUNT =
  /(\d[\d,]*)[\s-]+(carats?|monies|support (?:points?|pt)|friend (?:points?|pt)|(?:rainbow |gold )?crystal shards?|scout tickets?|star pieces?)\b/i;
const PER = /\b(?:each|every|per)\s+(?:day|login|period|availability period|week)\b|\bseries of\b|\bdaily\b/i;
const listLine = (line) => ITEM.test(line.replace(LOGIN, '').replace(DATED, ''));

// Why the items the rules read from `lines` may be wrong, or null: an amount in a sentence they didn't read, or one
// given per day / per window (the total is then a multiple).
export function itemDoubt(lines, items) {
  for (const line of lines) {
    if (listLine(line) || NOT_REWARD.test(line)) continue;
    const m = line.match(AMOUNT);
    if (!m) continue;
    const word = norm(m[2]).replace(/s$/, '').slice(0, 6);
    const item = items.find((i) => norm(i.name).startsWith(word));
    if (!item || item.count == null) return `an amount in a sentence the rules didn't read: "${line}"`;
    if (PER.test(line)) return `an amount that may be per day or per window: "${line}"`;
  }
  return null;
}

// Why the card copies the rules read may be wrong, or null: a card without a count where the text talks of copies or
// times, or a card given in several amounts.
export function copiesDoubt(lines, cards) {
  if (!cards.length) return null;
  const counted = lines.filter((line) => COPIES.test(line)).length;
  // "up to two times in the Login Bonus, and up to three times in the Missions, for a maximum of five times"
  const several = lines.some((line) => (line.match(/\b\w+\s+(?:copies|times)\b/gi) ?? []).length > 1);
  if (counted > 1 || several) return 'the text gives copies in several places';
  if (cards.some((c) => c.copies == null) && lines.some((line) => /\bcop(?:y|ies)\b|\b\w+ times\b/i.test(line)))
    return "the text talks about copies the rules didn't read";
  return null;
}
