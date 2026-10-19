// Usage: pnpm update-global
// Needs JP's banners (their items) and generated/cards.json (English names). Idempotent: the news-made entries are
// rebuilt from every post each time, the seeded ones are left alone.

import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { BannerFile, BannerItem } from '../shared/schemas/banner.ts';
import type { CardsFile, GlobalCard } from '../shared/schemas/card.ts';
import { type DatedMoment, dated } from '../shared/schemas/common.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import type { KnownDatesFile } from '../shared/schemas/predictions.ts';
import { DATA_DIR, GENERATED_DIR, newsDir } from './lib/paths.ts';
import { bannerPost } from './lib/banner-posts.ts';
import { loadPosts } from './lib/news-api.ts';
import { scenarioPost } from './lib/news.ts';
import {
  BANNERS_FILE,
  CARDS_FILE,
  type CardRecords,
  applyNews,
  englishNames,
  readJson,
  writeGlobal,
} from './lib/global.ts';
import { applyScenarioNews, fillColors, readScenarios, writeScenarios } from './lib/scenarios.ts';
import { readJpBanners, regularBanners } from './lib/jp-banners.ts';
import { buildEvents, readAnswers, readCmTable, readEvents, writeEvents } from './lib/events.ts';
import { keepEventFills } from './lib/dates.ts';
import { ensureCards } from './update-cards.ts';
import { buildCardFiles } from './build-cards.ts';

const SUMMARY_FILE = `${newsDir('gl')}summary.md`;
const KNOWN_DATES_FILE = `${DATA_DIR}known_dates.json`;

const day = (iso: string): string => iso.slice(0, 10);
const when = (iso: string): string => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

type Released = GlobalCard & { news_url?: string };

export type GlobalUpdate = ReturnType<typeof applyNews> & {
  changed: ReturnType<typeof applyNews>['banners'];
  released: [string, Released][];
  scenarios: ReturnType<typeof applyScenarioNews>;
  events: GameEvent[];
  unconfirmed: KnownDatesFile['banners'];
  summary: string;
};

export async function updateGlobal(): Promise<GlobalUpdate> {
  if (!existsSync(BANNERS_FILE)) throw new Error('data/ has no Global banners (data/global_banners.json is committed)');
  await ensureCards();
  const global = readJson<BannerFile>(BANNERS_FILE);
  const cards = readJson<CardRecords>(CARDS_FILE);
  const jp = regularBanners(readJpBanners());
  const cardData = readJson<CardsFile>(`${GENERATED_DIR}cards.json`);
  const raw = [...loadPosts().values()];
  const posts = raw.map(scenarioPost);

  const scouts = raw.map((post) => bannerPost(post)).filter((scout) => scout !== null);
  const result = applyNews({ posts: scouts, global, cards, jp, names: englishNames(global, cardData) });
  // A confirmed banner the news has announced is Global's own now: its known_dates.json entry has done its job, but
  // for an end the post doesn't give (kept as a confirmed date from then on).
  const known = readJson<KnownDatesFile>(KNOWN_DATES_FILE);
  for (const b of [...result.global.characters, ...result.global.cards]) {
    const k = known.banners.find((x) => x.id === b.id);
    if (k && b.end?.status !== 'news')
      b.end = { ...dated(new Date(k.end).toISOString(), 'confirmed'), source: k.source };
  }
  writeGlobal(result);
  await buildCardFiles();

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

  const storedEvents: GameEvent[] = readEvents();
  const oldEvents = new Map(storedEvents.map((e) => [e.id, JSON.stringify(e)]));
  const events = keepEventFills(
    buildEvents(raw, { cmTable: readCmTable(), cards: cardData, answers: readAnswers() }),
    storedEvents
  );
  writeEvents(events);
  const changedEvents = events.filter((e) => oldEvents.get(e.id) !== JSON.stringify(e));

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
      `- ${oldEvents.has(e.id) ? 'Updated' : 'Added'} ${e.kind} event "${e.name ?? e.kind}" (${day(e.start.date)})${extra ? ` — ${extra}` : ''}`
    );
  }
  for (const name of scenarios.unmatched) lines.push(`- Scenario "${name}" doesn't match any JP scenario`);

  const summary = lines.length ? `## Global repository (data/)\n\n${lines.join('\n')}\n` : '';
  return { ...result, changed, released, scenarios, events: changedEvents, unconfirmed, summary };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { changed, released, skipped, events, summary } = await updateGlobal();
    if (summary) {
      console.log(summary);
      if (existsSync(SUMMARY_FILE)) appendFileSync(SUMMARY_FILE, `\n${summary}`);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summary}`);
    }
    console.log(
      `Global: ${changed.length} banners added or moved, ${released.length} card releases, ${events.length} events added or changed, ${skipped.length} skipped (${day(new Date().toISOString())}).`
    );
  } catch (err) {
    console.error(`Global update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
