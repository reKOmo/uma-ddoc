# Refactor plan (TS codebase audit, 2026-11-26)

Temporary (see [design process](conventions/design-process.md)): work through it one item at a time; when an item lands,
tick it and move any lasting rule into its topic doc. Delete this file when it's done.

Each item: where, what's wrong, the proposed fix, how it's checked. Line numbers are from the audit and drift; find the
code by name. Items marked **(look)** change how a page looks: decide with the developer before doing them (the frontend
rule: never change a page's look to fit a shared component). Items marked **(plan)** are big enough for an interview first.

Default checks: `pnpm typecheck` + `pnpm lint` always; `pnpm test` + `pnpm test:e2e` for moves and refactors; for a
change in `scripts/` that writes `data/`, rerun the writer and confirm `git diff data/` is empty.

## Done

- [x] **`scripts/lib/json.ts`: one `readJson<T>(path, fallback?)`.** Replaced the 3 local `readJson`s (banners/global,
  build-cards, cards/jp) and ~14 inline `existsSync ? JSON.parse(readFileSync…) : fallback` readers; `CARDS_JSON` in
  `lib/paths.ts` for `generated/cards.json`. Checked: build-cards output byte-identical, tests green.
- [x] **Time constants once:** `MINUTE` / `HOUR` / `DAY` / `JST` exported from `scripts/lib/news/text.ts`; local copies
  removed from `events/gametora.ts`, `events/free-scouts.ts`, `cards/jp.ts`, `ai/questions-jp.ts`, `umatl.ts`.
- [x] **`Server` once:** `SERVERS` + `Server` in `shared/schemas/common.ts`; `scripts/lib/news/text.ts` and
  `tierlist/cards.ts` re-export it, `cards/mdb.ts`' own `SERVERS` removed, inline `'gl' | 'jp'` replaced in
  `timeline/entries.ts`, `cards/build.ts`.
- [x] **`StatusBadge` → `src/ui/`** (all its importers are card page files).
- [x] **`RankChart` → `src/pages/card/`** (its only importer is `RankOverTime`).
- [x] **Origin pills use `ui/Pill`:** `KindPill` / `OriginPill` are `<Pill variant="kind" tone="kind-…">` (the global
  `data-tone` colours); `Origins.module.css` keeps only OriginPill's size. `nowrap` moved into Pill's `.kind`.

## 1. Bugs found along the way (do first, they're not refactors)

- [x] **`update-global.ts` reads `cards.json` before rebuilding it** (`cardData` read ~line 58, `buildCardFiles()` ~73,
  `buildEvents` gets the stale copy ~99): a Global card whose English title first appears this run isn't matched in
  events until the next run. Done: events get `builtCards`, read after `buildCardFiles()` (data/ unchanged today).
- [x] **GameTora fill ignores JP's event window:** `events/gametora.ts` (~182) uses a fixed `SAME_EVENT_DAYS = 45` to
  match an undated news event; `jp.sameEventDays` (`lang/jp.ts` ~426) gives Champions Meetings / League of Heroes 75.
  Done: `jp.sameEventDays(kind)` (now required on `JapaneseLexicon`); test in `jp-events.test.ts` (data/ unchanged).
- [x] **Search folds accents on the Cards tab only:** `TierListPage.tsx` `normalize` strips accents, `timeline/search.ts`
  doesn't. Done: `normalizeSearch()` in `src/lib/search.ts` used by both; test in `timeline-search.test.ts`.

## 2. Pills, badges and buttons (UI duplication): done

Decided: `ui/Pill`'s status look everywhere; near-copies snap to the shared component's look; the paid badge takes
the card page's paid tone (`kind-champions_meeting`). Visual diffs against HEAD checked (sheets, Timeline filter,
scenario page, dark card page changed; the rest pixel-identical).

