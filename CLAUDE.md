# uma-puller

A static, mobile-first web app for Uma Musume players, deployed to GitHub Pages:

- **Tier list** — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A collapsible rarity × LB filter picks which copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
- **Banners** — a horizontal, scrollable/draggable calendar of past and current
  gacha banners (Global: our own record in `data/`, kept up from the official news; JP: scraped
  from GameTora), with a detail sheet per banner that
  shows each featured support card's tier-list rank. Global's calendar continues into the
  future with JP's banners at their predicted Global dates (`ml/`), drawn half-transparent
  with JP art (nearly solid and "confirmed" when `data/known_dates.json` has their exact dates); their sheets rank the cards in JP's tier list. Banners from the news use the
  official art and link to their post.
- **Settings** (`#/settings`, a tab) — banner times in UTC (default, as the game announces them) or the
  viewer's timezone; remembered in the browser.
- **Card page** (`#/card/<id>`) — one support card's full art, GameTora link (if GameTora has it), and its
  tier at each limit break in every scenario (plus the averaged "Overall" and
  "Current + future" rankings), then a "rank over time" chart (pick scenario + LB)
  and the newer cards that passed it — continued dashed into the future on Global with
  predicted release dates of JP's cards (when it'll drop a tier). Opened from tier-list cards and the banner
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
pnpm scrape-gametora    # JP banner history + card links/titles/JP dates from GameTora → generated/
                       # (--seed-global [--force]: rewrite data/ from GameTora's Global data; one-off)
pnpm update-global     # official news → Global's banners + card releases in data/ (needs scrape-gametora)
pnpm map-banner-cards  # link banner cards to our card data → generated/card_banners.json
pnpm clone-upstream    # clone/update upstream main into upstream/ (for test:upstream)
pnpm fetch-news        # new posts from umamusume.com/news → data/news/ (+ summary.md); --backfill for the archive,
                       # --reparse to re-parse stored posts after changing scripts/lib/news.js (no requests)

pnpm setup-ml              # create ml/.venv (uv, Python 3.13) + install ml/requirements.txt
pnpm predict-gl            # predicted Global release dates of JP-only cards → generated/ (Python, ml/)
pnpm predict-gl:backtest   # walk-forward backtest of the candidate models
```

`ml/` is Python in its own venv (`pnpm setup-ml`). Deploys rerun it after the banner scrape, so predictions
restart from Global's latest release. The Banners page reads `generated/predicted_global_banners.json`
through an `import.meta.glob`, so it's optional: without `pnpm predict-gl` there are just no predicted bars. Announced Global dates go in
`data/known_dates.json` (committed; predictions pass through them).

On a fresh checkout only the card data is fetched automatically. The Banners and
Card pages import `generated/jp_banners.json` and `generated/gametora_cards.json`, so
run `pnpm scrape-gametora && pnpm map-banner-cards` once before `pnpm dev`/`build` (Global's
banners are committed in `data/`).

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
  lib/paths.js       ROOT, GENERATED_DIR, DATA_DIR, NEWS_DIR (every script's paths)
  lib/upstream.js    everything that knows about the upstream repo (REPO, DATA_FILES,
                     UPSTREAM_DIR, download)
  clone-upstream.js  shallow clone (or fetch + reset) of upstream main into upstream/
  update-cards.js    download + split card data; exports ensureCards()
  scrape-gametora.js  GameTora: JP banner history + per-card URL/titles/release dates (+ the one-off Global seed)
  update-global.js   data/news/ → Global's banners + card releases in data/, appends to data/news/summary.md
  lib/global.js      pure: applyNews() (news posts + JP banners → Global banners/releases), data/ reader/writer
  map-banner-cards.js
  fetch-news.js      official news API → data/news/announcements.json + data/news/summary.md (incremental)
  lib/news.js        pure parsing of news posts: kind, periods, announced banner ids, featured trainees/cards
src/
  App.jsx            shell: hash routes (#/, #/banners, #/settings, #/card/<id>), top bar (title or back button +
                     server switch), tab bar, shared server + scenario state
  settings.jsx       SettingsProvider/useSettings(): user settings via context, kept in localStorage (try/catch;
                     defaults without it). timeZone: 'utc' (default) | 'local'
  pages/SettingsPage.jsx, settings.css  the Settings tab
  pages/TierListPage.jsx
  pages/BannersPage.jsx, banners.css   calendar + detail sheet
  pages/CardPage.jsx, card.css         one card: art, GameTora link, tier per scenario × LB
  cardInfo.js        card page info: GameTora's link/JP fields + Global's title/date from data/
  pages/RankChart.jsx                  SVG step chart of rank over time: fixed rank axis, sideways-scrolling
                                       plot (20px/month, quarters + years labelled), crosshair tooltip
  rankHistory.js     pure: a card's position at each release date (marks predicted ones)
  predictions.js     optional loader for generated/predicted_gl_releases.json
  timeline.js        pure calendar layout (row packing, months, days)
  tiers.js           toTiers(), cardRanks(), TIER_NAMES, STAT_OF_TYPE
  servers.js         SERVERS: gl/jp ↔ banner file names
  i18n/index.js      i18next setup; statName/serverName/scenarioName/lbName, formatDate
  i18n/en.json       every UI string (English)
  useDragScroll.js   mouse drag-to-pan
test/                Vitest `unit` project (pnpm test)
test/upstream/       Vitest `upstream` project (pnpm test:upstream), needs upstream/
ml/                  Python (own venv, ml/.venv): predicts Global release dates of JP cards from
                     card info (data.py: GameTora's JP dates + data/'s Global ones), models.py, adjust.py
                     (known dates: by hand + Global banners rerunning newer JP ones; no JP weekends),
                     backtest.py, predict.py, banners.py (JP banners → predicted Global ones),
                     (see ml/README.md)
data/                ours, committed (nothing can regenerate it; generated/ is rebuilt every deploy):
  global_banners.json, global_cards.json   Global's banners + card releases: seeded from GameTora once,
                                           then from the news (`update-global`); news-made entries carry news_url
  known_dates.json   Global dates known ahead of time, by hand (`dates` by JP date, `banners` by gacha id)
  news/              official Global news (`fetch-news`): announcements.json, summary.md (last run)
generated/           build-time data, gitignored — never edit or commit
upstream/            clone of upstream main, gitignored — only test:upstream reads it
.github/workflows/   deploy.yml, upstream-check.yml
```

