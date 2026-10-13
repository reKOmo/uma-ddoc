// Career scenario launches: parsing them from the news, GameTora's records, applying the news to
// Global's (scripts/lib/news.js, scripts/lib/scenarios.js).

import { describe, it, expect } from 'vitest';
import { scenarioPost } from '../scripts/lib/news.ts';
import { applyJpScenarioNews, applyScenarioNews, mergeGametora, retag } from '../scripts/lib/scenarios.ts';
import type { ScenarioMention } from '../scripts/lib/news.ts';
import type { GametoraScenario, ScenarioDraft } from '../scripts/lib/scenarios.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import type { StartDate } from '../shared/schemas/scenario.ts';
import { fixture, present } from './helpers.ts';

// (a post with the fields the scenario parsers read)
const post = (id: number, posted: string, title: string, lines: string[]) =>
  fixture<NewsPost>({
    announce_id: id,
    title,
    post_at: posted,
    announce_label: 1,
    message: lines.join('<br>\n'),
  });

describe('scenario mentions in the news', () => {
  it('reads the name, and the start only when the sentence says it is added', () => {
    const record = scenarioPost(
      post(904, '2026-07-21 22:00:00', 'Check out all the latest updates!', [
        'New Career Scenario info!',
        'A new career scenario, titled "Brighter Together! Our Grand Concert," will be added to the game at 10:00 p.m., Jul 22, 2026 (UTC)!',
      ])
    );
    expect(present(record, 'record').scenarios).toEqual([
      { full: 'Brighter Together! Our Grand Concert', start: '2026-07-22T22:00:00.000Z' },
    ]);
  });

  it('keeps "!" in names, and dates nothing in a campaign post', () => {
    const record = scenarioPost(
      post(200006, '2025-11-06 08:00:00', 'Unity Cup Celebration Event', [
        'To celebrate the release of the new "Unity Cup: Shine On, Team Spirit!" Career Scenario, we\'re holding a giveaway.',
      ])
    );
    expect(present(record, 'record').scenarios).toEqual([{ full: 'Unity Cup: Shine On, Team Spirit!', start: null }]);
  });

  it('ignores "scenario" anywhere else', () => {
    const record = scenarioPost(
      post(155, '2025-06-26 00:30:00', 'List of Known Issues', [
        '• In the Career Scenario "Unity Cup: Shine On, Team Spirit!", the game may freeze.',
        'New Career Scenario Celebration Support Card Scout',
      ])
    );
    expect(present(record, 'record').scenarios).toEqual([]);
  });
});

// (GameTora's scenario records, with the fields mergeGametora() reads)
const raw = (url_name: string, start_ja: number, extra: Record<string, unknown> = {}) =>
  fixture<GametoraScenario>({ url_name, name_ja: `JP ${url_name}`, start_ja, ...extra });
const GT = 'https://gametora.com/umamusume/';
const GAMETORA = [
  raw('our-grand-concert', 1661310000, { name_en: 'Brighter Together Our Grand Concert', start_en: 1784757600 }),
  raw('grand-masters', 1677207600, { name_en: 'Grandmasters Legacies Immortal' }),
  raw('project-larc', 1692846000),
];
const iso = (s: number) => new Date(s * 1000).toISOString();
const NOW = Date.parse('2026-10-08T00:00:00Z');
const out = (date: string): StartDate => ({ date, tag: 'out' });
const PREDICTED_GM: StartDate = {
  date: '2026-11-25T22:00:00.000Z',
  tag: 'predicted',
  lo: '2026-11-21',
  hi: '2026-11-29',
};

describe('mergeGametora', () => {
  it("adds JP's scenarios with key, name, tagged JP launch and link; never Global's launch", () => {
    const merged = mergeGametora([], GAMETORA, { now: NOW });
    const row = (s: ScenarioDraft) => [s.key, s.full_en, s.full_jp, s.en_start_date, s.jp_start_date, s.links.gametora];
    expect(merged.map(row)).toEqual([
      [
        'GL',
        'Brighter Together Our Grand Concert',
        'JP our-grand-concert',
        null,
        out(iso(1661310000)),
        `${GT}our-grand-concert`,
      ],
      ['GM', 'Grandmasters Legacies Immortal', 'JP grand-masters', null, out(iso(1677207600)), `${GT}grand-masters`],
      ['LArc', null, 'JP project-larc', null, out(iso(1692846000)), `${GT}project-larc`],
    ]);
  });

  it("keeps our names and Global launches, takes GameTora's English once it has one", () => {
    const ours = mergeGametora([], GAMETORA, { now: NOW }).map((s) =>
      s.key === 'GL'
        ? { ...s, full_en: 'Brighter Together! Our Grand Concert', en_start_date: out('2026-07-22T22:00:00.000Z') }
        : s
    );
    const translated = GAMETORA.map((r) => (r.url_name === 'project-larc' ? { ...r, name_en: "Project L'Arc" } : r));
    const merged = mergeGametora(ours, translated, { now: NOW });
    expect(merged[0].full_en).toBe('Brighter Together! Our Grand Concert');
    expect(merged[0].en_start_date).toEqual(out('2026-07-22T22:00:00.000Z'));
    expect(merged[2]).toMatchObject({ full_en: "Project L'Arc", full_jp: 'JP project-larc' });
  });
});

