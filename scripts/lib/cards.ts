// Pure: the card data the site, the tier list calculation and ml/ read, built from the raw inputs
// (see scripts/build-cards.js):
//   upstream     upstream's card lists ({ gl, jp }: arrays of one object per card × limit break) and
//                card events ({ [id]: [8 numbers] }), from generated/raw/upstream/
//   history      our history of JP's cards (data/jp_cards.json, committed): { [id]: entry } (entry: see fromGametora()):
//                a frozen record of what GameTora said about each card (2026-10), then the cards the JP news shows,
//                augmented from GameTora (scripts/lib/jp-cards.js, `pnpm update-jp`); it never takes GameTora's values
//   gametora     GameTora's support cards (generated/raw/gametora_cards.json; optional: [] without it), only for every
//                card's page slug: a card GameTora lists that the history lacks isn't added (update-jp warns)
//   globalCards  Global's own record (data/global_cards.json): { [id]: { title_en, release_gl } }
//   iconBase     upstream's card images at the same commit
// into
//   cards        { [id]: card } for every card upstream or the history has (shape: schemas/cards.schema.json)
//   stats        { gl, jp }: { [id]: { charName, events, lb: [stats at LB0…LB4] } } for the server's
//                cards upstream has stats for
// Throws if the outputs don't join back to upstream's exact lists (tierlist/join-cards.js).
// No URLs but upstream's icons: the app builds GameTora's (card page, full art, icons) from the id and the slug.

import { isDeepStrictEqual } from 'node:util';
import type { CardType, Rarity } from '../../shared/schemas/common.ts';
import type {
  CardsFile,
  CardStatsFile,
  GlobalCardsFile,
  JpCard,
  JpCardsFile,
  LbStats,
} from '../../shared/schemas/card.ts';
import type { GametoraCard } from '../../shared/schemas/gametora.ts';
import { type JoinedCard, joinCards, rarityOf, typeOf, withoutEvents } from '../../tierlist/join-cards.ts';

// GameTora's type names → ours (the tier list's stat keys, plus group).
const GAMETORA_TYPES: Record<GametoraCard['type'], CardType> = {
  speed: 'speed',
  stamina: 'stamina',
  power: 'power',
  guts: 'guts',
  intelligence: 'wisdom',
  friend: 'friend',
  group: 'group',
};

// One upstream card object (a limit break's stats and the card's fields; no `events`, which upstream's lists don't have).
export type UpstreamCard = Omit<JoinedCard, 'events'>;

// Upstream's per-card fields; the rest of a card object is its stats at that limit break.
const statsOf = ({ id, limit_break, char_name, type, group, rarity, ...stats }: UpstreamCard): LbStats => stats;

// A GameTora support card (raw/gametora_cards.json) → a history entry (data/jp_cards.json):
// { charId, type, rarity, name: { en, jp }, title: { en, jp }, release (JP's, "YYYY-MM-DD"), source, slug }, in our
// names (type wisdom, rarity SSR…); name.en / title.en are GameTora's English (fallbacks only). The frozen cards are
// exactly this; a card from the news takes its JP fields from the news (+ `news_url`: scripts/lib/jp-cards.js).
// rarity is null for a code other than 1–3 (rarityOf()).
export type HistoryEntry = Omit<JpCard, 'rarity'> & { rarity: Rarity | null };
export const fromGametora = (g: GametoraCard): HistoryEntry => ({
  charId: g.char_id ?? null,
  type: GAMETORA_TYPES[g.type],
  rarity: rarityOf(g.rarity) ?? null,
  name: { en: g.char_name ?? null, jp: g.name_jp ?? null },
  title: { en: g.title_en ?? null, jp: g.title_ja ?? null },
  release: g.release ?? null,
  source: g.obtained ? [g.obtained] : [],
  slug: g.url_name ?? null,
});

