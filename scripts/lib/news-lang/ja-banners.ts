// @ts-nocheck
// The Japanese scout posts' wording (banner-posts.js), part of news-lang/ja.js. What they look like:
// docs/jp-news-findings.md, "Scouts".

export const jaBanners = {
  // gacha_banner_<id>.png, also …_new / _new2 / _2.
  bannerArt: /(<img[^>]*\ssrc="[^"]*gacha_banner_\d+(?:_[^"./]*)?\.png[^"]*"[^>]*>)/,
  bannerArtSrc: /src="([^"]*gacha_banner_(\d+)(?:_[^"./]*)?\.png[^"]*)"/,
  // "・SSR [晩餐]ナリタブライアン", "SSR [只、君臨す。]オルフェーヴル", "・R[トレセン学園]…" (whole lines: notes about a card
  // aren't items); titles trimmed ("[万福龍湯伝・頂 ]").
  bannerCard: /^(?:[・■]\s*)?(SSR|SR|R)\s*\[\s*([^\]]*[^\]\s])\s*\]\s*([^\s[\]「」、。]+)$/,
  bannerTrainee: /^(★{1,3})\s*\[\s*([^\]]*[^\]\s])\s*\]\s*([^\s[\]「」、。]+)$/,
  // The heading the art sits under: 育成ウマ娘 (育成ウマ娘1/2 in revivals) / サポートカード, or a group-select scout's own
  // heading (★3確定… / SSR確定…).
  bannerType: (heading) =>
    /^育成ウマ娘\d*$|★\d確定/.test(heading) ? 'character' : /^サポートカード$|SSR確定/.test(heading) ? 'support' : null,
  bannerPeriod: /期間$/,
  scoutPeriod: /ガチャ開催期間$|^開催期間$/,
  // Paid scouts are per banner on JP (gacha id ≥ 50000: guaranteed ★3/SSR, step-up, stamp sheet, group select), not
  // per post: no post-wide marker.
  paidPost: /(?!)/,
  paidBanner: (gachaId) => gachaId >= 50000,
  // Trainees are listed 2–3 times, and a revival post lists both banners again after the second art: only the first
  // list after a banner's art is its own.
  firstList: true,
  // 予告 placeholders ("・SR ？？？") hold a place in the list without ending it.
  listPlaceholder: /^(?:・\s*)?(?:SSR|SR|R|★{1,3})\s*[？?]+$/,
  // Two windows in one 開催期間 section (2593): "ピックアップ プリティーダービーガチャ" / "セレクトピックアップ サポートカードガチャ",
  // each followed by its dates.
  periodLabel: (label) =>
    /サポートカード/.test(label) ? 'support' : /プリティーダービー/.test(label) ? 'character' : null,
  // A scout re-held after an issue (the post edited with a 再開催期間; 947, 2446, 1959).
  rerunPeriod: /再開催期間$/,
  // A scout's name: the heading it sits under when that names it (group-select posts: "★3確定5th Anniv.グループセレクト
  // ガチャ"), else the post's next 「…ガチャ…」 (the intro's come first) that fits its type ("「★3確定スタートダッシュガチャ第6R」と「SSR確定
  // スタートダッシュガチャ第6R」が開催しました"): ★ / 育成ウマ娘 / プリティーダービー for trainees, SSR / サポートカード for cards.
  bannerName: (heading, text, type, named) => {
    if (/ガチャ/.test(heading) && !/期間$/.test(heading)) return heading.trim();
    const fits = type === 'character' ? /★|育成ウマ娘|プリティーダービー/ : /SSR|サポートカード/;
    const names = [...text.matchAll(/「([^「」]*ガチャ[^「」]*)」/g)].map((m) => m[1].trim());
    // a name not given yet, else one already given (a post naming only its whole scout: 「リリース時期別★3/SSR確定…」)
    return names.find((n) => fits.test(n) && !named.has(n)) ?? names.find((n) => fits.test(n)) ?? null;
  },
  // A banner without a featured list keeps the post's line about it (what it draws from: "★3育成ウマ娘は…短距離が得意な
  // 育成ウマ娘が出現します。").
  bannerNote: true,
};
