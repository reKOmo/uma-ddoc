// Search text as both searches compare it: lower case without accents or punctuation, so "tracen" finds
// "[Tracen Academy]" and "ecole" finds "École".
export const normalizeSearch = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC') // puts Japanese voiced marks back on their kana
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