// What buildCards() reads: upstream's card lists (+ their events), our history, GameTora's list, Global's record.
type BuildInput = {
  upstream: { gl: UpstreamCard[]; jp: UpstreamCard[]; events: Record<string, number[]> };
  history?: JpCardsFile;
  gametora?: GametoraCard[];
  globalCards?: GlobalCardsFile;
  iconBase: string;
};

export function buildCards({ upstream, history = {}, gametora = [], globalCards = {}, iconBase }: BuildInput): {
  cards: CardsFile;
  stats: { gl: CardStatsFile; jp: CardStatsFile };
} {
  // The history; GameTora only for slugs.
  const gt = new Map<number, JpCard>(
    Object.entries(history).map(([id, entry]): [number, JpCard] => [Number(id), entry])
  );
  const slugs = new Map<number, string>();
  for (const c of gametora) if (c.url_name) slugs.set(c.support_id, c.url_name);
  // Upstream's cards: names per server (each in its own language), type and rarity.
  const own: Record<
    number,
    { type: CardType | undefined; rarity: Rarity | undefined; name: Partial<Record<'gl' | 'jp', string>> }
  > = {};
  for (const server of ['gl', 'jp'] as const) {
    for (const card of upstream[server]) {
      own[card.id] ??= { type: typeOf(card.type, card.group), rarity: rarityOf(card.rarity), name: {} };
      own[card.id].name[server] = card.char_name;
    }
  }
  // A character's Global name, for its cards Global doesn't have yet (group cards are named after
  // the group on GameTora, after a member upstream).
  const globalName = new Map<number, string>();
  for (const [id, card] of Object.entries(own)) {
    const charId = gt.get(Number(id))?.charId;
    if (card.name.gl && charId && card.type !== 'group') globalName.set(charId, card.name.gl);
  }

  const ids = [...new Set([...Object.keys(own).map(Number), ...gt.keys()])].sort((a, b) => a - b);
  const cards: CardsFile = {};
  for (const id of ids) {
    const up = own[id];
    // TODO(ts): undefined for a card only upstream has; g is read without ?. only when upstream has no type or rarity.
    const g = gt.get(id) as JpCard;
    const group = (up?.type ?? g?.type) === 'group';
    const gl = globalCards[id];
    cards[id] = {
      id,
      charId: g?.charId ?? null,
      // Upstream's where it has the card (the calculation's), else the history's.
      type: up?.type ?? g.type,
      rarity: up?.rarity ?? g.rarity,
      name: {
        en: (!group && (up?.name.gl ?? globalName.get(g?.charId))) || (g?.name.en ?? up?.name.gl ?? null),
        jp: g?.name.jp ?? up?.name.jp ?? null,
      },
      title: { en: gl?.title_en ?? g?.title.en ?? null, jp: g?.title.jp ?? null },
      release: { gl: gl?.release_gl ?? null, jp: g?.release ?? null },
      source: g?.source ?? [],
      // GameTora's page slug (https://gametora.com/umamusume/supports/<slug>; /supports/<id> alone is a 404).
      links: { gametora: slugs.get(id) ?? g?.slug ?? null },
      // Upstream's icon where it has the card; the app falls back to GameTora's, built from the id.
      images: { icon: up ? `${iconBase}support_card_s_${id}.png` : null },
    };
  }

  const stats: { gl: CardStatsFile; jp: CardStatsFile } = { gl: {}, jp: {} };
  for (const server of ['gl', 'jp'] as const) {
    for (const card of upstream[server]) {
      stats[server][card.id] ??= { charName: card.char_name, events: upstream.events[card.id] ?? null, lb: [] };
      stats[server][card.id].lb[card.limit_break] = statsOf(card);
    }
    if (!isDeepStrictEqual(withoutEvents(joinCards(cards, stats[server])), upstream[server])) {
      throw new Error(`${server}: the card data doesn't join back to upstream's list`);
    }
  }
  return { cards, stats };
}
