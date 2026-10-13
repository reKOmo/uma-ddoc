// The scout banners a news post (data/news/gl/posts.json, as the API sends it) announces. Pure.
//
// Scout posts show each banner's art as gacha_banner_<id>_….png, where <id> is the game's gacha id, the same on
// Global and JP (Global reruns JP's banners under JP's ids). The art sits under a "Trainee Umamusume" or "Support
// Cards" heading, followed by that banner's list: "★★★ [Heroic Author] Zenno Rob Roy" / "• SSR [Party Formation]
// Mayano Top Gun" (spotlight posts list debut trainees twice; each is kept once).
//
// What only JP's posts need is a Lexicon hook (news-lang/index.ts), absent on Global's.

import type { NewsPost } from '../../shared/schemas/news.ts';
import { en } from './news-lang/en.ts';
import type { BannerType, DateRef, Lexicon, Period } from './news-lang/index.ts';
import { apiDate, decodeEntities, newsUrl, type Section, sections, toLines } from './news-text.ts';

export type FeaturedCard = { rarity: string; title: string; name: string };
export type FeaturedTrainee = { stars: number; title: string; name: string };
export type Featured = FeaturedCard | FeaturedTrainee;

export type Banner = {
  gachaId: number;
  type: BannerType | null;
  start: string | null;
  end: string | null;
  image: string;
  featured: Featured[];
  paid?: boolean;
  name?: string | null;
  note?: string;
  rerun?: { start: string | null; end: string | null };
};

export type BannerPost = {
  id: number;
  url: string;
  posted: string | null;
  paid: boolean;
  banners: Banner[];
};

type Window = Period & { type: BannerType | null };
type ScoutPeriod = { heading: string; start: string | null; end: string | null; windows: Window[] };
// A banner while it's being read. `listed`: its list has ended, so later lines aren't its items (removed before returning).
type DraftBanner = Banner & { listed?: boolean };

// A period section's windows: [{ type, start, end }] (type null when unlabelled). Global's: its first line only.
function sectionPeriods(section: Section, lang: Lexicon, ref: DateRef): Window[] {
  if (!lang.periodLabel) return [{ type: null, ...lang.parsePeriod(section.lines[0], ref) }];
  const out: Window[] = [];
  let label: string | null = null;
  for (const line of section.lines) {
    const p = lang.parsePeriod(line, ref);
    if (p.start) {
      out.push({ type: label ? lang.periodLabel(label) : null, ...p });
      label = null;
    } else label = line;
  }
  return out;
}

export function bannerPost(post: NewsPost, lang: Lexicon = en): BannerPost | null {
  const html = lang.clean(post.message ?? '');
  if (!lang.bannerArt.test(html)) return null;
  const posted = apiDate(post.post_at, lang.server);
  // (apiDate gives null only for an empty post_at, which NewsPost's schema rules out.)
  const year = lang.dateRef(posted as string); // TODO(ts): see the line above

  const all = sections(html, '234');
  const isRerun = (heading: string) => lang.rerunPeriod?.test(heading);
  const periods: ScoutPeriod[] = all
    .filter((s) => lang.bannerPeriod.test(s.heading) && !isRerun(s.heading) && s.lines.length)
    .map((s) => {
      const windows = sectionPeriods(s, lang, year).filter((w) => w.start);
      const first = windows[0] ?? { start: null, end: null };
      return { heading: s.heading, start: first.start, end: first.end, windows };
    })
    .filter((p) => p.start);
  let period: ScoutPeriod | null = periods.find((p) => lang.scoutPeriod.test(p.heading)) ?? periods[0] ?? null;
  const rerunSection = all.find((s) => isRerun(s.heading) && s.lines.length);
  const rerun = rerunSection && sectionPeriods(rerunSection, lang, year).find((w) => w.start);

  const banners = new Map<number, DraftBanner>();
  const text = all.flatMap((s) => [s.heading, ...s.lines]).join('\n'); // the names a scout may go by, in order
  const named = new Set<string>();
  let last: DraftBanner | null | undefined = null; // the banner whose art came last: lists after it are its own
  for (const section of all) {
    const own = periods.find((p) => p.heading === section.heading);
    if (own && lang.scoutPeriod.test(own.heading)) period = own;
    for (const chunk of section.html.split(lang.bannerArt)) {
      const art = chunk.match(lang.bannerArtSrc);
      if (art) {
        const gachaId = Number(art[2]);
        last = banners.get(gachaId);
        if (!last) {
          const type = lang.bannerType(section.heading);
          const slot = period?.windows.find((w) => w.type && w.type === type) ?? period;
          last = {
            gachaId,
            type,
            start: slot?.start ?? null,
            end: slot?.end ?? null,
            image: decodeEntities(art[1]),
            featured: [],
          };
          if (lang.paidBanner) last.paid = lang.paidBanner(gachaId);
          if (lang.bannerName) {
            last.name = lang.bannerName(section.heading, text, type, named);
            if (last.name) named.add(last.name);
          }
          banners.set(gachaId, last);
        }
        continue;
      }
      if (!last) continue;
      for (const line of toLines(chunk)) {
        const card = last.type !== 'character' && line.match(lang.bannerCard);
        const trainee = last.type !== 'support' && line.match(lang.bannerTrainee);
        const item = card
          ? { rarity: card[1], title: card[2], name: card[3] }
          : trainee
            ? { stars: trainee[1].length, title: trainee[2], name: trainee[3] }
            : null;
        if (lang.bannerNote && !item && last.note === undefined && !last.featured.length) last.note = line;
        if (lang.firstList) {
          // A line that isn't an item ends the list (once it has begun).
          if (!item && last.featured.length && !lang.listPlaceholder?.test(line)) last.listed = true;
          if (!item || last.listed) continue;
        }
        if (item && !last.featured.some((f) => f.title === item.title && f.name === item.name))
          last.featured.push(item);
      }
    }
  }

  const list = [...banners.values()];
  for (const b of list) {
    delete b.listed;
    if (b.featured.length || !b.note) delete b.note;
    if (rerun) b.rerun = { start: rerun.start, end: rerun.end };
  }
  const id = Number(post.announce_id);
  const paid = lang.paidPost.test(toLines(html).join(' '));
  return { id, url: newsUrl(id, lang.server), posted, paid, banners: list };
}
