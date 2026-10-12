// umapyoi.net's copy of an official news post (it mirrors both servers' news under the same post ids): JP's in
// Japanese (?lang=jp shows the original, not umapyoi's machine translation), Global's on its English mirror. From the
// official post's URL (an event's or banner's news_url); null for anything else (GameTora-filled events have none).
export function umapyoiUrl(newsUrl) {
  const jp = newsUrl?.match(/umamusume\.jp\/news\/detail\/\?id=(\d+)/);
  if (jp) return `https://umapyoi.net/news/${jp[1]}?lang=jp`;
  const gl = newsUrl?.match(/umamusume\.com\/news\/(\d+)/);
  if (gl) return `https://umapyoi.net/en/news/${gl[1]}`;
  return null;
}
