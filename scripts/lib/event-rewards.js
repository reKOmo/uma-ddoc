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

import { en } from './news-lang/en.js';
import { norm } from './news-text.js';

export { norm };

// Every reader below takes `lang`, the posts' wording (scripts/lib/news-lang/), English by default.

export const NUMBERS = en.numbers;
const number = (s, lang = en) => lang.numbers[s.toLowerCase()] ?? Number(s.replace(/,/g, ''));
export const numberWord = (n) => Object.keys(NUMBERS).find((word) => NUMBERS[word] === n);

// An item's name as we show it, from the rules' lines or a model's answer: no leading amount, the usual spelling of an
// alias (lang.aliases), capitalised; null for what isn't an item name.
export function itemName(raw, lang = en) {
  const name = raw.trim().replace(lang.itemAmountPrefix, '');
  if (!lang.itemNameChar.test(name) || name.length > 60) return null;
  return lang.aliases[lang.aliasKey(norm(name))] ?? lang.showItem(name);
}

// title (normalised) → our cards with that title (in the posts' language: cards.json's title / name `lang.cardLang`).
export function cardIndex(cards, lang = en) {
  const index = new Map();
  for (const [id, card] of Object.entries(cards)) {
    const title = card.title?.[lang.cardLang]?.replace(/^\[|\]$/g, '');
    const name = card.name?.[lang.cardLang];
    if (!title || !name) continue;
    const key = norm(title);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ id: Number(id), rarity: card.rarity ?? null, title, name });
  }
  return index;
}

// The one card whose title starts with a mention's (cut short) title, with the mention's name, or null.
function byPrefix(index, [, title, name]) {
  const key = norm(title);
  if (key.length < 4) return null;
  const found = [...index]
    .filter(([t]) => t.startsWith(key))
    .flatMap(([, cards]) => cards.filter((c) => norm(name).startsWith(norm(c.name))));
  return found.length === 1 ? found[0] : null;
}

export function cardsIn(lines, index, lang = en) {
  const found = new Map();
  let list = false; // (JP: in a list of cards not given, `lang.notGivenList`)
  lines.forEach((line, i) => {
    if (lang.notGivenList) {
      if (lang.notGivenList.test(line)) list = true;
      else if (!(list && lang.bullet.test(line))) list = false;
      if (list) return;
    }
    if (lang.notGiven.test(line)) return;
    for (const m of line.matchAll(lang.cardMention)) {
      const candidates = index.get(norm(m[1])) ?? [];
      // (JP posts sometimes cut a title short: "[掲げよ、燃え盛る灯]" for "[掲げよ、燃え盛る灯を]".)
      const card =
        candidates.find((c) => norm(m[2]).startsWith(norm(c.name))) ?? (lang.titlePrefix ? byPrefix(index, m) : null);
      if (!card) continue;
      const copies = (line.match(lang.copies) ?? lines[i + 1]?.match(lang.copies))?.slice(1).find(Boolean);
      const old = found.get(card.id);
      found.set(card.id, { ...card, copies: copies ? number(copies, lang) : (old?.copies ?? null) });
    }
  });
  return [...found.values()];
}

