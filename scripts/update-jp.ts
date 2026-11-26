// Usage: pnpm update-jp [--summary]   (--summary: appends to data/news/jp/summary.md, for the news run)
// Idempotent: everything made from the news is rebuilt from all posts each time.

import { parseArgs } from 'node:util';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import type { GametoraCard } from '../shared/schemas/gametora.ts';
import { readCategories, refreshCategories, unsureLines } from './lib/news/categories.ts';
import { buildEvents } from './lib/events/build.ts';
import { readAnswers, readEvents, writeEvents } from './lib/events/files.ts';
import { fillFromGametora, readGametoraEvents } from './lib/events/gametora.ts';
import { updateJpBanners, writeJpBanners } from './lib/banners/jp.ts';
import { bannerPost } from './lib/banners/posts.ts';
import { withFreePulls } from './lib/events/free-scouts.ts';
import { loadPosts } from './lib/news/api.ts';
import { jp as jpLexicon } from './lib/news/lang/jp.ts';
import { CARDS_JSON, appendSummary, isMain } from './lib/paths.ts';
import { changedSince, readJson } from './lib/json.ts';
import { newestEventsFirst } from './lib/order.ts';
import { GAMETORA_CARDS_FILE, buildCardFiles, ensureCards } from './lib/cards/files.ts';
import { updateJpCards } from './lib/cards/jp.ts';
import { applyJpScenarioNews, readScenarios, writeScenarios } from './lib/scenarios.ts';

async function updateJp(summary: boolean): Promise<void> {
  await ensureCards();
  const posts = [...loadPosts('jp').values()];
  // Each post's scout banners, read once for the cards and the banners.
  const scouts = posts.map((post) => bannerPost(post, jpLexicon));

  // Rebuilt before the banners and events, so they find the new cards in the same run.
  // raw/gametora_cards.json is written by scrape-gametora in GametoraCard's shape (test/schemas.test.ts checks it).
  const gametoraCards = readJson<GametoraCard[] | null>(GAMETORA_CARDS_FILE, null);
  const jpCards = updateJpCards({ posts, scouts, gametora: gametoraCards });
  await buildCardFiles();
  const cards = readJson<CardsFile>(CARDS_JSON);

  const banners = updateJpBanners({ scouts: scouts.filter((scout) => scout !== null), cards });

  const stored = readEvents('jp');
  // Each post's category and units: JP's classifiers' (ml/categorize.py --server jp) over the rules.
  refreshCategories('jp');
  const categories = readCategories('jp');
  const fromNews = buildEvents(posts, {
    cards,
    answers: readAnswers('jp'),
    lang: jpLexicon,
    categories,
    banners: banners.jp,
  });
  // Without GameTora's file (never scraped), the fills already in data/ are kept.
  const gametora = readGametoraEvents();
  const kept = stored.filter((e: GameEvent) => e.source === 'gametora');
  if (!gametora)
    console.log('no generated/raw/gametora_events.json (pnpm scrape-gametora): GameTora fills kept as they are');
  const fill = gametora
    ? fillFromGametora(fromNews, gametora, cards)
    : { events: [...fromNews, ...kept].sort(newestEventsFirst), filled: kept, dated: [] };
  const { events } = fill;
  writeEvents(events, 'jp');
  // Each banner's free pulls, from the events' free scout windows.
  writeJpBanners(withFreePulls(banners.jp, events));
  const changed = changedSince(stored, events);

  const storedScenarios = readScenarios();
  const scenarios = applyJpScenarioNews({ posts, scenarios: storedScenarios.scenarios });
  if (storedScenarios.scenarios.length) writeScenarios(storedScenarios.source, scenarios.scenarios);

  const count = (list: GameEvent[]): string =>
    Object.entries(Object.groupBy(list, (e) => e.kind))
      .map(([kind, l = []]) => `${l.length} ${kind}`)
      .join(', ') || 'none';
  const lines = [
    ...jpCards.lines,
    ...banners.lines,
    `JP events: ${events.length}, ${changed.length} added or changed.`,
    `From GameTora where the news has none: ${count(fill.filled)}; dated by GameTora: ${count(fill.dated)}.`,
    ...(scenarios.unmatched.length
      ? [`Scenario launch posts matching no scenario: ${scenarios.unmatched.join(', ')}.`]
      : []),
    ...unsureLines(categories, 'jp'),
  ];
  console.log(lines.join('\n'));
  appendSummary('jp', `\n## JP record\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`, { toFile: summary });
}

if (isMain(import.meta.url)) {
  // strict: false: the news run's flags pass through pnpm.
  const { values } = parseArgs({ options: { summary: { type: 'boolean' } }, strict: false });
  updateJp(values.summary === true).catch((err) => {
    console.error(`JP update failed: ${err.message}`);
    process.exit(1);
  });
}
