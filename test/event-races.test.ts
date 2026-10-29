import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockRaces, raceConditions } from '../scripts/lib/event-races.ts';
import { eventBlocks, joinBlocks } from '../scripts/lib/event-blocks.ts';
import { buildEvents } from '../scripts/lib/events.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import { en, ja } from '../scripts/lib/news-lang/index.ts';
import { GENERATED_DIR } from '../scripts/lib/paths.ts';
import type { Block, Lexicon } from '../scripts/lib/news-lang/index.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { NewsPost } from '../shared/schemas/news.ts';

const block = (...sections: [string, ...string[]][]): Block => ({
  art: null,
  artId: null,
  intro: [],
  sections: sections.map(([heading, ...lines]) => ({ heading, lines })),
});
const RACE = {
  name: null,
  opponent: null,
  surface: null,
  distance: null,
  category: null,
  direction: null,
  course: null,
  season: null,
  weather: null,
  ground: null,
  time: null,
  variable: false,
};

describe('race conditions', () => {
  it("reads a Champions Meeting's line", () => {
    const races = blockRaces(
      block(['Race Conditions', 'Nakayama / Turf / 2,500m (Long) / Right-Handed / Inner / Winter / Cloudy / Good']),
      en
    );
    expect(races).toEqual([
      {
        ...RACE,
        track: 'nakayama',
        surface: 'turf',
        distance: 2500,
        category: 'long',
        direction: 'right',
        course: 'inner',
        season: 'winter',
        weather: 'cloudy',
        ground: 'good',
      },
    ]);
  });

  it('reads older wordings, and works out a missing distance category', () => {
    const { fields, unknown } = raceConditions(
      'Kyoto / Turf / 3000 m / Right-handed / Outer→Inner / Fall / Weather: Rain / Turf: Soft',
      en.race
    );
    expect(unknown).toEqual([]);
    expect(fields).toMatchObject({ distance: 3000, course: 'outer_to_inner', season: 'autumn', weather: 'rainy' });
    expect(fields.ground).toBe('soft');
    expect(blockRaces(block(['Race Condition', 'Tokyo / Turf / 1600 m / Left-Handed']), en)[0].category).toBe('mile');
  });

  it('reads a line the post breaks after a slash as one (Capricorn Cup 2026)', () => {
    const [race] = blockRaces(
      block(['Race Conditions', 'Chukyo / Turf / 1,200m (Sprint) / Left-Handed / Winter /', 'Sunny / Firm']),
      en
    );
    expect(race).toMatchObject({ track: 'chukyo', distance: 1200, season: 'winter', weather: 'sunny', ground: 'firm' });
  });

  it("splits a Legend Race by opponent when their weather differs, keeping the race's name", () => {
    const races = blockRaces(
      block(
        ['Race Conditions', 'Sprinters Stakes / Nakayama / Turf / 1,200m (Sprint) / Right-Handed / Outer / Fall'],
        ['Weather / Track Condition', '• Nishino Flower: Cloudy / Firm', '• Hishi Akebono: Sunny / Firm']
      ),
      en
    );
    expect(races.map((r) => [r.name, r.opponent, r.track, r.weather, r.ground])).toEqual([
      ['Sprinters Stakes', 'Nishino Flower', 'nakayama', 'cloudy', 'firm'],
      ['Sprinters Stakes', 'Hishi Akebono', 'nakayama', 'sunny', 'firm'],
    ]);
  });

  it("lists Dream Team's racecourses, with the season they share", () => {
    const races = blockRaces(
      block([
        'Race Conditions',
        'Racecourse: Tokyo, Nakayama',
        'Season: Fall',
        'Race conditions other than the season are variable and change every three races entered.',
      ]),
      en
    );
    expect(races).toEqual([
      { ...RACE, track: 'tokyo', season: 'autumn', variable: true },
      { ...RACE, track: 'nakayama', season: 'autumn', variable: true },
    ]);
  });

  it('reads JP lines: time of day, a named race in brackets, one race per line, Global names', () => {
    const [cup] = blockRaces(block(['対象レース', 'ロンシャン 芝 2400m（中距離） 右 秋 晴 不良 昼']), ja);
    expect(cup).toMatchObject({ track: 'longchamp', category: 'medium', ground: 'heavy', time: 'day' });
    const races = blockRaces(
      block([
        '対象レース',
        '天皇賞（春） 京都 芝 3200m（長距離） 右・外 春 晴 良 昼',
        '天皇賞（春） 阪神 芝 3200m（長距離） 右・外→内 春 曇 稍重 昼',
      ]),
      ja
    );
    expect(races.map((r) => [r.name, r.track, r.course, r.ground])).toEqual([
      ['Tenno Sho (Spring)', 'kyoto', 'outer', 'firm'],
      ['Tenno Sho (Spring)', 'hanshin', 'outer_to_inner', 'good'],
    ]);
    const names = new Map([['バンブーメモリー', 'Bamboo Memory']]);
    const split = blockRaces(
      block(
        ['対象レース', 'スワンステークス 京都 芝 1400m（短距離） 右・外 秋'],
        ['天候・バ場・時間帯', '・VSバンブーメモリー：晴 良 昼', '・VSケイエスミラクル：曇 良 昼']
      ),
      ja,
      names
    );
    expect(split.map((r) => [r.name, r.opponent, r.weather])).toEqual([
      ['Swan Stakes', 'Bamboo Memory', 'sunny'],
      ['Swan Stakes', 'ケイエスミラクル', 'cloudy'],
    ]);
  });

  it("marks a League of Heroes' weather and ground as random", () => {
    const [race] = blockRaces(
      block(['対象レース', '新潟 芝 1000m（短距離）直線 夏 昼', '※天候とバ場状態はランダムに決定します。']),
      ja
    );
    expect(race).toMatchObject({ direction: 'straight', distance: 1000, variable: true, weather: null });
  });
});

const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));
const cardsFile = `${GENERATED_DIR}cards.json`;
const cards: CardsFile = existsSync(cardsFile) ? read<CardsFile>(cardsFile) : {};

describe.each([
  ['gl', en],
  ['jp', ja],
] as [string, Lexicon][])('the stored %s news', { tags: ['data'] }, (server, lang) => {
  const file = postsFile(server as 'gl' | 'jp');
  it.skipIf(!existsSync(file))('knows every word of every race line, and every race name', () => {
    const unknown = new Set<string>();
    for (const post of read<NewsPost[]>(file)) {
      const whole = joinBlocks(eventBlocks(post, lang));
      for (const section of whole.sections.filter((s) => lang.race.heading.test(s.heading)))
        for (const line of section.lines.filter((l) => /\dm/.test(l))) {
          const c = raceConditions(line, lang.race);
          for (const w of c.unknown) unknown.add(w);
          if (c.name && lang.race.name && !lang.race.name(c.name)) unknown.add(c.name);
        }
    }
    expect([...unknown]).toEqual([]);
  });

  it.skipIf(!existsSync(file))('gives every news Champions Meeting, Legend Race and League of Heroes its races', () => {
    const events = buildEvents(read<NewsPost[]>(file), { cards, lang });
    const missing = events.filter(
      (e) => ['champions_meeting', 'legend_race', 'league_of_heroes'].includes(e.kind) && !e.races?.length
    );
    expect(missing.map((e) => e.id)).toEqual([]);
  });
});
