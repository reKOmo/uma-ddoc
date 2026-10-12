// The news' wording per server: the lexicon the shared parsers read that server's posts with.

import { en } from './en.js';
import { ja } from './ja.js';

export const LEXICONS = { gl: en, jp: ja };
export const lexicon = (server = 'gl') => {
  const lang = LEXICONS[server];
  if (!lang) throw new Error(`no news lexicon for ${server}`);
  return lang;
};
export { en, ja };
