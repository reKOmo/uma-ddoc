// Usage: node scripts/news-pending.ts   (prints true / false; nothing written)
//
// Whether the JP records wait on GameTora: a card the news announced that its list doesn't have yet
// (data/jp_cards_pending.json), or a featured item of a banner without an id (a debuting trainee GameTora doesn't list
// yet). news-run.sh then scrapes GameTora and rebuilds the records even with no new posts, so they fill in on the first
// run after GameTora lists them.

import { readPending } from './lib/jp-cards.ts';
import { readJpBanners } from './lib/jp-banners.ts';

const banners = readJpBanners();
const unresolved = [...banners.characters, ...banners.cards].some((b) => b.featured.some((item) => item.id == null));
console.log(readPending().length > 0 || unresolved);
