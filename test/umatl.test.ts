import { describe, expect, it } from 'vitest';
import { type TranslationInputs, buildTranslations, cleanText } from '../scripts/lib/umatl.ts';
import { type JapaneseNames, japaneseEntries, translateEntries } from '../src/timeline/translate.ts';
import { cardEnglish, type Language, languageOf } from '../src/translations.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { Entry, Featured } from '../src/timeline/entries.ts';
import type { TranslationsFile } from '../shared/schemas/translations.ts';
import { fixture } from './helpers.ts';

const cards = fixture<CardsFile>({
  30001: {
    charId: 1001,
    name: { en: 'Special Week', jp: 'スペシャルウィーク' },
    title: { en: null, jp: '[夕焼け]' },
    release: { gl: null, jp: { date: '2024-01-01' } },
  },
  30002: {
    charId: 1001,
    name: { en: 'Special Week', jp: 'スペシャルウィーク' },
    title: { en: '[Official]', jp: '[公式]' },
    release: { gl: { date: '2025-01-01' }, jp: { date: '2023-01-01' } },
  },
  30003: {
    charId: 1003,
    name: { en: 'Tokai Teio', jp: 'トウカイテイオー' },
    title: { en: null, jp: '[全名だけ]' },
    release: { gl: null, jp: { date: '2024-01-01' } },
  },
  30004: {
    charId: 1004,
    name: { en: 'Gametora Name', jp: '未発表' },
    title: { en: '[Gametora Title]', jp: '[題名]' },
    release: { gl: null, jp: { date: '2024-01-01' } },
  },
});
const story = (id: string, name: string, start: string, more = {}) => ({
  id,
  kind: 'story',
  name,
  parent: null,
  start: { date: start },
  items: [],
  titles: [],
  ...more,
});

const input = (more: Partial<TranslationInputs> = {}): TranslationInputs =>
  fixture<TranslationInputs>({
    umatl: {
      text_data: {
        5: { 100101: '[Fan Outfit One]', 100102: '[Fan Outfit Two]' },
        6: { 1001: 'Special Wiik', 1099: 'New Girl' },
        75: { 30003: '[Only In Full] Tokai Teio' },
        76: { 30001: '[Sunset\nColours]', 30002: '[Fan Title]' },
        189: { 1046: 'Fan Story Title' },
      },
      mdb: {
        'trainer-title': { ピスケス杯ゴールド: 'Fan Cup Title' },
        'gacha-names': { 'SSR確定 ガチャ': '$(scale 90)Guaranteed SSR Gacha' },
        'event-titles': { ジュエル3000個: 'Should not apply to items' },
      },
    },
    cards,
    jpBanners: {
      characters: [
        { name: null, featured: [{ id: 100102, char_id: 1001, title: '[ほっぴん]', name: 'スペシャルウィーク' }] },
      ],
      cards: [{ name: 'SSR確定ガチャ', featured: [] }],
    },
    globalBanners: {
      characters: [{ featured: [{ id: 100101, char_id: 1001, title: '[Official Outfit]', name: 'Special Week' }] }],
      cards: [],
    },
    jpEvents: [
      story('3480', 'サマーデイズ', '2026-07-01T03:00:00.000Z', {
        items: [{ name: 'ジュエル3000個' }, { name: '[ほっぴん]スペシャルウィークのピース' }],
        titles: ['ピスケス杯ゴールド'],
      }),
      story('3500', '別の物語', '2026-08-01T03:00:00.000Z'),
      { ...story('3600', 'タウラス杯', '2026-09-01T03:00:00.000Z'), kind: 'champions_meeting' },
      { ...story('3700', 'タウラス杯', '2027-09-01T03:00:00.000Z'), kind: 'champions_meeting' },
    ],
    globalEvents: [
      { id: '900', name: 'Another Story' },
      { id: '901', name: 'Taurus Cup' },
    ],
    pairs: [
      { gl: '900', jp: '3500' },
      { gl: '901', jp: '3600' },
    ],
    gametoraEvents: { story: [{ id: 1046, start_ja: Date.parse('2026-07-01T03:00:00.000Z') / 1000 }] },
    gametoraTrainees: [],
    ...more,
  });

