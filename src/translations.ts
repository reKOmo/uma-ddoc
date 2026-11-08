// English for JP names (generated/translations.json, `pnpm fetch-umatl`): Global's official names and UmaTL's fan
// translations. Optional: without the file, names stay as the data has them.
import { useMemo } from 'react';
import type { CardsFile } from '../shared/schemas/card.ts';
import { type TlText, type TranslationsFile, hasJapanese } from '../shared/schemas/translations.ts';
import { useSettings } from './settings.tsx';
import type { Settings } from './settingsStore.ts';
import { useAsync } from './useAsync.ts';
import type { Server } from './servers.ts';

export { hasJapanese };
export type { TlText, TranslationsFile };

const FILES = import.meta.glob<TranslationsFile>('../generated/translations.json', { import: 'default' });
let loaded: Promise<TranslationsFile | null> | undefined;
export function loadTranslations(): Promise<TranslationsFile | null> {
  const [load] = Object.values(FILES);
  loaded ??= load ? load().then((file) => (AI_PREVIEW ? masked(file) : file)) : Promise.resolve(null);
  return loaded;
}

// `pnpm dev:ai`: the page an AI agent looks at (screenshots, the DOM) never shows UmaTL's text, whose terms forbid
// its use with generative models (docs/data/umatl.md). Each fan translation becomes dots of its length, so layouts and
// marks still show; official names stay.
const AI_PREVIEW = import.meta.env.VITE_AI_PREVIEW === '1';
export const mask = (text: string): string => text.replace(/[^\s[\]]/g, '•');
export function masked(file: TranslationsFile): TranslationsFile {
  const texts = (record: Record<string, TlText>) =>
    Object.fromEntries(Object.entries(record).map(([key, t]) => [key, t.fan ? { ...t, en: mask(t.en) } : t]));
  return {
    cards: Object.fromEntries(Object.entries(file.cards).map(([key, title]) => [key, mask(title)])),
    trainees: texts(file.trainees),
    chars: texts(file.chars),
    events: texts(file.events),
    text: texts(file.text),
  };
}

// Which English a server's Japanese names show (Settings → Language): Global's official names, GameTora's, UmaTL's
// fan translations. With none, everything is as JP writes it (on Global too: japaneseEntries()).
export type Language = { server: Server; official: boolean; gametora: boolean; fan: boolean };
const LANGUAGES = {
  jp: { official: false, gametora: false, fan: false },
  official: { official: true, gametora: false, fan: false },
  all: { official: true, gametora: true, fan: true },
} as const;
export const languageOf = (server: Server, settings: Pick<Settings, 'fanTlGlobal' | 'jpNames'>): Language => ({
  server,
  ...LANGUAGES[server === 'gl' ? settings.fanTlGlobal : settings.jpNames],
});
export const translates = (language: Language): boolean => language.official || language.gametora || language.fan;
// Global's English names back to JP's.
export const toJapanese = (language: Language): boolean => language.server === 'gl' && !translates(language);

// Characters Global has (one of their cards is out there): their names on JP-only cards are Global's, not GameTora's.
const globalCharsOf = new WeakMap<CardsFile, Set<number>>();
const globalChars = (cards: CardsFile): Set<number> => {
  let chars = globalCharsOf.get(cards);
  if (!chars) {
    chars = new Set(Object.values(cards).flatMap((c) => (c.release.gl && c.charId != null ? [c.charId] : [])));
    globalCharsOf.set(cards, chars);
  }
  return chars;
};

// A card's English name or title, if the language shows it: Global's (the card, or for a name its character, is out
// there), else GameTora's.
export function cardEnglish(cards: CardsFile, id: number, part: 'name' | 'title', language: Language) {
  const card = cards[id];
  const en = card?.[part].en;
  if (!en) return undefined;
  const official =
    card.release.gl != null || (part === 'name' && card.charId != null && globalChars(cards).has(card.charId));
  return (official ? language.official : language.gametora) ? en : undefined;
}

export function useLanguage(server: Server): Language {
  const { fanTlGlobal, jpNames } = useSettings().settings;
  return useMemo(() => languageOf(server, { fanTlGlobal, jpNames }), [server, fanTlGlobal, jpNames]);
}

// null until loaded, and without the file.
export const useTranslations = (): TranslationsFile | null => useAsync(loadTranslations, []).data ?? null;

// A translation the language shows.
export const allowed = (text: TlText | undefined, language: Language): TlText | undefined =>
  text && (text.fan ? language.fan : language.official) ? text : undefined;
