// UmaTL's fan translations (+ Global's official names) for the JP names the site shows → generated/translations.json.
// UmaTL's terms: use only with attribution (the app credits it and marks every fan name), and never with generative
// models: nothing here may reach news:ai's prompts or ml/ (both run before this, on data/ alone).
import type { BannerFile } from '../../shared/schemas/banner.ts';
import type { CardsFile } from '../../shared/schemas/card.ts';
import type { EventPairsFile, EventsFile } from '../../shared/schemas/event.ts';
import type { GametoraEventsFile, GametoraTrainee } from '../../shared/schemas/gametora.ts';
import { type TlText, type TranslationsFile, type UmatlRaw, hasJapanese } from '../../shared/schemas/translations.ts';
import { GENERATED_DIR } from './paths.ts';

export const UMATL_TEXT_FILE = `${GENERATED_DIR}raw/umatl_text_data.json`;
export const UMATL_MDB_FILE = `${GENERATED_DIR}raw/umatl_mdb.json`;
export const TRANSLATIONS_FILE = `${GENERATED_DIR}translations.json`;

// hachimi-tl-en's text_data categories read (the game's text table, by game id).
export const UMATL_CATEGORIES = {
  traineeTitle: '5', // trainee outfit id → "[Special Dreamer]"
  charName: '6', // character id → "Special Week"
  cardFull: '75', // support card id → "[Tracen Academy] Special Week"
  cardTitle: '76', // support card id → "[Tracen Academy]"
  storyEvent: '189', // story event id (GameTora's) → its name
} as const;
// umamusu-translate's mdb tables read (Japanese text → English) for what our data stores as text, per kind of name
// (one kind's table never names another's: an event and an item can share their Japanese).
const TABLES_OF = {
  items: ['item-name'],
  titles: ['trainer-title'],
  banners: ['gacha-names'],
  events: ['event-titles', 'login-bonus', 'campaigns', 'gacha-names'],
} as const;
export const UMATL_TABLES: string[] = [...new Set(Object.values(TABLES_OF).flat())];

// The key two spellings of one name share: full-width forms folded, spaces and quote brackets dropped.
export const textKey = (text: string): string => text.normalize('NFKC').replace(/[\s「」『』]/g, '');

const DAY_MS = 86_400_000;
const PIECE = /^(\[[^\]]+\])(.+)のピース$/;

export type TranslationInputs = {
  umatl: UmatlRaw;
  cards: CardsFile;
  jpBanners: BannerFile;
  globalBanners: BannerFile;
  jpEvents: EventsFile;
  globalEvents: EventsFile;
  pairs: EventPairsFile['pairs'];
  gametoraEvents: GametoraEventsFile | null;
  gametoraTrainees: GametoraTrainee[];
};
export type TranslationReport = Record<'items' | 'titles' | 'banners' | 'events', { done: number; of: number }>;

// UmaTL's text as the game lays it out: its line breaks (the original repo's written `\\n`), Hachimi's `$(scale 90)` commands and rich-text tags.
export const cleanText = (text: string): string =>
  text
    .replace(/\$\([^)]*\)|<[^>]+>/g, '')
    .replace(/\s*(\\n|\n)\s*/g, ' ')
    .trim();

const fan = (en: string): TlText => ({ en: cleanText(en), fan: true });
const official = (en: string): TlText => ({ en, fan: false });

