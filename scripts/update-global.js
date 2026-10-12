// Brings Global's own banner + card release record (data/, see scripts/lib/global.js) up to date
// with the official news (data/news/gl/posts.json, from `pnpm news:latest`): every scout post's
// banners (scripts/lib/banner-posts.js) become Global banners, their cards Global releases, and the Career scenario launches the
// posts name go into data/scenarios.json (en_start_date, official names; see scripts/lib/scenarios.js), and the in-game
// events with the cards and items they give into data/global_events.json (scripts/lib/events.js). Idempotent: the news-made
// entries are rebuilt from all posts each time, the seeded ones are left alone.
//
// Needs JP's banners (data/jp_banners.json, without paid scouts and our own re-run entries) for the banners' items,
// and our card data (generated/cards.json) for English names. Appends what changed to data/news/gl/summary.md,
// then rebuilds the card data with the new Global releases (scripts/build-cards.js).
//
// Usage: pnpm update-global

import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GENERATED_DIR, newsDir } from './lib/paths.js';
import { bannerPost } from './lib/banner-posts.js';
import { loadPosts } from './lib/news-api.js';
import { scenarioPost } from './lib/news.js';
import { BANNERS_FILE, CARDS_FILE, applyNews, englishNames, readJson, writeGlobal } from './lib/global.js';
import { applyScenarioNews, fillColors, readScenarios, writeScenarios } from './lib/scenarios.js';
import { readJpBanners, regularBanners } from './lib/jp-banners.js';
import { buildEvents, readAnswers, readCmTable, readEvents, writeEvents } from './lib/events.js';
import { ensureCards } from './update-cards.js';
import { buildCardFiles } from './build-cards.js';

const SUMMARY_FILE = `${newsDir('gl')}summary.md`;

const day = (iso) => iso.slice(0, 10);
const when = (iso) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

export async function updateGlobal() {
  if (!existsSync(BANNERS_FILE)) throw new Error('data/ has no Global banners (data/global_banners.json is committed)');
  await ensureCards();
  const global = readJson(BANNERS_FILE);
  const cards = readJson(CARDS_FILE);
  const jp = regularBanners(readJpBanners());
  const cardData = readJson(`${GENERATED_DIR}cards.json`);
  const raw = [...loadPosts().values()];
  const posts = raw.map(scenarioPost);

  const scouts = raw.map((post) => bannerPost(post)).filter(Boolean);
  const result = applyNews({ posts: scouts, global, cards, jp, names: englishNames(global, cardData) });
  writeGlobal(result);
  await buildCardFiles();

  // Scenarios: JP's side comes from scrape-gametora; nothing to apply the news to before it ran.
  const stored = readScenarios();
  const scenarios = applyScenarioNews({ posts, scenarios: stored.scenarios });
  if (stored.scenarios.length) {
    await fillColors(scenarios.scenarios); // a new scenario's cover colour (one image)
    writeScenarios(stored.source, scenarios.scenarios);
  }

  // Events and what they give (data/global_events.json), rebuilt from every post.
  const storedEvents = readEvents();
  const oldEvents = new Map(storedEvents.map((e) => [e.id, JSON.stringify(e)]));
  const events = buildEvents(raw, { cmTable: readCmTable(), cards: cardData, answers: readAnswers() });
  writeEvents(events);
  const changedEvents = events.filter((e) => oldEvents.get(e.id) !== JSON.stringify(e));

  const before = new Map(
    [...global.characters, ...global.cards].filter((b) => b.announced).map((b) => [b.id, `${b.start} ${b.end}`])
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
  for (const e of changedEvents) {
    const cardList = e.cards.map((c) => `[${c.title}] ${c.name}`).join(', ');
    const extra = [cardList && `cards: ${cardList}`, e.titles.length && `titles: ${e.titles.join(', ')}`]
      .filter(Boolean)
      .join('; ');
    lines.push(
      `- ${oldEvents.has(e.id) ? 'Updated' : 'Added'} ${e.kind} event "${e.name ?? e.kind}" (${e.start ? day(e.start) : '?'})${extra ? ` — ${extra}` : ''}`
    );
  }
  for (const name of scenarios.unmatched) lines.push(`- Scenario "${name}" doesn't match any JP scenario`);

  const summary = lines.length ? `## Global repository (data/)\n\n${lines.join('\n')}\n` : '';
  return { ...result, changed, released, scenarios, events: changedEvents, summary };
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
    console.error(`Global update failed: ${err.message}`);
    process.exit(1);
  }
}
