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

export async function latestRef(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
    headers: { Accept: 'application/vnd.github.sha' },
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
  return (await res.text()).trim();
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
