# uma-puller

A static, mobile-first web app for Uma Musume players, deployed to GitHub Pages:

- **Tier list** — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A collapsible rarity × LB filter picks which copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
- **Banners** — a horizontal, scrollable/draggable calendar of past and current
  gacha banners (scraped from GameTora), with a detail sheet per banner that
  shows each featured support card's tier-list rank.
- **Card page** (`#/card/<id>`) — one support card's full art, GameTora link, and its
  tier at each limit break in every scenario (plus the averaged "Overall" and
  "Current + future" rankings), then a "rank over time" chart (pick scenario + LB)
  and the newer cards that passed it. Opened from tier-list cards and the banner
  sheet's "See more"; it isn't a tab.

Stack: React 19 + Vite 8, i18next + react-i18next, Vitest, Biome + husky, `lucide-react` icons, pnpm (never npm). No
backend: all data is generated at build time.

## Commands

```sh
pnpm dev               # dev server (fetches card data on first run — see note below)
pnpm build             # production build into dist/
pnpm lint              # Biome: formatting + lint check (CI runs this)
pnpm format            # Biome: apply formatting and safe fixes
pnpm test              # Vitest unit suite (~15s; fetches card data if missing)
pnpm test:upstream     # compare our calculation with upstream's (~25s; needs the clone)
pnpm rank gl GL speed  # print a ranking in the terminal (scenario may be overall / upcoming)

pnpm update-cards      # card data from upstream main → generated/
pnpm scrape-banners    # banner history + card links/titles from GameTora → generated/
pnpm map-banner-cards  # link banner cards to our card data → generated/card_banners.json
pnpm clone-upstream    # clone/update upstream main into upstream/ (for test:upstream)
```

On a fresh checkout only the card data is fetched automatically. The Banners and
Card pages import `generated/*_banners.json` and `generated/gametora_cards.json`, so
run `pnpm scrape-banners && pnpm map-banner-cards` once before `pnpm dev`/`build`.

## Layout

```
tierlist/          ranking code (runs in Node and the browser)
  tierlist-calc.js   processCards(): scores candidates against a fixed deck (from upstream, ours now)
  scenarios.js       weights, training gains, per-server scenarios + deck presets (likewise)
  index.js           rankCards() (one deck), rankByUsefulness() (avg over preset decks, cached),
                     STATS (stat keys), presetDecks(), COMBINED (averaged rankings), scenarioOptions()
  cards.js           loadCards(server): joins generated metadata + per-server stats
  join-cards.js      joinCards(), NAME_FIELD (server → metadata name field)
  cli.js             `pnpm rank`
scripts/
  lib/upstream.js    everything that knows about the upstream repo (REPO, DATA_FILES,
                     UPSTREAM_DIR, download)
  clone-upstream.js  shallow clone (or fetch + reset) of upstream main into upstream/
  update-cards.js    download + split card data; exports ensureCards()
  scrape-banners.js  GameTora banner history + per-card URL/titles/release dates
  map-banner-cards.js
src/
  App.jsx            shell: hash routes (#/, #/banners, #/card/<id>), top bar (title or back button + server
                     switch), tab bar, shared server + scenario state
  pages/TierListPage.jsx
  pages/BannersPage.jsx, banners.css   calendar + detail sheet
  pages/CardPage.jsx, card.css         one card: art, GameTora link, tier per scenario × LB
  pages/RankChart.jsx                  SVG step chart of rank over time: fixed rank axis, sideways-scrolling
                                       plot (20px/month, quarters + years labelled), crosshair tooltip
  rankHistory.js     pure: a card's position at each past release date
  timeline.js        pure calendar layout (row packing, months, days)
  tiers.js           toTiers(), cardRanks(), TIER_NAMES, STAT_OF_TYPE
  servers.js         SERVERS: gl/jp ↔ banner file names
  i18n/index.js      i18next setup; statName/serverName/scenarioName/lbName, formatDate
  i18n/en.json       every UI string (English)
  useDragScroll.js   mouse drag-to-pan
test/                Vitest `unit` project (pnpm test)
test/upstream/       Vitest `upstream` project (pnpm test:upstream), needs upstream/
generated/           build-time data, gitignored — never edit or commit
upstream/            clone of upstream main, gitignored — only test:upstream reads it
.github/workflows/   deploy.yml, upstream-check.yml
```

## Data pipeline

Upstream card data, GameTora, and an upstream clone used only by tests:

| Input | Where it goes | Committed? | Updated by |
|---|---|---|---|
| Card lists + card events | `generated/raw/*.js` (as downloaded) → `metadata.json`, `global_stats.json`, `jp_stats.json`, `card-events.json` | no | `pnpm update-cards` (every deploy) |
| Banner history | `generated/{global,jp}_banners.json`, `card_banners.json` | no | `pnpm scrape-banners`, `pnpm map-banner-cards` (every deploy) |
| GameTora card URLs, titles, release dates | `generated/gametora_cards.json` | no | `pnpm scrape-banners` (every deploy) |
| Upstream code (for comparison only) | `upstream/` | no | `pnpm clone-upstream` (manual locally; CI clones it) |

