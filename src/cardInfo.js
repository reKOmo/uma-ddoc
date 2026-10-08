// Per-card info for the card page: GameTora's link, JP title and JP release date
// (generated/gametora_cards.json, `pnpm scrape-gametora`), with Global's title and release date
// from Global's own record (data/global_cards.json, see scripts/lib/global.js). GameTora's Global
// fields are ignored, except its English title for cards not on Global yet.
//   { [id]: { url, title_en, title_jp, release_gl, release_jp } }   url is null if GameTora lacks the card

export function mergeCardInfo(gametora, globalCards) {
  const ids = new Set([...Object.keys(gametora), ...Object.keys(globalCards)]);
  return Object.fromEntries(
    [...ids].map((id) => {
      const gt = gametora[id] ?? {};
      const gl = globalCards[id];
      return [
        id,
        {
          url: gt.url ?? null,
          title_en: gl?.title_en ?? gt.title_en ?? null,
          title_jp: gt.title_jp ?? null,
          release_gl: gl?.release_gl ?? null,
          release_jp: gt.release_jp ?? null,
        },
      ];
    })
  );
}

// Only downloaded when a card page opens.
export const loadCardInfo = () =>
  Promise.all([import('../generated/gametora_cards.json'), import('../data/global_cards.json')]).then(([gt, gl]) =>
    mergeCardInfo(gt.default, gl.default)
  );