describe('buildTranslations', () => {
  const { file } = buildTranslations(input());

  it("fills only the card titles nobody else translates, from UmaTL's full name if need be", () => {
    expect(file.cards).toEqual({ 30001: '[Sunset Colours]', 30003: '[Only In Full]' });
  });

  it("prefers Global's and GameTora's names over UmaTL's", () => {
    expect(file.trainees[100101]).toEqual({ en: '[Official Outfit]', fan: false });
    expect(file.trainees[100102]).toEqual({ en: '[Fan Outfit Two]', fan: true });
    expect(file.chars[1001]).toEqual({ en: 'Special Week', fan: false });
    expect(file.chars[1099]).toEqual({ en: 'New Girl', fan: true });
    // GameTora's names stay in the card data, below Global's.
    expect(file.chars[1004]).toBeUndefined();
  });

  it("names a story event by its game id, a paired one by Global's, and its JP name's other events alike", () => {
    expect(file.events).toEqual({
      3480: { en: 'Fan Story Title', fan: true },
      3500: { en: 'Another Story', fan: false },
      3600: { en: 'Taurus Cup', fan: false },
      3700: { en: 'Taurus Cup', fan: false },
    });
  });

  it('translates titles, banner names and pieces by their text, never with event names', () => {
    expect(file.text).toEqual({
      ピスケス杯ゴールド: { en: 'Fan Cup Title', fan: true },
      SSR確定ガチャ: { en: 'Guaranteed SSR Gacha', fan: true },
      '[ほっぴん]スペシャルウィークのピース': { en: "[Fan Outfit Two] Special Week's Piece", fan: true },
    });
  });

  it("drops the game's layout from UmaTL's text", () => {
    expect(cleanText('$(nb)$(scale 75)Made <color=#f00>Up</color> Words \\n～And More～')).toBe(
      'Made Up Words ～And More～'
    );
  });
});