export function itemsIn(lines, lang = en) {
  const counts = new Map();
  const add = (name, count) => {
    const shown = itemName(name, lang);
    if (!shown || lang.notReward.test(shown)) return;
    const key = norm(shown);
    const old = counts.get(key);
    // (JP: an item Global has too goes by Global's name, its Japanese one kept as `local`.)
    const local = lang.localName?.(name, shown);
    const item = (n) => (local ? { name: shown, count: n, local } : { name: shown, count: n });
    if (count == null) {
      if (!old) counts.set(key, item(null));
    } else counts.set(key, item((old?.count ?? 0) + count));
  };
  const prose = []; // amounts from sentences: only when the block's lists don't give that item
  let mainRewards = false;
  for (const raw of lang.splitItems ? lines.flatMap(lang.splitItems) : lines) {
    let line = raw;
    let times = 1;
    const login = line.match(lang.login);
    if (login) {
      times = login[2] ? Number(login[2]) - Number(login[1]) + 1 : 1;
      line = line.slice(login[0].length);
    }
    line = line.replace(lang.dated, '');
    const item = line.match(lang.item);
    if (item && !lang.sentenceEnd.test(item[1])) {
      add(item[1].replace(lang.itemBullet, ''), number(item[2], lang) * times);
      continue;
    }
    // An amount in a sentence (lang.proseTotal / proseAmount: a gift of carats, not a fee or price)
    const gift = line.match(lang.proseTotal) ?? line.match(lang.proseAmount);
    if (gift && lang.proseItem.test(line) && lang.proseGift.test(line) && !lang.notReward.test(line)) {
      prose.push(number(gift[1], lang));
      continue;
    }
    // "Main Rewards" bullets name rewards without amounts; so do "rewards like/including …" sentences.
    if (lang.mainRewards.test(line)) mainRewards = true;
    else if (mainRewards && lang.bullet.test(line)) add(line.replace(lang.bullet, ''), null);
    else mainRewards = false;
    if (lang.rewardsLike.test(line))
      for (const [name, re] of lang.mentioned) {
        const m = line.match(re);
        if (m) add(name ?? lang.mentionedName(m[0]), null);
      }
  }
  if (prose.length && !(counts.get(norm(itemName(lang.proseName, lang)))?.count > 0))
    add(lang.proseName, Math.max(...prose));
  return [...counts.values()];
}

export function titlesIn(lines, lang = en) {
  const titles = [];
  let list = false;
  for (const line of lines) {
    const one = line.match(lang.title);
    if (one) titles.push(one[1].trim());
    else if (lang.titleList.test(line)) list = true;
    else if (list && lang.bullet.test(line)) titles.push(line.replace(lang.bullet, '').trim());
    else if (list) list = false;
  }
  return [...new Set(lang.notTitle ? titles.filter((t) => !lang.notTitle.test(t)) : titles)];
}

export function missionsIn(lines, year, lang = en) {
  const sets = [];
  lines.forEach((line, i) => {
    const name = line.replace(lang.missionBullet, '');
    if (!lang.missionSet(name)) return;
    const { start, end } = lang.parsePeriod(lines[i + 1] ?? '', year);
    if (start) sets.push({ name, start, end });
  });
  return sets;
}

// --- doubts: where the rules may have read a reward wrong (scripts/lib/events.js asks a model about these) ----------

const listLine = (line, lang) => lang.item.test(line.replace(lang.login, '').replace(lang.dated, ''));

// Why the items the rules read from `lines` may be wrong, or null: an amount in a sentence they didn't read, or one
// given per day / per window (the total is then a multiple).
export function itemDoubt(lines, items, lang = en) {
  for (const line of lines) {
    if (listLine(line, lang) || lang.notReward.test(line)) continue;
    const m = line.match(lang.amount);
    if (!m) continue;
    const word = lang.amountWord(norm(m[2]));
    const item = items.find((i) => norm(i.name).startsWith(word));
    if (!item || item.count == null) return `an amount in a sentence the rules didn't read: "${line}"`;
    if (lang.per.test(line)) return `an amount that may be per day or per window: "${line}"`;
  }
  return null;
}

// Why the card copies the rules read may be wrong, or null: a card without a count where the text talks of copies or
// times, or a card given in several amounts.
export function copiesDoubt(lines, cards, lang = en) {
  if (!cards.length) return null;
  const counted = lines.filter((line) => lang.copies.test(line)).length;
  const several = lines.some((line) => (line.match(lang.copiesCount) ?? []).length > 1);
  if (counted > 1 || several) return 'the text gives copies in several places';
  if (cards.some((c) => c.copies == null) && lines.some((line) => lang.copiesTalk.test(line)))
    return "the text talks about copies the rules didn't read";
  return null;
}
