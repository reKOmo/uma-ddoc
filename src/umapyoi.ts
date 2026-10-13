// umapyoi.net mirrors both servers' news under the same post ids: a JP post in Japanese (?lang=jp, the original) or its
// English translation (?lang=en), by the JP news setting; a Global post on its English mirror.

export type UmapyoiLanguage = 'jp' | 'en';

export const umapyoiJp = (id: number | string, language: UmapyoiLanguage = 'jp'): string =>
  `https://umapyoi.net/news/${id}?lang=${language}`;
export const umapyoiGl = (id: number | string): string => `https://umapyoi.net/en/news/${id}`;

// From the official post's URL (an event's or banner's news_url); null for anything else (GameTora-filled events have
// none).
export function umapyoiUrl(newsUrl: string | null | undefined, language?: UmapyoiLanguage): string | null {
  const jp = newsUrl?.match(/umamusume\.jp\/news\/detail\/\?id=(\d+)/);
  if (jp) return umapyoiJp(jp[1], language);
  const gl = newsUrl?.match(/umamusume\.com\/news\/(\d+)/);
  if (gl) return umapyoiGl(gl[1]);
  return null;
}
