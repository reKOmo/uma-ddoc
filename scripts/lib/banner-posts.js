// The scout banners a news post (data/news/posts.json, as the API sends it) announces. Pure.
//
// Scout posts show each banner's art as gacha_banner_<id>_….png, where <id> is the game's gacha id, the same on
// Global and JP (Global reruns JP's banners under JP's ids). The art sits under a "Trainee Umamusume" or "Support
// Cards" heading, followed by that banner's list: "★★★ [Heroic Author] Zenno Rob Roy" / "• SSR [Party Formation]
// Mayano Top Gun" (spotlight posts list debut trainees twice; each is kept once).
//
// bannerPost(post) → { id, url, posted, paid, banners } or null when the post shows no banner, with
//   paid     the post's scouts cost paid carats (the one-off guaranteed scouts: launch, anniversaries), like the
//            "special" banners JP's scrape skips
//   banners  [{ gachaId, type: 'character' | 'support' | null, start, end, image, featured }]
//   start/end   the scout period above the banner's art (else the post's first period); ISO UTC, end null when
//               open-ended
//   image       the official art's URL
//   featured    characters [{ stars, title, name }], support cards [{ rarity, title, name }] (as the post spells
//               them); empty when the post doesn't list them ("features Support Cards introduced up to …")

import { apiDate, decodeEntities, newsUrl, parsePeriod, sections, toLines } from './news-text.js';

const ART = /(<img[^>]*\ssrc="[^"]*gacha_banner_\d+_[^"]*"[^>]*>)/;
const CARD = /^(?:[•・■]\s*)?(SSR|SR|R)\s+\[([^\]]+)\]\s+(.+)$/;
const TRAINEE = /^(★{1,3})\s+\[([^\]]+)\]\s+(.+)$/;

// "Trainee Umamusume" (older posts: "Umamusume") → character, "Support Cards" → support.
const typeOf = (heading) =>
  /Trainee|^Umamusume$/i.test(heading) ? 'character' : /Support Card/i.test(heading) ? 'support' : null;

export function bannerPost(post) {
  const html = post.message ?? '';
  if (!ART.test(html)) return null;
  const posted = apiDate(post.post_at);
  const year = new Date(posted).getUTCFullYear();

  const all = sections(html, '234');
  const periods = all
    .filter((s) => /period$/i.test(s.heading) && s.lines.length)
    .map((s) => ({ heading: s.heading, ...parsePeriod(s.lines[0], year) }))
    .filter((p) => p.start);
  let period = periods.find((p) => /scout.*period$/i.test(p.heading)) ?? periods[0] ?? null;

  const banners = new Map();
  let last = null; // the banner whose art came last: lists after it are its own
  for (const section of all) {
    const own = periods.find((p) => p.heading === section.heading);
    if (own && /scout.*period$/i.test(own.heading)) period = own;
    for (const chunk of section.html.split(ART)) {
      const art = chunk.match(/src="([^"]*gacha_banner_(\d+)_[^"]*)"/);
      if (art) {
        const gachaId = Number(art[2]);
        last = banners.get(gachaId);
        if (!last) {
          last = {
            gachaId,
            type: typeOf(section.heading),
            start: period?.start ?? null,
            end: period?.end ?? null,
            image: decodeEntities(art[1]),
            featured: [],
          };
          banners.set(gachaId, last);
        }
        continue;
      }
      if (!last) continue;
      for (const line of toLines(chunk)) {
        const card = last.type !== 'character' && line.match(CARD);
        const trainee = last.type !== 'support' && line.match(TRAINEE);
        const item = card
          ? { rarity: card[1], title: card[2], name: card[3] }
          : trainee
            ? { stars: trainee[1].length, title: trainee[2], name: trainee[3] }
            : null;
        if (item && !last.featured.some((f) => f.title === item.title && f.name === item.name))
          last.featured.push(item);
      }
    }
  }

  const id = Number(post.announce_id);
  const paid = /paid carats/i.test(toLines(html).join(' '));
  return { id, url: newsUrl(id), posted, paid, banners: [...banners.values()] };
}
