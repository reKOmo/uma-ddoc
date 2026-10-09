// Brings Global's own banner + card release record (data/, see scripts/lib/global.js) up to date
// with the official news (data/news/announcements.json, from `pnpm fetch-news`): every scout post's
// banners become Global banners, their cards Global releases, and the Career scenario launches the
// posts name go into data/scenarios.json (en_start_date, official names; see scripts/lib/scenarios.js). Idempotent: the news-made
// entries are rebuilt from all posts each time, the seeded ones are left alone.
//
// Needs JP's banners (generated/jp_banners.json, `pnpm scrape-gametora`) for the banners' items,
// and our card data (generated/cards.json) for English names. Appends what changed to data/news/summary.md,
// then rebuilds the card data with the new Global releases (scripts/build-cards.js).
//
// Usage: pnpm update-global

import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GENERATED_DIR, NEWS_DIR } from './lib/paths.js';
import { BANNERS_FILE, CARDS_FILE, applyNews, englishNames, readJson, writeGlobal } from './lib/global.js';
import { applyScenarioNews, fillColors, readScenarios, writeScenarios } from './lib/scenarios.js';
import { ensureCards } from './update-cards.js';
import { buildCardFiles } from './build-cards.js';

const NEWS_FILE = `${NEWS_DIR}announcements.json`;
const SUMMARY_FILE = `${NEWS_DIR}summary.md`;

const day = (iso) => iso.slice(0, 10);
const when = (iso) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

export async function updateGlobal() {
  if (!existsSync(BANNERS_FILE))
    throw new Error('data/ has no Global banners yet: run pnpm scrape-gametora --seed-global');
  await ensureCards();
  const global = readJson(BANNERS_FILE);
  const cards = readJson(CARDS_FILE);
  const jp = readJson(`${GENERATED_DIR}jp_banners.json`);
  const cardData = readJson(`${GENERATED_DIR}cards.json`);
  const posts = existsSync(NEWS_FILE) ? readJson(NEWS_FILE) : [];

  const result = applyNews({ posts, global, cards, jp, names: englishNames(global, cardData) });
  writeGlobal(result);
  await buildCardFiles();

  // Scenarios: JP's side comes from scrape-gametora; nothing to apply the news to before it ran.
  const stored = readScenarios();
  const scenarios = applyScenarioNews({ posts, scenarios: stored.scenarios });
  if (stored.scenarios.length) {
    await fillColors(scenarios.scenarios); // a new scenario's cover colour (one image)
    writeScenarios(stored.source, scenarios.scenarios);
  }

  const before = new Map(
    [...global.characters, ...global.cards].filter((b) => b.news_url).map((b) => [b.id, `${b.start} ${b.end}`])
  );
  const changed = result.banners.filter(({ banner }) => before.get(banner.id) !== `${banner.start} ${banner.end}`);
  const released = Object.entries(result.cards).filter(
    ([id, c]) => c.news_url && cards[id]?.release_gl !== c.release_gl
  );

  const lines = [];
  for (const { banner, kind, unmatched } of changed) {
    const verb = before.has(banner.id) ? 'Moved' : 'Added';
    const items = banner.featured.map((i) => `${i.title} ${i.name}`).join(', ');
    lines.push(
      `- ${verb} ${kind === 'cards' ? 'support card' : 'trainee'} banner ${banner.id}: ${when(banner.start)} → ${when(banner.end)} — ${items}`
    );
    if (unmatched.length) lines.push(`  - No English name in the post for: ${unmatched.join(', ')}`);
  }
  for (const [id, c] of released)
    lines.push(`- Card ${id} ${c.title_en ?? ''} out on Global ${c.release_gl}`.replace('  ', ' '));
  for (const s of result.skipped) lines.push(`- Skipped banner ${s.id} (${s.post}): ${s.reason}`);
  for (const s of scenarios.changed) {
    const start =
      s.en_start_date && s.en_start_date.tag !== 'predicted'
        ? `starts on Global ${when(s.en_start_date.date)} (${s.en_start_date.tag})`
        : 'announced, no Global date yet';
    lines.push(`- Scenario ${s.key}: "${s.full_en}" ${start}`);
  }
  for (const name of scenarios.unmatched) lines.push(`- Scenario "${name}" doesn't match any JP scenario`);

  const summary = lines.length ? `## Global repository (data/)\n\n${lines.join('\n')}\n` : '';
  return { ...result, changed, released, scenarios, summary };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { changed, released, skipped, summary } = await updateGlobal();
    if (summary) {
      console.log(summary);
      if (existsSync(SUMMARY_FILE)) appendFileSync(SUMMARY_FILE, `\n${summary}`);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summary}`);
    }
    console.log(
      `Global: ${changed.length} banners added or moved, ${released.length} card releases, ${skipped.length} skipped (${day(new Date().toISOString())}).`
    );
  } catch (err) {
    console.error(`Global update failed: ${err.message}`);
    process.exit(1);
  }
}
