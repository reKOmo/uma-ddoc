import { execFileSync } from 'node:child_process';

// Upstream is data only: the calculation is ours (tierlist/).
export const REPO: string = 'Euophrys/umamusume-tierlist';
import { GENERATED_DIR, ROOT } from './paths.ts';

export const UPSTREAM_DIR: string = `${ROOT}upstream/`;
export const UPSTREAM_RAW: string = `${GENERATED_DIR}raw/upstream/`;

type DataFile = { upstream: string; local: string };

// `local` is relative to UPSTREAM_RAW.
export const DATA_FILES: DataFile[] = [
  { upstream: 'src/cards/gl.js', local: 'gl.js' },
  { upstream: 'src/cards/jp.js', local: 'jp.js' },
  { upstream: 'src/card-events.js', local: 'card-events.js' },
];

// Git, not GitHub's API: the API's anonymous limit is shared by a CI runner's whole IP, and failed deploys.
export function latestRef(): string {
  const out = execFileSync('git', ['ls-remote', '--exit-code', `https://github.com/${REPO}.git`, 'refs/heads/main']);
  return out.toString().split('\t')[0];
}

// Downloads each file at `ref`: { [upstream path]: text }.
export async function download(ref: string, files: DataFile[]): Promise<Record<string, string>> {
  const texts = await Promise.all(
    files.map(async (file) => {
      const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${file.upstream}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${file.upstream} at ${ref.slice(0, 10)}: ${res.status} ${res.statusText}`);
      return res.text();
    })
  );
  return Object.fromEntries(files.map((file, i) => [file.upstream, texts[i]]));
}