describe('applyScenarioNews', () => {
  const news = (id: number, posted: string, scenarios: ScenarioMention[]) => ({
    id,
    url: `https://umamusume.com/news/${id}/`,
    posted,
    scenarios,
  });
  const base = mergeGametora([], GAMETORA, { now: NOW }).map((s) => {
    if (s.key === 'GL') return { ...s, en_start_date: out('2026-07-22T22:00:00.000Z') };
    if (s.key === 'GM') return { ...s, en_start_date: PREDICTED_GM };
    return s;
  });

  it('gives a known scenario its official name; a dated mention wins over later undated ones', () => {
    const { scenarios, changed } = applyScenarioNews({
      posts: [
        news(904, '2026-07-21', [{ full: 'Brighter Together! Our Grand Concert', start: '2026-07-22T22:00:00.000Z' }]),
        news(200013, '2026-07-23', [{ full: 'Brighter Together: Our Grand Concert', start: null }]),
      ],
      scenarios: base,
      now: NOW,
    });
    expect(scenarios[0].full_en).toBe('Brighter Together! Our Grand Concert');
    expect(changed.map((s) => s.key)).toEqual(['GL']);
  });

  it('links the post that dates the launch (umapyoi.net has a copy), not an undated mention', () => {
    const { scenarios } = applyScenarioNews({
      posts: [
        news(903, '2026-07-01', [{ full: 'Brighter Together! Our Grand Concert', start: null }]),
        news(904, '2026-07-21', [{ full: 'Brighter Together! Our Grand Concert', start: '2026-07-22T22:00:00.000Z' }]),
      ],
      scenarios: base,
      now: NOW,
    });
    expect(scenarios[0].links.umapyoi_gl).toBe(904);
  });

  it("names Global's next scenario: by name, else JP's next one; a date replaces the prediction", () => {
    const named = applyScenarioNews({
      posts: [news(1200, '2026-12-01', [{ full: 'Grandmasters: Legacies Immortal', start: null }])],
      scenarios: base,
      now: NOW,
    }).scenarios;
    // Undated: named, still predicted.
    expect(named[1]).toMatchObject({
      key: 'GM',
      full_en: 'Grandmasters: Legacies Immortal',
      en_start_date: PREDICTED_GM,
    });

    const dated = applyScenarioNews({
      posts: [news(1201, '2026-12-02', [{ full: 'Some New Official Name', start: '2027-01-10T22:00:00.000Z' }])],
      scenarios: base,
      now: NOW,
    }).scenarios;
    expect(dated[1]).toMatchObject({
      key: 'GM',
      full_en: 'Some New Official Name',
      en_start_date: { date: '2027-01-10T22:00:00.000Z', tag: 'confirmed' },
    });
  });
});

describe('applyJpScenarioNews', () => {
  const post = (id: number, title: string) =>
    fixture<NewsPost>({
      announce_id: id,
      announce_label: 1,
      title,
      message: '',
      post_at: '2026-06-29 12:00:00',
    });
  // (a scenario with the fields the JP news is matched against)
  const scenario = (key: string, full_jp: string) =>
    fixture<ScenarioDraft>({ key, full_jp, links: { gametora: `https://gametora.com/umamusume/${key}` } });

  it("links JP's launch post by the Japanese name, however it's spaced; leaves others alone", () => {
    const { scenarios, unmatched } = applyJpScenarioNews({
      posts: [
        post(3306, '育成シナリオ「らっしゃい！トレセン軒！ ～恩返し、始めました～」公開！'),
        post(3300, '育成シナリオ「らっしゃい！トレセン軒！ ～恩返し、始めました～」の不具合について'),
        post(3400, '育成シナリオ「まだない名前」公開！'),
      ],
      scenarios: [
        scenario('TracenKen', 'らっしゃい！トレセン軒！～恩返し、始めました～'),
        scenario('BD', 'Beyond Dreams'),
      ],
    });
    expect(scenarios.map((s) => s.links.umapyoi_jp)).toEqual([3306, undefined]);
    expect(unmatched).toEqual(['まだない名前']);
  });
});

describe('covers', () => {
  it("links each scenario's GameTora key art as its cover", () => {
    const merged = mergeGametora([], [{ ...GAMETORA[0], id: 3 }], { now: NOW });
    expect(merged[0].links).toEqual({
      gametora: `${GT}our-grand-concert`,
      cover: 'https://media.gametora.com/umamusume/scenarios/hero/3.png',
    });
    expect(merged[0].color).toBeNull(); // filled by fillColors
  });
});

describe('retag', () => {
  it('turns a confirmed date out once it has passed, and leaves predictions alone', () => {
    const scenario = fixture<ScenarioDraft>({
      key: 'GM',
      en_start_date: { date: '2027-01-10T22:00:00.000Z', tag: 'confirmed' },
      jp_start_date: PREDICTED_GM,
    });
    const [later] = retag([scenario], Date.parse('2027-01-11T00:00:00Z'));
    expect(present(later.en_start_date, 'launch').tag).toBe('out');
    expect(later.jp_start_date).toBe(PREDICTED_GM);
  });
});
