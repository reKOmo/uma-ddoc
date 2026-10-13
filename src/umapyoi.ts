// @ts-nocheck
// umapyoi.net's copies of the official news posts (it mirrors both servers' news under the same post ids). A JP post
// in Japanese (?lang=jp, the original) or umapyoi's English translation (?lang=en), by `language` (the JP news setting,
// src/settingsStore.js); a Global post on its English mirror.
export const umapyoiJp = (id, language = 'jp') => `https://umapyoi.net/news/${id}?lang=${language}`;
export const umapyoiGl = (id) => `https://umapyoi.net/en/news/${id}`;

// From the official post's URL (an event's or banner's news_url); null for anything else (GameTora-filled events have
// none).
export function umapyoiUrl(newsUrl, language) {
  const jp = newsUrl?.match(/umamusume\.jp\/news\/detail\/\?id=(\d+)/);
  if (jp) return umapyoiJp(jp[1], language);
  const gl = newsUrl?.match(/umamusume\.com\/news\/(\d+)/);
  if (gl) return umapyoiGl(gl[1]);
  return null;
}
