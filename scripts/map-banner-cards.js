// Maps the support cards featured on scraped banners (generated/*_banners.json,
// from scripts/scrape-banners.js) to the cards in our card data
// (generated/metadata.json, from scripts/update-cards.js), writing
// generated/card_banners.json:
//   cards      { [id]: { id, group, name_en, name_jp, first_banner: { global, jp },
//                        global: [appearance…], jp: [appearance…] } }
//              for every card in our data; an appearance is
//              { banner, start, end, main, new }
//   unmatched  { global: [item…], jp: [item…] } featured cards we don't have
//   name_mismatches  same id, different name (a sign the ids don't line up);
//                    group cards are skipped, GameTora names them after the group
// GameTora and the game use the same support card ids, so matching is by id;
// names are only cross-checked.
//
// Usage: pnpm map-banner-cards

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GENERATED_DIR } from './lib/upstream.js';
import { ensureCards } from './update-cards.js';

const SERVERS = { global: 'name_en', jp: 'name_jp' };

export async function mapBannerCards() {
  await ensureCards();
  const metadata = JSON.parse(readFileSync(`${GENERATED_DIR}metadata.json`, 'utf8'));

  const cards = {};
  for (const meta of Object.values(metadata)) {
    cards[meta.id] = {
      id: meta.id,
      group: meta.group,
      name_en: meta.name_en,
      name_jp: meta.name_jp,
      first_banner: { global: null, jp: null },
      global: [],
      jp: [],
    };
  }

  const unmatched = { global: [], jp: [] };
  const nameMismatches = [];
  for (const [server, nameField] of Object.entries(SERVERS)) {
    const { cards: banners } = JSON.parse(readFileSync(`${GENERATED_DIR}${server}_banners.json`, 'utf8'));
    // Oldest first, so appearance lists and first_banner come out in order.
    for (const banner of [...banners].reverse()) {
      for (const item of banner.featured) {
        const card = cards[item.id];
        if (!card) {
          unmatched[server].push({
            id: item.id,
            name: item.name,
            title: item.title,
            banner: banner.id,
            start: banner.start,
          });
          continue;
        }
        // GameTora names group cards after the group, not the character.
        if (!card.group && card[nameField] !== null && item.name !== card[nameField]) {
          nameMismatches.push({ id: item.id, server, ours: card[nameField], gametora: item.name });
        }
        card[server].push({
          banner: banner.id,
          start: banner.start,
          end: banner.end,
          main: banner.main?.id === item.id,
          new: item.new,
        });
        card.first_banner[server] ??= banner.start;
      }
    }
  }

  const uniqueMismatches = [...new Map(nameMismatches.map((m) => [`${m.server}/${m.id}`, m])).values()];
  const result = {
    mapped_at: new Date().toISOString(),
    cards,
    unmatched,
    name_mismatches: uniqueMismatches,
  };
  writeFileSync(`${GENERATED_DIR}card_banners.json`, `${JSON.stringify(result, null, 1)}\n`);

  const all = Object.values(cards);
  for (const server of Object.keys(SERVERS)) {
    const featured = all.filter((c) => c[server].length > 0).length;
    const missing = new Set(unmatched[server].map((i) => i.id)).size;
    console.log(
      `${server}: ${featured} of our cards were featured on banners; ${missing} featured cards aren't in our data`
    );
  }
  if (uniqueMismatches.length) {
    console.log(`${uniqueMismatches.length} name mismatches (same id, different name) — see name_mismatches`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await mapBannerCards();
  } catch (err) {
    console.error(`Banner card mapping failed: ${err.message}`);
    process.exit(1);
  }
}