describe('translateEntries', () => {
  const tl = fixture<TranslationsFile>({
    cards: { 30001: '[Sunset Colours]' },
    trainees: {},
    chars: {},
    events: { 3480: { en: 'Fan Story Title', fan: true }, 3500: { en: 'Another Story', fan: false } },
    text: { ピスケス杯ゴールド: { en: 'Fan Cup Title', fan: true } },
  });
  const event = (id: string, name: string, more = {}) =>
    fixture<Entry>({
      id,
      group: 'event',
      name,
      main: null,
      featured: [],
      items: [],
      titles: [],
      ...more,
    });
  const entries = [
    event('3480', 'サマーデイズ', {
      featured: [
        { id: 30001, card: true, name: 'スペシャルウィーク', title: '[夕焼け]' },
        { id: 30004, card: true, name: '未発表', title: '[題名]' },
      ],
      titles: ['ピスケス杯ゴールド'],
    }),
    event('3500', '別の物語'),
    event('3600', '訳なし'),
  ];
  const all = languageOf('jp', { fanTlGlobal: 'all', jpNames: 'all' });
  const run = (language: Language) => translateEntries(entries, { tl, language, cards, server: language.server });

  it('leaves Japanese names alone as JP writes them', () => {
    expect(run(languageOf('jp', { fanTlGlobal: 'all', jpNames: 'jp' }))).toBe(entries);
    expect(run(languageOf('gl', { fanTlGlobal: 'jp', jpNames: 'all' }))).toBe(entries);
  });

  it('marks fan translations, keeps the originals for the search, flags what stays Japanese', () => {
    const [summer, other, none] = run(all);
    expect(summer).toMatchObject({
      name: 'Fan Story Title',
      featured: [
        { name: 'Special Week', title: '[Sunset Colours]' },
        { name: 'Gametora Name', title: '[Gametora Title]' },
      ],
      titles: ['Fan Cup Title'],
      untranslated: false,
    });
    expect([...(summer?.fan ?? [])]).toEqual(['[Sunset Colours]', 'Fan Story Title', 'Fan Cup Title']);
    expect(summer?.originals).toContain('サマーデイズ');
    expect(other).toMatchObject({ name: 'Another Story', untranslated: false });
    expect(other?.fan.size).toBe(0);
    expect(none).toMatchObject({ name: '訳なし', untranslated: true });
  });

  it("shows only Global's official names, not GameTora's or UmaTL's", () => {
    for (const language of [
      languageOf('gl', { fanTlGlobal: 'official', jpNames: 'jp' }),
      languageOf('jp', { fanTlGlobal: 'all', jpNames: 'official' }),
    ]) {
      const [summer, other] = run(language);
      expect(summer).toMatchObject({
        name: 'サマーデイズ',
        featured: [
          { name: 'Special Week', title: '[夕焼け]' },
          { name: '未発表', title: '[題名]' },
        ],
      });
      // (Global reads JP's event ids only on its predicted events, see below.)
      expect(other?.name).toBe(language.server === 'jp' ? 'Another Story' : '別の物語');
    }
  });

  it("reads JP's event ids on Global only from its predicted events", () => {
    const global = translateEntries([event('3500', '別の物語'), event('jp-3500', '別の物語')], {
      tl,
      language: { ...all, server: 'gl' },
      cards,
      server: 'gl',
    });
    expect(global.map((e) => e.name)).toEqual(['別の物語', 'Another Story']);
  });

  it("names cards: Global's official English, else GameTora's, as the language allows", () => {
    const official = languageOf('jp', { fanTlGlobal: 'all', jpNames: 'official' });
    expect(cardEnglish(cards, 30002, 'title', languageOf('gl', { fanTlGlobal: 'jp', jpNames: 'all' }))).toBeUndefined();
    expect(cardEnglish(cards, 30002, 'title', official)).toBe('[Official]');
    // A JP-only card of a character Global has: Global's name, not its title.
    expect(cardEnglish(cards, 30001, 'name', official)).toBe('Special Week');
    expect(cardEnglish(cards, 30001, 'title', official)).toBeUndefined();
    expect(cardEnglish(cards, 30004, 'name', official)).toBeUndefined();
    expect(cardEnglish(cards, 30004, 'name', all)).toBe('Gametora Name');
  });
});

describe('japaneseEntries', () => {
  const entry = (id: string, group: 'event' | 'characters', name: string, featured: Partial<Featured>[]) =>
    fixture<Entry>({ id, group, name, main: { name: featured[0]?.name ?? '', others: 0 }, featured });
  const jp: JapaneseNames = {
    cards,
    banners: new Map([['77', 'ガチャ名']]),
    trainees: new Map([[100101, { name: 'スペシャルウィーク', title: '[衣装]' }]]),
    events: new Map([['900', '別の物語']]),
  };

  it("names Global's banners, trainees, cards and paired events as JP does, keeping the English for the search", () => {
    const [banner, event, unpaired] = japaneseEntries(
      [
        entry('77', 'characters', 'Pick Up', [{ id: 100101, card: false, name: 'Special Week', title: '[Outfit]' }]),
        entry('900', 'event', 'Another Story', [{ id: 30002, card: true, name: 'Special Week', title: '[Official]' }]),
        entry('901', 'event', 'Global Only', []),
      ],
      jp
    );
    expect(banner).toMatchObject({
      name: 'ガチャ名',
      main: { name: 'スペシャルウィーク' },
      featured: [{ name: 'スペシャルウィーク', title: '[衣装]' }],
    });
    expect(banner?.originals).toEqual(['Special Week', '[Outfit]', 'Pick Up']);
    expect(event).toMatchObject({ name: '別の物語', featured: [{ name: 'スペシャルウィーク', title: '[公式]' }] });
    expect(unpaired?.name).toBe('Global Only');
  });
});
