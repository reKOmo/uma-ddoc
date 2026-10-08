# Umaddoc (uma-ddoc)

A static, mobile-first web app for Uma Musume players, deployed to GitHub Pages:

- **Tier list** (the "Cards" tab, `#/`) — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A collapsible rarity × LB filter picks which copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
  A search box filters by character name and card title (English + Japanese; titles from `loadCardInfo()`, every
  word must match, accents/punctuation ignored); like the LB filter, it doesn't move cards between tiers.
  Stat, LB filter and search are remembered (`src/tierListFilters.js`: kept across pages and in localStorage); the
  scenario is App's (kept across pages, not reloads). "Reset filters" (inside the Filter dropdown; disabled at the defaults) restores all four,
  scenario = the server's default.
  A floating "Back to top" button shows once scrolled past a screen.
  On desktop the tiers are a bit right of centre (left column 1.25× the right), the pickers and filter in a sticky column to their left (`.tier-sidebar`); on phones, above the tiers.
- **Timeline** (`#/timeline`, a tab; `#/banners` still works) — a horizontal, scrollable/draggable calendar of past and current
  gacha banners (Global: our own record in `data/`, kept up from the official news; JP: scraped
  from GameTora), with a detail sheet per banner that
  shows each featured support card's tier-list rank. Global's calendar continues into the
  future with JP's banners at their predicted Global dates (`ml/`), drawn half-transparent
  with JP art (nearly solid and "confirmed" when `data/known_dates.json` has their exact dates); their sheets rank the cards in JP's tier list. Banners from the news use the
  official art and link to their post.
  A strip above the date axis shows which Career scenario runs when on that server (`data/scenarios.json`,
  `src/scenarioStrip.js`), each in its cover's colour: the current one solid, unlaunched ones faint (confirmed) or
  dashed (predicted), with a line down the calendar where each begins; labels stick to the left edge while scrolling, with a › arrow (it opens the scenario page) right after the
  name on desktop and at the segment's right edge on phones (`overflow: clip`, not hidden, keeps sticky working).
  JP's calendar marks where Global is: a window from the JP banner Global is running to its next banner's
  JP start (announced / confirmed / predicted; faded end when predicted), a dashed estimate line inside it
  (linear in time between the two), and a "Global now" button that scrolls there.
