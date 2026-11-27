// What the news tools (news:events, news:merges, news:ai) read: a server's stored posts, cut and built as
// update-global / update-jp do (without the banners: no free scout window's banner).

import type { CardsFile } from '../../../shared/schemas/card.ts';
import type { GameEvent } from '../../../shared/schemas/event.ts';
import { readJson } from '../json.ts';
import { CARDS_JSON } from '../paths.ts';
import { loadPosts } from '../news/api.ts';
import { readCategories } from '../news/categories.ts';
import { lexicon } from '../news/lang/index.ts';
import type { Server } from '../news/text.ts';
import { buildEvents } from './build.ts';
import { readAnswers, readCmTable } from './files.ts';
import { type Fragment, eventFragments } from './fragments.ts';
import type { Merge } from './merge.ts';

export function newsContext(server: Server) {
  const cards = readJson<CardsFile>(CARDS_JSON, {});
  const lang = lexicon(server);
  const posts = [...loadPosts(server).values()];
  const categories = readCategories(server);
  return {
    server,
    lang,
    posts,
    fragments: (): Fragment[] => eventFragments(posts, cards, lang, categories),
    // `merges` is filled with every fragment that joined another event (buildEvents()).
    events: (merges: Merge[] = []): GameEvent[] =>
      buildEvents(posts, {
        cmTable: server === 'gl' ? readCmTable() : [],
        cards,
        answers: readAnswers(server),
        lang,
        categories,
        merges,
      }),
  };
}
