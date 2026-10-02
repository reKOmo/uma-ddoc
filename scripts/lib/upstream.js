// Everything that knows about the upstream repo: where things live, which
// files we take from it, and how to download them.
//
// Upstream files fall into two groups that update independently:
//   code  tierlist calculation, scenario presets and upstream's test for them.
//         Committed, kept in sync with upstream main by scripts/update-code.js.
//   data  card lists + card events. Fetched from upstream main into generated/
//         at build time, never committed (scripts/update-cards.js).

import { readFileSync } from "node:fs"

export const REPO = "Euophrys/umamusume-tierlist"
export const ROOT = new URL("../../", import.meta.url).pathname
export const GENERATED_DIR = `${ROOT}generated/`

// `imports` maps each relative import upstream uses to its local path. Any
// other relative import, or a package we don't have installed, fails the update
// so it can be handled by hand.
export const CODE_FILES = [
  {
    upstream: "src/components/tierlist-calc.js",
    local: "tierlist/tierlist-calc.js",
    imports: { "../card-events": "../generated/card-events.js" },
  },
  { upstream: "src/scenarios.js", local: "tierlist/scenarios.js" },
  {
    upstream: "src/components/tierlist-calc.test.js",
    local: "test/upstream-calc.test.js",
    imports: {
      "./tierlist-calc": "../tierlist/tierlist-calc.js",
      "../cards/gl": "../generated/raw/gl.js",
      "../cards/jp": "../generated/raw/jp.js",
      "../scenarios": "../tierlist/scenarios.js",
    },
  },
]

// `local` is relative to generated/.
export const DATA_FILES = [
  { upstream: "src/cards/gl.js", local: "raw/gl.js" },
  { upstream: "src/cards/jp.js", local: "raw/jp.js" },
  { upstream: "src/card-events.js", local: "card-events.js" },
]

export async function latestRef() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
    headers: { Accept: "application/vnd.github.sha" },
  })
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`)
  return (await res.text()).trim()
}

// Downloads each file at `ref`. Returns { upstreamPath: text }.
export async function download(ref, files) {
  const texts = await Promise.all(
    files.map(async (file) => {
      const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${file.upstream}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${file.upstream} at ${ref.slice(0, 10)}: ${res.status} ${res.statusText}`)
      return res.text()
    })
  )
  return Object.fromEntries(files.map((file, i) => [file.upstream, texts[i]]))
}

const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8"))
const INSTALLED = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))

// A bare specifier for a package this project has installed.
export const isInstalledPackage = (specifier) =>
  !specifier.startsWith(".") && INSTALLED.has(specifier.split("/")[0])

// Every module specifier a JS source imports or re-exports, with its offsets.
export function importsOf(source) {
  const pattern = /(?:^|\n)\s*(?:import|export)\b[^'"`;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/dg
  return [...source.matchAll(pattern)].map((m) => {
    const group = [1, 2, 3].find((g) => m[g] !== undefined)
    const [start, end] = m.indices[group]
    return { specifier: m[group], start, end }
  })
}

// The local file content for one upstream file: a header plus the source with
// its imports remapped. Throws on an import we don't know how to carry over.
export function toLocal(file, source) {
  const mapped = file.imports ?? {}
  const imports = importsOf(source)
  const unknown = imports
    .map((i) => i.specifier)
    .filter((s) => !(s in mapped) && !isInstalledPackage(s))
  if (unknown.length > 0) {
    throw new Error(
      `${file.upstream} now imports ${unknown.map((s) => `"${s}"`).join(", ")}; ` +
        `map it in CODE_FILES in scripts/lib/upstream.js`
    )
  }
  let text = source
  for (const { specifier, start, end } of imports.reverse()) {
    if (specifier in mapped) text = text.slice(0, start) + mapped[specifier] + text.slice(end)
  }
  const header =
    `// Copied from https://github.com/${REPO}/blob/main/${file.upstream}\n` +
    `// verbatim apart from this header and import paths, and kept in sync with\n` +
    `// upstream main by scripts/update-*.js — do not edit by hand.\n\n`
  return header + text
}
