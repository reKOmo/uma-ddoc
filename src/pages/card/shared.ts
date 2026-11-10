import { cards } from '../../../tierlist/cards.ts';
import { cardEnglish, hasJapanese, type Language, type TranslationsFile } from '../../translations.ts';

export const LIMIT_BREAKS = [0, 1, 2, 3, 4];

// A card's name and title in the server's language (src/translations.ts): the English it shows (Global's, GameTora's),
// else the title UmaTL's where the language allows fan translations, else as JP writes them.
export const nameOf = (id: number, language: Language): string | undefined => {
  const name = cards[id]?.name;
  return cardEnglish(cards, id, 'name', language) ?? name?.jp ?? name?.en ?? undefined;
};

export type Title = { text: string; fan: boolean };
export function titleOf(id: number, language: Language, tl: TranslationsFile | null): Title | null {
  const title = cards[id]?.title;
  const en = cardEnglish(cards, id, 'title', language);
  if (en) return { text: en, fan: false };
  const fan = language.fan ? tl?.cards[id] : undefined;
  if (fan) return { text: fan, fan: true };
  const text = title?.jp ?? title?.en;
  return text ? { text, fan: false } : null;
}

// The name and title in the other language than shown (the card page shows both): Japanese next to English, English
// (GameTora's too; UmaTL's title where the language allows fan translations) next to Japanese. null when the same.
export function otherNames(id: number, language: Language, tl: TranslationsFile | null) {
  const card = cards[id];
  const shownName = nameOf(id, language);
  const shownTitle = titleOf(id, language, tl);
  const other = (shown: string | undefined, jp: string | null | undefined, en: string | null | undefined) => {
    const text = shown && hasJapanese(shown) ? en : jp;
    return text && text !== shown ? text : null;
  };
  const fanTitle = language.fan ? tl?.cards[id] : undefined;
  const title = other(shownTitle?.text, card?.title.jp, card?.title.en ?? fanTitle);
  return {
    name: other(shownName, card?.name.jp, card?.name.en),
    title: title ? { text: title, fan: title === fanTitle && !card?.title.en } : null,
  };
}
