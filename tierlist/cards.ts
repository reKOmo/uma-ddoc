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

// Upstream's card objects for the server, plus each card's `events`.
export function loadCards(server: Server): Promise<JoinedCard[]> {
  cache[server] ??= loadStats(server).then((stats) => joinCards(cards, stats));
  return cache[server];
}

// JP's cards the server lacks, for rankings that look ahead. Their stats are JP's (identical for shared cards); their
// name is the server's name for the same JP name, so the calculation sees one character.
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
