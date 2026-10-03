// Everything that knows about the upstream repo
// (https://github.com/Euophrys/umamusume-tierlist).
//
// The tier list calculation started as a copy of upstream's and is ours now
// (tierlist/). Upstream is still used for:
//   data   card lists + card events, fetched from upstream main into generated/
//          at build time, never committed (scripts/update-cards.js).
//   tests  test/upstream/ compares our calculation with upstream's, run from a
//          clone in upstream/ (scripts/clone-upstream.js).

export const REPO = 'Euophrys/umamusume-tierlist';
export const ROOT = new URL('../../', import.meta.url).pathname;
export const GENERATED_DIR = `${ROOT}generated/`;
export const UPSTREAM_DIR = `${ROOT}upstream/`;

// `local` is relative to generated/.
export const DATA_FILES = [
  { upstream: 'src/cards/gl.js', local: 'raw/gl.js' },
  { upstream: 'src/cards/jp.js', local: 'raw/jp.js' },
  { upstream: 'src/card-events.js', local: 'raw/card-events.js' },
];

export async function latestRef() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
    headers: { Accept: 'application/vnd.github.sha' },
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
  return (await res.text()).trim();
}

// Downloads each file at `ref`. Returns { upstreamPath: text }.
export async function download(ref, files) {
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
