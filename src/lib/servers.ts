export const SERVERS = {
  gl: { banners: 'global' },
  jp: { banners: 'jp' },
};

export type Server = keyof typeof SERVERS;
