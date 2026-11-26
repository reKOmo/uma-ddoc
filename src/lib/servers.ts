export const SERVERS = {
  gl: { banners: 'global' },
  jp: { banners: 'jp' },
};

export type Server = keyof typeof SERVERS;

// Pages showing both servers side by side: JP first, as it launches everything first.
export const SERVER_ORDER: Server[] = ['jp', 'gl'];
