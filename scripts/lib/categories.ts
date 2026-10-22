// What ml/categorize.py makes of a server's posts (data/news/<server>/categories.json): a post's category, kind, phase
// and an event post's units, which the events are built from instead of the title rules (docs/data/classifier.md).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { PostCategory } from '../../shared/schemas/news.ts';
import { writeFeatures } from '../news-features.ts';
import { staleLabels } from './gold.ts';
import type { Server } from './news-text.ts';
import { GENERATED_DIR, ROOT, newsDir } from './paths.ts';

const categoriesFile = (server: Server = 'gl'): string => `${newsDir(server)}categories.json`;
const PYTHON = `${ROOT}ml/.venv/bin/python`;
export const canClassify = (): boolean => existsSync(PYTHON);
const categorize = (server: Server, ...args: string[]) =>
  execFileSync(PYTHON, ['-W', 'ignore', `${ROOT}ml/categorize.py`, '--server', server, ...args], { stdio: 'inherit' });

export function readCategories(server: Server = 'gl', file = categoriesFile(server)): Map<number, PostCategory> {
  if (!existsSync(file)) return new Map();
  // TODO(ts): JSON.parse's any: categories.json is written by ml/categorize.py (its schema: CategoriesFileSchema,
  // test/schemas.test.ts)
  const list = JSON.parse(readFileSync(file, 'utf8')) as PostCategory[];
  return new Map(list.map((c) => [c.id, c]));
}

// The features of every post, then the classifiers over them (`pnpm news:features` + `pnpm news:categorize`). Without
// ml/'s venv (`pnpm setup-ml`) the stored categories.json stands: gold posts are in it, a newer post falls back to the
// rules.
export function refreshCategories(server: Server = 'gl'): void {
  if (!canClassify()) {
    console.warn('No ml/.venv (pnpm setup-ml): the stored categories.json and the rules decide.');
    return;
  }
  writeFeatures(server);
  categorize(server);
}

// Every post's categories with these posts categorized by the models as if new, trained without their gold labels
// (test/news-replay.ts; ml/categorize.py --hold-out writes them to generated/).
export function heldOutCategories(server: Server, ids: number[]): Map<number, PostCategory> {
  writeFeatures(server);
  categorize(server, '--hold-out', ids.join(','));
  return readCategories(server, `${GENERATED_DIR}categories_held_out${server === 'gl' ? '' : `_${server}`}.json`);
}

// For the update summary: the posts edited since they were labelled, and those the post model would categorize
// otherwise than the rules do.
export function unsureLines(categories: Map<number, PostCategory>, server: Server, titles = new Map<number, string>()) {
  const review = `pnpm gold:review${server === 'gl' ? '' : `:${server}`}`;
  const post = (id: number) => `post ${id}${titles.has(id) ? ` "${titles.get(id)}"` : ''}`;
  return [
    ...staleLabels(server).map((l) => `Edited since labelled: ${post(l.id)}: label it again (${review})`),
    ...[...categories.values()]
      .filter((c) => c.flag)
      .map(
        (c) =>
          `Unsure: ${post(c.id)} is ${c.category}/${c.kind ?? ''} by the rules, ${c.flag} by the model: label it (${review})`
      ),
  ];
}
