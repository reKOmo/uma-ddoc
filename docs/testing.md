# Testing

```sh
pnpm test              # Vitest unit suite (~15s; fetches card data if missing); pre-push runs it
pnpm test:upstream     # our calculation vs upstream's (~25s; needs `pnpm clone-upstream`)
pnpm test:e2e          # the app in a browser (Playwright, e2e/; starts the dev server; ~45s; needs
                       # `pnpm exec playwright install chromium` once; E2E_PORT=… for parallel runs)
pnpm test:visual       # 14 screens × light/dark × phone/desktop, pixel by pixel against baselines made on this
                       # machine (.visual-baseline/, not in git; `--update-snapshots` from a known-good commit;
                       # VISUAL_BASELINE=… to share them)
```

## When to run what

- Small UI tweaks: `pnpm lint` only.
- Routing changes and real refactors: `pnpm test` + `pnpm test:e2e`. Deploys run both.
- Changed a data shape: `pnpm build-schemas` (`schemas.test.ts` fails when `schemas/*.json` are stale).
- Changed a shared news parser: run `update-global` / `news:events` before and after; Global's output must be
  byte-identical.

## Conventions

- Unit tests live in `test/` (Vitest `unit` project); jsdom for component tests (`*.test.tsx`).
- Type partial test data with `fixture<T>()` and must-exist lookups with `present()` (`test/helpers.ts`).
- e2e: select by role and label, never class names; any uncaught page error fails a test.
- `test/upstream/` (`upstream` project) needs the clone in `upstream/`; see [ranking](ranking.md).

## What each test covers

- `schemas.test.ts`: every committed data file fits its zod schema (`shared/schemas/files.ts`), every generated one
  present too, and `schemas/*.json` are what `pnpm build-schemas` writes.
- `stores.test.ts`: each persisted store reads the format older versions stored, writes exactly that format, and
  falls back to its defaults on garbage or a throwing localStorage.