- [x] Status pills → `StatusBadge` / Pill `status` (+ `size="lg"` in the sheet header; ScenarioPage's `out` drawn as live).
- [x] Small pills → Pill (`label size="sm"`, `tag size="sm"`, a toned status badge for "paid"); `#c2410c` gone.
- [x] Count badges: FilterButton wraps ToolbarButton, one `.badge`.
- [x] Tinted pill → Pill `tinted` (TypePill, the sheet's kind pill).
- [x] Tier chip → `TierChip` (centred inside it).
- [x] `.visually-hidden` / `.phone-visually-hidden` global; Dropdown `hideLabel` (the card page's scenario picker).
- [x] `<Segmented>` replaces the global `.segmented`; `variant="pill"` for the server switch.
- [x] `ResetButton`, `FilterGroup`; `FilterSheet.css` deleted; dead `.filter-button` selector gone.
- [x] Link buttons → `LinkButton` (button form, `filled`).
- [x] `.section-label` global (FilterGroup, Settings, Timeline search groups, race facts).
- [x] `--radius-control` token.
- [x] CardRow used by the sheet's featured tiles (`large`, `badge`, `meta`).
- [x] Timeline search chips and the filter's ticked chips are Pill `tinted` (through `pillClass()`); Pill `.confirmed` uses the `--confirmed` token
  and `--ink-light`.
- Left on purpose: the sheet's rewards chips (`--inset` tiles in a sheet, not Pill tags).

## 3. Shared logic in `src/`

- [ ] **One `useRanking`** for the 4 hand-written "yield, rank, ignore if superseded" effects (`TierListPage` ~97–110,
  `useUpcomingRanking`, `useScenarioRankings`, `timeline/useRankings.ts`), on `useAsync`. `useRankings` also splits its
  `ids.join()` key back into numbers.
- [ ] **Persisted store factory:** `persisted<T>()` + `stringSetStore()` / `booleanStore()` beside `rawStorage`;
  `collapsed.ts` = `hidden.ts`, `compact.ts` = `searchOverride.ts`, and `order`, `hiddenScenarios`, `tierListFilters`,
  `settingsStore` repeat the shape (~150 lines). Check: `e2e/storage.spec.ts` (old stored formats still load).
- [ ] **Pull verdicts out of the hidden set:** `pullOnly:<verdict>` keys mean "picked", the reverse of the rest
  (`TimelineFilter.tsx`, `useTimelineFilters.ts`; the hook imports `pullKey` from the component). Fix: its own `pulls`
  store (from the factory). Needs a stored-format migration.
- [ ] **Card page loaders cached:** `loadEntries` rebuilds and translates every entry per card page visit; `loadEvents`,
  `loadRealBanners` uncached (`withArt` 2–3× per file); `globalBannersPromise` a second hand-made cache
  (`timeline/data.ts`). Fix: memo per loader, `loadEntries` keyed by server + language.
- [ ] **Search cache** (`normalizeSearch` done in 1.3): the tier list re-runs `toTiers` and normalises
  every card on every render (`TierListPage` ~39–42, 85–93): memo the tiers, cache each card's text. Maybe
  `match-sorter` (already a dependency) for the every-word match.
- [ ] **`useUpcomingAdvice` ×3 per card page** (Summary, NextBanner, Banners): call it once in `CardPage`, pass it down.
- [ ] **Dates:** `dateFormats`, `dateRange`, `daysUntil` (`timeline/format.ts`), `DAY` (`timeline/layout.ts`) and
  `timeZoneOptions` / `clockOptions` / `localTimeZone` (`state/settings.tsx`) → `src/lib/dates.ts`, with a memoised
  `useDateFormats()` reading timeZone + clock (the card page drops the clock setting today). Also: `formatDate` =
  `formatDateTime` (`i18n/index.ts`); `ScenarioPage` `longTime` rebuilds `.time`; day ↔ ISO conversions ×6; a
  `86400000` literal in `lib/pullGuide.ts`.
- [ ] **One viewport hook for the Timeline:** `useRenderWindow`, `useStickyBars`, `useCompactRows` each listen to the
  scroller (order-dependent, only explained in comments). Fix: `useViewport(scroller)` publishing `{left, width}` per
  frame. Performance-sensitive: check scroll by hand.
- [ ] **Optional `generated/` loader ×6** (`lib/predictions.ts`, `lib/pullGuide.ts`, `lib/translations.ts`,
  `timeline/data.ts` ×3; two need a `TODO(ts)` cast) → `optionalJson<T>(glob)`.
- [ ] **`NextBanner` (~91–119):** 9 chained flags + nested ternaries → pure `pickShown()` returning a discriminated
  union; unit test it.
- [ ] **`useTimelineFilters`:** drop unread `unfold` / `NONE` / `laneOrder`; `kinds` from `presentGroups`.
- [ ] **`cardOrigins` generic over servers, one caller with one server** → `cardOrigins(cardId, entries, server)`.
- [ ] **Small:** `TimelinePage` resets the sheet on server change in an effect (key it by server); `toggled()` =
  `TimelineFilter`'s `toggle`; `scenarioSegments(SCENARIOS, server)` per render in `RankOverTime` (once per server);
  `looseObject` + hand destructuring in `settingsStore` / `tierListFilters` (`z.object` strips); four
  `saveFilters({...getFilters(), x})` setters → `patchFilters()`; duplicated comment in `useRankings.ts`.
- [ ] **Constants:** `SERVER_ORDER` ×2 (ScenarioPage, ScenariosPage); `LIMIT_BREAKS` ×2 (TierListPage, card/shared) →
  `lib/tiers.ts`; inline `'gl' | 'jp'` left in `scenarioStrip.ts`, `translate.ts` (use `Server`).
- [ ] **Unused exports:** `getHiddenScenarios` (nowhere); ~15 used only in their file (`getSettings`, `languageOf`,
  `masked`, `releaseAhead`, `traineeIcon`, `useUpcomingRanking`, `loadEvents`, `TERM_TYPES`, `ORIGIN_KINDS`,
  `isPullKey`, `bannerStatus`, `packRows`, Summary's tiles; grep `test/` first); `SETTING_OPTIONS` alias.

## 4. Shared logic in `scripts/`, `tierlist/`, `shared/`

- [ ] **JSON writers:** ~15 hand-written "one record per line" serialisers (`bannerList` / `writeGlobal`,
  `writeJpBanners` = writeGlobal's banner half, `writeJpCards`, `writePending`, `perLine`, `savePosts`,
  `events/files.ts`, `gold.ts`, `scrape-gametora.ts` ×3, `scenarios.ts`, `mdb.ts`). Fix: `jsonLines()` /
  `jsonEntries(record, indent?)` / `jsonEnvelope()` in `lib/json.ts`. Edge cases: `[]` vs `[\n\n]`, 2/4-space indents.
  Check: every writer rerun, `git diff data/` empty.
- [ ] **Global / JP banners share a module:** `lib/banners/common.ts` with `writeBannerFile`, `newestPerBanner`
  (`newestAnnounced` / `newestPosts`), `newestFirst`, and what jp.ts imports from global.ts today (`bannerList`,
  `endOfMinute`, `pickMain`, `BANNER_KINDS`). `jp.ts` ~48–62 derives `ScoutPost` etc. from `BannerPost` like global.ts;
  `addReruns` uses `newsFields()`; `withoutNews` / `seedDraft` one helper.
- [ ] **Newest-first comparator ×6** (`events/build.ts`, `gametora.ts` ×2, `update-jp.ts`, `banners/global.ts`,
  `banners/jp.ts`) → one export.
- [ ] **`update-jp.ts` re-reads:** `readEvents('jp')` ×2, `readJpBanners()` ×3 because `updateJpBanners` returns the
  result or `{lines}`; the no-GameTora path calls `fillFromGametora` with empty lists to sort. `update-global.ts`:
  `known.banners.find` in a loop (Map), `writeGlobal` twice. Event-diff `JSON.stringify` compare ×4 → `changedSince()`;
  summary.md appending ×3 → `writeSummary()`.
- [ ] **More time helpers:** ISO → `YYYY-MM-DD HH:MM` slice ×7 → `minuteText()`; `jstDay()`; nearest-year JST
  resolution ×2 (`parsePeriodJp`, `isoOfJst`) → `nearestYear()` (JP gold + replay tests must stay green);
  `fetch-news-umapyoi.ts`' own offset; `86400000` in `list-merges.ts`, `pull-guide.ts`.
- [ ] **Server helpers:** `isServer` / `serverArg` from `SERVERS`; `convert-mdb.ts` validates `--server` by hand,
  `ai-events.ts` declares the flag twice; the "gl has no suffix" file rule ×4 → `serverSuffix()`; gl → "global" file
  prefix in 3 places → `dataFile(server, kind)`. Inline `'gl' | 'jp'` left in `lang/index.ts`, `gold-review/main.tsx`.
- [ ] **`norm`:** drop the re-export in `events/rewards.ts` (~8 importers → `news/text.ts`); `lib/scenarios.ts`' own
  ASCII `norm` → `asciiKey` (it forces `normAny`); bracket stripping ×3 → `bareTitle()`; `title|name` key ×2 →
  `cardKey()`.
- [ ] **GameTora maps:** `GAMETORA_TYPES` (`cards/build.ts`) and `GAMETORA_TYPE` (`banners/jp.ts`, with a cast) are
  inverses, `src/lib/tiers.ts` a third → `toGametoraType` / `fromGametoraType` in `shared/schemas/common.ts`; `RARITY`
  (`banners/jp.ts`) = `RARITY_CODES`.
- [ ] **HTTP:** `fetch` + `!res.ok` throw ×6, User-Agent `HEADERS` ×3, `ai/client.ts`' own pacing → `getOk` / `getJson`
  / `getText` / `SCRAPER_HEADERS` in `lib/http.ts`.
- [ ] **Events:** `endOf` / `overlap` / `SAME_EVENT_DAYS` in both `merge.ts` and `gametora.ts` (with 1.2); GameTora
  seconds → ISO ×2.
- [ ] **News tool setup ×3** (`list-events`, `list-merges`, `ai-events`): `newsContext(server)`; `list-events` ignores
  `--server` and categories today.
- [ ] **`ai/answers.ts`:** hand-written `Loose*` types + 4 casts → a permissive zod schema; keep the semantic checks.
- [ ] **`lang/jp.ts`:** two bracket-depth scanners (`jpName`, `subName`) → `topQuotes()`.
- [ ] **Small:** `pickMain`'s redundant `?? null`; unreachable throws in `lexicon()` / `questionsOf()` (type the maps);
  `parsePeriodJp` sets `end.time` twice; `cmPhases` parses the line twice; `find()` in loops (`keepPhases`,
  `findBanner`); `scrapeEvents` duplicates `loadData` / `pick()`; `longerTitle`'s six lambdas; `structuredClone` for
  `JSON.parse(JSON.stringify())` (`tierlist/scenarios.ts`); `Map.groupBy` in `list-merges.ts`; flags read 3 ways
  (`parseArgs` everywhere); Global id-series thresholds ×3 → named in `lang/en.ts`; `isMain(import.meta.url)` ×10
  (optional).
- [ ] **Repeated parsing in `update-jp`** (~1 s per run, measured): compute fragments once. Only if the pipeline gets slow.

## 5. Big files to split (plan)

- [ ] **`src/pages/card/RankChart.tsx`** (one 333-line component): pure `rankChartLayout()` (points, segments, label
  placement, bands, chips, months, scenarios) + `useWidth` → `hooks/` + `useZoomCenter` + `RankAxis` / `DateAxis` /
  `ScenarioRule` / `TodayMarker`. Unit-test the layout.
- [ ] **`src/pages/TimelinePage.tsx`:** `useTimelineData`, `useSheetSelection` (+ hash sync), `useSearchCursor`,
  `TimelineToolbar`, `SearchStatus`. Check: e2e (routing, sheet back, search).
- [ ] **`src/timeline/TimelineSheet.tsx`** (15 components): `timeline/sheet/` (Header, Featured, Races, Schedule +
  pure `currentPhase()`, Navigation with one shared props type, Links).
- [ ] **`src/pages/TierListPage.tsx`:** `lib/cardSearch.ts`, store actions, `useRanking` (3.1), `TierFilters`,
  `TierSection` / `CardTile`.
- [ ] **`tierlist/tierlist-calc.ts` `processCards`** (~250 lines): `deckSetup`, `eventGains`, `trainingSchedule`,
  `rampedFsBonus`, `raceGains`; shared training-bonus preamble in `trainingGain` / `crossTrainingGain`. Keep the
  summation order exactly: `pnpm test:upstream` parity.
- [ ] **Smaller:** `ScenarioPage` (`LaunchSide`, `ScenarioNav`, the formatters → 3.7), `PassedBy`
  (`useScrollToPicked`, `ReleaseRow`, `PassRow`), `ai/answers.ts` `applyAnswer` (`mergeItems` / `mergeCards`),
  `gold-review/main.tsx` (`useGoldData`, `PostList`, `PostUnits`, `LabelForm`; local tool, low priority).
- Fine as is: `tierlist/scenarios.ts` (optional `BASE_STAT_WEIGHTS` + overrides, ~300 lines shorter, upstream test
  guards it), `lang/jp.ts` / `en.ts` (optional `lang/jp-names.ts`), `banners/jp.ts`, `cards/mdb.ts`, `entries.ts`,
  `Lanes.tsx`, `cards/pull-guide.ts`, `cards/jp.ts`.

## 6. Directory organisation

- [ ] **`timeline/scenarioStrip.ts` → `src/lib/`** (RankChart, RankOverTime, TimelineAxis, TimelinePage use it).
- [ ] **Dates → `src/lib/dates.ts`** (= 3.7): the card page stops reaching into `timeline/` for formatting.
- [ ] **Commands never imported:** `news-features.ts`' `writeFeatures` → `lib/news/features.ts` (lib imports a command
  today); `build-cards.ts`' `buildCardFiles` / `INPUTS` / `OUTPUTS` / `GAMETORA_CARDS_FILE` and `update-cards.ts`'
  `ensureCards` → `lib/cards/`; `build-schemas.ts`' `jsonSchema` / `schemaText` → `lib/schemas.ts`; `gold-review.ts`'
  `PostView` → a lib module. Rule for `docs/conventions/code-style.md`: commands import libs, never other commands.
- [ ] **Data-file paths live in domain modules** (`fetch-pull-guide`, `build-cards` import `banners/global.ts` for a
  path): with 4's `dataFile()`, or a `lib/files.ts`; `shared/schemas/files.ts` already names each file.
- [ ] **`state/settings.tsx` → `.ts`** (no JSX; ~11 imports).
- [ ] **`pages/card/Origins.tsx` → `OriginPills.tsx`** (holds `KindPill` / `OriginPill`).
- [ ] **Hooks naming (optional):** `pages/card/hooks.ts`, `advice.ts` vs the `useX.ts` files elsewhere;
  `lib/translations.ts` mixes a loader and hooks.
- [ ] **`test/` mirrors the source tree** (works with the Vitest config): `global.test.ts` → banners/global,
  `news.test.ts` → news/text, `ui.test.tsx` + `ui-b.test.tsx` per component; shared test helpers (post-HTML builders ×3,
  JSON readers ×14) → `test/helpers.ts`.
- [ ] **Casing in `shared/`** (camelCase, while Node code is kebab-case: `pull-guide.ts` / `pullGuide.ts` /
  `schemas/pullGuide.ts`): pick a rule, write it in `code-style.md`.
- [ ] **`tierlist/join-cards.ts` → `shared/`?** (scripts use it for codes and joining, not ranking; low payoff.)
- [ ] **`docs/codebase-map.md`:** missing `ui/InfoTip`, `ShouldPullChip`, `ShouldPullLine`, `timeline/gridStep.ts`,
  `RaceIcons`, `RaceTrack`, `TimelineSkeleton`, `pages/card/PassedBy.tsx`, `ScenarioFilter`, `scripts/news-pending.ts`,
  `scripts/lib/json.ts`; update with every move above.