- **Scenarios** (`#/scenarios`, a tab) and the **scenario page** (`#/scenario/<key>`) are **server-agnostic**: they
  show both servers (JP, then Global) whatever the top bar says, and "Newest on <server>" for each server a scenario is
  the latest launched on (`isCurrent`). The tab lists every Career scenario in launch order: key art thumbnail in its
  colour, name + key (a pill in the scenario's colour), each server's status and date; each opens its page. Its one
  exception to being server-agnostic: only the newest on the top bar's server gets the coloured background.
  The page: key art, English + Japanese names, launch as one card, JP on the left → Global on the right (launched /
  confirmed / predicted with range, how long ago or until, in the Settings timezone; the gap in the middle), Global's
  lag behind JP ("Launched / Expected after …" under the arrow between the two on desktop, a row under the card on phones), a Links section (external pages from `links`, now GameTora), "Open its tier list" (when either
  server's tier list ranks it) and previous / next scenario (on top on phones, at the bottom on desktop; CSS order
  only). On desktop the key art is a sticky column on the left, everything else beside it (`.scenario-body`). Opened from a segment of the banner calendar's scenario strip (that one is per server) or an entry on the
  Scenarios tab (which stays highlighted); the page isn't a tab.
- **Settings** (`#/settings`, a tab) — banner times in UTC (default, as the game announces them) or the
  viewer's timezone; scenario names Global (Unity, TB, GC; JP's where Global has none yet, the default) or JP
  (Aoharu, MANT, GL); remembered in the browser. At the bottom, About: version (package.json), the Cygames
  disclaimer, and credits linking GameTora and the original tier list (Euophrys' Uma Tiers).
- **Card page** (`#/card/<id>`) — one support card's full art, GameTora link (if GameTora has it), and its
  tier at each limit break in every scenario (plus the averaged "Overall" and
  "Current + future" rankings), then a "rank over time" chart (pick scenario + LB)
  and the newer cards that passed it — continued dashed into the future on Global with
  predicted release dates of JP's cards (when it'll drop a tier). Above the tiers, pull advice from Luh's Umamusume
  Support Card Encyclopedia (a public Google Sheet), only for the card's next Global banner (or the one running;
  `upcomingEntry()` in `src/pullGuide.js`), in one box:
  - "Upcoming banner", on the banner's art like the Timeline's bars (same crop of GameTora's margin, dark
    gradient, shadowed text, "See banner" a solid accent (pink) button): its status badge + dates as in the Timeline's sheet (Settings timezone; the guide's
    own date when there's no banner), then the label pill (Rerun, Event…) and "See banner" on one line.
    "See banner" is `#/timeline/gl/<banner id>` (the Timeline switches to Global, centres on that banner and opens
    its sheet); `findBanner()`: first release = the earliest Global banner, real or predicted, featuring the card,
    a rerun = the closest by date, none for event/story cards. "No upcoming banners :c" when none is to come.
  - under a rule (beside it on desktop, the box split in two), "Should pull? <pill>": Yes / No / Free / If Whale(+…) / If Dolphin(+…) when the advice starts with one; the
    whole advice as the recommendation line when it says more than the pill, or has no pill and is longer than
    24 characters (shorter, e.g. "With Kitasan", it leads the notes instead; `parsePull`), free pulls, then the notes as one paragraph (`notesParagraph()`: a full stop added where a sentence has none).
  - The box's footer (under both halves): a centred "See more on Luh's encyclopedia" (the card's row in the sheet). The guide's disclaimer (with a link
    to the sheet) is in About, not on the card page.
  Opened from tier-list cards and the banner sheet's "See more"; it isn't a tab.

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
pnpm scrape-gametora    # JP banner history + card links/titles/JP dates + JP scenarios from GameTora → generated/
                       # (--seed-global [--force]: rewrite data/ from GameTora's Global data; one-off)
pnpm update-global     # official news → Global's banners, card releases + scenario launches in data/ (needs scrape-gametora)
pnpm map-banner-cards  # link banner cards to our card data → generated/card_banners.json
pnpm fetch-pull-guide  # pull advice + notes per card from Luh's Support Card Encyclopedia → generated/pull_guide.json
pnpm clone-upstream    # clone/update upstream main into upstream/ (for test:upstream)
pnpm fetch-news        # new posts from umamusume.com/news → data/news/ (+ summary.md); --backfill for the archive,
                       # --reparse to re-parse stored posts after changing scripts/lib/news.js (no requests)

