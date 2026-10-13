// @ts-nocheck
// Card data, built by `pnpm build-cards` into generated/ (see scripts/lib/cards.js): every card's
// shown data (cards.json, shape in schemas/cards.schema.json) and the calculation's inputs per
// server (card_stats/), which load on demand, so the browser only downloads the selected server's.
import cards from '../generated/cards.json' with { type: 'json' };
import { joinCards } from './join-cards.ts';

export { cards };

const STATS = {
  gl: () => import('../generated/card_stats/gl_card_stats.json', { with: { type: 'json' } }),
  jp: () => import('../generated/card_stats/jp_card_stats.json', { with: { type: 'json' } }),
};

const cache = {};
const loadStats = (server) => STATS[server]().then((m) => m.default);

// Upstream's card objects for the server (same shape and order as upstream's src/cards/gl.js and
// jp.js arrays), plus each card's `events`.
export function loadCards(server) {
  cache[server] ??= loadStats(server).then((stats) => joinCards(cards, stats));
  return cache[server];
}

// The server's cards plus JP's cards it doesn't have yet, for rankings that look ahead (Global
// releases JP's cards later). Those use JP's stats, which are identical for every card both servers
// have. Their name in the server's language is the one the server's cards give the same JP name (so
// the calculation still sees them as the same character), else the card's English name.
// On JP itself this is just JP's cards.
export function loadCardsWithUpcoming(server) {
  if (server === 'jp') return loadCards('jp');
  cache[`${server}+upcoming`] ??= Promise.all([loadStats(server), loadStats('jp')]).then(([own, jp]) => {
    const known = new Map(Object.keys(own).map((id) => [jp[id].charName, own[id].charName]));
    const upcoming = Object.keys(jp)
      .filter((id) => !(id in own))
      .map((id) => [id, { ...jp[id], charName: known.get(jp[id].charName) ?? cards[id].name.en }]);
    return joinCards(cards, { ...own, ...Object.fromEntries(upcoming) });
  });
  return cache[`${server}+upcoming`];
}