## Data pipeline

Upstream card data, GameTora, and an upstream clone used only by tests:

| Input | Where it goes | Committed? | Updated by |
|---|---|---|---|
| Card lists + card events | `generated/raw/*.js` (as downloaded) → `metadata.json`, `global_stats.json`, `jp_stats.json`, `card-events.json` | no | `pnpm update-cards` (every deploy) |
| JP banner history | `generated/jp_banners.json`, `card_banners.json` | no | `pnpm scrape-gametora`, `pnpm map-banner-cards` (every deploy) |
| Global banner history + card releases | `data/global_banners.json`, `data/global_cards.json` | yes | seeded from GameTora once; `pnpm update-global` from `data/news/` (`news.yml`; deploys rerun it) |
| GameTora card URLs, titles, JP release dates | `generated/gametora_cards.json` | no | `pnpm scrape-gametora` (every deploy) |
| Predicted Global release dates of JP-only cards and future Global banners | `generated/predicted_gl_releases.json`, `predicted_global_banners.json` | no | `pnpm predict-gl` (every deploy) |
| Announced Global dates | `data/known_dates.json` (`dates` by JP date, `banners` by JP gacha id with exact start/end) | yes | by hand, e.g. from the monthly release schedule image (Global's banners in `data/` add more) |
| Official Global news (banners, events, updates) | `data/news/announcements.json`, `data/news/summary.md` (last run's additions) | yes | `pnpm fetch-news` (`news.yml`, daily) |
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
- **GameTora is JP's source only** (plus the card page link and English titles of JP-only cards).
  Global's banners and card titles/release dates come from `data/`; GameTora's Global fields
  (`release_gl`, Global `title_en`) in `gametora_cards.json` are ignored (`src/cardInfo.js`,
  `ml/data.py` `load_card_info()` merge the two the same way). Don't make Global read GameTora again.
- **GameTora scraping**: the history page is client-rendered, so the scraper reads GameTora's
  versioned JSON (`/data/manifests/umamusume.json` → `/data/umamusume/<name>.<hash>.json`).
  It's an internal format and may change; the scraper fails loudly if it does.
  "Special" (paid/step-up) banners are skipped. A banner's `main` item is our own
  heuristic (highest rarity, then highest rate).
- **`gametora_cards.json`** comes from GameTora's `support-cards` file: the card page
  link (GameTora's `url_name` slug, not derivable from the name), titles, and release
  dates (`release_gl` from `release_en`, `release_jp` from `release`). It covers more
  cards than our data (GameTora tracks newer JP cards than upstream has).
- **Official news** (`umamusume.com/api/ajax/pr_info_index` / `pr_info_detail`, POST JSON, no cookies needed):
  keep it gentle. `fetch-news` pages 10 posts at a time like the site, stops at the first page with a known post,
  fetches details only for new/edited posts, one request at a time with 3–8 s random pauses — a normal day is
  1–3 requests. Don't make it refetch everything. `data/news/announcements.json` is one record per line and excluded
  from Biome. Timestamps from the API are UTC.
- **News → Global banners** (`scripts/lib/global.js`): scout posts show each banner's art as
  `gacha_banner_<id>_….png`, and `<id>` is the game's gacha id, which Global shares with JP (Global reruns JP's
  banners under JP's ids; 130/132 seeded Global banners match JP's id and cards). So a news banner is JP's banner
  of that id (featured ids, icons, rates, types) with the post's dates and official art, names/titles paired with
  the post's English list (by character name, else the one leftover), `announced: true`, `news_url`. Its cards
  not yet out get `release_gl` = its start's UTC date (+ `news_url`). `applyNews` rebuilds every news-made entry
  from all posts (idempotent; a later post about a banner wins) and never touches seeded ones. Verified: from the
  news alone it rebuilt 30134/30135 identical to GameTora's. A post whose banner id JP lacks is skipped (listed in
  the summary).
- **Known dates from Global's banners** (`ml/adjust.py`): every Global banner rerunning a JP banner newer than the
  anchor is a known date (JP start's JST date → Global start's UTC date), merged with `known_dates.json` (hand
  entries win; out-of-order ones dropped with a warning). Predicted banners skip ids `data/` already has.
- Banner/card images are hotlinked from GameTora and upstream GitHub; full card art is
  GameTora's `tex_support_card_<id>.png` (3:4 portrait). News-made banners use the official art from the post
  (936×228, no transparent margin: `.bar.official-art` covers instead of GameTora's crop).

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
  a past date is the current ranking filtered to cards whose release date
  (`release_gl` from `data/`, `release_jp` from GameTora) is on or before it. The card is compared with other
  cards at the **same LB**. Preset decks stay as they are today. Cards without a
  release date (a few Global promo cards) are left out. The last step runs on to today,
  so where upstream's card lists lag the game the line is just flat at the end.
  **On Global it continues as a dashed line** through JP's cards Global doesn't have yet, at
  their predicted dates (`generated/predicted_gl_releases.json` via `src/predictions.js`,
  optional). They're ranked with `rankByUsefulness(…, { upcoming: true })`: JP's stats
  (identical to Global's for every shared card), English names via another card of the same
  character; existing cards' scores don't change (averaged rankings keep the Global-only
  0–1000 scale, so upcoming cards can score above 1000). JP's newest cards have no stats
  upstream yet and are left out. Cards not on Global with a prediction get the chart too.
- Server keys: `gl` / `jp` for tier-list code, `global` / `jp` for banner files
  (`src/servers.js` maps them). GameTora card types map to stat tabs via `STAT_OF_TYPE`
  (`intelligence` → `wisdom`, `group` → `friend`).

## Tests

- `news.test.js`: news parsing (periods, kinds, banner ids + art, featured), the summary.
- `global.test.js`: `applyNews` (news + JP banner → Global banner/releases, idempotent, seeded entries kept,
  unknown ids skipped) and `mergeCardInfo`.
- `data.test.js`: generated data rebuilds upstream's lists exactly; names present; preset
  deck cards exist; every scenario (incl. averaged) × stat ranking is non-empty, finite,
  sorted; averaged rankings only use defined scenarios, include the current one, and
  score 0–1000.
- `calc.test.js`: one known score (Kitasan Black ≈ 372, from upstream's own test).
- `rank-history.test.js`: `rankHistory()` on a small synthetic ranking.
- `timeline.test.js`: calendar days in UTC vs. the viewer's timezone (TZ pinned to Europe/Warsaw).
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
  and `src/servers.js` hold keys only. Dates go through `formatDate()` / `formatDateTime()` so they use the
  UI's locale. Banner times (calendar days, bars, sheet) follow the **Settings** timezone: UTC by default, as
  the game announces them, or the viewer's own (`timeZoneOptions()` for Intl, `buildTimeline(…, { utc })` for
  days). All stored times are UTC. Other settings go in `src/settings.jsx` (DEFAULTS + OPTIONS). A new language is a new JSON file registered in `RESOURCES`.
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

**All workflows are manual-only for now** (`workflow_dispatch`): their push/schedule triggers and news.yml's
redeploy step are commented out. Uncomment them to run automatically again.

- `deploy.yml` — on push to main, daily, and manually: install → `pnpm lint` → `update-cards` →
  `scrape-gametora` → `update-global` (not committed) → `map-banner-cards` → `setup-ml` + `predict-gl` → `pnpm test` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- `news.yml` — daily at 23:43 UTC and manually (optional backfill): `fetch-news`; if a banner post came in,
  `update-cards` + `scrape-gametora` + `update-global`; commits `data/` with the summary as the commit
  message and job summary, and starts `deploy.yml` (a GITHUB_TOKEN push doesn't trigger it). Needs
  `contents: write`, `actions: write`.
- Pages source must be set to "GitHub Actions".
