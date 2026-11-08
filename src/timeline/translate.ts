// Entries' Japanese names in English (src/translations.ts' language): Global's names, GameTora's (card data), then
// UmaTL's fan translations where the language allows them. Only Japanese names are touched; what has no English
// stays as it is.
import type { CardsFile } from '../../shared/schemas/card.ts';
import {
  type Language,
  type TlText,
  type TranslationsFile,
  allowed,
  cardEnglish,
  hasJapanese,
  translates,
} from '../translations.ts';
import type { Entry, Featured } from './entries.ts';

// Global's names as JP writes them (Settings → Language: Japanese): cards by id, the rest by JP's own (banners share
// their gacha id; events are paired, data.ts). What JP has no name for (Global's news' items, Global-only events)
// stays as Global writes it.
export type JapaneseNames = {
  cards: CardsFile;
  banners: Map<string, string>;
  trainees: Map<number, { name: string; title: string }>;
  events: Map<string, string>;
};
export function japaneseEntries(entries: Entry[], jp: JapaneseNames): Entry[] {
  return entries.map((entry) => {
    const originals: string[] = [];
    const swap = (text: string, japanese: string | null | undefined): string => {
      if (!japanese || japanese === text) return text;
      originals.push(text);
      return japanese;
    };
    const featured = entry.featured.map((item): Featured => {
      if (item.id == null) return item;
      const card = item.card ? jp.cards[item.id] : undefined;
      const trainee = item.card ? undefined : jp.trainees.get(item.id);
      return {
        ...item,
        name: swap(item.name, card ? card.name.jp : trainee?.name),
        title: item.title && swap(item.title, card ? card.title.jp : trainee?.title),
      };
    });
    const id = String(entry.id);
    const name = entry.name && swap(entry.name, entry.group === 'event' ? jp.events.get(id) : jp.banners.get(id));
    const main =
      entry.main && entry.featured[0]?.name === entry.main.name
        ? { ...entry.main, name: featured[0]?.name ?? entry.main.name }
        : entry.main;
    return { ...entry, name, main, featured, originals };
  });
}

type Translate = { tl: TranslationsFile | null; language: Language; cards: CardsFile; server: 'gl' | 'jp' };

// The JP event an entry shows: JP's own, or on Global a predicted one ('jp-<JP id>').
const jpEventId = (entry: Entry, server: Translate['server']): string | null => {
  const id = String(entry.id);
  return server === 'jp' ? id : id.startsWith('jp-') ? id.slice(3) : null;
};

const english = (en: string | null | undefined): TlText | undefined => (en ? { en, fan: false } : undefined);

export function translateEntries(entries: Entry[], { tl, language, cards, server }: Translate): Entry[] {
  if (!translates(language)) return entries;
  // The GameTora name of a character (any of its cards'), for trainees Global hasn't named.
  const gametoraChars = new Map(Object.values(cards).map((c) => [c.charId, c.name.en] as const));
  const pick = (text: TlText | undefined) => allowed(text, language);
  return entries.map((entry) => {
    const fan = new Set<string>();
    const originals: string[] = [];
    // `text` translated by the first of `found` the language allows, if it's Japanese.
    const swap = (text: string, ...found: (TlText | undefined)[]): string => {
      if (!hasJapanese(text)) return text;
      const en = found.find(Boolean);
      if (!en) return text;
      if (en.fan) fan.add(en.en);
      originals.push(text);
      return en.en;
    };

    const featured = entry.featured.map((item): Featured => {
      if (item.id == null) return item;
      if (item.card) {
        const title = tl?.cards[item.id];
        return {
          ...item,
          name: swap(item.name, english(cardEnglish(cards, item.id, 'name', language))),
          title:
            item.title &&
            swap(
              item.title,
              english(cardEnglish(cards, item.id, 'title', language)),
              pick(title ? { en: title, fan: true } : undefined)
            ),
        };
      }
      // A trainee's id is their character's and the outfit's (100101: Special Week's first).
      const char = Math.floor(item.id / 100);
      const named = tl?.chars[char];
      return {
        ...item,
        name: swap(
          item.name,
          named?.fan ? undefined : pick(named),
          language.gametora ? english(gametoraChars.get(char)) : undefined,
          pick(named?.fan ? named : undefined)
        ),
        title: item.title && swap(item.title, pick(tl?.trainees[item.id])),
      };
    });
    const eventId = entry.group === 'event' ? jpEventId(entry, server) : null;
    const name =
      entry.name &&
      swap(entry.name, pick(eventId != null ? tl?.events[eventId] : undefined), pick(tl?.text[entry.name]));
    // The banner's main item is the first featured (entries.ts puts it there).
    const main =
      entry.main && entry.featured[0]?.name === entry.main.name
        ? { ...entry.main, name: featured[0]?.name ?? entry.main.name }
        : entry.main;
    const items = entry.items.map((item) => {
      const en = swap(item.name, pick(tl?.text[item.name]));
      return en === item.name ? item : { ...item, name: en, local: item.name };
    });
    const titles = entry.titles.map((title) => swap(title, pick(tl?.text[title])));
    return {
      ...entry,
      name,
      main,
      featured,
      items,
      titles,
      fan,
      originals,
      untranslated: entry.group === 'event' && !!name && hasJapanese(name),
    };
  });
}