- **The calculation is ours** (`tierlist/tierlist-calc.js`, `scenarios.js`): nothing
  syncs it automatically. Upstream's UI-only parts were dropped (the per-card `info`
  breakdown, scenario `version`/`currentState`/`show`, server `referenceDocUrl`,
  `defaultLocale`, `defaultFilters`, `defaultTierListDropdown`, `useLegacyFsBonusDisplay`).
  Keep the MIT attribution in their headers and `tierlist/LICENSE`.
- **Hearing about upstream changes:** `test/upstream/parity.test.js` imports upstream's
  calc, scenarios and card lists straight from the clone (Vite resolves their
  extensionless imports) and requires our rankings to match exactly. When it fails,
  port the change by hand (or update the test if we diverge on purpose). It also checks
  the clone and `generated/` are the same upstream commit (`SOURCE.json` `ref`) — if
  not, run `pnpm clone-upstream && pnpm update-cards`.
- `vite.config.js` keeps Vite's dependency scan and watcher out of `upstream/` (it's a
  whole other app with its own `index.html`).
- **Card ids are the same on Global and JP and in GameTora's data.** Global has a subset
  of JP's cards. Card data is split into server-independent `metadata.json` and per-server
  stats; `joinCards()` rebuilds upstream's exact arrays (verified by a round-trip check in
  `update-cards` and by `test/data.test.js`). Each server's `char_name` is in its own
  language, which `scenarioLink` in the scenarios relies on.
- Generated card data is **JSON** (one card per line), imported with
  `with { type: 'json' }` so the same imports work in Node (CLI, scripts) and Vite.
  Vite's dev server keeps that attribute on dynamic `import()`s while serving JSON as
  JS, which the browser rejects; a dev-only plugin in `vite.config.js` strips it.
  Only `generated/raw/` keeps upstream's JS modules, as downloaded (the tests and the
  round-trip check read them).
- `ensureCards()` fetches card data if any output is missing; it runs from a Vite
  plugin (dev/build) and from `test/global-setup.js`.
- **GameTora**: the history page is client-rendered, so the scraper reads GameTora's
  versioned JSON (`/data/manifests/umamusume.json` → `/data/umamusume/<name>.<hash>.json`).
  It's an internal format and may change; the scraper fails loudly if it does.
  "Special" (paid/step-up) banners are skipped. A banner's `main` item is our own
  heuristic (highest rarity, then highest rate).
