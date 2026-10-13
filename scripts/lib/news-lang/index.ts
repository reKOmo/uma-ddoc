// @ts-nocheck
// The news' wording per server: the lexicon the shared parsers read that server's posts with.

import { en } from './en.ts';
import { ja } from './ja.ts';

export const LEXICONS = { gl: en, jp: ja };
export const lexicon = (server = 'gl') => {
  const lang = LEXICONS[server];
  if (!lang) throw new Error(`no news lexicon for ${server}`);
  return lang;
};
export { en, ja };
