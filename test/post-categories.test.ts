import { describe, expect, it } from 'vitest';
import { categorize, plain } from '../scripts/lib/post-categories.ts';
import type { NewsPost } from '../shared/schemas/news.ts';
import { fixture } from './helpers.ts';

type PostOptions = { id?: number; message?: string };
const post = (title: string, { id = 1000, message = '' }: PostOptions = {}) =>
  fixture<NewsPost>({ announce_id: id, title, message });
const art = (id: number) =>
  `<figure><img src="https://example.com/uploads/Header/gacha_banner_${id}_L1791410400.png?c=1"></figure>`;
const of = (title: string, options?: PostOptions) => {
  const { category, kind, phase, name } = categorize(post(title, options));
  return { category, kind, phase, name };
};

describe('categorize', () => {
  it('finds scout banners and types them by their heading', () => {
    const message = `<h2 class="heading"> Trainee Umamusume</h2>${art(30134)} ★★★ [Heroic Author] Zenno Rob Roy
      <h2 class="heading"> Support Cards</h2>${art(30135)} • SSR [Party Formation] Mayano Top Gun`;
    const c = categorize(post('Spotlight Pretty Derby and Spotlight Support Card Scouts out now!', { message }));
    expect(c).toMatchObject({ category: 'banner', kind: null, phase: 'started' });
    expect(c.banners).toEqual([
      { gachaId: 30134, type: 'character' },
      { gachaId: 30135, type: 'support' },
    ]);
    expect(categorize(post('New … Scouts coming soon!', { message })).phase).toBe('announced');
  });

  it('names story events, quoted or not', () => {
    expect(of('The story event "Hark Back, Run Forward" has ended!')).toEqual({
      category: 'event',
      kind: 'story',
      phase: 'ended',
      name: 'Hark Back, Run Forward',
    });
    expect(of('The story event Illuminate the Heart is coming soon!')).toMatchObject({
      kind: 'story',
      phase: 'announced',
      name: 'Illuminate the Heart',
    });
  });

  it('tells Champions Meeting phases apart', () => {
    expect(of('The race event Champions Meeting: Libra Cup is coming in late August!')).toMatchObject({
      kind: 'champions_meeting',
      phase: 'announced',
      name: 'Libra Cup',
    });
    expect(of('The league selection period for the Champions Meeting: Libra Cup has begun!').phase).toBe(
      'league_selection'
    );
    expect(of('The race event Champions Meeting: Libra Cup is here!').phase).toBe('started');
  });

  it('knows the recurring events', () => {
    expect(of('A Legend Race is here!')).toMatchObject({ kind: 'legend_race', phase: 'started', name: null });
    expect(of('Transfer Requests coming soon!')).toMatchObject({ kind: 'transfer_requests', phase: 'announced' });
    expect(of("Let's Go! Uma Outing now available!")).toMatchObject({ kind: 'uma_outing', name: 'Uma Outing' });
    expect(of('The event Aim for the Stars! Dream Team has ended!')).toMatchObject({
      kind: 'special',
      name: 'Aim for the Stars! Dream Team',
    });
    expect(of('The event "Trainer Aptitude Test" is here!')).toMatchObject({
      kind: 'special',
      name: 'Trainer Aptitude Test',
    });
  });

  it('names celebrations and campaigns without their phase or tagline', () => {
    expect(of('Holiday Celebration Part 2 now available!')).toMatchObject({
      kind: 'celebration',
      name: 'Holiday Celebration Part 2',
    });
    expect(of('Up to 100 free scouts! Daily Free 10x Scout has begun!')).toMatchObject({
      kind: 'campaign',
      name: 'Daily Free 10x Scout',
    });
    // (no "Celebration" in its title)
    expect(of('New Beginnings Part 1 now available!')).toMatchObject({
      kind: 'celebration',
      name: 'New Beginnings Part 1',
    });
    expect(of('A special Umayuru Celebration has begun!')).toMatchObject({
      kind: 'celebration',
      name: 'Umayuru Celebration',
    });
    expect(of('Increased Daily Race Tickets event coming soon!').name).toBe('Increased Daily Race Tickets');
    expect(of('Bonus Star Piece rewards in Career!')).toMatchObject({
      kind: 'campaign',
      phase: null,
      name: 'Bonus Star Piece rewards in Career',
    });
    expect(of('1.5-Year Anniversary Celebrations ending soon!').phase).toBe('ending');
  });

  it('keeps gifts and store sales apart from celebrations', () => {
    expect(of('A Gift to Celebrate 150,000 Followers on X!', { id: 100026 }).kind).toBe('gift');
    expect(of('Steam Release Celebration Event!', { id: 100009 }).kind).toBe('gift');
    expect(
      of('1.5-Year Anniversary Celebration items now available on the Cygames WebStore!', { id: 100083 })
    ).toMatchObject({ category: 'other', kind: 'sale' });
  });

  it('sorts the rest', () => {
    expect(of('Issue with Independent Training', { id: 100100 })).toMatchObject({ category: 'other', kind: 'issue' });
    expect(of('Maintenance Announcement', { id: 100089 }).kind).toBe('maintenance');
    expect(of('New racecourses and Dirt races now available!').kind).toBe('update');
    expect(of('Check out all the latest updates!').kind).toBe('roundup');
    expect(of('The new Career scenario "Brighter Together! Our Grand Concert" is here!')).toMatchObject({
      kind: 'scenario',
      name: 'Brighter Together! Our Grand Concert',
    });
    expect(of('Regarding Google Play Points').kind).toBe('misc');
  });

  it('never takes community posts for in-game events', () => {
    expect(of('Umamusume: Pretty Derby Unity Cup Celebration Event', { id: 200006 })).toMatchObject({
      category: 'other',
      kind: 'community',
    });
  });
});

describe('plain', () => {
  it('drops tags and decodes entities', () => {
    expect(plain('Only once each!<br>Rookie&nbsp;Starter Packs &amp; more')).toBe(
      'Only once each! Rookie Starter Packs & more'
    );
  });

  it("revises the title's answer by the body's template phrases", () => {
    const message = (...lines: string[]) => lines.join('<br>\n');
    expect(
      of('G1 Race Commemoration now available!', {
        message: message(
          'As of 10:00 p.m., Mar 3 (UTC), our G1 Commemoration has begun!',
          'See below for details of included events.'
        ),
      })
    ).toMatchObject({ category: 'event', kind: 'celebration', name: 'G1 Race Commemoration' });
    expect(
      of('Free Rainbow and Gold Uncap Crystals to celebrate new uncap items!', {
        message: message("To celebrate, we've sent a gift of one Rainbow Uncap Crystal to all trainers!"),
      })
    ).toMatchObject({ category: 'event', kind: 'gift' });
    expect(
      of('Cinderella Grey Broadcast Commemoration event is now underway!', {
        message: message("Starting from 12:00 p.m., Oct 6 (UTC), we're holding a commemorative login bonus!"),
      }).kind
    ).toBe('login_bonus');
    expect(of('Regarding the August Giveaway Gift Contents').category).toBe('other');
  });
});