- **`gametora_cards.json`** comes from GameTora's `support-cards` file: the card page
  link (GameTora's `url_name` slug, not derivable from the name), titles, and release
  dates (`release_gl` from `release_en`, `release_jp` from `release`). It covers more
  cards than our data (GameTora tracks newer JP cards than upstream has).
- Banner/card images are hotlinked from GameTora and upstream GitHub; full card art is
  GameTora's `tex_support_card_<id>.png` (3:4 portrait).

## Ranking semantics

- `processCards` (upstream) scores each candidate card as its **marginal** value when
  added to a fixed 5-card deck. Scores are only comparable within one
  server + scenario + stat.
- `rankByUsefulness` averages that score over the site's default deck and all deck
  presets; if a deck already holds the candidate's character, the candidate is scored
  against the other 4 cards (the game forbids duplicate characters).
- Tiers (S, A, B…) split the score range into 7 equal bands (upstream's banding).
- **Averaged rankings** (`COMBINED` in `tierlist/index.js`) are offered next to the real
  scenarios everywhere a scenario is picked: `overall` (every scenario) and `upcoming`
  ("Current + future": the server's `defaultScenario` plus every scenario listed before
  it, since `availableScenarios` is newest first). Each scenario's ranking is rescaled to
  0–1000 (bottom → top card) and those are averaged. Scenarios the server lists but
  doesn't define are left out of the averages: Global lists `DYI` but has no weights for
  it, so `getScenario` silently falls back to GL — Global's DYI row/option is a copy of GL.
- Banner sheet ranks use the **LB4 (MLB)** copy in the currently selected scenario.
  The card page ranks every LB in every scenario of the selected server (one scenario
  at a time, so rows fill in as they finish).
- **Rank over time** relies on candidates being scored independently: the tier list on
  a past date is the current ranking filtered to cards whose GameTora release date
  (`release_gl` / `release_jp`) is on or before it. The card is compared with other
  cards at the **same LB**. Preset decks stay as they are today. Cards without a
  release date (a few Global promo cards) are left out. The last step runs on to today,
  so where upstream's card lists lag the game the line is just flat at the end.
  No future/upcoming cards yet (planned: user-added events, e.g. Global releases of
  JP cards).
- Server keys: `gl` / `jp` for tier-list code, `global` / `jp` for banner files
  (`src/servers.js` maps them). GameTora card types map to stat tabs via `STAT_OF_TYPE`
  (`intelligence` → `wisdom`, `group` → `friend`).

## Tests

- `data.test.js`: generated data rebuilds upstream's lists exactly; names present; preset
  deck cards exist; every scenario (incl. averaged) × stat ranking is non-empty, finite,
  sorted; averaged rankings only use defined scenarios, include the current one, and
  score 0–1000.
- `calc.test.js`: one known score (Kitasan Black ≈ 372, from upstream's own test).
- `rank-history.test.js`: `rankHistory()` on a small synthetic ranking.
- `i18n.test.jsx`: every key used in `src/` exists (literal `t('…')`, `i18nKey="…"`, tab
  labels, and dynamically built ones); other catalogs match `en.json`'s keys; plurals,
  lists and `<Trans>` render as expected.
- `upstream/parity.test.js` (`pnpm test:upstream` only): same upstream commit as
  `generated/`; same scenarios, default and deck presets; every scenario × stat × preset
  deck ranks exactly like upstream's code on upstream's card lists (75 tests).

## Code style

- **Biome** (`biome.json`) formats and lints JS/JSX, CSS and JSON; run `pnpm format`
  before committing. Style: semicolons at the end of statements, a trailing newline at
  the end of every file, 2-space indent, single quotes in JS (double in JSX attributes),
  ES5 trailing commas, 120 columns.
  Git-ignored paths (`generated/`, `upstream/`, `dist/`) are skipped.
- **Pre-commit hook** (husky, `.husky/pre-commit`): applies Biome's formatting + safe
  fixes to the staged files and re-stages them, then blocks the commit if anything that
  can't be auto-fixed remains. Partially staged files are only checked, never fixed (re-
  staging would commit their unstaged changes); fix those with `pnpm format` + re-stage.
  `pnpm install` sets it up (the `prepare` script). Bypass in an emergency with
  `git commit --no-verify`.
- Linter uses the `recommended` preset. Where the code is deliberate, suppress with a
  `biome-ignore <rule>: <reason>` comment (see the banner sheet backdrop and `RankChart`)
  rather than turning rules off globally.

## Frontend conventions

- **No hard-coded UI text.** Every user-facing string (including `aria-label`s, titles
  and badges like MLB) lives in `src/i18n/en.json` and is rendered with `t()` from
  `useTranslation()`, or `<Trans>` for sentences with markup. Catalogs use i18next's
  format: `{{var}}`, plural keys `key_one`/`key_other` (pass `count`), `{{items, list}}`
  for "A, B, and C". Display names for code keys go through the helpers in
  `src/i18n/index.js` (`statName`, `serverName`, `scenarioName`, `lbName`); `tierlist/`
  and `src/servers.js` hold keys only. Dates go through `formatDate()` so they use the
  UI's locale. A new language is a new JSON file registered in `RESOURCES`.
- **Mobile first.** Base CSS targets phones; `@media (min-width: 768px)` adds desktop
  tweaks. Top bar (page title or back button, server switch) always on top; tab bar at
  the bottom on phones, under the top bar on desktop. Pages don't render their own title. Check layouts at 360–390px wide.
- Colour tokens live on `:root` in `src/App.css`, with a dark-mode override; use them
  instead of literal colours (tier colours `.tier-0`… are the exception).
- Hash routing only — GitHub Pages can't serve deep links. `vite.config.js` uses
  `base: "./"` so the build works under any Pages path.
- Icons come from `lucide-react` (the same Lucide set Streamline hosts); don't use text
  symbols as icons.
- Card and trainee icons are square images; show them uncropped (`object-fit: contain`).
- Heavy work (rankings take ~100–300 ms each; averaged ones run every scenario) yields
  before computing so loading text can paint, and is cached per server/scenario/stat.
- Charts are hand-written SVG (no chart library): colour tokens for marks and text,
  hairline gridlines, a hover/keyboard crosshair + tooltip. Long time axes scroll
  sideways with `useDragScroll` instead of squeezing labels.
- Toggle groups are `<fieldset className="segmented">` (shared styles in `App.css`);
  every `<button>` has an explicit `type`.
- Scenario pickers list the real scenarios, then the `COMBINED` ones in an "Averaged"
  `<optgroup>`; display names go through `scenarioName()` (from `src/i18n`).

## CI / deploy

- `deploy.yml` — on push to main, daily, and manually: install → `pnpm lint` → `update-cards` →
  `scrape-banners` → `map-banner-cards` → `pnpm test` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- Pages source must be set to "GitHub Actions".
