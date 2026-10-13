# TypeScript migration plan

Goal: the whole JS codebase (`src/`, `tierlist/`, `scripts/`, `test/`, configs; not `ml/`) in TypeScript, hand-written
mechanics replaced by libraries where it pays, and the frontend built from reusable components with CSS Modules.

The work is cut into **tasks small enough for a simple model (Haiku)**: each lists the files it owns, what to do,
and the commands that prove it's done. Design decisions are made up front (here, or in a `lead` task) so a worker
never has to make one. Part 1 is how to run it; part 2 the shared specs; part 3 the tasks.

---

# Part 1 — How to run it

## Roles

- **Lead** (a strong model, or the user): runs the `lead` tasks (foundations, anything needing judgment), hands out
  worker tasks, reviews and merges them, does the browser checks.
- **Worker** (Haiku by default; tasks marked `sonnet` are bigger or fiddlier): does one task, in its own git worktree
  on a branch off `ts-migration`, and reports back. A worker gets the **worker brief** below + its task card +
  part 2's specs its card points at.

## Branches

All work on `ts-migration` (off `main`). Each worker task makes **its own worktree from the current `ts-migration`
commit** as its first step (the Agent tool's `isolation: "worktree"` starts from `main`, and an unchanged one is
removed, so it isn't used):
```sh
git -C /home/bartok/Coding/uma-puller worktree add -b ts/<ID> .claude/worktrees/<ID> <ts-migration commit>
cd /home/bartok/Coding/uma-puller/.claude/worktrees/<ID>
pnpm install --frozen-lockfile --prefer-offline && cp -r ../../../generated ./generated   # (+ ln -s ../../../upstream upstream)
```
Work only there (absolute paths); never touch the main checkout. The lead cherry-picks each finished branch onto
`ts-migration`, then fixes the seams between tasks of the same wave (each worker writes a minimal local type for
anything a parallel task is typing; the lead swaps them for the real ones), and removes the worktrees and branches.
Tasks in the same wave own disjoint files, so they merge without conflicts. Only the lead edits the **lead-owned
files**: `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`, `biome.json`, `vite.config.ts`, `vitest.config.ts`,
`src/i18n/en.json`, `shared/`, `CLAUDE.md`, this file. `.claude/worktrees/` is gitignored (Biome would scan it).

## Checks (referred to by name in the task cards)

- **CHECK-BASE**: `pnpm lint && pnpm typecheck && pnpm test` all pass.
- **CHECK-DATA** (any task touching `scripts/` or `tierlist/`): the scripts' output is byte-identical.
  ```sh
  pnpm build-cards && pnpm update-jp && pnpm update-global && pnpm -s news:events > /tmp/events-after.txt
  git diff --exit-code -- data generated/cards.json ':!data/news/*/summary.md'
  diff /tmp/events-before.txt /tmp/events-after.txt
  git checkout -- data/news   # summary.md gets appended to on every run
  ```
  (`/tmp/events-before.txt`: the same `pnpm -s news:events` run on `ts-migration` before the task started; `-s`, or
  pnpm's header lines differ.)
  For `tierlist/` tasks, also `pnpm test:upstream` (needs `pnpm clone-upstream` once).
- **CHECK-UI** (any task touching `src/**/*.tsx` or CSS): `pnpm build` and `pnpm test:e2e` pass (Playwright, e2e/:
  links, stored state, every page; selectors by role and label: keep them working, and `e2e/pages.spec.ts`' one class
  selector, `.bar-hit`, when the Timeline's bars move to CSS Modules: give the bar a stable `data-testid` instead). The
  worker lists the screens it touched in its report and the lead looks at them (headless Chromium: Playwright's,
  `pnpm exec playwright install chromium`; 360 px and desktop widths, light + dark).

## Worker brief (give this to every worker, with its task card)

> You are doing one task of a JS → TypeScript migration of a React + Vite app (pnpm, never npm). Read `CLAUDE.md`
> for what the app does, then your task card in `docs/ts-migration-plan.md` and the part-2 specs it names.
>
> Rules:
> 1. Only edit the files your card lists. If you need to change anything else (another file, a dependency, a string
>    in `src/i18n/en.json`, a shared type), **stop and report it**: don't work around it.
> 2. **Don't change behaviour.** Types, renames and the refactor your card describes only. Keep every existing
>    comment (update one if your change makes it wrong). Match the surrounding style.
> 3. Typing rules: the "Typing recipe" in part 2. Never `any`. If you can't type something, use `unknown` and narrow
>    it, or cast with a `// TODO(ts): <why>` comment on the line above and list it in your report.
> 4. Run your card's checks. If one fails and the fix isn't inside your files, stop and report the output.
> 5. Commit on your branch (`ts/<task id>`), message `<task id>: <what>`, then report: files changed, checks run and
>    their result, TODOs left, anything the lead should look at (screens to check, doubts).

---

# Part 2 — Shared specs

## Decisions (user, 2026-10-13)

1. **zod** is the source of truth for data shapes; types are `z.infer`'d; `schemas/*.json` are generated from zod
   (Ajv dropped). The browser imports types only (`import type`), except localStorage parsing (`zod/mini`).
2. **wouter** with hash location for routing; typed URL builders in `src/routes.ts`.
3. **`useAsync`** hook for loading; no TanStack Query.
4. **News-parser regexes stay.** (No HTML parser.)
5. **CSS Modules** per component.

Also decided: Radix Select for the Dropdown, zustand (+ `persist`) for the localStorage stores, `pngjs` for PNG
decoding, `node:util` `parseArgs` for CLI flags, one paced-fetch helper + `p-retry` in the scripts. Kept
hand-written: `RankChart`, `useDragScroll`, `BackToTop`, `useMediaQuery`, search normalisation, date parsing.

## TypeScript setup (made by L0)

- Scripts run on Node 24's type stripping: `node scripts/x.ts`, no build step. So: **`.ts` in every relative import
  path**, no `enum`, `namespace` or constructor parameter properties (`erasableSyntaxOnly` enforces it).
- One `tsconfig.json` for everything (TypeScript 7): `strict`, `noEmit`, `allowImportingTsExtensions`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, `resolveJsonModule`, `module`/`moduleResolution` `nodenext`,
  `jsx: react-jsx`, types `node` (24) + `vite/client`, libs `esnext` + DOM.
- `pnpm typecheck` = `tsc` (under a second; also in `deploy.yml`).
- JSON imports keep `with { type: 'json' }`. `test/data.test.ts` imports upstream's raw `.js` card lists (no
  `allowJs`): type them with a small `declare module` / cast when X1 gets there.
- Biome lints `.ts` files even under `@ts-nocheck` (e.g. `noImplicitAnyLet`): L0 annotated the few it flagged.

**Every file is renamed in L0 and starts with `// @ts-nocheck`.** A typing task removes that line from its files and
makes them type-check. So no task ever edits another task's files to fix an import path, and the app keeps working
throughout.

## Typing recipe (every typing task)

For each file of the task:
1. Delete the `// @ts-nocheck` line.
2. Run `pnpm typecheck` and fix this file's errors only:
   - Data shapes (cards, banners, events, scenarios, pull guide, posts…): import the type from `shared/schemas/`
     (`import type { Card } from '../shared/schemas/card.ts'`). Don't define your own copy.
   - A shape used only in this file: a `type` next to where it's used. Exported functions get explicit parameter
     and return types; locals are inferred.
   - A shape described in a comment (e.g. `entries.ts`' "one shape" header): turn the comment into the `type`,
     keep the comment above it.
   - `null` vs `undefined`: keep whatever the code uses today.
   - Lookups that can miss (`obj[key]`, `.find()`): handle the `undefined` the way the code already does (it usually
     does with `?.`/`??`); never add `!` unless the line above proves it's there.
   - Imported functions from a file still `@ts-nocheck`: fine, their types come out loose; don't edit that file.
3. `pnpm lint` (`pnpm format` fixes formatting).

## Data schemas (L1)

Done. `shared/schemas/<name>.ts` each export zod schemas (strict objects: an unknown field fails) and their types,
e.g. `export const CardSchema = z.strictObject({ … }); export type Card = z.infer<typeof CardSchema>;`

| File | Types (what to import) |
|---|---|
| `common.ts` | `Rarity`, `CardType` (tier list keys + group), `GametoraType` (intelligence), `CardSource`, `Texts`; `Day`, `Moment`, `IdKey` |
| `card.ts` | `Card`, `CardsFile` (cards.json), `LbStats`, `CardStats`, `CardStatsFile`, `JpCard`, `JpCardsFile`, `JpPendingCard`, `GlobalCard`, `GlobalCardsFile` |
| `banner.ts` | `Banner`, `BannerItem`, `BannerId`, `BannerFile` (Global's, JP's and predicted banners: one shape) |
| `event.ts` | `EVENT_KINDS`, `EventKind`, `GameEvent`, `EventCard`, `EventItem`, `Phase`, `EventsFile`, `PredictedEvent`, `PredictedEventsFile`, `EventPairsFile`, `CmRewardsFile` |
| `scenario.ts` | `Scenario`, `StartDate`, `ScenariosFile` |
| `pullGuide.ts` | `PullGuide`, `Advice`, `NoBannerAdvice`, `Release` |
| `news.ts` | `NewsPost`, `AiAnswer`, `AiAnswersFile` |
| `predictions.ts` | `KnownDatesFile`, `PredictedCard`, `PredictionsFile` |
| `sources.ts` | `Source`, `SourcesFile` |
| `gametora.ts` | `GametoraCard`, `GametoraTrainee`, `GametoraEventsFile` |
| `files.ts` | `DATA_FILES` / `GENERATED_FILES` (file → schema), `JSON_SCHEMAS` |

`test/schemas.test.ts` parses every data file (generated ones when present) with its schema; `pnpm build-schemas`
writes `schemas/*.json` from `JSON_SCHEMAS` (`z.toJSONSchema()`, then Biome formats them) and the test fails when
they're stale. Ajv is gone. A shape change: edit the zod schema, `pnpm build-schemas`. Constants shared by scripts
and src live here (`EVENT_KINDS`: `scripts/lib/events.ts` re-exports it).

## `useAsync` (W-L1)

```ts
// src/useAsync.ts
export function useAsync<T>(load: () => Promise<T>, deps: React.DependencyList):
  { data: T | undefined; error: unknown; pending: boolean };
```
Runs `load()` when `deps` change; ignores results of a stale run (the old `let cancelled` flag); `data` resets to
`undefined` when deps change; `pending` true until it settles. No caching (the loaders cache themselves).

## Stores (W-L2)

zustand + `persist`, **same localStorage keys and stored formats as today** (so nobody loses settings; use
`persist`'s `partialize` / custom `storage` `serialize`/`deserialize` to keep today's JSON, e.g. `hidden` as an array
of strings, `compact` as the string `"false"`/`"true"`). Each store validates what it loads with a `zod/mini` schema
and falls back to the defaults on anything invalid or a throwing `localStorage`. Each keeps its plain-JS getters for
non-React readers (`getSetting()` in `src/i18n`).

| Store file | Key | Shape |
|---|---|---|
| `src/settingsStore.ts` | `uma-ddoc.settings` | `{ timeZone, scenarioNames, jpNewsLanguage }` |
| `src/tierListFilters.ts` | `uma-ddoc.tierListFilters` | `{ stat, shown, query, size }` |
| `src/timeline/hidden.ts` | `uma-ddoc.timelineHidden` | `string[]` → `Set` |
| `src/timeline/collapsed.ts` | `uma-ddoc.timelineCollapsed` | `string[]` → `Set` |
| `src/timeline/compact.ts` | `uma-ddoc.timelineCompact` | `"false"` / anything else → boolean |
| `src/timeline/order.ts` | `uma-ddoc.timelineOrder` | `string[]` (normalised as today) |

## Routes (W-L3)

`src/routes.ts`: `cardUrl(id)`, `scenarioUrl(key)`, `timelineUrl(server?, id?)`, `TAB_URLS`; each returns the hash
string (`#/card/30321`). wouter `<Router hook={useHashLocation}>`, routes `/`, `/timeline`, `/timeline/:server/:id`,
`/scenarios`, `/scenario/:key`, `/settings`, `/card/:id`, `/banners` → `/timeline`. Must keep: the Cards tab active on
a card page and Scenarios on a scenario page; `<main key={route}>` scroll reset; `goBack()`; the Timeline's sheet
address set with `history.replaceState` (not wouter's `navigate`, which would re-route).

## CSS Modules (L4)

- `vite.config.ts`: `css: { modules: { localsConvention: 'camelCaseOnly' } }`, so `.see-more` is `styles.seeMore`.
  Biome: `css.parser.cssModules: true`.
- A component's styles: `Component.module.css` next to it, `import styles from './Component.module.css'`, classes
  combined with `clsx(styles.a, cond && styles.b)`.
- **Stay global** (`src/styles/global.css`): `:root` tokens + dark mode, resets, `body`/`html`, tier colours
  (`.tier-0`…), and the tone variables, now `[data-tone="kind-story"] { --tone: … }` (entries keep `tone` as a key;
  components render `data-tone={entry.tone}`).
- Global classes other code relies on become `data-` attributes: `useDragScroll` sets `data-dragging`; `BackToTop`
  finds its scroller with `closest('[data-scroll-root]')`.
- Tests never look elements up by class name: by role, label or text.

## UI primitives (W-C1, W-C2): `src/ui/`

Each its own `X.tsx` + `X.module.css`, its CSS **moved** (not copied) from where it lives today.

| Component | Props | Replaces |
|---|---|---|
| `LinkButton` | `href, external?, icon?, children` (external: new tab + ExternalLink icon) | `.link-button` + icon |
| `SeeMore` | `href? \| onClick?, children` (› after) | `.see-more` |
| `FoldToggle` | `expanded, onToggle, moreLabel, lessLabel` (⌄/⌃) | show N more / show less pairs |
| `Pill` | `variant: 'tag' \| 'kind' \| 'status' \| 'verdict' \| 'label', tone?, title?, children` | `.tag`, `.entry-kind`, `.origin-kind`, `.badge`, `.verdict-chip`, `.pull-label` |
| `TierChip` | `tier?: number, pending?, title?` | the three tier-chip styles |
| `Segmented` | `label, options: { value, label, icon?, ariaLabel? }[], value, onChange, disabled?` | `fieldset.segmented` |
| `Section` | `title, level?: 2 \| 3, action?, children` | section headings with a button beside |
| `Status` | `children` | `p.status` |
| `SearchInput` | `value, onChange, placeholder, label, clearLabel` | the tier list's search |
| `ToolbarButton` | `icon, label, onClick, pressed?, disabled?, iconOnly?` | Timeline toolbar buttons |
| `CardRow` | `id, name, title?, href, meta?` (icon, name, title) | passed-by list, featured items, origins |

`StatusBadge` becomes `<Pill variant="status">`.

---

# Part 3 — Tasks

Format: **ID · title · model** — Depends · Files (owned) · Checks · Steps/notes.
Waves: every task in a wave can run at once; a wave starts once the one before is merged.

## Wave 0 — foundations (lead)

**L0 · Tooling + mass rename · lead** — Depends: — · Files: everything · Checks: CHECK-BASE, CHECK-DATA, CHECK-UI
1. Branch `ts-migration`. Add `typescript`, `@types/node`, `@types/react`, `@types/react-dom`; `tsconfig.json` (part 2);
   `typecheck` script; `deploy.yml` runs it.
2. Script the rename: `git mv` every `*.js` → `*.ts`, `*.jsx` → `*.tsx` under `src/ tierlist/ scripts/ test/` +
   both configs; rewrite relative import specifiers to match; prepend `// @ts-nocheck` to each; `package.json`
   scripts → `.ts`; `index.html` → `main.tsx`; vitest globs `*.test.{ts,tsx}`.
3. `test/i18n.test.tsx`: its source scan matches `/\.[jt]sx?$/` and reads `App.tsx`.
4. All checks green with zero behaviour change, commit.

**L1 · zod schemas · lead** — Depends: L0 · Files: `shared/schemas/*`, `scripts/build-schemas.ts`, `schemas/*.json`,
`package.json`, `test/cards.test.ts` + `test/pull-guide.test.ts` (Ajv → zod) · Checks: CHECK-BASE
Write the schemas from the shapes CLAUDE.md and the data files document; parse every committed `data/*.json` and
the generated files with them in a test (`test/schemas.test.ts`) so they're proven right; remove `ajv`.

## Wave 1 — type the pure code (workers, parallel) — done 2026-10-13

Merged with the lead's integration commits (one type per shape: `JoinedCard`, scenario weights, `Lexicon`,
`Entry`, `Ranked`/`Stat`, `ArtBannerFile`). Types to build on: `tierlist/index.ts` (`Stat`, `Ranked`),
`tierlist/scenarios.ts` (`ScenarioWeights`, `ServerConfig`), `src/timeline/entries.ts` (`Entry` and its parts,
`EntryStatus`), `src/timeline/layout.ts` (`Timeline`, `LaneGroupRows`), `src/gametora.ts` (`ArtBanner`…),
`scripts/lib/news-lang/index.ts` (`Lexicon`, `JapaneseLexicon`, `DateRef`, `Block`), `scripts/lib/news-text.ts`
(`Server`, `Section`).

All: typing recipe; owned files only.

| ID | Model | Files | Checks |
|---|---|---|---|
| T1 | haiku | `tierlist/{cards,join-cards,index,cli}.ts` | BASE, DATA (+ upstream) |
| T2 | sonnet | `tierlist/scenarios.ts` | BASE, DATA (+ upstream) |
| T3 | sonnet | `tierlist/tierlist-calc.ts` (keep the MIT header; upstream-derived, type lightly) | BASE, DATA (+ upstream) |
| T4 | haiku | `src/{tiers,rankHistory,cardOrigins,gametora,umapyoi,servers,predictions,pullGuide,scenarioRelease,statIcons}.ts` | BASE |
| T5 | haiku | `src/timeline/{entries,events,format,scenarioStrip,globalProgress}.ts` (`Entry` type from `entries.ts`' header comment, exported) | BASE |
| T6 | haiku | `src/timeline/{layout,data,useRankings}.ts`, `src/i18n/index.ts`, `src/useDragScroll.ts`, `src/useMediaQuery.ts` | BASE |
| S1 | haiku | `scripts/lib/{paths,sources,upstream,news-text,news,post-categories}.ts` | BASE, DATA |
| S2 | sonnet | `scripts/lib/news-lang/{index,en,ja,ja-banners}.ts`; export `type Lexicon` from `index.ts`: every key `en` has, + `ja`'s extra hooks as optional | BASE, DATA |

## Wave 2 — type the scripts (workers, parallel) — done 2026-10-13

Every `scripts/` file is typed. Integration widened the schemas to what the code writes (a banner item's `type` and a
re-run's `end` may be null; `global_cards.json` entries may have `news_url` and a null title; the pull guide's
`updated` may be null). Types to build on: `scripts/lib/events.ts` (`Fragment`, `BuildOptions`),
`scripts/lib/banner-posts.ts` (`BannerPost`), `scripts/lib/event-questions.ts` (`Field`, `AskedEvent`),
`scripts/lib/global.ts` (`CardRecords`), `scripts/lib/cards.ts` (`UpstreamCard`). S8 typed `colors.ts` too.

| ID | Model | Files | Checks |
|---|---|---|---|
| S3 | haiku | `scripts/lib/{banner-posts,event-blocks,event-rewards}.ts` | BASE, DATA |
| S4 | sonnet | `scripts/lib/events.ts` | BASE, DATA |
| S5 | sonnet | `scripts/lib/{event-questions,ai}.ts` | BASE, DATA |
| S6 | haiku | `scripts/lib/{jp-cards,jp-banners}.ts` | BASE, DATA |
| S7 | haiku | `scripts/lib/{global,scenarios,gametora-events}.ts` | BASE, DATA |
| S8 | haiku | `scripts/lib/{cards,pull-guide,news-api}.ts` | BASE, DATA |
| S9 | haiku | `scripts/{build-cards,update-cards,clone-upstream,update-global,update-jp,scrape-gametora,list-events,categorize-news}.ts` | BASE, DATA |
| S10 | haiku | `scripts/{fetch-news-latest,fetch-news-all,fetch-news-umapyoi,fetch-pull-guide,ai-events}.ts` | BASE (no network runs: these fetch) |

## Wave 3 — libraries (workers; L1→L2→L3 in order, L4 alongside) — done 2026-10-13

`src/useAsync.ts` (data loading), zustand stores over `src/rawStorage.ts` (each store keeps its own stored
format), wouter with `src/routes.ts` (every link built there; its own `useHashLocation` follows `hashchange` only, so
the Timeline's `replaceState` doesn't re-route), `scripts/lib/http.ts` (`paced()`), p-retry, pngjs, parseArgs.
Differences: `#/banners` now rewrites the address to `#/timeline`; `#/timeline/<unknown server>/<id>` opens the
Timeline (was the Cards tab). Tests can render hooks: `// @vitest-environment jsdom` + `@testing-library/react`.
Not yet checked in a browser (none on the lead's machine).

**W-L1 · `useAsync` · haiku** — Depends: wave 1 · Files: `src/useAsync.ts` (new), `src/pages/{CardPage,TimelinePage,TierListPage,ScenarioPage}.tsx`, `src/timeline/useRankings.ts`, `test/use-async.test.tsx` (new) · Checks: BASE, UI
Write the hook (spec, part 2) + a test (stale result ignored, deps change resets). Replace each `let cancelled`
effect that loads data with it. **Leave** the ranking effects that yield with `setTimeout` before computing
(`useScenarioRankings`, `useUpcomingRanking`, TierListPage's ranking): only their `cancelled` bookkeeping may use the
hook if the yield stays inside `load`. Don't type the pages (they keep `@ts-nocheck`).

**W-L2 · zustand stores · haiku** — Depends: W-L1 · Files: the six store files (part 2 table), `src/settings.ts(x)`,
the stores' callers in `src/pages/{TierListPage,TimelinePage,SettingsPage}.tsx`, `test/stores.test.ts` (new) ·
Checks: BASE, UI
Per the spec. The test: each store reads today's stored format (write the old JSON into a fake `localStorage`
first) and falls back on garbage and on a throwing `localStorage`. Lead adds `zustand` + `zod` before handing out.

**W-L3 · wouter + routes · sonnet** — Depends: W-L2 · Files: `src/App.tsx`, `src/routes.ts` (new), every `src/**`
file with a `#/` string literal (`grep -rn "'#/\|\`#/" src`), `test/routes.test.ts` (new) · Checks: BASE, UI
Per the spec. Every hand-built hash becomes a `routes.ts` call. Test the builders. Lead adds `wouter`.

**W-L4 · script helpers · haiku** — Depends: wave 2 · Files: `scripts/lib/http.ts` (new), `scripts/lib/{news-api,ai,colors}.ts`,
`scripts/{scrape-gametora,fetch-pull-guide,fetch-news-umapyoi,ai-events,categorize-news,fetch-news-latest,fetch-news-all}.ts`,
`tierlist/cli.ts`, `test/colors.test.ts` · Checks: BASE, DATA
1. `http.ts`: `sleep(ms)`, `pacedFetch(url, init, { pause: [min, max] })` (one request at a time, a random pause
   between requests); replace the five local `sleep`/`pause` copies, **keeping each script's own pause lengths**.
2. `ai.ts`' retry loop → `p-retry` (same waits: 5 s, 10 s, 20 s…; same 429 handling).
3. `colors.ts`: `decodePng` → `pngjs` (`PNG.sync.read`), same `{ width, height, rgba }` return; the colour logic
   untouched; `colors.test.ts` passes unchanged.
4. Flag parsing → `parseArgs` (same flags, same defaults).
Lead adds `pngjs`, `@types/pngjs`, `p-retry`.

## Wave 4 — CSS Modules + primitives

**L4 · CSS Module groundwork · lead** — Depends: wave 3 · Files: `vite.config.ts`, `biome.json`, `src/App.css` →
`src/styles/global.css` + what stays app-shell, `src/timeline/entries.ts` (tone stays a key), `useDragScroll.ts`,
`BackToTop.tsx`, `src/main.tsx` · Checks: BASE, UI
Per the CSS Modules spec: config, global.css, `data-tone` + tone variables, `data-dragging`, `data-scroll-root`.

**W-C1 · primitives A · haiku** — Depends: L4 · Files: `src/ui/{LinkButton,SeeMore,FoldToggle,Pill,TierChip,Status}.{tsx,module.css}`,
`src/timeline/StatusBadge.tsx`, `test/ui.test.tsx` (new) · Checks: BASE, UI
Build them per the table (typed props), CSS moved from the files the "Replaces" column names: **only add the new
components; don't change callers yet** (the old classes stay until the page tasks remove them). Render tests for each.

**W-C2 · primitives B · haiku** — Depends: L4 · Files: `src/ui/{Segmented,Section,SearchInput,ToolbarButton,CardRow}.{tsx,module.css}`,
`test/ui-b.test.tsx` (new) · Checks: BASE, UI — as W-C1.

**W-C3 · Dropdown → Radix Select · sonnet** — Depends: L4 · Files: `src/Dropdown.tsx`, `Dropdown.module.css`,
`src/ScenarioPicker.tsx`, `test/scenario-picker.test.tsx` · Checks: BASE, UI
Same props and look (groups under headings, icon, pill, note, badge, italic, disabled; opening scrolls the selected
option into view, centred). Radix gives the keyboard handling and type-ahead. Lead adds `@radix-ui/react-select`.

## Wave 5 — pages (workers, parallel)

Every page task: switch the page to the `src/ui/` primitives, move its CSS into `*.module.css` (delete the old file
or the moved rules), remove `@ts-nocheck` and type it (recipe), make its tests find elements by role/text.
Checks: BASE, UI (list the screens).

| ID | Model | Files |
|---|---|---|
| P1 | haiku | `src/{App,Sheet,FilterSheet,BackToTop,main}.tsx` + their CSS; the rules left in `App.css` the primitives now own |
| P2 | haiku | `src/pages/TierListPage.tsx` (tier/card tile styles from App.css) |
| P3 | sonnet | `src/pages/CardPage.tsx` → `src/pages/card/{CardPage,PullAdvice,Origins,RankOverTime,ScenarioTierTable}.tsx`, `card.css` → modules |
| P4 | haiku | `src/pages/RankChart.tsx` + its rules from `card.css` (coordinate: P3 owns `card.css`; P4 runs after P3) |
| P5 | haiku | `src/pages/{ScenarioPage,ScenariosPage}.tsx`, `scenario.css`, `scenarios.css`, `test/scenario-page.test.tsx` |
| P6 | haiku | `src/pages/SettingsPage.tsx`, `settings.css`, `test/settings-page.test.tsx` |
| P7 | haiku | `src/timeline/TimelineSheet.tsx`, `sheet.css`, `test/timeline-sheet.test.tsx` |
| P8 | sonnet | `src/pages/TimelinePage.tsx` → split out `src/timeline/{useCompactRows,useTimelineFilters,useCenterOn}.ts`; `src/timeline/{Lanes,TimelineAxis}.tsx`, `timeline.css` → modules |
| P9 | haiku | `src/timeline/{TimelineFilter,GroupOrder}.tsx` + their CSS |

## Wave 6 — tests + docs

| ID | Model | Files |
|---|---|---|
| X1 | haiku | type `test/{calc,data,cards,gametora,rank-history,card-origins,scenario-release,scenario-strip,scenario-names,umapyoi,global-progress,timeline,timeline-order}.test.ts` |
| X2 | haiku | type `test/{news,post-categories,banner-posts,events,event-questions,global,scenarios,colors,pull-guide}.test.ts` |
| X3 | haiku | type `test/{jp-news,jp-banners,jp-cards,jp-events,timeline-entries,timeline-events,i18n}.test.ts(x)`, `test/global-setup.ts`, `test/upstream/parity.test.ts` |
| L9 | lead | `grep -rn "@ts-nocheck\|TODO(ts)" src tierlist scripts test` is empty (or each left on purpose); CLAUDE.md: paths, stack, conventions (CSS Modules, `src/ui/`, routes, stores, zod); merge `ts-migration` → `main` |
