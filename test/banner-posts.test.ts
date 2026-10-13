import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bannerPost } from '../scripts/lib/banner-posts.ts';
import { postsFile } from '../scripts/lib/news-api.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import { fixture, present } from './helpers.ts';

const art = (id: number) =>
  `<figure><img src="https://example.com/uploads/Header/gacha_banner_${id}_L1791410400.png?c=1&amp;x=2"></figure>`;
const h2 = (text: string) => `<h2 class="heading"> ${text}</h2>\n`;

// Post 1089, trimmed.
const SPOTLIGHT = [
  ' As of 10:00 p.m., Oct 7, 2026 (UTC), a new Spotlight Pretty Derby Scout and Spotlight Support Card Scout have begun!<br>\n',
  h2('Spotlight Scout Availability Period'),
  ' 10:00 p.m., Oct 7–9:59 p.m., Oct 15, 2026 (UTC)<br>\n',
  h2('Trainee Umamusume'),
  art(30134),
  ' ■ Debut Trainee Umamusume (Spotlight)<br>\n ★★★ [Heroic Author] Zenno Rob Roy<br>\n<br>\n',
  ' ■ Spotlight Trainee Umamusume<br>\n ★★★ [Heroic Author] Zenno Rob Roy<br>\n',
  h2('Support Cards'),
  art(30135),
  ' ■ Support Cards（Spotlight）<br>\n • SSR [From the Ground Up] Light Hello<br>\n',
  ' • SSR [Party Formation] Mayano Top Gun<br>\n',
  h2('Umamusume Story Sneak Peek'),
  ' To celebrate the new arrival of [Heroic Author] Zenno Rob Roy, episodes 1 through 4…<br>\n',
  h2('Umamusume Story Sneak Peek Period'),
  ' 10:00 p.m., Oct 7–9:59 p.m., Oct 22, 2026 (UTC)<br>\n',
].join('');

const post = (message: string, { id = 1089, posted = '2026-10-07 22:00:00' } = {}) =>
  fixture<NewsPost>({
    announce_id: id,
    title: 'Spotlight Pretty Derby and Spotlight Support Card Scouts out now!',
    message,
    post_at: posted,
  });

describe('bannerPost', () => {
  it('reads each banner: type, scout period, art and its own list (each entry once)', () => {
    expect(bannerPost(post(SPOTLIGHT))).toEqual({
      id: 1089,
      url: 'https://umamusume.com/news/1089/',
      posted: '2026-10-07T22:00:00Z',
      paid: false,
      banners: [
        {
          gachaId: 30134,
          type: 'character',
          start: '2026-10-07T22:00:00.000Z',
          end: '2026-10-15T21:59:00.000Z',
          image: 'https://example.com/uploads/Header/gacha_banner_30134_L1791410400.png?c=1&x=2',
          featured: [{ stars: 3, title: 'Heroic Author', name: 'Zenno Rob Roy' }],
        },
        {
          gachaId: 30135,
          type: 'support',
          start: '2026-10-07T22:00:00.000Z',
          end: '2026-10-15T21:59:00.000Z',
          image: 'https://example.com/uploads/Header/gacha_banner_30135_L1791410400.png?c=1&x=2',
          featured: [
            { rarity: 'SSR', title: 'From the Ground Up', name: 'Light Hello' },
            { rarity: 'SSR', title: 'Party Formation', name: 'Mayano Top Gun' },
          ],
        },
      ],
    });
  });

  it('is null for posts without banner art', () => {
    expect(bannerPost(post('<h2>Support Cards</h2> ■ SSR [Run Forth!] Oguri Cap<br>'))).toBeNull();
  });

  it("takes the post's first period when none is a scout period, and open-ended ones", () => {
    const message = `${h2('Availability Period')} Jun 26, 2025 (UTC) onwards<br>${h2('Trainee Umamusume')}${art(50001)}`;
    const [banner] = present(
      bannerPost(post(message, { id: 122, posted: '2025-06-26 00:30:00' })),
      'scout post'
    ).banners;
    expect(banner).toMatchObject({ gachaId: 50001, start: '2025-06-26T00:00:00.000Z', end: null, featured: [] });
  });

  it('carries a period over the new year', () => {
    const message = `${h2('Spotlight Scout Availability Period')} 10:00 p.m., Dec 28–9:59 p.m., Jan 5, 2027 (UTC)<br>${h2('Support Cards')}${art(1)}`;
    const [banner] = present(bannerPost(post(message, { posted: '2026-12-27 22:00:00' })), 'scout post').banners;
    expect([banner.start, banner.end]).toEqual(['2026-12-28T22:00:00.000Z', '2027-01-05T21:59:00.000Z']);
  });

  it('flags scouts paid with paid carats', () => {
    const message = ` A scout can be performed at the cost of 1,500 paid carats.<br>${h2('Trainee Umamusume')}${art(50009)}`;
    expect(present(bannerPost(post(message)), 'scout post').paid).toBe(true);
  });
});

describe.skipIf(!existsSync(postsFile('gl')))('the stored news', () => {
  const posts: NewsPost[] = JSON.parse(readFileSync(postsFile('gl'), 'utf8'));
  const banners = posts.map((post) => bannerPost(post)).filter((scout) => scout !== null);

  it('types and dates every banner', () => {
    expect(banners.length).toBeGreaterThan(0);
    for (const { id, banners: list } of banners)
      for (const b of list)
        expect({ id, gachaId: b.gachaId, type: b.type, start: Boolean(b.start) }).toMatchObject({
          type: expect.stringMatching(/^(character|support)$/),
          start: true,
        });
  });

  // Except a scout of the whole pool ("features Trainee Umamusume introduced up to Jan 29, 2026"), which lists nothing.
  it('lists what every regular scout features', () => {
    const pool = new Set(
      posts
        .filter((p) => /features (?:Trainee Umamusume|Support Cards) introduced up to/i.test(p.message))
        .map((p) => Number(p.announce_id))
    );
    for (const { id, paid, banners: list } of banners)
      if (!paid)
        for (const b of list)
          if (!pool.has(id)) expect({ id, gachaId: b.gachaId, n: b.featured.length > 0 }).toMatchObject({ n: true });
  });
});
