// UI strings: every key the code asks for exists, every language has the same
// keys as English, and i18next fills placeholders, plurals, lists and <Trans>.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Trans } from 'react-i18next';
import en from '../src/i18n/en.json' with { type: 'json' };
import i18n, { lbName } from '../src/i18n/index.js';
import { COMBINED, STATS } from '../tierlist/index.js';
import { SERVERS } from '../src/servers.js';
import { CM_PHASES, EVENT_KINDS } from '../scripts/lib/events.js';
import { ja } from '../scripts/lib/news-lang/ja.js';
import { EVENT_GROUPS } from '../src/timeline/events.js';
import { LANE_GROUPS } from '../src/timeline/layout.js';

const I18N_DIR = new URL('../src/i18n/', import.meta.url);
const SRC_DIR = new URL('../src/', import.meta.url);
const t = i18n.t.bind(i18n);

// Leaf keys as dotted paths, with plural forms (days_one, days_other) folded
// into the key the code uses (days).
function leafKeys(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object'
      ? leafKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key.replace(/_(zero|one|two|few|many|other)$/, '')}`]
  );
}
const keys = new Set(leafKeys(en));

describe('catalogs', () => {
  for (const file of readdirSync(I18N_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
    it(`${file} has the same keys as en.json`, () => {
      const catalog = JSON.parse(readFileSync(new URL(file, I18N_DIR), 'utf8'));
      expect([...new Set(leafKeys(catalog))].sort()).toEqual([...keys].sort());
    });
  }

  it('has every literal key the code uses', () => {
    const sources = readdirSync(SRC_DIR, { recursive: true })
      .filter((f) => /\.jsx?$/.test(f))
      .map((f) => readFileSync(new URL(f, SRC_DIR), 'utf8'));
    const used = sources.flatMap((source) => [
      ...[...source.matchAll(/\bt\(\s*'([\w.]+)'/g)].map((m) => m[1]),
      ...[...source.matchAll(/i18nKey="([\w.]+)"/g)].map((m) => m[1]),
    ]);
    // App.jsx keeps tab labels as keys in its route table.
    const labels = [...readFileSync(new URL('App.jsx', SRC_DIR), 'utf8').matchAll(/label: '([\w.]+)'/g)].map(
      (m) => m[1]
    );
    expect(used.length).toBeGreaterThan(40);
    expect([...used, ...labels].filter((key) => !keys.has(key))).toEqual([]);
  });

  it('has a name for every key the code builds dynamically', () => {
    const dynamic = [
      ...STATS.map((s) => `stat.${s}`),
      ...Object.keys(SERVERS).map((s) => `server.${s}`),
      ...Object.keys(COMBINED).map((k) => `scenario.${k}`),
      ...['live', 'upcoming', 'ended', 'predicted', 'confirmed'].map((s) => `timeline.status.${s}`),
      ...['out', 'confirmed', 'predicted'].map((s) => `timeline.scenarioTag.${s}`),
      ...['barTitle', 'predictedBarTitle', 'confirmedBarTitle'].map((k) => `timeline.${k}`),
      ...['characters', 'cards'].map((k) => `timeline.kind.${k}`),
      ...['rerunOf', 'reheld', 'partOf'].map((k) => `timeline.relation.${k}`),
      ...['button', 'title', 'line'].map((k) => `timeline.mark.global.${k}`),
      ...['featuredTrainees', 'featuredCards', 'supportCards'].map((k) => `timeline.${k}`),
      ...LANE_GROUPS.map((g) => g.label),
      ...['out', 'confirmed', 'predicted'].map((s) => `scenarioPage.status.${s}`),
      'scenarioPage.link.gametora',
      ...['early', 'mid', 'late', 'month'].map((k) => `pullGuide.${k}`),
      ...['yes', 'no', 'free', 'whale', 'dolphin'].map((v) => `pullGuide.verdict.${v}`),
      ...['gametora', 'tierList', 'pullGuide'].flatMap((k) => [
        `settings.credit.${k}.name`,
        `settings.credit.${k}.description`,
      ]),
      ...['R', 'SR', 'SSR'].map((r) => `rarity.${r}`),
      ...EVENT_KINDS.map((k) => `events.kind.${k}`),
      ...EVENT_GROUPS.map(([k]) => `events.group.${k}`),
      ...CM_PHASES.map(([k]) => `events.phase.${k}`),
      ...ja.schedules.league_of_heroes.map(([k]) => `events.phase.${k}`),
    ];
    expect(dynamic.filter((key) => !keys.has(key))).toEqual([]);
  });
});

describe('i18next', () => {
  it('fills placeholders', () => {
    expect(t('card.notReleased', { server: 'Global' })).toBe('Not released on Global yet.');
  });

  it('picks plural forms by count', () => {
    expect(t('timeline.days', { count: 1 })).toBe('1 day');
    expect(t('timeline.days', { count: 7 })).toBe('7 days');
  });

  it('formats lists', () => {
    expect(t('card.averages', { name: 'Overall', scenarios: ['GL', 'GM', 'URA'] })).toBe(
      'Overall averages GL, GM, and URA.'
    );
  });

  it('renders <Trans> tags as elements', () => {
    const html = renderToStaticMarkup(
      <Trans
        i18nKey="card.historySummary"
        values={{ date: 'Jun 26, 2025', start: 3, startTotal: 18, now: 13, nowTotal: 48 }}
        components={{ strong: <strong /> }}
      />
    );
    expect(html).toBe('Released Jun 26, 2025 at <strong>#3</strong> of 18; now <strong>#13</strong> of 48.');
  });

  it('labels LB4 as MLB', () => {
    expect([0, 3, 4].map(lbName)).toEqual(['LB0', 'LB3', 'MLB']);
  });
});
