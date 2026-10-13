// Clones upstream main into upstream/ (gitignored), or updates an existing
// clone to the latest main. Only test/upstream/ needs it.
//
// Usage: pnpm clone-upstream

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { REPO, UPSTREAM_DIR } from './lib/upstream.ts';

const git = (...args: string[]): void => {
  execFileSync('git', args, { stdio: 'inherit' });
};

if (existsSync(`${UPSTREAM_DIR}.git`)) {
  // fetch + reset rather than pull, so a force-pushed upstream still works.
  git('-C', UPSTREAM_DIR, 'fetch', '--depth', '1', 'origin', 'main');
  git('-C', UPSTREAM_DIR, 'reset', '--hard', 'FETCH_HEAD');
} else {
  git('clone', '--depth', '1', `https://github.com/${REPO}.git`, UPSTREAM_DIR);
}
