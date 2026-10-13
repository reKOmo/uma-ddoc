// Card data, built by `pnpm build-cards` into generated/ (see scripts/lib/cards.js): every card's
// shown data (cards.json, shape in schemas/cards.schema.json) and the calculation's inputs per
// server (card_stats/), which load on demand, so the browser only downloads the selected server's.
import cardsJson from '../generated/cards.json' with { type: 'json' };
import type { CardsFile, CardStats, CardStatsFile } from '../shared/schemas/card.ts';
import { type JoinedCard, joinCards } from './join-cards.ts';

// test/schemas.test.ts parses generated/cards.json against CardsFileSchema.
const cards = cardsJson as CardsFile;
export { cards };

export type Server = 'gl' | 'jp';

const STATS: Record<Server, () => Promise<{ default: CardStatsFile }>> = {
  gl: () => import('../generated/card_stats/gl_card_stats.json', { with: { type: 'json' } }),
  jp: () => import('../generated/card_stats/jp_card_stats.json', { with: { type: 'json' } }),
};

const cache: Record<string, Promise<JoinedCard[]>> = {};
const loadStats = (server: Server): Promise<CardStatsFile> => STATS[server]().then((m) => m.default);

// Upstream's card objects for the server (same shape and order as upstream's src/cards/gl.js and
// jp.js arrays), plus each card's `events`.
export function loadCards(server: Server): Promise<JoinedCard[]> {
  cache[server] ??= loadStats(server).then((stats) => joinCards(cards, stats));
  return cache[server];
}

// The server's cards plus JP's cards it doesn't have yet, for rankings that look ahead (Global
// releases JP's cards later). Those use JP's stats, which are identical for every card both servers
// have. Their name in the server's language is the one the server's cards give the same JP name (so
// the calculation still sees them as the same character), else the card's English name.
// On JP itself this is just JP's cards.
export function loadCardsWithUpcoming(server: Server): Promise<JoinedCard[]> {
  if (server === 'jp') return loadCards('jp');
  cache[`${server}+upcoming`] ??= Promise.all([loadStats(server), loadStats('jp')]).then(([own, jp]) => {
    const known = new Map(Object.keys(own).map((id): [string, string] => [jp[id].charName, own[id].charName]));
    const upcoming = Object.keys(jp)
      .filter((id) => !(id in own))
      .map((id): [string, CardStats] => [
        id,
        // TODO(ts): every card has an English name (test/data.test.ts checks names are present); the schema allows null.
        { ...jp[id], charName: known.get(jp[id].charName) ?? (cards[id].name.en as string) },
      ]);
    return joinCards(cards, { ...own, ...Object.fromEntries(upcoming) });
  });
  return cache[`${server}+upcoming`];
}
