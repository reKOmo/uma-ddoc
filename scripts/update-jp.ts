// Usage: pnpm update-jp
// Idempotent: everything made from the news is rebuilt from all posts each time. Appends to data/news/jp/summary.md.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import type { GametoraCard } from '../shared/schemas/gametora.ts';
import { buildEvents, readAnswers, readEvents, writeEvents } from './lib/events.ts';
import { fillFromGametora, readGametoraEvents } from './lib/gametora-events.ts';
import { updateJpBanners } from './lib/jp-banners.ts';
import { loadPosts } from './lib/news-api.ts';
import { ja } from './lib/news-lang/ja.ts';
import { GENERATED_DIR, newsDir } from './lib/paths.ts';
import { readJson } from './lib/global.ts';
import { ensureCards } from './update-cards.ts';
import { GAMETORA_CARDS_FILE, buildCardFiles } from './build-cards.ts';
import { updateJpCards } from './lib/jp-cards.ts';
import { applyJpScenarioNews, readScenarios, writeScenarios } from './lib/scenarios.ts';

const SUMMARY_FILE = `${newsDir('jp')}summary.md`;

export type JpUpdate = {
  cards: ReturnType<typeof updateJpCards>;
  banners: Awaited<ReturnType<typeof updateJpBanners>>;
  events: GameEvent[];
};

export async function updateJp(): Promise<JpUpdate> {
  await ensureCards();
  const posts = [...loadPosts('jp').values()];

  // Rebuilt before the banners and events, so they find the new cards in the same run.
  // TODO(ts): JSON.parse's any: raw/gametora_cards.json is written by scrape-gametora in GametoraCard's shape
  // (test/schemas.test.ts checks it).
  const gametoraCards = existsSync(GAMETORA_CARDS_FILE)
    ? (JSON.parse(readFileSync(GAMETORA_CARDS_FILE, 'utf8')) as GametoraCard[])
    : null;
  const jpCards = updateJpCards({ posts, gametora: gametoraCards });
  await buildCardFiles();
  const cards = readJson<CardsFile>(`${GENERATED_DIR}cards.json`);

  const banners = await updateJpBanners({ posts, cards });

  const old = new Map<string, string>(readEvents('jp').map((e: GameEvent) => [e.id, JSON.stringify(e)]));
  const fromNews = buildEvents(posts, { cards, answers: readAnswers('jp'), lang: ja });
  // Without GameTora's file (never scraped), the fills already in data/ are kept.
  const gametora = readGametoraEvents();
  const kept = readEvents('jp').filter((e: GameEvent) => e.source === 'gametora');
  const fill = gametora
    ? fillFromGametora(fromNews, gametora, cards)
    : { ...fillFromGametora(fromNews, { story: [], champions_meeting: [], legend_race: [] }, cards), filled: kept };
  if (!gametora)
    console.log('no generated/raw/gametora_events.json (pnpm scrape-gametora): GameTora fills kept as they are');
  const events: GameEvent[] = gametora
    ? fill.events
    : [...fill.events, ...kept].sort((a, b) => b.start.localeCompare(a.start) || b.id.localeCompare(a.id));
  writeEvents(events, 'jp');
  const changed = events.filter((e: GameEvent) => old.get(e.id) !== JSON.stringify(e));

  const stored = readScenarios();
  const scenarios = applyJpScenarioNews({ posts, scenarios: stored.scenarios });
  if (stored.scenarios.length) writeScenarios(stored.source, scenarios.scenarios);

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
  ];
  console.log(lines.join('\n'));
  if (existsSync(SUMMARY_FILE))
    appendFileSync(SUMMARY_FILE, `\n## JP record\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
  return { cards: jpCards, banners, events };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateJp().catch((err) => {
    console.error(`JP update failed: ${err.message}`);
    process.exit(1);
  });
}
