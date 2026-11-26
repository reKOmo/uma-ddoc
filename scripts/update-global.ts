// Usage: pnpm update-global [--summary]   (--summary: appends to data/news/gl/summary.md, for the news run)
// Needs JP's banners (their items) and generated/cards.json (English names). Idempotent: the news-made entries are
// rebuilt from every post each time, the seeded ones are left alone.

import { existsSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { BannerFile, BannerItem } from '../shared/schemas/banner.ts';
import type { CardsFile, GlobalCard } from '../shared/schemas/card.ts';
import { type DatedMoment, dated } from '../shared/schemas/common.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import type { KnownDatesFile } from '../shared/schemas/predictions.ts';
import { changedSince, readJson } from './lib/json.ts';
import { CARDS_JSON, DATA_DIR, appendSummary, dataFile, isMain } from './lib/paths.ts';
import { bannerPost } from './lib/banners/posts.ts';
import { loadPosts } from './lib/news/api.ts';
import { scenarioPost } from './lib/news/scenario-posts.ts';
import { minuteText } from './lib/news/text.ts';
import {
  type CardRecords,
  applyNews,
  englishNames,
  writeGlobalBanners,
  writeGlobalCards,
} from './lib/banners/global.ts';
import { applyScenarioNews, fillColors, readScenarios, writeScenarios } from './lib/scenarios.ts';
import { readJpBanners, regularBanners } from './lib/banners/jp.ts';
import { buildEvents } from './lib/events/build.ts';
import { readAnswers, readCmTable, readEvents, writeEvents } from './lib/events/files.ts';
import { readCategories, refreshCategories, unsureLines } from './lib/news/categories.ts';
import { keepEventFills } from './lib/fills.ts';
import { withFreePulls } from './lib/events/free-scouts.ts';
import { buildCardFiles, ensureCards } from './lib/cards/files.ts';

const KNOWN_DATES_FILE = `${DATA_DIR}known_dates.json`;

const day = (iso: string): string => iso.slice(0, 10);
const when = (iso: string): string => `${minuteText(iso)} UTC`;

type Released = GlobalCard & { news_url?: string };

type GlobalUpdate = ReturnType<typeof applyNews> & {
  changed: ReturnType<typeof applyNews>['banners'];
  released: [string, Released][];
  scenarios: ReturnType<typeof applyScenarioNews>;
  events: GameEvent[];
  unconfirmed: KnownDatesFile['banners'];
  summary: string;
};

async function updateGlobal(): Promise<GlobalUpdate> {
  if (!existsSync(dataFile('gl', 'banners')))
    throw new Error('data/ has no Global banners (data/global_banners.json is committed)');
  await ensureCards();
  const global = readJson<BannerFile>(dataFile('gl', 'banners'));
  const cards = readJson<CardRecords>(dataFile('gl', 'cards'));
  const jp = regularBanners(readJpBanners());
  const cardData = readJson<CardsFile>(CARDS_JSON);
  const raw = [...loadPosts().values()];
  const posts = raw.map(scenarioPost);

  const scouts = raw.map((post) => bannerPost(post)).filter((scout) => scout !== null);
  const result = applyNews({ posts: scouts, global, cards, jp, names: englishNames(global, cardData) });
  // A confirmed banner the news has announced is Global's own now: its known_dates.json entry has done its job, but
  // for an end the post doesn't give (kept as a confirmed date from then on).
  const known = readJson<KnownDatesFile>(KNOWN_DATES_FILE);
  const knownById = new Map<number | string, KnownDatesFile['banners'][number]>(known.banners.map((k) => [k.id, k]));
  for (const b of [...result.global.characters, ...result.global.cards]) {
    const k = knownById.get(b.id);
    if (k && b.end?.status !== 'news')
      b.end = { ...dated(new Date(k.end).toISOString(), 'confirmed'), source: k.source };
  }
  // The card releases first: the card data is built from them (the banners are written once their free pulls are in).
  writeGlobalCards(result.cards);
  await buildCardFiles();
  // Rebuilt from the card releases just written: a card whose English title the news gives first is matched in this
  // run's events, not the next one's.
  const builtCards = readJson<CardsFile>(CARDS_JSON);

  const announced = new Set([...result.global.characters, ...result.global.cards].map((b) => Number(b.id)));
  const unconfirmed = known.banners.filter((b) => announced.has(b.id));
  if (unconfirmed.length) {
    known.banners = known.banners.filter((b) => !announced.has(b.id));
    writeFileSync(KNOWN_DATES_FILE, `${JSON.stringify(known, null, 2)}\n`);
  }

  // Scenarios: JP's side comes from scrape-gametora; nothing to apply the news to before it ran.
  const stored = readScenarios();
  const scenarios = applyScenarioNews({ posts, scenarios: stored.scenarios });
  if (stored.scenarios.length) {
    // a new scenario's cover colour (one image; no headers: imageColor's default)
    await fillColors(scenarios.scenarios, undefined);
    writeScenarios(stored.source, scenarios.scenarios);
  }

  // Each post's category and units: the classifiers' (ml/categorize.py) over the rules.
  refreshCategories();
  const categories = readCategories();
  const storedEvents: GameEvent[] = readEvents();
  const storedIds = new Set(storedEvents.map((e) => e.id));
  const events = keepEventFills(
    buildEvents(raw, {
      cmTable: readCmTable(),
      cards: builtCards,
      answers: readAnswers(),
      categories,
      banners: result.global,
    }),
    storedEvents
  );
  writeEvents(events);
  // Each banner's free pulls, from the events' free scout windows.
  writeGlobalBanners(withFreePulls(result.global, events));
  const changedEvents = changedSince(storedEvents, events);

  const before = new Map(
    [...global.characters, ...global.cards]
      .filter((b) => b.start.status === 'news')
      .map((b) => [b.id, `${b.start.date} ${b.end?.date}`])
  );
  const changed = result.banners.filter(
    ({ banner }) => before.get(banner.id) !== `${banner.start.date} ${banner.end?.date}`
  );
  const released = Object.entries(result.cards).filter(
    ([id, c]) => c.news_url && cards[id]?.release_gl.date !== c.release_gl.date
  );

  const lines: string[] = [];
  for (const { banner, kind, unmatched } of changed) {
    const verb = before.has(banner.id) ? 'Moved' : 'Added';
    // TODO(ts): Global's scouts always end (only JP has open-ended ones)
    const end = (banner.end as DatedMoment).date;
    const items = banner.featured.map((i: BannerItem) => `${i.title} ${i.name}`).join(', ');
    lines.push(
      `- ${verb} ${kind === 'cards' ? 'support card' : 'trainee'} banner ${banner.id}: ${when(banner.start.date)} → ${when(end)} — ${items}`
    );
    if (unmatched.length) lines.push(`  - No English name in the post for: ${unmatched.join(', ')}`);
  }
  for (const [id, c] of released)
    lines.push(`- Card ${id} ${c.title_en ?? ''} out on Global ${c.release_gl.date}`.replace('  ', ' '));
  for (const b of unconfirmed)
    lines.push(`- Banner ${b.id} is out of known_dates.json: the news has it (was confirmed by ${b.source})`);
  for (const s of result.skipped) lines.push(`- Skipped banner ${s.id} (${s.post}): ${s.reason}`);
  for (const s of scenarios.changed) {
    const start =
      s.en_start_date && s.en_start_date.status !== 'predicted'
        ? `starts on Global ${when(s.en_start_date.date)} (${s.en_start_date.status})`
        : 'announced, no Global date yet';
    lines.push(`- Scenario ${s.key}: "${s.full_en}" ${start}`);
  }
  for (const e of changedEvents) {
    const cardList = e.cards.map((c) => `[${c.title}] ${c.name}`).join(', ');
    const extra = [cardList && `cards: ${cardList}`, e.titles.length && `titles: ${e.titles.join(', ')}`]
      .filter(Boolean)
      .join('; ');
    lines.push(
      `- ${storedIds.has(e.id) ? 'Updated' : 'Added'} ${e.kind} event "${e.name ?? e.kind}" (${day(e.start.date)})${extra ? ` — ${extra}` : ''}`
    );
  }
  for (const name of scenarios.unmatched) lines.push(`- Scenario "${name}" doesn't match any JP scenario`);
  const titles = new Map(raw.map((p) => [p.announce_id, p.title]));
  for (const line of unsureLines(categories, 'gl', titles)) lines.push(`- ${line}`);

  const summary = lines.length ? `## Global repository (data/)\n\n${lines.join('\n')}\n` : '';
  return { ...result, changed, released, scenarios, events: changedEvents, unconfirmed, summary };
}

if (isMain(import.meta.url)) {
  try {
    // strict: false: the news run's flags pass through pnpm.
    const { values } = parseArgs({ options: { summary: { type: 'boolean' } }, strict: false });
    const { changed, released, skipped, events, summary } = await updateGlobal();
    if (summary) {
      console.log(summary);
      appendSummary('gl', `\n${summary}`, { toFile: values.summary === true, toJob: true });
    }
    console.log(
      `Global: ${changed.length} banners added or moved, ${released.length} card releases, ${events.length} events added or changed, ${skipped.length} skipped (${day(new Date().toISOString())}).`
    );
  } catch (err) {
    console.error(`Global update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
