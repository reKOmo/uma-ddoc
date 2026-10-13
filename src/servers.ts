// The game servers the site covers. Tier list data uses the short key; the
// banner files are named by `banners`. Display names are in src/i18n.
export const SERVERS = {
  gl: { banners: 'global' },
  jp: { banners: 'jp' },
};

export type Server = keyof typeof SERVERS;
