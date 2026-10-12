// GameTora's URLs, built from ids (the data files store none: GameTora's images are hotlinked, its card pages linked).
const SITE = 'https://gametora.com';
const IMAGES = `${SITE}/images/umamusume/`;

// A support card's page, from its slug (cards.json `links.gametora`, GameTora's url_name; /supports/<id> is a 404).
export const cardPage = (slug) => (slug ? `${SITE}/umamusume/supports/${slug}` : null);
// A support card's full art (3:4 portrait).
export const cardArt = (id) => `${IMAGES}supports/tex_support_card_${id}.png`;
// A support card's square icon: upstream's where cards.json has one, else GameTora's.
export const cardIcon = (id, cards) => cards?.[id]?.images?.icon ?? `${IMAGES}supports/support_card_s_${id}.png`;
// A trainee outfit's icon (its 6-digit id and its character's id).
export const traineeIcon = (charId, id) => `${IMAGES}characters/thumb/chara_stand_${charId}_${id}.png`;

// A banner's art on GameTora: Global's under en/. Our own re-run entries ("<id>-rerun") show their original's.
const ART_PREFIX = { global: 'en/', jp: '' };
export const bannerArt = (id, art) => `${IMAGES}${ART_PREFIX[art]}gacha/img_bnr_gacha_${Number.parseInt(id, 10)}.png`;

// A banner file ({ characters, cards }) with what the app shows filled in: each banner's `image` (the official art it
// stores, else GameTora's for `art`: 'global' | 'jp'), each item's `icon` (none without an id).
// `cards`: generated/cards.json, so a card upstream has shows upstream's icon (GameTora's otherwise).
export function withArt(file, art, cards) {
  const item = (kind) => (it) =>
    it && {
      ...it,
      icon:
        it.id == null
          ? null
          : kind === 'cards'
            ? cardIcon(it.id, cards)
            : it.char_id != null
              ? traineeIcon(it.char_id, it.id)
              : null,
    };
  const banners = (kind) =>
    file[kind].map((b) => ({
      ...b,
      image: b.image ?? bannerArt(b.id, art),
      main: item(kind)(b.main),
      featured: b.featured.map(item(kind)),
    }));
  return { ...file, characters: banners('characters'), cards: banners('cards') };
}