- `use-async.test.tsx`, `routes.test.ts`, `routes-replace.test.tsx` (jsdom): `useAsync` (stale runs ignored, deps
  resets); the URL builders and `<App>` at each address (page, highlighted tab, the `#/banners` alias); a Timeline link
  keeping its entry when the page replaces the address on mount (the routing bug wouter's first hook had).
- `ui.test.tsx`, `ui-b.test.tsx`, `dropdown.test.tsx` (jsdom): the `src/ui/` components and the Radix dropdown (groups,
  disabled options, choosing, icons / notes / badges).
- `e2e/` (Playwright; `pnpm test:e2e`): links into the Timeline open their sheet on the right server (direct, "See
  banner", the other server's link, back from a card page), stored state survives reloads and older formats load, every
  page renders and loads on both servers, the dropdown by click / keyboard / tap, the rank chart's tooltip. Selectors by
  role and label, never class names; any uncaught page error fails a test. Run after UI or routing changes; deploys run it.
  `pnpm test:visual`: 14 screens × light/dark × phone/desktop pixel by pixel against this machine's baselines.
- `pull-guide.test.ts`: the script's output and `generated/pull_guide.json` (when present) fit the pull guide's zod
  schema; a tab's HTML view → entries (card id from the link, label, dates, Pull?, notes), mapped to banners
  (`byBanner`, `findBanner`), the tab list and update date; `upcomingBanner` / `currentAdvice` (running / next banner,
  cards on no banner), `latestAdvice`, `sheetLink`, `verdictOf` / `bannerVerdicts` (the Timeline filter).
- `news.test.ts`: the first parser (periods, kinds, banner ids + art, featured).
- `post-categories.test.ts`: categories, event kinds, phases and names from real titles; community posts never events.
- `jp-news.test.ts`: `parsePeriodJa` (JST, year nearest the post, open ends), JP `categorize()` (kinds, names, phases,
  admin posts kept out, celebrations by part art, labels), `norm()` on Japanese; over the stored JP news: scouts exactly
  where scout art is, the fixture samples (`test/fixtures/jp-news-samples.json`, ids sampled per kind) by group.
- `jp-banners.test.ts`: JP scout posts (first list, periods, R cards, paid per banner, re-runs) on fixtures,
  `applyJpNews()` (enrich, make, re-runs, idempotent, no icons); over the stored data: every seeded (GameTora) banner a
  post shows agrees on start, end and type; the 366 seeded banners kept, re-runs paired both ways; rebuilt from the
  seeded entries alone it's the stored file, nothing unresolved; no GameTora URL stored.
- `jp-events.test.ts`: JP events on fixture posts (story, CM, LR, LoH, specials, celebrations, gifts, login bonuses,
  sales) and over the stored data (story SSRs, CM / LoH schedules, no paid items, `local` names, parents exist); the
  GameTora fills (the cut, each kind's shape, cup schedules as the news has them, no overlap with news events,
  idempotent; only before mid-2022 in the data).
- `banner-posts.test.ts`: a scout post's banners (type, period, art, own list, each once), open-ended and
  year-crossing periods, paid scouts; every stored banner typed and dated, every regular scout's list non-empty.
- `events.test.ts`: posts cut into blocks; cards (phrasings, copies, trainees/unknown/bonus cards skipped); items
  (login day ranges, dated rows, aliases, prose gifts vs lists, fees, amount-less mentions, vouchers); titles; mission
  sets; one-event posts kept whole; celebration sub-events (names, kinds, gift without period, folded blocks); merging
  (most advanced post's dates, ended posts, same-named events kept apart); the Champions Meeting range; mission sets
  as bars under their event; over the stored
  news: every event post makes dated events of known kinds, every story event has its SSR.
- `global.test.ts`: `applyNews` (news + JP banner → Global banner/releases, idempotent, seeded entries kept but given
  their post and art,
  unknown ids, paid scouts and type mismatches skipped) and `englishNames`.
- `cards.test.ts`: `buildCards()` (merge rules: Global's titles/dates, names by character, group names, the history
  only: GameTora's list gives slugs, never a card the history lacks; a card upstream lacks from the history; no
  GameTora, neither), the stats files, and `cards.json` against its schema.
- `jp-cards.test.ts`: `newsCards()` on real posts (story SSRs quoted or not, campaign gifts from their part, scout cards
  incl. a select-pickup's R card, first appearance), `applyNewsCards()` (augmenting, gift sources, frozen cards
  untouched, pending, GameTora-only cards listed, idempotent, kept GameTora fields, rarity disagreements); over the
  stored data: nothing to add today, and the frozen cards from 2026-06 on rebuild identically but 30310.
- `gametora.test.ts`: GameTora's URLs built from ids / slugs, `withArt()` (official art kept, item icons: upstream's
  where cards.json has one, else GameTora's).
- `data.test.ts`: generated data rebuilds upstream's lists exactly, carries upstream's events; names present; preset
  deck cards exist; every scenario (incl. averaged) × stat ranking is non-empty, finite,
  sorted; averaged rankings only use defined scenarios, include the current one, and
  score 0–1000.
- `calc.test.ts`: one known score (Kitasan Black ≈ 372, from upstream's own test).
- `rank-history.test.ts`: `rankHistory()` on a small synthetic ranking.
- `card-origins.test.ts`: `cardOrigins()` (kinds, re-runs, oldest first, `originKinds()`, parts over their event, both servers).
- `timeline-entries.test.ts`: both servers' calendars (real + predicted) as entries: the same fields everywhere, unique
  keys, known statuses, relations / parents / parts pointing at entries, art on every banner; re-runs both ways,
  predicted / paid banners, predicted events' card names and JP links, one-day events, `bannerStatus()`.
- `timeline-sheet.test.tsx`: the sheet's sections, in order, for a predicted banner, a paid scout, a celebration and
  its part (the sheet's portal mocked away).
- `timeline-order.test.ts`: the lane groups' order (default, dropping among shown groups, groups a saved order lacks).
- `timeline.test.ts`: calendar days in UTC vs. the viewer's timezone (TZ pinned to Europe/Warsaw); end-less entries;
  `laneGroups()` order; `visibleRows()` (compact mode: rows in view, parts by their entry's key, open ends).
- `global-progress.test.ts`: the Global-in-JP estimate, window ends (known vs. predicted), reruns, paid and `-rerun`
  banners ignored.
- `scenarios.test.ts`: scenario mentions in news (dated vs. not, false positives), `mergeGametora` (JP side only, never Global's dates), `applyScenarioNews`.
- `timeline-events.test.ts`: events in lane groups by type with parts only under their parent (`laneGroups()`, `partCount()`),
  item order, sub-events; the data, for both servers: every dated event placed once, only known kinds and groups (the
  app's lists = the build's), every Champions Meeting with its schedule (from round 1 for GameTora-filled cups),
  phase labels, existing parents, named items; `withPredicted()` (stale predictions dropped with their parts) and the
  predicted events file's shape (`test/fixtures/predicted-global-events.json`, and the generated file when present).
- `event-questions.test.ts`: doubts (amounts in sentences, per day, purchases not; copies in several places), the
  questions (only asked fields, every field when comparing, kind only for sub-events), `applyAnswer()` (doubted and
  empty fields, never sure ones; gaps / model modes; invalid answers, generic names, a year off, card copies among
  items, mission sets names only, copies the post gives), per-field re-asking and merging, `parseJson()`.
- `scenario-strip.test.ts`: scenario segments per server, current one, Japanese name fallback.
- `colors.test.ts`: PNG decoding through row filters, main colour (skin/hair left out, fallbacks).
- `scenario-release.test.ts`: launched vs. not per server (predictions never count), unknown keys.
- `scenario-picker.test.tsx`: the closed Dropdown / ScenarioPicker markup (listbox button, italic + hint when unreleased).
- `scenario-page.test.tsx`: the scenario page's markup (names, launches, predicted range, links), `isCurrent`, the
  Scenarios tab's list.
- `scenario-names.test.ts`: `scenarioName()` under the Scenario names setting (Global with JP fallback, JP).
- `settings-page.test.tsx`: About shows the version, the disclaimer and both credit links.
- `umapyoi.test.ts`: umapyoi.net links from both servers' post URLs.
- `i18n.test.tsx`: every key used in `src/` exists (literal `t('…')`, `i18nKey="…"`, tab
  labels, and dynamically built ones); other catalogs match `en.json`'s keys; plurals,
  lists and `<Trans>` render as expected.
- `upstream/parity.test.ts` (`pnpm test:upstream` only): same upstream commit as
  `generated/`; same scenarios, default and deck presets; every scenario × stat × preset
  deck ranks exactly like upstream's code on upstream's card lists (75 tests).