export function buildTranslations(input: TranslationInputs): { file: TranslationsFile; report: TranslationReport } {
  const { umatl, cards } = input;
  const category = (key: keyof typeof UMATL_CATEGORIES) => umatl.text_data[UMATL_CATEGORIES[key]] ?? {};
  // Each kind's tables in one lookup, by textKey.
  const tables = Object.fromEntries(
    Object.entries(TABLES_OF).map(([kind, names]) => [
      kind,
      new Map(names.flatMap((name) => Object.entries(umatl.mdb[name] ?? {}).map(([jp, en]) => [textKey(jp), en]))),
    ])
  ) as Record<keyof typeof TABLES_OF, Map<string, string>>;

  // Card titles UmaTL has where neither Global nor GameTora gives one. A title UmaTL keeps only in the full name
  // ("[title] name") is cut from it.
  const cardTitles: Record<string, string> = {};
  for (const [id, card] of Object.entries(cards)) {
    if (card.title.en || !card.title.jp || !hasJapanese(card.title.jp)) continue;
    const title = category('cardTitle')[id] ?? category('cardFull')[id]?.match(/^\[[^\]]+\]/)?.[0];
    if (title) cardTitles[id] = cleanText(title);
  }

  // Characters and outfits: Global's names (its banners, its cards), then UmaTL's. (The app reads GameTora's from the
  // card data, between the two.)
  const globalItems = [...input.globalBanners.characters, ...input.globalBanners.cards].flatMap((b) => b.featured);
  const chars: Record<string, TlText> = {};
  for (const [id, name] of Object.entries(category('charName'))) chars[id] = fan(name);
  for (const card of Object.values(cards))
    if (card.release.gl && card.charId && card.name.en) chars[card.charId] = official(card.name.en);
  for (const item of globalItems) if (item.char_id && item.name) chars[item.char_id] = official(item.name);
  const trainees: Record<string, TlText> = {};
  for (const [id, title] of Object.entries(category('traineeTitle'))) trainees[id] = fan(title);
  for (const item of input.globalBanners.characters.flatMap((b) => b.featured))
    if (item.id != null && item.title) trainees[item.id] = official(item.title);

  // Events: the paired Global event's name, else a story event's by its game id (GameTora's, matched by start).
  const globalNames = new Map(input.globalEvents.map((e) => [e.id, e.name] as const));
  const events: Record<string, TlText> = {};
  const story = input.gametoraEvents?.story ?? [];
  for (const event of input.jpEvents) {
    if (event.kind !== 'story' || event.parent) continue;
    const gameId =
      event.id.match(/^gt-story-(\d+)$/)?.[1] ??
      story.find((s) => Math.abs(s.start_ja * 1000 - Date.parse(event.start.date)) < DAY_MS)?.id;
    const name = gameId != null && category('storyEvent')[gameId];
    if (name) events[event.id] = fan(name);
  }
  // A JP name a paired Global event translated, for every JP event of that name (a Champions Meeting's cup).
  const pairedNames = new Map<string, string | null>();
  const jpById = new Map(input.jpEvents.map((e) => [e.id, e] as const));
  for (const pair of input.pairs) {
    const en = globalNames.get(pair.gl);
    const jp = jpById.get(pair.jp)?.name;
    if (!en) continue;
    events[pair.jp] = official(en);
    if (!jp || !hasJapanese(jp)) continue;
    const key = textKey(jp);
    // Two Global names for one JP name: neither is sure.
    pairedNames.set(key, pairedNames.has(key) && pairedNames.get(key) !== en ? null : en);
  }

  // Trainees by their Japanese title + name (a piece names its outfit so).
  const traineeIds = new Map<string, number>();
  for (const t of input.gametoraTrainees) traineeIds.set(textKey(`${t.title}${t.name}`), t.id);
  for (const item of input.jpBanners.characters.flatMap((b) => b.featured))
    if (item.id != null && item.title && item.name) traineeIds.set(textKey(`${item.title}${item.name}`), item.id);
  const piece = (jp: string): TlText | undefined => {
    const [, title, name] = jp.match(PIECE) ?? [];
    const id = title && name && traineeIds.get(textKey(`${title}${name}`));
    const outfit = id ? trainees[id] : undefined;
    const char = id ? chars[Math.floor(id / 100)] : undefined;
    return outfit && char && { en: `${outfit.en} ${char.en}'s Piece`, fan: outfit.fan || char.fan };
  };

  const fromTables = (kind: keyof typeof TABLES_OF, jp: string): TlText | undefined => {
    const en = tables[kind].get(textKey(jp));
    return en ? fan(en) : kind === 'items' ? piece(jp) : undefined;
  };
  const text: Record<string, TlText> = {};
  const report = {} as TranslationReport;
  const translate = (kind: Exclude<keyof TranslationReport, 'events'>, names: (string | null | undefined)[]) => {
    const wanted = new Set(names.filter((n): n is string => !!n && hasJapanese(n)));
    let done = 0;
    for (const jp of wanted) {
      const found = fromTables(kind, jp);
      if (!found) continue;
      text[jp] = found;
      done++;
    }
    report[kind] = { done, of: wanted.size };
  };
  const jpEvents = input.jpEvents;
  translate(
    'items',
    jpEvents.flatMap((e) => e.items.map((i) => i.name))
  );
  translate(
    'titles',
    jpEvents.flatMap((e) => e.titles)
  );
  translate(
    'banners',
    [...input.jpBanners.characters, ...input.jpBanners.cards].map((b) => b.name)
  );
  // The rest of the events by their name: a paired event's of that name (official), else UmaTL's tables.
  const named = jpEvents.filter((e) => e.name && hasJapanese(e.name));
  for (const event of named) {
    if (events[event.id] || !event.name) continue;
    const paired = pairedNames.get(textKey(event.name));
    const found = paired ? official(paired) : fromTables('events', event.name);
    if (found) events[event.id] = found;
  }
  report.events = { done: named.filter((e) => events[e.id]).length, of: named.length };

  return { file: { cards: cardTitles, trainees, chars, events, text }, report };
}
