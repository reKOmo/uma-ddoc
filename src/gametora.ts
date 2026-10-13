// GameTora's URLs, built from ids (the data files store none: GameTora's images are hotlinked, its card pages linked).
import type { BannerFile, BannerId, BannerItem, Banner } from '../shared/schemas/banner.ts';
import type { CardsFile } from '../shared/schemas/card.ts';

const SITE = 'https://gametora.com';
const IMAGES = `${SITE}/images/umamusume/`;

// A support card's page, from its slug (cards.json `links.gametora`, GameTora's url_name; /supports/<id> is a 404).
export const cardPage = (slug: string | null | undefined): string | null =>
  slug ? `${SITE}/umamusume/supports/${slug}` : null;
// A support card's full art (3:4 portrait).
export const cardArt = (id: number): string => `${IMAGES}supports/tex_support_card_${id}.png`;
// A support card's square icon: upstream's where cards.json has one, else GameTora's.
export const cardIcon = (id: number, cards?: CardsFile): string =>
  cards?.[id]?.images?.icon ?? `${IMAGES}supports/support_card_s_${id}.png`;
// A trainee outfit's icon (its 6-digit id and its character's id).
export const traineeIcon = (charId: number, id: number): string =>
  `${IMAGES}characters/thumb/chara_stand_${charId}_${id}.png`;

// A banner's art on GameTora: Global's under en/. Our own re-run entries ("<id>-rerun") show their original's.
const ART_PREFIX = { global: 'en/', jp: '' };
export const bannerArt = (id: BannerId, art: 'global' | 'jp'): string =>
  `${IMAGES}${ART_PREFIX[art]}gacha/img_bnr_gacha_${Number.parseInt(String(id), 10)}.png`;

// A banner's featured item or main item with its icon.
export type ArtItem = BannerItem & { icon: string | null };
// A banner with what the app shows filled in (see withArt()).
export type ArtBanner = Omit<Banner, 'main' | 'featured'> & {
  image: string;
  officialArt: boolean;
  main: ArtItem | null;
  featured: ArtItem[];
};
export type ArtBannerFile = Omit<BannerFile, 'characters' | 'cards'> & {
  characters: ArtBanner[];
  cards: ArtBanner[];
};

// A banner file ({ characters, cards }) with what the app shows filled in: each banner's `image` (the official art from
// its post, `news_image` or a news-made banner's `image`, else GameTora's for `art`: 'global' | 'jp') and
// `officialArt` (the official art: 936×228, no margin, so it's cropped differently from GameTora's), each item's
// `icon` (none without an id).
// `cards`: generated/cards.json, so a card upstream has shows upstream's icon (GameTora's otherwise).
export function withArt(file: BannerFile, art: 'global' | 'jp', cards: CardsFile): ArtBannerFile {
  const item =
    (kind: 'characters' | 'cards') =>
    (it: BannerItem): ArtItem => ({
      ...it,
      icon:
        it.id == null
          ? null
          : kind === 'cards'
            ? cardIcon(it.id, cards)
            : it.char_id != null
              ? traineeIcon(it.char_id, it.id)
              : null,
    });
  const banners = (kind: 'characters' | 'cards'): ArtBanner[] =>
    file[kind].map((b) => ({
      ...b,
      image: b.news_image ?? b.image ?? bannerArt(b.id, art),
      officialArt: (b.news_image ?? b.image) != null,
      main: b.main && item(kind)(b.main),
      featured: b.featured.map(item(kind)),
    }));
  return { ...file, characters: banners('characters'), cards: banners('cards') };
}