pnpm setup-ml              # create ml/.venv (uv, Python 3.13) + install ml/requirements.txt
pnpm predict-gl            # predicted Global release dates of JP-only cards → generated/ (Python, ml/)
pnpm predict-gl:backtest   # walk-forward backtest of the candidate models
```

`ml/` is Python in its own venv (`pnpm setup-ml`). Deploys rerun it after the banner scrape, so predictions
restart from Global's latest release. The Timeline page reads `generated/predicted_global_banners.json`
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
  lib/colors.js      PNG decoder (zlib only) + main colour of an image, for scenario covers
  lib/scenarios.js   Career scenarios (data/scenarios.json): SCENARIO_NAMES (slug → key + JP/Global short names, by hand),
                     mergeGametora() (JP side), applyScenarioNews() (Global side, from the news)
  map-banner-cards.js
  fetch-pull-guide.js  Luh's Support Card Encyclopedia (Google Sheet) → generated/pull_guide.json
  lib/pull-guide.js  pure: the sheet's HTML view → entries per card (dates, Pull?, notes), tab → scenario key
  fetch-news.js      official news API → data/news/announcements.json + data/news/summary.md (incremental)
  lib/news.js        pure parsing of news posts: kind, periods, announced banner ids, featured trainees/cards
src/
  App.jsx            shell: hash routes (#/, #/timeline, #/timeline/<gl|jp>/<banner id>, #/scenarios, #/settings, #/card/<id>,
                     #/scenario/<key>), top bar (title or back button +
                     server switch), tab bar, shared server + scenario state
  settingsStore.js   user settings as a plain store (getSetting / setSetting / subscribe), kept in localStorage
                     (try/catch; defaults without it): timeZone 'utc' | 'local', scenarioNames 'global' | 'jp'
  tierListFilters.js the Cards tab's stat / LB filter / search: getFilters(), saveFilters(), DEFAULTS, isDefault()
  settings.jsx       useSettings() (useSyncExternalStore over the store); App calls it so plain readers like
                     scenarioName() refresh on change
  pages/SettingsPage.jsx, settings.css  the Settings tab
  pages/TierListPage.jsx
  pages/BannersPage.jsx, banners.css   the Timeline tab: calendar + detail sheet (code still says "banners")
  pages/CardPage.jsx, card.css         one card: art, GameTora link, tier per scenario × LB
  cardInfo.js        card page info: GameTora's link/JP fields + Global's title/date from data/
  pages/ScenariosPage.jsx, scenarios.css  the Scenarios tab (list)
  pages/ScenarioPage.jsx, scenario.css  one scenario (reuses card.css's tag / link / section classes)
  pages/RankChart.jsx                  SVG step chart of rank over time: fixed rank axis, sideways-scrolling
                                       plot (20px/month, quarters + years labelled), crosshair tooltip
  rankHistory.js     pure: a card's position at each release date (marks predicted ones)
  predictions.js     optional loader for generated/predicted_gl_releases.json
  pullGuide.js       optional loader for generated/pull_guide.json (card page's "Pull advice"), upcomingEntry(), sheetLink(),
                     findBanner()
  bannerData.js      banner file loaders (real + optional predicted) and bannerStatus(), shared by the Timeline and the
                     card page (the status `.badge` styles are in App.css)
  StatusBadge.jsx    a banner's status pill (Live, Upcoming, Predicted…): the Timeline's sheet and the card page
  timeline.js        pure calendar layout (row packing, months, days; `at(ms)` → position)
  BackToTop.jsx      floating "back to top" button (the tier list), watches the .app-main scroll container
  Dropdown.jsx, .css the app's dropdown (custom listbox; every dropdown uses it)
  ScenarioPicker.jsx scenario dropdown on top of it (italic + note when unreleased);
                     scenarioRelease.js: SCENARIOS, scenarioByKey, isReleased / isCurrent(key, server)
  scenarioStrip.js   pure: scenario segments (launch → next launch, cover colour + text ink) for the calendar's strip
  globalProgress.js  pure: where Global is in JP's history (window between banners + linear estimate)
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
                     scenarios.py (predicted Global scenario launches → data/scenarios.json),
                     (see ml/README.md)
data/                ours, committed (nothing can regenerate it; generated/ is rebuilt every deploy):
  global_banners.json, global_cards.json   Global's banners + card releases: seeded from GameTora once,
                                           then from the news (`update-global`); news-made entries carry news_url
  scenarios.json     every Career scenario: key, full_en, full_jp, en/jp_start_date, links.gametora
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
| Career scenarios + launch times on both servers | `data/scenarios.json` | yes | JP side: `pnpm scrape-gametora` (every deploy); Global side: `pnpm update-global` from the news (seeded once from GameTora) |
| Predicted Global release dates of JP-only cards and future Global banners | `generated/predicted_gl_releases.json`, `predicted_global_banners.json` | no | `pnpm predict-gl` (every deploy) |
| Pull advice + notes per card (Global banners) | `generated/pull_guide.json` | no | `pnpm fetch-pull-guide` (every deploy; optional for the site) |
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
- **Scenarios** (`data/scenarios.json`, `scripts/lib/scenarios.js`): one entry per scenario in JP launch order,
  `{ key, full_en, full_jp, en_start_date, jp_start_date, links: { gametora, cover }, color }`; a start date is `{ date, tag }` (or null):
  tag `out` (launched), `confirmed` (known, still ahead), `predicted` (+ `lo`/`hi` range, from `ml/scenarios.py`).
  Known dates are re-tagged (confirmed → out) whenever the file is written, by JS or Python (same format). `key` is the tier list's where it ranks the
  scenario (URA, Aoharu, MANT, GL, GM, DYI), else ours — an id (URLs, lookups), never shown. `short: { jp, en }`: the
  names shown, via `scenarioName()` and the Scenario names setting (JP's from upstream's en-jp locale + GameTora's
  "for short"; Global's from upstream's en-gl locale, null until Global has one). Both from the hand table
  `SCENARIO_NAMES` (add new GameTora slugs there). `full_en`: Global's official name once the news gives it, else GameTora's English, else null;
  `full_jp`: the Japanese name (GameTora, every scrape). `links.cover`: GameTora's key art
  (`media.gametora.com/umamusume/scenarios/hero/<id>.png`, no text, so one for both servers; no official EN
  covers for now). `color`: the cover's main colour
  (`scripts/lib/colors.js`: own PNG decoder, skin/hair hues left out since the art is mostly characters), computed
  once per cover by `fillColors` and kept. GameTora's own `bg_color` per scenario is a curated alternative. Dates
  are ISO UTC; `en_start_date` is predicted until the news gives Global's (a dated mention replaces the prediction). Links: `https://gametora.com/umamusume/<slug>`
  (GameTora's scenario pages; there's no `/scenarios/<slug>`). `scrape-gametora` refreshes the JP side and adds new
  scenarios; `update-global` the Global side from the news. The news parser only takes "new Career scenario "…""
  phrasings (plain "scenario" is everywhere: known issues, scout fine print); a launch time only when the sentence
  says it's added/begins. A news name matches by name/key/slug, else JP's next scenario Global hasn't launched
  (Global follows JP's order). Predictions (`pnpm predict-gl` → `ml/scenarios.py`): a scenario's JP launch day
  through the card release model + known dates, 22:00 UTC, no JP weekend, after Global's latest known launch —
  each past launch (Aoharu, MANT, GL) came out on Global the same day as its JP launch day's cards.
- **Known dates from Global's banners** (`ml/adjust.py`): every Global banner rerunning a JP banner newer than the
  anchor is a known date (JP start's JST date → Global start's UTC date), merged with `known_dates.json` (hand
  entries win; out-of-order ones dropped with a warning). Predicted banners skip ids `data/` already has.
- **Pull guide** (`scripts/lib/pull-guide.js`): Luh's Umamusume Support Card Encyclopedia, a public Google Sheet
  (one tab per Global scenario era, one row per card banner; reruns get their own row). Read from each tab's HTML
  view (`htmlview/sheet?gid=…`): the CSV export has no hyperlinks, and a row's card id is only in its GameTora link
  (`…/supports/<id>-…`, ids are ours); the xlsx export has them but is ~110 MB of art. Cell comments are in neither,
  so they're left out. Columns are found by header text ("Support Card", "Date", "Pull?", "Notes"; one tab has no
  "Notes" header, so it falls back to the column after "Pull?"). A tab's scenario is the GameTora page its top row
  links, matched to `links.gametora` in `data/scenarios.json` (`SLUG_ALIASES` for the sheet's old slugs). Dates:
  exact (`date`), or `month` + early/late for the author's estimates. Notes are wrapped to the column by hand;
  `parseNotes` joins lines back into sentences (a guess: a capital, "(" or digit starts a new one unless the line
  before runs on — a comma/colon/number, a joining word in `CONTINUES`, or a card name split across the break, from
  every tab's card names, so the script parses the tabs twice), splits sentences run together on one line (`STARTS`)
  and drops spaces before "!"/"?". `parsePull` evens out the advice's wording (If Whale, With X, Dolphin, to Lates). Entries keep the tab `gid` and sheet `row` so the card page links to the row. The sheet's
  content is the author's English text, shown as is; credited (with a disclaimer) in About. ~15 requests with 1–2 s pauses; the script fails loudly if no cards are found.
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

- `pull-guide.test.js`: a tab's HTML view → entries (card id from the link, label, dates, Pull?, notes), tab →
  scenario key, the tab list and update date; `upcomingEntry` (running / next banner, estimates), `sheetLink`, `findBanner`.
- `news.test.js`: news parsing (periods, kinds, banner ids + art, featured), the summary.
- `global.test.js`: `applyNews` (news + JP banner → Global banner/releases, idempotent, seeded entries kept,
  unknown ids skipped) and `mergeCardInfo`.
- `data.test.js`: generated data rebuilds upstream's lists exactly; names present; preset
  deck cards exist; every scenario (incl. averaged) × stat ranking is non-empty, finite,
  sorted; averaged rankings only use defined scenarios, include the current one, and
  score 0–1000.
- `calc.test.js`: one known score (Kitasan Black ≈ 372, from upstream's own test).
- `rank-history.test.js`: `rankHistory()` on a small synthetic ranking.
- `global-progress.test.js`: the Global-in-JP estimate, window ends (known vs. predicted), reruns ignored.
- `scenarios.test.js`: scenario mentions in news (dated vs. not, false positives), `fromGametora`, `applyScenarioNews`.
- `scenario-strip.test.js`: scenario segments per server, current one, Japanese name fallback.
- `colors.test.js`: PNG decoding through row filters, main colour (skin/hair left out, fallbacks).
- `scenario-release.test.js`: launched vs. not per server (predictions never count), unknown keys.
- `scenario-picker.test.jsx`: the closed Dropdown / ScenarioPicker markup (listbox button, italic + hint when unreleased).
- `scenario-page.test.jsx`: the scenario page's markup (names, launches, predicted range, links), `isCurrent`, the
  Scenarios tab's list.
- `scenario-names.test.js`: `scenarioName()` under the Scenario names setting (Global with JP fallback, JP).
- `settings-page.test.jsx`: About shows the version, the disclaimer and both credit links.
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
  days). All stored times are UTC. Other settings go in `src/settingsStore.js` (DEFAULTS + OPTIONS) + a row on the Settings page. A new language is a new JSON file registered in `RESOURCES`.
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
- **Dropdowns are `src/Dropdown.jsx`**, never a native `<select>` (phones' native pickers ignore `<option>` styling,
  and it looks the same everywhere): options `{ value, label, group?, note?, badge?, italic?, disabled? }` (disabled: greyed, can't be
  chosen, skipped by the keyboard), groups under headings, hover +
  keyboard-active highlight; opening scrolls the list (not the page) to the selected option, centred. WAI-ARIA select-only combobox pattern (aria-activedescendant; ↑/↓, Home/End,
  Enter/Space, Esc, type-ahead). Scenario pickers are `src/ScenarioPicker.jsx` on top of it: the real scenarios,
  then the `COMBINED` ones in an "Averaged" group; display names via `scenarioName()` (short names per the setting; never show a raw key). Scenarios not launched on the
  selected server (`isReleased()`, `src/scenarioRelease.js`, from `data/scenarios.json`) are in italics with a
  "Not released yet" note, on the button too; the one running now on it (`isCurrent()`) has a "Current" badge
  (none on JP while its newest scenario isn't one the tier list ranks). Every scenario in `data/scenarios.json` is
  listed, newest first; those the tier list doesn't rank yet are disabled with "Not in the tier list yet".
- `deploy.yml` — on push to main, daily, and manually: install → `pnpm lint` → `update-cards` →
  `scrape-gametora` → `fetch-pull-guide` → `update-global` (not committed) → `map-banner-cards` → `setup-ml` + `predict-gl` → `pnpm test` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- `news.yml` — daily at 23:43 UTC and manually (optional backfill): `fetch-news`; if a banner post came in,
  `update-cards` + `scrape-gametora` + `update-global`; commits `data/` with the summary as the commit
  message and job summary, and starts `deploy.yml` (a GITHUB_TOKEN push doesn't trigger it). Needs
  `contents: write`, `actions: write`.
- Pages source must be set to "GitHub Actions".
