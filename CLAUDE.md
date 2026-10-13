# Umaddoc (uma-ddoc)

A static, mobile-first web app for Uma Musume players, deployed to GitHub Pages:

- **Tier list** (the "Cards" tab, `#/`) — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A rarity × LB filter (the Filter button beside the search box, a sheet like the Timeline's: `src/FilterSheet.tsx`, a
  section of LB chips per rarity with All / None, a count on the button of LBs changed from the defaults; at its bottom
  "Card size": Small / Medium / Large (the default) / Huge, a display preference "Reset filters" keeps) picks which
  copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
  A search box filters by character name and card title (English + Japanese, from `generated/cards.json`; every
  word must match, accents/punctuation ignored); like the LB filter, it doesn't move cards between tiers.
  Stat, LB filter, search and card size are remembered (`src/tierListFilters.ts`: kept across pages and in localStorage); the
  scenario is App's (kept across pages, not reloads). "Reset filters" (by the filter sheet's title; disabled at the defaults) restores all four,
  scenario = the server's default.
  A tier's label (S, A…; a ⌃ pinned to the top of the strip says so) folds it to a slim row ("› N cards hidden · Show"), to compare the tiers around it; while any
  is folded, "Show all hidden tiers" sits above the list. Not remembered: every tier is open on each visit.
  A floating "Back to top" button shows once scrolled past a screen.
  Scenario and stat pickers half the width each. On desktop the tiers are a bit right of centre (left column 1.25× the right), the pickers and filter in a sticky column to their left (`.tier-sidebar`); on phones, above the tiers.
- **Timeline** (`#/timeline`, a tab; `#/banners` still works) — a horizontal, scrollable/draggable calendar of past and current
  gacha banners (Global: our own record in `data/`, kept up from the official news; JP: our own record too, GameTora's
  history seeded once and the JP news merged over it, R cards, paid scouts and re-runs included).
  While a sheet is open the address is `#/timeline/<server>/<id>` (replaced, not pushed; ids are unique on a server,
  banners' and events' alike), so going back to the Timeline from a card's page reopens the sheet.
  **Both servers run exactly the same code, fed different data** (`src/timeline/`): every banner and event becomes an
  *entry* (`entries.ts`, one shape whatever the server or source; every difference between the data files is read
  there and nowhere else), the page has no `server ===` branch, and one sheet (`TimelineSheet.tsx`, on `src/Sheet.tsx`: drag it down to close)
  shows every banner and event alike: art, kind pill, name, status + dates, where its dates come from (predicted /
  confirmed from JP's; paid), relations (re-run of / re-held / part of, each opening the other), featured items or
  cards with their tier-list rank, other rewards, schedule, titles, parts, the post + umapyoi.net; sections without
  content aren't shown. Cards rank in the server's own tier list (MLB, the selected scenario); when it lacks one of
  them (an announced or predicted card on Global), in the one that also ranks JP's cards it doesn't have yet
  (`useRankings.ts`, as the card page's dashed future). Global's calendar continues into the
  future with JP's banners at their predicted Global dates (`ml/`), drawn half-transparent
  with JP art (nearly solid and "confirmed" when `data/known_dates.json` has their exact dates). Banners from the news
  use the official art and link to their post.
  A strip above the date axis shows which Career scenario runs when on that server (`data/scenarios.json`,
  `src/timeline/scenarioStrip.ts`), each in its cover's colour: the current one solid, unlaunched ones faint (confirmed) or
  dashed (predicted), with a line down the calendar where each begins; labels stick to the left edge while scrolling, with a › arrow (it opens the scenario page) right after the
  name on desktop and at the segment's right edge on phones (`overflow: clip`, not hidden, keeps sticky working).
  Events under the banners on both servers (`data/global_events.json` / `data/jp_events.json`, loaded per server by
  `loadEvents()` in `src/timeline/data.ts`; JP's names as the posts give them, items by their Japanese `local` name;
  `src/timeline/events.ts`) in labelled groups by type
  (`EVENT_GROUPS`, after the support card then trainee banners: story & special, celebrations, gifts & login bonuses,
  bonuses, missions, Champions Meetings, League of Heroes (JP), Legend Races, shops & sales, transfers & outings: what
  gives cards and pulls first, competitive modes next), each group packed on its own. Every group label (the banner sections'
  too) folds its group away (`src/timeline/collapsed.ts`: remembered in localStorage, try/catch; rows stay fixed, bars
  never move). **Filter** (the toolbar's button, with a count of what's hidden, opens a sheet, `TimelineFilter.tsx`: sections
  Banners / Events / Pull advice, each with All / None, "Show all" by the title; a second tab, Order, drags the
  calendar's lane groups into order (`GroupOrder.tsx`, dnd-kit's pointer sensor, by a handle with `touch-action: none`:
  phones drag at once and the rest of a row still scrolls; keyboard too; tabs with icons; "Reset order" by
  the title (on the Order tab, where "Show all" is on the Show tab); both tabs share one grid cell (the other
  invisible + `inert`), so switching never resizes the sheet; `src/timeline/order.ts`: remembered in localStorage,
  the lanes and the chips both follow it); every change applies and is saved at once, no Done; `src/timeline/hidden.ts`: remembered in
  localStorage, try/catch, the same for both servers): a toggle per banner section (trainee, support card) and event
  kind the calendar has, in its groups' order; when the pull guide covers any of the calendar's banners (Global's), a
  toggle per pull-advice verdict (Yes / No / Free / If Whale / If Dolphin / No advice: a support card banner stays
  while one of its cards has a verdict shown; `VERDICTS`, `bannerVerdicts()` in `src/pullGuide.ts`; greyed out while
  support card banners are hidden).
  Hidden bars leave the lanes (a hidden event's parts of shown kinds stand on their own; the calendar's dates and the
  sheets keep everything). **Compact mode** (the toolbar's fold button, on by default, `src/timeline/compact.ts`: remembered in
  localStorage): rows with nothing in view (± half a screen) fold away while scrolling slowly or once it stops (`visibleRows()` in
  `layout.ts`), so a group is only as tall as what's on screen; rows are never repacked, a bar never changes row. An event with parts (a celebration's sub-events, an event's mission sets) is one bar with a "+N" fold
  button (`.bar-fold`); unfolded, its parts' rows open under its row over a band tinted in its colour
  (`.event-parts-band`), nested parts the same way. Bars: the post's art covering the bar
  (`background-size: cover`, like banners' official art) behind the banners' gradient, edge coloured by kind family; under 64px a bar is a chip
  (no label, no art; name in the tooltip and sheet). A bar opens a sheet: dates, "Part of <event>" (opens it), the
  support cards it gives first (to their card page, copies), other rewards (carats, monies, shards first; ranges for
  Champions Meetings), a cup's schedule (league selection, rounds, final round steps), titles, its parts (open them; a
  "Support cards" pill on those giving one), the news post and umapyoi.net's copy of it (`src/umapyoi.ts`: JP's in
  Japanese, `news/<id>?lang=jp`; Global's `en/news/<id>`; every event with a post has both, GameTora-filled ones none).
  News-made banners' sheets link both too.
  Global's calendar also shows **predicted events** (`generated/predicted_global_events.json`, optional like the
  predicted banners): every JP event Global hasn't had yet at its predicted Global date, in the same groups,
  half-transparent (nearly solid when confirmed), with JP's names and art; the sheet says "Predicted from the JP event
  of … ± N days" and links JP's announcement. A prediction is dropped when Global's real events already have a newer
  event of its kind (`withPredicted()`, `src/timeline/events.ts`).
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
  lag behind JP ("Launched / Expected after …" under the arrow between the two on desktop, a row under the card on phones), a Links section (GameTora's page, and the launch post on umapyoi.net: JP's in Japanese, `news/<id>?lang=jp`, and Global's, `en/news/<id>`), "Open its tier list" (when either
  server's tier list ranks it) and previous / next scenario (on top on phones, at the bottom on desktop; CSS order
  only). On desktop the key art is a sticky column on the left, everything else beside it (`.scenario-body`). Opened from a segment of the banner calendar's scenario strip (that one is per server) or an entry on the
  Scenarios tab (which stays highlighted); the page isn't a tab.
- **Settings** (`#/settings`, a tab) — banner times in UTC (default, as the game announces them) or the
  viewer's timezone; scenario names Global (Unity, TB, GC; JP's where Global has none yet, the default) or JP
  (Aoharu, MANT, GL); JP news on umapyoi.net in Japanese (the original, default: `?lang=jp`) or English (umapyoi's
  translation, `?lang=en`), for every umapyoi.net link to a JP post (`src/umapyoi.ts`); remembered in the browser. At the bottom, About: version (package.json), the Cygames
  disclaimer, and credits linking GameTora and the original tier list (Euophrys' Uma Tiers).
- **Card page** (`#/card/<id>`) — one support card's full art, GameTora link (if GameTora has it), and its
  tier at each limit break in every scenario (plus the averaged "Overall" and
  "Current + future" rankings), then a "rank over time" chart (pick scenario + LB)
  and the newer cards that passed it — continued dashed into the future on Global with
  predicted release dates of JP's cards (when it'll drop a tier). Above the tiers, pull advice from Luh's Umamusume
  Support Card Encyclopedia (a public Google Sheet), only for the card's next Global banner, real or predicted (or the one
  running; `upcomingBanner()` + `currentAdvice()` in `src/pullGuide.ts`), in one box:
  - "Upcoming banner", on the banner's art like the Timeline's bars (same crop of GameTora's margin, dark
    gradient, shadowed text, "See banner" a solid accent (pink) button): its status badge + dates as in the Timeline's sheet (Settings timezone; the guide's
    own date for event/story/shop cards, on no banner), then the label pill (Rerun when the banner's `featured`
    entry isn't `new`; the guide's Event, Story… for cards on no banner) and "See banner" on one line.
    "See banner" is `#/timeline/gl/<banner id>` (the Timeline switches to Global, centres on that banner and opens
    its sheet). "No upcoming banners :c" when none is to come.
  - under a rule (beside it on desktop, the box split in two), "Should pull? <pill>": Yes / No / Free / If Whale(+…) / If Dolphin(+…) when the advice starts with one; the
    whole advice as the recommendation line when it says more than the pill, or has no pill and is longer than
    24 characters (shorter, e.g. "With Kitasan", it leads the notes instead; `parsePull`), free pulls, then the notes as one paragraph (`notesParagraph()` at build time: a full stop added where a sentence has none).
  - The box's footer (under both halves): a centred "See more on Luh's encyclopedia" (the card's row in the sheet). The guide's disclaimer (with a link
    to the sheet) is in About, not on the card page.
  - "Available on" (`Origins`, `src/cardOrigins.ts`): every banner featuring the card and event giving it on the
    selected server (a card not on Global yet: Global's predicted ones and JP's, JP's tagged), oldest first (a toggle
    reverses it), the first shown and the rest folded; a kind pill (Banner / Paid banner / Story event / Gift: gifts,
    login bonuses, missions, campaigns / Shop; else the event's own kind) in one colour per kind (not the Timeline's: a banner there takes its main card's type), Re-run when the card
    isn't new on it, status + dates, and a link to it on the Timeline (`#/timeline/<server>/<id>`). A part giving it
    counts, not the celebration listing it too. A card on none (the scout pool's R/SR, main story, promo) shows
    cards.json's `source` instead. Paid banners never list cards yet (JP's paid scouts have no featured list). Under
    the card's name, the first origin's kind pill, "+N" for the other kinds it has come by since (all in the tooltip).
  The tier list's floating "Back to top" button too.
  Opened from tier-list cards and the Timeline sheet's "See more"; it isn't a tab, but keeps the Cards tab highlighted.

Stack: TypeScript 7 (strict), React 19 + Vite 8 (CSS Modules), i18next + react-i18next, zod (data shapes), zustand
(remembered state), wouter (hash routing), Radix Select (the dropdown), `vaul` (sheets, on Radix's dialog), `@dnd-kit`
(drag to reorder), `lucide-react` icons, `clsx`, Vitest + Playwright, Biome + husky, pnpm (never npm). No backend: all
data is generated at build time.

**TypeScript everywhere** (migrated in 2026-10, `docs/ts-migration-plan.md`): one `tsconfig.json` (`strict`,
`nodenext`, `erasableSyntaxOnly`, `allowImportingTsExtensions`), `pnpm typecheck` (= `tsc`, in CI). Scripts and
`tierlist/` run on Node 24's type stripping (`node scripts/x.ts`, no build step): `.ts` in every import path, no
`enum` / `namespace` / parameter properties. Data shapes are zod schemas in `shared/schemas/` (types via `z.infer`;
`schemas/*.json` generated from them by `pnpm build-schemas`); `src/` imports their types only (`import type`), so zod
isn't in the bundle but where stored state is parsed (`zod/mini`). Never `any`: `unknown` + narrowing, or a cast with a
`// TODO(ts):` comment saying why (mostly JSON from outside: GameTora, umapyoi.net, a model's reply).

## Commands

```sh
pnpm dev               # dev server (fetches card data on first run — see note below)
pnpm build             # production build into dist/
pnpm lint              # Biome: formatting + lint check (CI runs this)
pnpm format            # Biome: apply formatting and safe fixes
pnpm test              # Vitest unit suite (~15s; fetches card data if missing)
pnpm test:upstream     # compare our calculation with upstream's (~25s; needs the clone)
pnpm typecheck         # tsc over everything (CI runs this)
pnpm test:e2e          # the app in a browser (Playwright, e2e/; starts the dev server; ~45s; needs
                       # `pnpm exec playwright install chromium` once; E2E_PORT=… for parallel runs)
pnpm test:visual       # screens compared pixel by pixel with baselines made on this machine (.visual-baseline/, not
                       # in git; `--update-snapshots` from a known-good commit; VISUAL_BASELINE=… to share them)
pnpm rank gl GL speed  # print a ranking in the terminal (scenario may be overall / upcoming)

pnpm update-cards      # upstream main's card lists + events → generated/raw/upstream/, then build-cards
pnpm build-cards       # raw inputs + data/jp_cards.json + data/global_cards.json → generated/cards.json + card_stats/
                       # (the three scripts that change an input run it themselves)
pnpm build-schemas     # schemas/*.json from the zod schemas in shared/schemas/ (test/schemas.test.ts fails when stale)
pnpm scrape-gametora    # support card list (augments new cards, slugs) + JP scenarios + JP event history (story events, Champions
                       # Meetings, Legend Races) from GameTora → generated/, then build-cards (--events: only the events)
pnpm update-jp         # JP news → new cards in data/jp_cards.json (augmented from GameTora's list; else pending in
                       # data/jp_cards_pending.json), then build-cards, then data/jp_banners.json (news merged over
                       # GameTora's history, seeded once) + data/jp_events.json
pnpm update-global     # official news → Global's banners, card releases, scenario launches + events in data/ (needs scrape-gametora),
                       # then build-cards
pnpm fetch-pull-guide  # pull advice + notes per card from Luh's Support Card Encyclopedia → generated/pull_guide.json (after predict-gl)
pnpm clone-upstream    # clone/update upstream main into upstream/ (for test:upstream)
pnpm news:latest       # new + edited posts from umamusume.com/news → data/news/gl/posts.json (+ summary.md); periodic runs
pnpm news:all          # every post the site still serves (walks the archive post by post; resumable; once)
pnpm news:umapyoi      # the posts the official site no longer serves, from umapyoi.net's mirror (resumable; once)
                       # each of the three takes --server jp (umamusume.jp → data/news/jp/): news:latest:jp, news:all:jp,
                       # news:umapyoi:jp (parsed by `update-jp`)
pnpm news:categories   # every stored post with its category (banner / event kind / other), for checking the parser
pnpm news:events       # the events the stored news makes (cards, items, titles), printed; nothing written
pnpm news:ai           # ask a model about what the rules doubt in events → data/news/<server>/ai_answers.json (--server jp);
                       # --model M, --provider ollama|openrouter, --limit N; --compare [--sample N | --ids a,b] tests a
                       # model against the rules (nothing saved, report in generated/ai-compare-<model>.json)

pnpm setup-ml              # create ml/.venv (uv, Python 3.13) + install ml/requirements.txt
pnpm predict-gl            # predicted Global release dates of JP-only cards → generated/ (Python, ml/; promo cards never),
                           # Global↔JP event pairs + predicted Global events (ml/events.py)
pnpm predict-gl:backtest   # walk-forward backtest of the candidate models
```

`ml/` is Python in its own venv (`pnpm setup-ml`). Deploys rerun it after the banner scrape, so predictions
restart from Global's latest release. The Timeline page reads `generated/predicted_global_banners.json`
through an `import.meta.glob`, so it's optional: without `pnpm predict-gl` there are just no predicted bars. Announced Global dates go in
`data/known_dates.json` (committed; predictions pass through them).

On a fresh checkout only upstream's card data is fetched automatically; `cards.json` then takes JP's names, titles,
dates and slugs from `data/jp_cards.json` (committed: every card, the news-made ones too), so nothing is missing
(`pnpm scrape-gametora` only refreshes slugs and augments cards still pending; both servers' banners are committed in
`data/` too; GameTora's banners aren't scraped any more).

## Layout

```
tierlist/          ranking code (runs in Node and the browser)
  tierlist-calc.ts   processCards(): scores candidates against a fixed deck (from upstream, ours now)
  scenarios.ts       weights, training gains, per-server scenarios + deck presets (likewise)
  index.ts           rankCards() (one deck), rankByUsefulness() (avg over preset decks, cached),
                     STATS (stat keys), presetDecks(), COMBINED (averaged rankings), scenarioOptions()
  cards.ts           `cards` (generated/cards.json), loadCards(server): joins it with the server's stats;
                     loadCardsWithUpcoming()
  join-cards.ts      joinCards() (+ `events` per card), withoutEvents(), TYPE_CODES / RARITY_CODES (cards.json's
                     strings ↔ upstream's codes)
  cli.ts             `pnpm rank`
scripts/
  lib/paths.ts       ROOT, GENERATED_DIR, DATA_DIR, newsDir(server) (every script's paths)
  lib/http.ts        sleep(), paced(): one request at a time with a pause between (every fetching script's pacing)
  lib/sources.ts     generated/sources.json (file → where its data came from): readSources(), writeSources()
  lib/upstream.ts    everything that knows about the upstream repo (REPO, DATA_FILES,
                     UPSTREAM_DIR, UPSTREAM_RAW, download)
  clone-upstream.ts  shallow clone (or fetch + reset) of upstream main into upstream/
  update-cards.ts    download upstream's card data into generated/raw/upstream/; exports ensureCards()
  build-cards.ts     raw inputs → generated/cards.json + card_stats/<gl|jp>_card_stats.json (buildCardFiles())
  build-schemas.ts   schemas/*.json from shared/schemas/ (z.toJSONSchema)
  lib/cards.ts       pure: buildCards() (the merge, + the round-trip check against upstream's lists)
  scrape-gametora.ts  GameTora: support card list + JP event history (generated/raw/), JP scenarios (data/)
  update-global.ts   data/news/ → Global's banners + card releases in data/, appends to data/news/gl/summary.md
  update-jp.ts       data/news/jp/ → new cards in data/jp_cards.json (+ build-cards), data/jp_banners.json +
                     data/jp_events.json, appends to data/news/jp/summary.md
  lib/jp-cards.ts    pure: newsCards() (every support card the JP news shows, at its first appearance),
                     applyNewsCards() (→ the history + pending, GameTora augmenting; GameTora-only cards listed),
                     data/jp_cards.json + jp_cards_pending.json readers/writers, updateJpCards()
  lib/gametora-events.ts  GameTora's JP story events / Champions Meetings / Legend Races → fills in jp_events.json
  lib/jp-banners.ts  pure: applyJpNews() (JP news → data/jp_banners.json), regularBanners() (what Global and ml/ read),
                     reader / writer
  lib/news-lang/     the news' wording per language, read by every parser below (`lang`, English by default):
                     en.ts (Global), ja.ts + ja-banners.ts (JP), index.ts (lexicon(server))
  lib/global.ts      pure: applyNews() (news posts + JP banners → Global banners/releases), data/ reader/writer
  lib/event-blocks.ts  pure: eventBlocks() (a post cut at its header art into blocks: intro + h2–h4 sections)
  lib/event-rewards.ts pure: cardsIn() (cards by lookup), itemsIn(), titlesIn(), missionsIn()
  lib/events.ts      pure: postEvents() (a post → its events, with doubts), eventFragments(), buildEvents() (mission
                     sets as bars, merged over posts, answers applied), cmPhases() (a cup's schedule), cmItems()
                     (Champions Meeting range from the hand table), data/ readers/writers (events, answers)
  lib/event-questions.ts  pure: what a model is asked about an event (askedFields(), question(): prompt + examples
                     + JSON schema), staleFields() / mergeAnswer() (per-field versions), applyAnswer() (checks + rules first)
  lib/ai.ts          the model client: Ollama (native /api/chat) or OpenRouter (OpenAI-style), aiConfig(), ask()
  ai-events.ts       `pnpm news:ai` (ask about doubted fields, store answers; --compare to test a model)
  list-events.ts     `pnpm news:events` (the events the news makes, printed, nothing written)
  lib/colors.ts      PNG decoder (zlib only) + main colour of an image, for scenario covers
  lib/scenarios.ts   Career scenarios (data/scenarios.json): SCENARIO_NAMES (slug → key + JP/Global short names, by hand),
                     mergeGametora() (JP side), applyScenarioNews() (Global side, from the news)
  fetch-pull-guide.ts  Luh's Support Card Encyclopedia (Google Sheet) → generated/pull_guide.json
  lib/pull-guide.ts  pure: the sheet's HTML view → entries (dates, Pull?, notes) → advice per banner (findBanner())
  fetch-news-latest.ts  new/edited posts → data/news/<server>/posts.json + summary.md (incremental, news.yml)
  fetch-news-all.ts  the whole archive → data/news/<server>/posts.json (one-off, resumable)
  fetch-news-umapyoi.ts  older posts from umapyoi.net's mirror → data/news/<server>/posts.json (one-off, resumable)
  categorize-news.ts `pnpm news:categories`
  lib/news-api.ts    the news API client per server (gl / jp; gentle pacing), posts.json reader/writer, --server
  lib/news-text.ts   pure: HTML → lines/sections, period dates (parsePeriod), shared by the news parsers
  lib/post-categories.ts  pure: categorize(post) → banner / event (+ kind) / other, phase, name
  lib/banner-posts.ts  pure: bannerPost(post) → a scout post's banners (gacha id, type, period, art, featured list)
  lib/news.ts        pure: the first parser (toRecord), still used for scenarios and events
src/                 (components' styles: `X.module.css` beside each, `camelCaseOnly` names; global ones below)
  main.tsx           mounts App (StrictMode); imports styles/global.css first, then App.css
  styles/global.css  what is global on purpose: colour tokens (light, dark), resets, tier colours (.tier-0…7), and the
                     tones: an element's colour (--tone) from its `data-tone` (a Timeline entry's `tone`, a chip's)
  App.css            the few plain classes pages still share: .page (every page's box), .segmented (the Timeline
                     filter's tabs), .reset-filters
  App.tsx            shell: wouter routes (src/routes.ts), top bar (title or back button + server switch), tab bar
                     (current tab aria-current="page"), shared server + scenario state; <main data-scroll-root>
  routes.ts          every address the app links to, built here (cardUrl, scenarioUrl, timelineUrl, TAB_URLS): no page
                     writes `#/…` by hand; wouter's patterns; `useHashLocation`: one location for the whole app,
                     changed only by `hashchange` (the Timeline's replaceState of the open sheet must not re-route)
  useAsync.ts        useAsync(load, deps) → { data, error, pending }: loads, ignoring a superseded run (pages' data)
  rawStorage.ts      the persisted stores' localStorage adapter: each store keeps its own stored format (never
                     zustand's { state, version } wrapper), every access guarded (private windows)
  settingsStore.ts   user settings (zustand + persist; getSetting / setSetting / subscribe for non-React readers):
                     timeZone 'utc' | 'local', scenarioNames 'global' | 'jp', jpNewsLanguage 'jp' | 'en'
  tierListFilters.ts the Cards tab's stat / LB filter / search / card size (zustand store): getFilters(),
                     saveFilters(), DEFAULTS, SIZES, isDefault()
  settings.tsx       useSettings() (the settings store's hook); App calls it so plain readers like scenarioName()
                     refresh on change
  ui/                the shared components (each with its module): LinkButton, SeeMore, FoldToggle, Pill (tag / kind
                     / status / verdict / label), TierChip, Status, Segmented, Section, SearchInput, ToolbarButton,
                     CardRow; pages use them where they look identical, else keep their own markup
  pages/SettingsPage.tsx               the Settings tab
  pages/TierListPage.tsx               the Cards tab
  pages/TimelinePage.tsx               the Timeline tab: loads a server's timeline, draws its groups and marks, opens
                                       the sheet; no server-specific code (src/timeline/)
  pages/CardPage.tsx                   one card (the entry App imports): art, tags, GameTora link, its parts:
  pages/card/        PullAdvice, Origins (+ OriginPill), RankOverTime, ScenarioTierTable; hooks.ts (usePredictions,
                     useOrigins, useScenarioRankings, useUpcomingRanking), shared.ts
  pages/card.css     global on purpose: the Rank over time picker's size (`.history-controls .dropdown-button`)
  gametora.ts        GameTora's URLs built from ids (no data file stores them): cardPage(slug), cardArt(id),
                     cardIcon(id, cards) (upstream's icon from cards.json, else GameTora's), traineeIcon(charId, id),
                     bannerArt(id, 'global' | 'jp'), withArt(file, art, cards) (a banner file's art + item icons, filled
                     by timeline/data.ts when it loads one; `officialArt`: the news' art, over GameTora's; ArtBanner…)
  pages/ScenariosPage.tsx              the Scenarios tab (list)
  pages/ScenarioPage.tsx               one scenario
  pages/RankChart.tsx                  SVG step chart of rank over time: fixed rank axis, sideways-scrolling
                                       plot (20px/month, quarters + years labelled), crosshair tooltip
  rankHistory.ts     pure: a card's position at each release date (marks predicted ones)
  cardOrigins.ts     pure: cardOrigins() (a card's banners and events, as Timeline entries, oldest first; generic: the
                     origins keep the entries given), originKinds()
  predictions.ts     optional loader for generated/predicted_gl_releases.json
  pullGuide.ts       optional loader for generated/pull_guide.json (card page's "Pull advice"), upcomingBanner(),
                     currentAdvice(), latestAdvice(), sheetLink()
  umapyoi.ts         umapyoiUrl(news_url): umapyoi.net's copy of an official post (JP's in Japanese)
  BackToTop.tsx      floating "back to top" button (the tier list, the card page), watches the [data-scroll-root]
                     scroll container
  Dropdown.tsx       the app's dropdown on Radix Select (every dropdown uses it; keeps a global `dropdown-button`
                     class on its button for card.css)
  statIcons.ts       STAT_ICONS: the game's stat type icons by stat key (src/icons/stats/<stat>.png, committed: 70×70,
                     from upstream's src/icons/utx_ico_obtain_00–05), bundled; the Cards tab's Stat picker shows them
  FilterSheet.tsx    the app's filter (Cards tab, Timeline): FilterButton (count), FilterSheet (on Sheet.tsx: title +
                     a reset), FilterSection (toggle chips coloured by data-tone, All / None); changes apply at once;
                     FilterSheet.css: its section classes (filter-section, -head, filter-note), shared with the pages
  Sheet.tsx          the app's detail sheet on vaul's drawer: phones, a bottom sheet dragged down to close (down arrow);
                     desktop (useMediaQuery.ts' DESKTOP), a centred near-square dialog, fading, × button, no drag
                     (`handleOnly`); focus, Escape, click outside, scroll lock; its heading is a <SheetTitle>
  ScenarioPicker.tsx scenario dropdown on top of it (italic + note when unreleased);
                     scenarioRelease.ts: SCENARIOS, scenarioByKey, isReleased / isCurrent(key, server)
  timeline/          the Timeline, the same for both servers:
    data.ts          loadTimeline(server) → { entries, marks }, loadEntries(server) (entries alone: the card page)
                     (MARKS: per-server overlays + toolbar buttons, JP's "Global now"); banner / event file loaders
                     (real + optional predicted), shared with the card page
    entries.ts       pure: bannerEntries(), eventEntries() → entries (`Entry`: one shape, documented there),
                     bannerStatus()
    layout.ts        pure: buildTimeline(entries) (months, days, `at(ms)` → position), laneGroups() (LANE_GROUPS:
                     the one order of the Timeline and its filter: support cards, trainees, then EVENT_GROUPS; rows
                     packed, parts nested under their parent; generic: rows keep the entries given), partCount()
    events.ts        pure: EVENT_GROUPS, items with currencies first (itemList()), withPredicted()
    format.ts        dateFormats(timeZone), dateRange(), kindName(), barLabel(), entryTitle()
    useRankings.ts   MLB ranks of a sheet's cards (server's own tier list, else looking ahead)
    useCenterOn.ts, useCompactRows.ts, useTimelineFilters.ts  the Timeline page's centring (linked entry / today,
                     zoom), compact mode's measuring, and its hidden / order / verdict filtering
    TimelineSheet.tsx  the one sheet for every entry, in sections (Header, Provenance, Relations, Featured,
                     Rewards, Schedule, Titles, Parts, RankNote, Links)
    TimelineAxis.tsx scenario strip + months + days; CalendarLines (scenario starts, today, marks)
    Lanes.tsx        LaneGroup (foldable label + rows), one Bar for banners and events (chip when short, +N parts;
                     its button data-testid="bar"); an entry's colour: data-tone
    StatusBadge.tsx  a status pill (Live, Upcoming, Predicted…): ui/Pill's status variant
    collapsed.ts     which Timeline groups are folded (zustand store): getCollapsed() / saveCollapsed()
    order.ts         the lane groups' order (the filter's Order tab; zustand store): getOrder() / saveOrder(),
                     orderedGroups(), reorderGroups()
    GroupOrder.tsx   the Order tab's draggable list (dnd-kit, by handles; rows `data-vaul-no-drag`: they don't drag
                     the sheet)
    hidden.ts        banner sections + event kinds the filter hides (zustand store): getHidden() / saveHidden()
    TimelineFilter.tsx  the toolbar's filter button + sheet (toggles per banner section / event kind / pull verdict)
    compact.ts       compact mode on/off (default on; zustand store): getCompact() / saveCompact()
    scenarioStrip.ts pure: scenario segments (launch → next launch, cover colour + text ink) for the calendar's strip
    globalProgress.ts pure: where Global is in JP's history (window between banners + linear estimate)
  tiers.ts           toTiers(), cardRanks(), TIER_NAMES, STAT_OF_TYPE
  servers.ts         SERVERS: gl/jp ↔ banner file names
  i18n/index.ts      i18next setup; statName/serverName/scenarioName/lbName, formatDate
  i18n/en.json       every UI string (English)
  useDragScroll.ts   mouse drag-to-pan (marks the scroller data-dragging)
shared/schemas/      zod schemas + their types for every data file (card, banner, event, scenario, pullGuide, news,
                     predictions, sources, gametora, common); files.ts: each data file's schema, the JSON Schemas
schemas/             JSON Schemas generated from shared/schemas/ (`pnpm build-schemas`; pull_guide.json points at its
                     own via `$schema`; cards.json is keyed by card id alone, so no `$schema`)
test/                Vitest `unit` project (pnpm test); helpers.ts: fixture<T>() (test data with only the fields the
                     code under test reads) and present() (a value fixed data must have); upstream-modules.d.ts types
                     upstream's plain-JS modules
test/upstream/       Vitest `upstream` project (pnpm test:upstream), needs upstream/
e2e/                 Playwright (pnpm test:e2e; visual.spec.ts only in pnpm test:visual); fixtures.ts
ml/                  Python (own venv, ml/.venv): predicts Global release dates of JP cards from
                     card info (data.py: JP dates from data/jp_cards.json via cards.json + data/'s Global ones), models.py, adjust.py
                     (known dates: by hand + Global banners rerunning newer JP ones; no JP weekends),
                     backtest.py, predict.py, banners.py (JP banners → predicted Global ones),
                     scenarios.py (predicted Global scenario launches → data/scenarios.json),
                     events.py (Global events paired with JP's → generated/event_pairs.json; predicted Global
                     events → generated/predicted_global_events.json),
                     (see ml/README.md)
data/                ours, committed (nothing can regenerate it; generated/ is rebuilt every deploy):
  global_banners.json, global_cards.json   Global's banners + card releases: seeded from GameTora once,
                                           then from the news (`update-global`); news-made entries carry news_url
  jp_cards.json      our history of JP's cards: charId, type, rarity, name/title (en: GameTora's, jp), JP release,
                     source, slug; keyed by id, one per line. The first 563 are a frozen record of GameTora's fields
                     (2026-10-12) that never changes; newer cards come from the JP news, augmented from GameTora
                     (`update-jp`, rebuilt from every post each time; they carry `news_url`)
  jp_cards_pending.json  the JP news' cards GameTora doesn't list yet (no id: not in cards.json), a list, one per
                     line (`update-jp`; `[]` when none)
  scenarios.json     every Career scenario: key, full_en, full_jp, en/jp_start_date, links.gametora
  known_dates.json   Global dates known ahead of time, by hand (`dates` by JP date, `banners` by gacha id)
  global_events.json Global's in-game events (the app reads this): built from news/gl/posts.json alone by
                     `update-global`; never edit by hand
  jp_banners.json    JP's banners: GameTora's history seeded once, the JP news merged over it (`update-jp`)
  jp_events.json     JP's in-game events, from news/jp/posts.json alone (`update-jp`); never edit by hand
  champions_meeting_rewards.json  Champions Meeting final-round rewards per league/group/place, by hand, in
                     blocks by `since` date
  news/gl/           official Global news: posts.json (raw, `news:latest` / `news:all` / `news:umapyoi`), summary.md,
                     ai_answers.json (a model's answers about doubted event fields, `news:ai`; applied at build time)
  news/jp/           official JP news (Japanese originals), the same files
generated/           build-time data, gitignored — never edit or commit
upstream/            clone of upstream main, gitignored — only test:upstream reads it
.github/workflows/   deploy.yml, upstream-check.yml
```

## Data pipeline

Upstream card data, GameTora, and an upstream clone used only by tests:

| Input | Where it goes | Committed? | Updated by |
|---|---|---|---|
| Card lists + card events (upstream) | `generated/raw/upstream/*.js` (as downloaded) | no | `pnpm update-cards` (every deploy) |
| JP's cards (JP names/titles, JP release dates, source, slug, type/rarity) | `data/jp_cards.json` (keyed by id, one per line) + `data/jp_cards_pending.json` (news cards without an id yet) | yes | the first 563 written once (2026-10-12) from GameTora, never changed; `pnpm update-jp` adds the JP news' newer cards, augmented from the row below (`news.yml`; deploys rerun it) |
| GameTora's support card list (augments the news' new cards: id, type, charId, slug, English; every card's slug) | `generated/raw/gametora_cards.json` (cut to the fields we read) | no | `pnpm scrape-gametora` (every deploy) |
| Every card's shown data | `generated/cards.json` (`schemas/cards.schema.json`; no GameTora URLs: a slug, upstream's icon) | no | `pnpm build-cards`, from the raw inputs + `data/jp_cards.json` + `data/global_cards.json` |
| Tier list calculation inputs | `generated/card_stats/gl_card_stats.json`, `jp_card_stats.json` | no | `pnpm build-cards` |
| Where generated files came from | `generated/sources.json`: `{ [file name]: source }` (upstream's repo + commit for `raw/upstream/*`, GameTora for `raw/gametora_cards.json`, the sheet's URL + update date for `pull_guide.json`, each with `fetched_at`); each script sets its own files' entries (`scripts/lib/sources.ts`) | no | `update-cards`, `scrape-gametora`, `fetch-pull-guide` |
| JP banners | `data/jp_banners.json` (GameTora's shape without its URLs; what the Timeline, `update-global` and `ml/` read) | yes | seeded once from GameTora's history (no longer scraped); `pnpm update-jp` merges the JP news over it (`news.yml`; deploys rerun it) |
| JP's events + what they give | `data/jp_events.json` (same shape as Global's) | yes | `pnpm update-jp`: built from `data/news/jp/posts.json` (+ `data/news/jp/ai_answers.json`), plus GameTora's story events / CMs / Legend Races where the news has none (before mid-2022) |
| GameTora's JP event history | `generated/raw/gametora_events.json` (cut to the fields used) | no | `pnpm scrape-gametora` (every deploy) |
| GameTora's trainee outfits (ids of debuting trainees) | `generated/raw/gametora_trainees.json` (`{ id, char_id, name, title }`, Japanese) | no | `pnpm scrape-gametora` (every deploy) |
| Global↔JP event pairs, predicted Global events | `generated/event_pairs.json`, `generated/predicted_global_events.json` | no | `pnpm predict-gl` (every deploy) |
| Global banner history + card releases | `data/global_banners.json`, `data/global_cards.json` | yes | seeded from GameTora once; `pnpm update-global` from `data/news/gl/` (`news.yml`; deploys rerun it) |
| Career scenarios + launch times on both servers | `data/scenarios.json` | yes | JP side: `pnpm scrape-gametora` (every deploy); Global side: `pnpm update-global` from the news (seeded once from GameTora) |
| Predicted Global release dates of JP-only cards and future Global banners | `generated/predicted_gl_releases.json`, `predicted_global_banners.json` (no GameTora URLs) | no | `pnpm predict-gl` (every deploy) |
| Pull advice + notes per card (Global banners) | `generated/pull_guide.json` | no | `pnpm fetch-pull-guide` (every deploy; optional for the site) |
| Global's events + what they give | `data/global_events.json` (output, what the app reads) | yes | `pnpm update-global`: built from `data/news/gl/posts.json` (+ the answers below) |
| A model's answers about what the rules doubt in events | `data/news/gl/ai_answers.json` (by event aiKey: `{ model, at, versions, answer }`, one per line, excluded from Biome) | yes | `pnpm news:ai` (locally with Ollama; in `news.yml` with OpenRouter's free Gemma) |
| Champions Meeting rewards per league/group/place | `data/champions_meeting_rewards.json` | yes | by hand, from the in-game reward list |
| Announced Global dates | `data/known_dates.json` (`dates` by JP date, `banners` by JP gacha id with exact start/end) | yes | by hand, e.g. from the monthly release schedule image (Global's banners in `data/` add more) |
| Official Global news (banners, events, updates) | `data/news/gl/posts.json` (each post as the API sends it), `data/news/gl/summary.md` (last run's additions) | yes | `pnpm news:latest` (`news.yml`, daily); `pnpm news:all` once |
| Official JP news (Japanese originals) | `data/news/jp/posts.json`, `data/news/jp/summary.md`, `ai_answers.json` | yes | `pnpm news:all:jp` + `news:umapyoi:jp` once; `news:latest:jp` (`news.yml`); answers: `news:ai --server jp` |
| Upstream code (for comparison only) | `upstream/` | no | `pnpm clone-upstream` (manual locally; CI clones it) |

- **The calculation is ours** (`tierlist/tierlist-calc.ts`, `scenarios.ts`): nothing
  syncs it automatically. Upstream's UI-only parts were dropped (the per-card `info`
  breakdown, scenario `version`/`currentState`/`show`, server `referenceDocUrl`,
  `defaultLocale`, `defaultFilters`, `defaultTierListDropdown`, `useLegacyFsBonusDisplay`).
  Keep the MIT attribution in their headers and `tierlist/LICENSE`.
- **Hearing about upstream changes:** `test/upstream/parity.test.ts` imports upstream's
  calc, scenarios and card lists straight from the clone (Vite resolves their
  extensionless imports) and requires our rankings to match exactly. When it fails,
  port the change by hand (or update the test if we diverge on purpose). It also checks
  the clone and `generated/` are the same upstream commit (`sources.json` `ref`) — if
  not, run `pnpm clone-upstream && pnpm update-cards`.
- `vite.config.ts` keeps Vite's dependency scan and watcher out of `upstream/` (it's a
  whole other app with its own `index.html`).
- **Card ids are the same on Global and JP and in GameTora's data.** Global has a subset
  of JP's cards. The card data (`scripts/lib/cards.ts`) is:
  - `generated/cards.json`: every card upstream or `data/jp_cards.json` has (a card only GameTora lists isn't one:
    `update-jp` warns), what the site shows: `{ id, charId, type, rarity, name: { en, jp }, title: { en, jp }, release: { gl, jp
    }, source, links: { gametora }, images: { icon } }`. Readable strings (type `speed`…`wisdom`, `friend`, `group`;
    rarity `R`/`SR`/`SSR`), mapped to upstream's codes in `tierlist/join-cards.ts`. "GameTora's" below means
    `data/jp_cards.json`'s (our frozen copy of GameTora's fields, 2026-10-12, then the JP news' cards with
    GameTora's id/type/charId/slug/English; a card in it never takes GameTora's list's values but its slug).
    Type/rarity: upstream's where it has the card. `name.en`: Global's (upstream's gl list) where it has the
    character (by `charId`), else GameTora's; group cards keep GameTora's group name ("Team Sirius"); `name.jp`:
    GameTora's. `title.en`/`release.gl`: ours (`data/global_cards.json`), else GameTora's title;
    `title.jp`/`release.jp`: GameTora's. `source`: how it's obtained, GameTora's `obtained` (`gacha`,
    `story_event`, `promo`, `limited_quest`, `main_story`, `shop`). `links.gametora`: GameTora's page slug
    (`url_name`, e.g. `30321-duramente`; the current list's, else the history's); the app links
    `https://gametora.com/umamusume/supports/<slug>` (`/supports/<id>` alone is a 404). `images.icon`: upstream's at
    its commit, null for cards upstream lacks. No GameTora URLs: the app builds the full art and icons from the id
    (`src/gametora.ts`).
  - `generated/card_stats/<gl|jp>_card_stats.json`: the calculation's inputs per server, `{ [id]: { charName,
    events, lb: [LB0…LB4 stats] } }`. `charName` is upstream's per-server name (each in its own language, which
    `scenarioLink` relies on; a group card's is a member's, as upstream has it); `events` the card's event rewards
    (the same on both servers) or null.
  `joinCards()` rebuilds upstream's exact arrays plus `events` per card (verified by `buildCards()` and
  `test/data.test.ts`).
- Generated card data is **JSON** (one card per line), imported with
  `with { type: 'json' }` so the same imports work in Node (CLI, scripts) and Vite.
  Vite's dev server keeps that attribute on dynamic `import()`s while serving JSON as
  JS, which the browser rejects; a dev-only plugin in `vite.config.ts` strips it.
  Only `generated/raw/upstream/` keeps upstream's JS modules, as downloaded (the build and tests read them).
- `ensureCards()` fetches upstream's card data if it's missing and builds the card data if that's missing; it runs
  from a Vite plugin (dev/build) and from `test/global-setup.ts`.
- **What still comes from GameTora** (nothing else may): card page links (slugs only), the ids, types, charIds, slugs
  and English names/titles of the JP news' new cards (`update-jp`: scripts/lib/jp-cards.ts), the id and character of
  a trainee debuting on a JP banner (`raw/gametora_trainees.json`, scripts/lib/jp-banners.ts), JP's events without a news source (the pre-mid-2022 fills in `data/jp_events.json`,
  `source: 'gametora'`), Career scenarios (`data/scenarios.json`'s JP side, covers, links), and hotlinked images
  (card art and icons, trainee icons, banner art) whose URLs the app builds from ids (`src/gametora.ts`: no data file
  or generated file stores one, but scenarios' `links`). Both servers' banners are our own records in `data/`,
  seeded once from GameTora's history (2026-10) and kept up from the news; JP's cards are `data/jp_cards.json` (frozen,
  then from the news). Global's banners and card titles/release dates come from `data/`; `raw/gametora_cards.json`
  doesn't even keep GameTora's Global fields. `cards.json` is the one place the two are merged (the site,
  `update-global` and `ml/` all read it). Don't make Global read GameTora again.
- **GameTora scraping** (`scrape-gametora`: the support card list, scenarios, the event history): its pages are
  client-rendered, so the scraper reads GameTora's versioned JSON (`/data/manifests/umamusume.json` →
  `/data/umamusume/<name>.<hash>.json`), one file at a time, 2 s apart. It's an internal format and may change; the
  scraper fails loudly if it does. A banner's `main` item is our own heuristic (highest rarity, then highest rate;
  `pickMain()`, as when the banners were seeded). GameTora's art URLs: `gacha/img_bnr_gacha_<id>.png` (Global's under
  `en/gacha/`), `supports/tex_support_card_<id>.png` (full art), `supports/support_card_s_<id>.png` (icon),
  `characters/thumb/chara_stand_<char_id>_<id>.png` (trainee), all under `https://gametora.com/images/umamusume/`.
- **`raw/gametora_cards.json`** is GameTora's `support-cards` file cut to what `buildCards()` reads (ids, names,
  titles, type, rarity, JP `release`, `obtained`, `url_name`: the page's slug, not derivable from the name);
  `fromGametora()` turns an entry into `data/jp_cards.json`'s shape (a news card takes its JP fields from the news).
- **Official news** (`umamusume.com/api/ajax/pr_info_index` / `pr_info_detail`, POST JSON, no cookies needed):
  keep it gentle. `news:latest` pages 10 posts at a time like the site, stops at the first page with a known post,
  fetches details only for new/edited posts (index `update_at` changed), one request at a time with 3–8 s random
  pauses — a normal day is 1–3 requests. Don't make it refetch everything. The index only lists the last few months;
  each detail response has `next_announce_id` (the next older post, by post date, across every id series), so
  `news:all` walks the whole archive from the newest post (1–2 s pauses, a one-off). The site doesn't keep everything:
  163 posts, mostly from July 2026 on, a few back to the June 2025 launch. The rest (425 posts, every month since
  launch) came from umapyoi.net, which mirrors the official English news (`GET https://umapyoi.net/api/v1/en/news` →
  every id, `/api/v1/en/news/<id>` → a post; same ids, titles and HTML as the official ones): `news:umapyoi` (0.1 s pauses: umapyoi.net allows 10 requests a second) turns them
  into the official shape (unix → "YYYY-MM-DD HH:MM:SS", `image_big` = its thumbnail, the same file; no `from_date` /
  `to_date` / `next_announce_id`) with `source: 'umapyoi'`. 588 posts in all; the old art is still served. `data/news/gl/posts.json` keeps each post's
  `detail` exactly as sent (+ `next_announce_id`, `fetched_at`), one per line, newest first, excluded from Biome;
  parsers read it, so a parser change needs no request. Timestamps from the API are UTC. Post ids come in series:
  1… in-game news, 100001… notices (issues, maintenance, store), 200001… community posts (X giveaways, letters).
  **Global's in-game posts reuse JP's post ids** for the same content (Global's 1076 story event is JP's 1076; its
  1065 Sagittarius Cup JP's 1065): the strongest way to pair events across servers.
- **Official JP news** (`umamusume.jp/api/ajax/pr_info_index` / `pr_info_detail`, **GET** with query params; a POST
  gets the site's HTML; `scripts/lib/news-api.ts`' `SERVERS.jp`): same pacing. The index is paged from 1 with
  `total_page_count`, and lists **every** post the site serves (317 on 2026-10-11, ids 107…3497): all of them from
  2026-07-23 on (id 3348; about the last 2½ months), plus 188 older ones it kept, scattered back to April 2023 and a
  few from the 2021 launch (rules, the known-issues post 155, updated often, sits among the newest), so index order
  isn't post order. A detail's `prev_announce_id` is the next **lower id** the site serves and
  `next_announce_id` the next higher (by id, not post date: 60 of 316 links go to a newer post), both stored as sent;
  `olderId()` reads either server's. Walking them from every index post found nothing the index lacks. Times are
  **JST** strings (`apiDate(s, 'jp')` → UTC); `update_at` is null when never edited. `image_big` is the header art
  (`prd-info-umamusume.akamaized.net/announce/<id>/Header/<file>`, 95 of 317 have one); a post page is
  `umamusume.jp/news/detail/?id=<id>` (client-rendered). Older posts come from umapyoi.net's mirror of the Japanese
  originals, `GET /api/v1/news` (2,663 ids, 100…3497, back to the 2021 launch) / `/api/v1/news/<id>` (no language
  segment; drop its machine-translated `title_english` / `message_english`): same ids; on 8 posts both serve, title,
  `message` (byte for byte, same `<p data-local-id>` markup) and post time match. Its `post_at` is unix (→ JST
  string), its `image` the post's banner as the news list shows it (`…/Thumbnail/<file>`, 936×228), `article_image`
  on some older posts (null on recent ones) the header over its first section (936×120; in a celebration post, its
  first part's: post 1122's ゆく年くる年 showed its login bonus's): `news:umapyoi:jp` takes `image` as `image_big` (the
  post's main event's art), else `article_image` (`--refresh-images` brought the stored posts over, 2026-10-13).
  2,663 JP posts in all (317 official, 2,346 from umapyoi; per year 96 / 380 / 541 / 592 / 614 / 440 for 2021–2026),
  every id umapyoi lists, none without a message or time; 1,485 umapyoi posts have header art (old ones checked: still
  served).
- **Post categories** (`scripts/lib/post-categories.ts`): `categorize(post)` → `{ category: banner | event | other,
  kind, phase, name, banners }`, from the title (very regular; first matching rule wins), the id series and, for
  banners, the body. Event kinds: story, champions_meeting, legend_race, transfer_requests, uma_outing, special
  (named one-offs), celebration (multi-part: anniversaries, holidays, Fall G1), campaign (single bonuses: Star Pieces,
  race tickets, free scouts), gift. Other: scenario, update, issue, maintenance, sale, roundup, community, misc.
  Phase: announced / league_selection / started / ending / ended. `news:latest` uses it for the summary and to tell
  news.yml whether data/ needs rebuilding.
- **Banner posts** (`scripts/lib/banner-posts.ts`): `bannerPost(post)` → `{ id, url, posted, paid, banners: [{
  gachaId, type: character | support, start, end, image, featured }] }`. Each banner's art sits under a "Trainee
  Umamusume" / "Support Cards" heading (its type) and is followed by its own list (`★★★ [Title] Name` / `SSR [Title]
  Name`, each once); its period is the scout period above it. Headings at every level (h2–h4: older posts use h3;
  `sections(html, '234')`); older posts say "Umamusume" for trainees. `paid`: the post's scouts cost paid carats (the
  one-off guaranteed scouts), left out like JP's special banners. Verified against the first parser on all 32 banner
  posts (same ids, dates, art, items).
- **News → Global banners** (`scripts/lib/global.ts`, fed `bannerPost()`s): scout posts show each banner's art as
  `gacha_banner_<id>_….png`, and `<id>` is the game's gacha id, which Global shares with JP (Global reruns JP's
  banners under JP's ids; 130/132 seeded Global banners match JP's id and cards). So a news banner is JP's banner
  of that id (featured ids, rates, types) with the post's dates and official art, names/titles paired with
  the banner's own English list (by character name, else the one leftover), `announced: true`, `news_url`. Its cards
  not yet out get `release_gl` = its start's UTC date (+ `news_url`). `applyNews` rebuilds every news-made entry
  (`announced`) from all posts (idempotent; a later post about a banner wins); a seeded one keeps its dates and items
  and gets the post that shows it (`news_url`) and its official art (`news_image`), as JP's GameTora banners do
  (132 of 134 on 2026-10-13). Predicted banners keep JP's post as `news_url` (the sheet: "Read JP's announcement"). Verified: from the
  news alone it rebuilt 30134/30135 identical to GameTora's. A banner whose id JP lacks, or whose type (from the post)
  isn't JP's, is skipped (listed in the summary); so are paid scouts.
- **Scenarios** (`data/scenarios.json`, `scripts/lib/scenarios.ts`): one entry per scenario in JP launch order,
  `{ key, full_en, full_jp, en_start_date, jp_start_date, links: { gametora, cover, umapyoi_jp?, umapyoi_gl? }, color }`
  (`umapyoi_*`: the launch post's id in that server's news, the page builds the umapyoi.net URL: JP's from `update-jp`,
  `applyJpScenarioNews()`, by the Japanese name of 育成シナリオ「X」公開！; Global's from `update-global`, the post that
  dates the launch); a start date is `{ date, tag }` (or null):
  tag `out` (launched), `confirmed` (known, still ahead), `predicted` (+ `lo`/`hi` range, from `ml/scenarios.py`).
  Known dates are re-tagged (confirmed → out) whenever the file is written, by JS or Python (same format). `key` is the tier list's where it ranks the
  scenario (URA, Aoharu, MANT, GL, GM, DYI), else ours — an id (URLs, lookups), never shown. `short: { jp, en }`: the
  names shown, via `scenarioName()` and the Scenario names setting (JP's from upstream's en-jp locale + GameTora's
  "for short"; Global's from upstream's en-gl locale, null until Global has one). Both from the hand table
  `SCENARIO_NAMES` (add new GameTora slugs there). `full_en`: Global's official name once the news gives it, else GameTora's English, else null;
  `full_jp`: the Japanese name (GameTora, every scrape). `links.cover`: GameTora's key art
  (`media.gametora.com/umamusume/scenarios/hero/<id>.png`, no text, so one for both servers; no official EN
  covers for now). `color`: the cover's main colour
  (`scripts/lib/colors.ts`: own PNG decoder, skin/hair hues left out since the art is mostly characters), computed
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
  entries win; out-of-order ones dropped with a warning). Predicted banners skip ids `data/` already has. **Event
  pairs** are known dates too, with the lowest priority (hand entries, then banner reruns, then events; only at or
  after Global's last release; a Champions Meeting compared on round 1 on both sides). Backtest (mean of the
  per-bucket median errors, linear(all)): 3.40 → 2.90 days with them (2026-10-12).
- **Global ↔ JP events and predicted Global events** (`ml/events.py`, run by `predict-gl`): each Global top-level
  event is paired with JP's (`generated/event_pairs.json`: `{ pairs: [{ gl, jp, kind, how, gl_start, jp_start, dev_days,
  anchor }], rejected: [… why] }`): `how` = `post` (same post id, the commonest), `card` (story events' SSR), `name`
  (Champions Meeting cups, EN ↔ JP: Taurus Cup ↔ タウラス杯…; a small table of recurring specials / celebrations,
  `NAMES`, `CUPS`) or `order` (Legend Races); every pair keeps Global's order = JP's per kind and lies within 10 days of
  where JP's card releases put it (else rejected: 2, events Global moved). 94 pairs on 2026-10-12 (story 20/20, CM
  20/20, LR 15/15, …); unpaired: mostly 2025 gifts/campaigns whose 2021 JP posts aren't in the archive, Transfer
  Requests (GameTora has none). Predicted events: every JP event (all kinds, user decision) after the JP date Global
  has caught up to with no pair, at the same predicted Global date as banners (22:00 UTC, no JP weekend; a known date
  exactly), JP's durations, parts and phases shifted with their top-level event; `generated/predicted_global_events.json`
  `{ source, events: [JP event fields + id 'jp-<jp id>', parent 'jp-…', predicted, jp_id, jp_start, jp_end, margin_days,
  confirmed?] }`. 368 top-level + 616 parts on 2026-10-12.
  **`confirmed` comes only from `data/known_dates.json`** (`ml/adjust.py`: `hand_known_days()`, `confirmed_cards()`):
  a banner on its `banners`; a card on one of those banners or on a JP day its `dates` give; an event only on a JP day
  its `dates` give. A JP day known otherwise (Global's banners, paired events, a confirmed banner's day) still gives
  the exact Global day, but nothing on it is `confirmed`: sharing a day with an announced banner or cup confirms
  nothing about a gift on that day.
- **Events** (`scripts/lib/events.ts` → `data/global_events.json`): Global's in-game events from the news alone (no
  GameTora; Global's upcoming ones are predicted from JP's: "Global ↔ JP events" below). **Everything with dates of its
  own is a bar** (except inside one event: Champions Meeting rounds, reward collection, repeated windows stay in its
  bar), newest first: `{ id, kind, name, parent, start, end, cards, items, titles, phases?, news_url, image, source }`
  (`phases`: Champions Meetings only). What matters most is whether an event gives a **support card**: `cards` `[{ id, rarity,
  title, name, copies }]`, found by looking every "[Title] Name" up in `generated/cards.json` (English title + name;
  however the post words it, trainees never match; lines about bonus cards/boosts/rankings skipped), `copies` from "a
  total of five copies" / "up to two times". Everything else it gives is secondary: `items` `[{ name, count }]` as the
  post names them (aliases: Support Pt → Support Points), count a number, `{ min, max }` (Champions Meeting, hand
  table) or null (named without an amount: Legend Races' "Main Rewards", "rewards including … SSR Voucher and carats");
  "Item × N" lines sum ("Login Days 8-12" counts 5×, dated gift rows add up), a carat amount in prose ("a gift of 3,000
  carats") counts only when no list gives carats, never fees/prices. `titles` ("Event-Exclusive Title: X" or the
  "Event-Exclusive Titles" bullets). Mission sets ("X Missions" + its period line, `missionsIn()`) are bars of their
  own (kind missions, id `<event>-m<n>`, `parent` = the event listing them; `missionBars()`). Kinds (`EVENT_KINDS`): story,
  champions_meeting, legend_race, transfer_requests, uma_outing, special, celebration, and a celebration's sub-events
  campaign / gift / login_bonus / missions / shop / sale (campaign is also single bonus posts: Star Pieces, race
  tickets, free scouts). `name` null for Legend Races and Transfer Requests (the UI shows the kind).
  From posts (`postEvents()`): event posts (`categorize()`; "ending soon" reminders skipped) are cut into blocks at their
  header art (`eventBlocks()`: `<figure><img …/header_<8 digits>_…>`; scout art isn't a boundary; the intro goes with
  the first block; h2–h4 are all headings). A one-event post stays one event whatever art it shows (story events and
  Champions Meetings use extra pictures). A celebration post is several: block 0 is the celebration (id = post id),
  each later block with a period heading or gift/reward contents of its own is a sub-event (id `<post>-<block>`,
  `parent` = the celebration; name from its opening sentence, `subEventName()`; kind from name + opening sentence,
  then headings, `subEventKind()`; a gift without a period starts when its sentence says, else when posted); other
  blocks (a new song, stamps, a dated "has been added" sentence) belong to the block before. A celebration without a
  period of its own runs from its opening sentence's date to its last sub-event's end. Dates (`blockPeriod()`): the
  block's period headings (main ones first: availability / event / sale / league selection; never reward collection, expiry,
  registration, matching, sneak peek, ranking, exchange), every short non-bullet line under them; "Gift Timing" lists
  run first → last moment; else an opening "As of / From … (UTC)" sentence. "has ended" posts give no dates. A
  one-event post is read as one block (`joinBlocks()`: lines after a picture stay under the heading before it; a Legend
  Race post shows its second race's art between the race periods). A Champions Meeting runs from its league selection
  to its final race (the post's "Event Availability Period" and GameTora's dates start at round 1, 3–4 days later; the
  league selection is the event's start) and has `phases` [{ key, start, end }] from its
  schedule headings (`cmPhases()`, `CM_PHASES`: league_selection, round_1, round_2, final_registration,
  final_matching, final_race; from the latest post that has them, "coming soon" posts only give rough starts).
  Mission sets get the reward names of their post's sentence about the missions ("rewards including carats, monies
  and Support Points"), never amounts (posts don't give per-set amounts).
  Merging (`buildEvents()`): same kind + name and overlapping dates (a cup counts from its league selection, so a
  "coming soon" post dated there meets it; the frequent "Bonus Star Piece" posts stay apart); a post with a period but
  "has ended" joins the latest such event that started before it, within 14 days; a post announcing an event without
  dates ("coming in late November") joins the same-named event starting within 45 days after it (else keeps its own
  bar, starting when posted). Dates, news link and art from the most advanced post (started > league selection >
  announced); items take the largest count any post gives; cards and titles combined; id = the first post's. An event
  spans its parts (a celebration dated from its first section, e.g. a 3-day collab, runs as long as its login bonus
  and gifts). `pnpm news:events` prints the result.
  A part without art of its own (a sub-event, a mission set) shows its parent's. Sales list no items (what they list
  is bought), nor do "Paid Carats". 323 events; ids are post ids (`<post>`, `<post>-<block>` for a celebration's
  sub-event, `<event>-m<n>` for a mission set; merged posts keep the first post's id). GameTora's event data (Legend
  Race names, mission reward counts, story point rewards) was tried as a merged-in seed and removed: the Timeline's
  data comes from the news only. Checked against GameTora on 2026-10-11 (a one-off script): every story event (name,
  dates, cards), Legend Race, mission set and special-event run matches it, and every Champions Meeting's end (its
  start is earlier on purpose: league selection); ours only has less (the Trainer Aptitude Test's / Racing Carnival's
  reward-collection days after their event period, mission sets the news hasn't announced).
- **A model for what the rules doubt** (`scripts/lib/ai.ts`, `event-questions.ts`, `ai-events.ts`, `pnpm news:ai`): the
  rules stay the extractor; each event records its `doubts` ({ field: why }: an amount in a sentence they didn't read or
  given per day (`itemDoubt()`), copies given in several places or talked about but not read (`copiesDoubt()`), a
  sub-event name from a heading instead of a sentence, a kind nothing matched, dates from a sentence or a "Timing"
  list). `askedFields()`: those, plus a card without copies or an event without a name (not items named without an
  amount, nor Legend Race / Transfer Request names: posts don't have them). Each question is narrow: the fields, worked
  examples from made-up posts (none copied from real ones; several answer null), the event's own text, and for an
  event with cards the lines elsewhere in the same post about them ("up to three times in the Missions" in the gift's
  section) so it gives this event's share; JSON schema of just those fields. Amounts are asked in parts (`each` ×
  `times`, or a `total` the text states): small models read numbers well but multiply badly, so the code multiplies.
  System prompt: answer only from the text, never guess or assume a default; null is better than a wrong answer.
  Answers are stored in `data/news/gl/ai_answers.json` by event aiKey (id + a hash of its text and context, so an edited
  post is asked again) with per-field versions (`FIELD_VERSIONS`: bump one when its question changes, so only that
  field is re-asked) and applied at build time by `applyAnswer()`, rules first: a doubted or empty field takes the
  answer, a value the rules are sure of is never touched. An answer is used only if it checks out: item and event
  names in the text (not a kind's generic name like "Legend Race"; "carat gifts" → Carats), amounts up to 10 million,
  copies of a card the rules found that the post gives (as a digit or word, in a line about the card or copies/times;
  "1st" isn't 1), a known kind, dates in order within ~200 days of the post; mission sets take names only; card copies
  a model put among the items count as copies. Models: Gemma 4 — locally `gemma4:26b` through Ollama (native API,
  `think: false`: thinking took minutes and its reasoning filled Ollama's default 4,096-token context, so `num_ctx`
  16,384), on OpenRouter `google/gemma-4-26b-a4b-it:free` (OPENROUTER_API_KEY; free models: 20 requests a minute, 50 a
  day, 1,000 once the account bought $10 of credits; paced and 429s retried). `gemma4:e4b` is ~6× faster but missed the
  multiplications. Results (2026-10-11): 142 events asked; on hard cases with known answers 26b got every one (Umayuru's
  150 × 22 windows = 3,300 carats, 3,000-carat login bonuses, Golshi Mode's 1,200,000 Monies, ×5 card gifts, ×2 login
  and ×3 missions copies); every number and date it changed is in its post. `--compare` asks events about every field
  and reports agreement with the rules per field (how these were chosen).
- **One parser, two languages** (`scripts/lib/news-lang/`): the news parsers (post-categories, banner-posts,
  event-blocks, event-rewards, events) are shared and take a lexicon `lang` (English by default): every pattern they
  read a post with (title rules, phases, period headings, item / copies / login patterns, sub-event kinds, art, CM phase
  headings) plus hooks: `parsePeriod` + `dateRef` (EN: the post's UTC year; JP: `parsePeriodJa`, JST, the year nearest
  the post), `clean(html)` (JP: zero-width spaces, full-width digits, unquoted attributes, line breaks at headings),
  `community(post)`, a rule's kind as a function of the post. JP-only behaviour sits behind optional hooks English
  doesn't set (scouts: `firstList`, `paidBanner`, `periodLabel`, `rerunPeriod`; events: `introBlock`, `blockRole`,
  `partCopies`, `deadline`, `schedules`, `sameDates`, `unionDates`, `titlePrefix`, `localName`, `splitItems`…).
  **A change to the shared code must leave Global's output byte-identical** (`update-global` before/after, `news:events`).
  `norm()` keeps letters of every script (kana, kanji). What the JP posts look like, and the user's decisions:
  docs/jp-news-findings.md; the plan: docs/jp-news-plan.md.
- **JP categories** (`news-lang/ja.ts`): label 2/3 = community (≈ EN's 200001 series; label 5 is one maintenance post),
  scouts by their art (exactly the 466 posts with `gacha_banner_` art), then anchored title rules (`^ストーリーイベント「…」
  (開催決定|開催|終了)！$`, `^(レースイベント|M/D|N月下旬)「チャンピオンズミーティング X」`, …) so event-named bug posts stay
  other. JP kinds Global lacks: `league_of_heroes` (no name, in UNNAMED_KINDS), `factor_research` (因子研究),
  `masters_challenge`. A campaign post showing ≥ 2 parts' art is a celebration. Names stay Japanese (decision 1): a
  name is the leading 「…」/『…』 when only the phase follows it, else the title without its phase.
- **News → JP cards** (`scripts/lib/jp-cards.ts`, `pnpm update-jp`, first step; user decision 2026-10-12): a JP card
  the history (`data/jp_cards.json`) lacks comes from the JP news; GameTora augments it once its list has it.
  `newsCards(posts)`: every support card the news shows, at its first appearance — scout posts' featured lists
  (`bannerPost(post, ja)`, every rarity and scout, paid too) plus any other card line in a scout post (`ja.bannerCard`:
  a select-pickup scout's new R card under its own heading after the candidates), a story event's own SSR
  (`ja.eventCard`: 「イベント限定SSRサポートカード「[…]…」」, quoted or, at a line's end, not) and a card an event
  part gives (`ja.giftCard` on a line with プレゼント/獲得/お贈り, not `notGiven`: 「SSRサポートカード「[…]…」をプレゼント」,
  「「SSR[…]…」を最大2枚プレゼント」), from `eventFragments()` (so summary blocks and scouts inside celebrations aren't read;
  `cardsIn()` and data/jp_events.json are untouched). From the news, never overwritten: `title.jp` / `name.jp` (as the
  post writes them, title in brackets; a title cut short joins the history's / the longest spelling), `rarity`,
  `release` (the JST day of the earliest banner start or event start giving it: an event announced without dates
  doesn't count; first appearance on any banner or event), `source` (`gacha` for a scout banner, which wins a tie;
  `story_event` for a story event; any other event's card takes GameTora's `obtained` once augmented — promo or
  limited_quest, the news can't tell — else `promo`). From GameTora (`raw/gametora_cards.json`, matched by title.jp +
  name.jp under `norm()`, a cut title by prefix): `id`, `type`, `charId`, `slug`, `name.en`, `title.en`; a news-made
  entry carries `news_url`. Until GameTora lists a card it's **pending** (`data/jp_cards_pending.json`: no id, so not
  in `cards.json`: no card page, not ranked; banners show it by name with id null); once augmented it moves into the
  history and `update-jp` rebuilds the card data before banners and events, so they resolve it in the same run.
  News-made entries are rebuilt from every post each time (idempotent); their GameTora fields are kept when GameTora's
  list is missing or drops the card; the frozen 563 never change. A card GameTora lists that neither the history nor
  the news has isn't added: `update-jp`'s summary lists it (a parser gap shows there). Upstream's jp.js isn't used for
  ids (it adds a card once its stats are known, after GameTora). Checked on 2026-10-12 by removing the frozen cards
  from 2024 on (218) and rebuilding: 206 came back with every field identical (id, type, charId, rarity, names,
  titles, slug, release.jp, source); the 12 others (collab/promo and main-story SSRs) are named in no event or scout
  post (some only in ぱかライブTV summaries), so they're GameTora-only warnings. Over all 563, the news finds 394; the
  only release differences are 2021–22 cards whose first archived banner is a later re-run.
- **News → JP banners** (`scripts/lib/jp-banners.ts`, `pnpm update-jp`): `data/jp_banners.json` is GameTora's history
  (seeded once, 366 banners) with the JP news merged over it, rebuilt from every post each time (idempotent; seeded
  entries never lost; GameTora's banners aren't scraped any more). No GameTora URLs (seeded banners have no `image`,
  items no `icon`: the app builds them, `src/gametora.ts`); `image` is only a news-made banner's official art. A
  banner GameTora has gets `announced`, `news_url`, `news_image` (official art, shown over GameTora's; dates stay
  GameTora's: all 574 post/GameTora pairs agree on start, end and type) and the R cards the post lists,
  as `from_news` featured items (GameTora leaves R cards out). Banners GameTora lacks (select-pickup supports, Twinkle
  Collection 30xxx, paid 50xxx) are made from the post (`from_news: true`, featured resolved: supports by cards.json
  title.jp + name.jp, trainees by title + name on the items of data/jp_banners.json and data/global_banners.json, and
  a trainee no banner has shown yet (a debut) by GameTora's trainee list (`generated/raw/gametora_trainees.json`, from
  `scrape-gametora`; until GameTora lists it, by name only, id null, and listed in update-jp's summary; once stored it
  resolves from our banners without the list); a card still pending, see above, stays id null). `paid: true` per banner (gacha id ≥ 50000; a post
  can mix both). Re-runs (decision 6): the original keeps its dates and gets `rerun: { id, start, end }`; the re-run is
  GameTora's banner with the same featured starting then (`rerunOf`), else ours with id `<id>-rerun` (the only string
  ids). JP scouts: only the first featured list after a banner's art counts, labelled windows in one period section,
  a `再開催期間` section re-holds every scout of its post. Every news-confirmed banner gets `name`, the scout's name from its post (its heading in
  group-select posts, else the next 「…ガチャ…」 in the post that fits its type: ★ / 育成 / プリティーダービー for trainees,
  SSR / サポートカード for cards; a post naming only its whole scout gives every banner that name), and one without a
  featured list (JP's paid scouts: guaranteed ★3/SSR, step-up, start dash list only which releases can appear) gets
  `note`, the post's line about what it draws from. The Timeline labels a bar with no featured item by its `name`
  (every JP banner has a label) and shows `name` under the sheet's art, `note` in place of the empty featured list. `regularBanners()` (and ml/data.py's `jp_banners()`) is what
  Global's news pairing, `globalProgress` and `ml/` read: no paid banners, no string ids, GameTora's featured (no
  `from_news` items), so their output didn't change. The Timeline shows paid badges and links re-runs both ways.
- **JP events** (`buildEvents(posts, { lang: ja })` → `data/jp_events.json`, `pnpm update-jp`): Global's model, JP
  wording. Celebration posts are cut at part art (`header_…`, `banner_…`, `header_CP_/EV_…`, bare `<img>` too; the
  intro is its own block; scout links and paid gachas, card-copy summaries and feature news aren't parts). Periods are
  JST; gifts run to their 対象のトレーナー deadline; Champions Meetings have Global's phases (the headings never changed
  since 2022), League of Heroes its own (team formation, main stage, extra stage registration / matching / votes /
  race). Items: Global's canonical name where Global has the item (Carats, Monies, Support Points, shards, tickets) with
  the Japanese one in `local`, else the Japanese name; paid packs, costs and exchanges excluded. Cards by title.jp +
  name.jp; campaign copies per part from the post's summary (「…」で最大2枚). A sale part doesn't stretch its
  celebration (`notSpanning`: a pack stays on sale a year or more). Before mid-2022, where the news archive is thin,
  GameTora's JP story events (with their SSR), Champions Meetings (from round 1: GameTora has no league selection;
  phases round_1 → final_race) and Legend Races fill in (`source: 'gametora'`, ids `gt-story-<id>` / `gt-cm-<id>` /
  `gt-lr-…`, no news_url or art; `scripts/lib/gametora-events.ts`, from `generated/raw/gametora_events.json`; news
  events always win; without the raw file the fills in data/ are kept). 1,144 events. Checked
  against GameTora's JP event data on 2026-10-11 (a one-off script): every story event from mid-2022 (44/45 with the
  SSR; the miss is a 2021 announcement naming none), Champions Meeting (36/36: round 1 = GameTora's start, same end)
  and Legend Race (48/48) matches; before mid-2022 the archive is thin (2021: 96 posts).
- **The model on JP events** (`news:ai --server jp`): the questions are per language (`QUESTIONS` in
  event-questions.ts: Japanese SYSTEM / FIELDS / made-up EXAMPLES; English's unchanged, so Global's stored answers
  still match). JP times are JST: the model gets the post date and answers dates in JST as the post writes them; the
  code converts them to UTC with the year nearest the post. Sub-event kinds also allow `special` (an event embedded in
  a celebration post). Answer names go through the JP lexicon (`itemName(raw, ja)`, `local`). Run locally with
  `gemma4:26b` on 2026-10-11/12: all 268 doubted (+ empty-field) JP fragments answered (312 stored, ~1 h); applied, it
  changed 56 events: sub-events named by their own sentence instead of the celebration, events embedded in celebration
  posts typed `special` and merged into their own post's event (no more duplicates), mission sets listed twice merged
  (1,120 → 1,110 events). Known weak spot: the cosmetic 特別ホーム画面 parts became `special`.
- **JP on the Timeline and in the workflows**: JP's calendar has the event lanes Global has (groups, parts, sheets).
  A banner without an end (an open-ended scout, 終了日時未定) counts as one day in `src/timeline/layout.ts` and reads "from
  <start>". `fetch-news-latest --server jp` categorizes with the JP lexicon (summary + `update`). `news.yml`: Global's
  news, then JP's (`news_jp`); cards + GameTora if either updated; the model for each server that updated;
  `update-jp`, then `update-global` (Global's news pairs with JP's banners by id); one commit whose subject sums both
  servers. `deploy.yml` runs `update-jp` before `update-global` (not committed).
- **Pull guide** (`scripts/lib/pull-guide.ts`): Luh's Umamusume Support Card Encyclopedia, a public Google Sheet
  (one tab per Global scenario era, one row per card banner; reruns get their own row). Read from each tab's HTML
  view (`htmlview/sheet?gid=…`): the CSV export has no hyperlinks, and a row's card id is only in its GameTora link
  (`…/supports/<id>-…`, ids are ours); the xlsx export has them but is ~110 MB of art. Cell comments are in neither,
  so they're left out. Columns are found by header text ("Support Card", "Date", "Pull?", "Notes"; one tab has no
  "Notes" header, so it falls back to the column after "Pull?"). Dates:
  exact (`date`), or `month` + early/late for the author's estimates. Notes are wrapped to the column by hand;
  `parseNotes` joins lines back into sentences (a guess: a capital, "(" or digit starts a new one unless the line
  before runs on — a comma/colon/number, a joining word in `CONTINUES`, or a card name split across the break, from
  every tab's card names, so the script parses the tabs twice), splits sentences run together on one line (`STARTS`)
  and drops spaces before "!"/"?". `parsePull` evens out the advice's wording (If Whale, With X, Dolphin, to Lates); advice starting with a limit break ("1LB+ or R MLB") gets the Yes pill, its text placed as before (leading the notes, or the recommendation line when long).
  Each row is matched to one of Global's banners (`findBanner()`, at build time: first release = the earliest
  banner featuring the card, real or predicted; a rerun = the closest by date, within 3 weeks of an exact date, 6 of
  an estimate), so `fetch-pull-guide` runs after `predict-gl`. Verified: every gacha row maps, and the sheet's
  "Rerun" labels match the banners' `new` flags exactly. `pull_guide.json` (shape: `schemas/pull_guide.schema.json`; keep it in step): `{ banners:
  { [banner id]: { [card id]: advice } }, noBanner: { [card id]: advice + release } }`, advice = `{ googleSheetsSrc:
  { gid, row } (the card page links to the row), freePulls, shouldPull (the pill: yes/no/free/whale/dolphin + the
  advice's "+"s, or null), comment (the line under it), advice (the notes as one paragraph) }`; `noBanner` holds
  event/story/shop cards (free, on no gacha banner) with `release: { label, date | month + part | dateText }` from
  the sheet (the script warns about any other card that maps to no banner). The sheet's
  content is the author's English text, shown as is; credited (with a disclaimer) in About. ~15 requests with 1–2 s pauses; the script fails loudly if no cards are found.
- Banner/card images are hotlinked from GameTora and upstream GitHub; the app builds GameTora's URLs from ids
  (`src/gametora.ts`; `src/timeline/data.ts` fills a loaded banner file's `image` and items' `icon` with `withArt()`: Global's
  banners Global's art, JP's and predicted ones JP's; card items GameTora's icon, trainee items `chara_stand_<char_id>_
  <id>`). Full card art is GameTora's `tex_support_card_<id>.png` (3:4 portrait). News-made banners use the official
  art from the post, stored (936×228, no transparent margin: `.bar.official-art` covers instead of GameTora's crop).

## Ranking semantics

- `processCards` (upstream) scores each candidate card as its **marginal** value when
  added to a fixed 5-card deck. Scores are only comparable within one
  server + scenario + stat.
- `rankByUsefulness` averages that score over the site's default deck and all deck
  presets; if a deck already holds the candidate's character, the candidate is scored
  against the other 4 cards (the game forbids duplicate characters).
- Tiers (S, A, B…) split the score range into 7 equal bands (upstream's banding).
- **Averaged rankings** (`COMBINED` in `tierlist/index.ts`) are offered next to the real
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
  (`release_gl` from `data/`, `release_jp` from `data/jp_cards.json`) is on or before it. The card is compared with other
  cards at the **same LB**. Preset decks stay as they are today. Cards without a
  release date (a few Global promo cards) are left out. The last step runs on to today,
  so where upstream's card lists lag the game the line is just flat at the end.
  **On Global it continues as a dashed line** through JP's cards Global doesn't have yet, at
  their predicted dates (`generated/predicted_gl_releases.json` via `src/predictions.ts`,
  optional). They're ranked with `rankByUsefulness(…, { upcoming: true })`: JP's stats
  (identical to Global's for every shared card), English names via another card of the same
  character; existing cards' scores don't change (averaged rankings keep the Global-only
  0–1000 scale, so upcoming cards can score above 1000). JP's newest cards have no stats
  upstream yet and are left out. Cards not on Global with a prediction get the chart too.
  **Promo cards** (cards.json `source` promo: collabs, campaigns) are never predicted: Global isn't expected to get promo
  banners or cards (ml/data.py `is_promo()`: status 'promo'; ml/banners.py drops them from predicted banners and skips a
  banner of nothing else). One Global does get comes from the news like any release.
- Server keys: `gl` / `jp` for tier-list code, `global` / `jp` for banner files
  (`src/servers.ts` maps them). GameTora card types map to stat tabs via `STAT_OF_TYPE`
  (`intelligence` → `wisdom`, `group` → `friend`).

## Tests

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

## Code style

- **Use libraries, don't hand-write.** Before writing a mechanism yourself (UI behaviour, parsing, retries, storage,
  routing, dates…), look for a maintained library and use it; write it yourself only when nothing fits or it's
  genuinely a few lines. Prefer small, focused, fast libraries (they're shipped to phones: bundle size and speed are
  user experience) over big do-everything ones; take a heavy library only when its weight is actually needed. Choose
  stable, long-established, widely used libraries over what's newly fashionable: the code should need little
  maintenance (few breaking releases, a long track record, an active but calm project).
- **Keep it simple, as a lazy senior dev would:** the least code that does the job clearly. No speculative
  abstractions, options or layers; no cleverness where plain code reads better; delete rather than work around.
- **Comments: as few as possible.** Names and types say what code does; a comment only says why, where that isn't
  obvious (a workaround, a data quirk, a trap someone would fall into). No file headers restating what a file is or
  exports, no comments narrating the code, no section banners. Keep licence / attribution headers, `biome-ignore`
  reasons and `TODO(ts)` notes.
- **Frontend: reusable components.** UI is built from shared components (`src/ui/`, `src/FilterSheet.tsx`,
  `src/Sheet.tsx`, `src/Dropdown.tsx`…). Reuse one before writing new markup; when two places need the same piece,
  make it a component instead of copying it.
- **TypeScript** (`tsconfig.json`, strict): `pnpm typecheck` must pass; see "TypeScript everywhere" above. Tests type
  partial data with `fixture<T>()` and must-exist lookups with `present()` (`test/helpers.ts`).
- **Biome** (`biome.json`) formats and lints TS/TSX, CSS (CSS Modules parsed) and JSON; run `pnpm format`
  before committing. Style: semicolons at the end of statements, a trailing newline at
  the end of every file, 2-space indent, single quotes in JS (double in JSX attributes),
  ES5 trailing commas, 120 columns.
  Git-ignored paths (`generated/`, `upstream/`, `dist/`, `.claude/worktrees/`) are skipped.
- **Pre-commit hook** (husky, `.husky/pre-commit`): applies Biome's formatting + safe
  fixes to the staged files and re-stages them, then blocks the commit if anything that
  can't be auto-fixed remains. Partially staged files are only checked, never fixed (re-
  staging would commit their unstaged changes); fix those with `pnpm format` + re-stage.
  `pnpm install` sets it up (the `prepare` script). Bypass in an emergency with
  `git commit --no-verify`.
- **Pre-push hook** (`.husky/pre-push`): runs `pnpm test`; a failing test blocks the push
  (`git push --no-verify` to bypass).
- Linter uses the `recommended` preset. Where the code is deliberate, suppress with a
  `biome-ignore <rule>: <reason>` comment (see `RankChart`)
  rather than turning rules off globally.

## Frontend conventions

- **No hard-coded UI text.** Every user-facing string (including `aria-label`s, titles
  and badges like MLB) lives in `src/i18n/en.json` and is rendered with `t()` from
  `useTranslation()`, or `<Trans>` for sentences with markup. Catalogs use i18next's
  format: `{{var}}`, plural keys `key_one`/`key_other` (pass `count`), `{{items, list}}`
  for "A, B, and C". Display names for code keys go through the helpers in
  `src/i18n/index.ts` (`statName`, `serverName`, `scenarioName`, `lbName`); `tierlist/`
  and `src/servers.ts` hold keys only. Dates go through `formatDate()` / `formatDateTime()` so they use the
  UI's locale. Banner times (calendar days, bars, sheet) follow the **Settings** timezone: UTC by default, as
  the game announces them, or the viewer's own (`timeZoneOptions()` for Intl, `buildTimeline(…, { utc })` for
  days). All stored times are UTC. Other settings go in `src/settingsStore.ts` (DEFAULTS + OPTIONS) + a row on the Settings page. A new language is a new JSON file registered in `RESOURCES`.
- **Mobile first.** Base CSS targets phones; `@media (min-width: 768px)` adds desktop
  tweaks. Top bar (page title or back button, server switch) always on top; tab bar at
  the bottom on phones, under the top bar on desktop. Pages don't render their own title. Check layouts at 360–390px wide.
- **Styles are CSS Modules**: `X.module.css` beside the component (`import styles from './X.module.css'`,
  `camelCaseOnly`: `.see-more` → `styles.seeMore`), combined with `clsx`. Global only on purpose:
  `src/styles/global.css` (tokens, resets, tier colours, tones), `App.css`'s few shared classes, a class other code or
  CSS looks up by name (keep it a plain class beside the module one, and say why). Code never finds elements by class:
  `data-*` (`data-scroll-root`, `data-dragging`, `data-testid`) or roles.
- Colour tokens live on `:root` in `src/styles/global.css`, with a dark-mode override; use them instead of literal
  colours (tier colours `.tier-0`… are the exception). A Timeline entry's or chip's colour is `data-tone={tone}`
  (global.css maps tones to `--tone`), the component's CSS reads `var(--tone)`.
- **Shared components are `src/ui/`** (LinkButton, SeeMore, FoldToggle, Pill, TierChip, Status, Segmented, Section,
  SearchInput, ToolbarButton, CardRow): use them; where one doesn't fit a page's look exactly, keep the page's markup
  rather than changing how it looks.
- Hash routing only (GitHub Pages can't serve deep links), with wouter: every address is built by `src/routes.ts`.
  `vite.config.ts` uses `base: "./"` so the build works under any Pages path.
- Data loading in components is `useAsync()` (`src/useAsync.ts`); remembered state is a zustand store persisted
  through `src/rawStorage.ts` (keys and stored formats never change: people would lose their settings).
- Icons come from `lucide-react` (the same Lucide set Streamline hosts); don't use text
  symbols as icons.
- Card and trainee icons are square images; show them uncropped (`object-fit: contain`).
- Heavy work (rankings take ~100–300 ms each; averaged ones run every scenario) yields
  before computing so loading text can paint, and is cached per server/scenario/stat.
- Charts are hand-written SVG (no chart library): colour tokens for marks and text,
  hairline gridlines, a hover/keyboard crosshair + tooltip. Long time axes scroll
  sideways with `useDragScroll` instead of squeezing labels.
- Toggle groups are `src/ui/Segmented.tsx` (a `<fieldset>` of `aria-pressed` buttons); every `<button>` has an
  explicit `type`.
- **Detail sheets are `src/Sheet.tsx`** (vaul's drawer: drag down to close on phones), never a hand-made overlay; nothing may set
  the sheet's `transform` (vaul's drag does).
  Keep it rendered with `open` false while it closes (`onClosed` once it has slid away), or it vanishes instead of
  sliding. Its animation must never share the main thread with heavy work: the Timeline's lanes and axis are `memo`ised
  with stable (`useCallback`) props so opening/closing a sheet doesn't re-render thousands of bars, and the sheet's
  rankings start after `SHEET_ANIMATION_MS`. Class names are built with
  `clsx`.
- **Dropdowns are `src/Dropdown.tsx`** (Radix Select underneath), never a native `<select>` (phones' native pickers ignore `<option>` styling,
  and it looks the same everywhere): options `{ value, label, icon?, group?, note?, badge?, italic?, disabled? }` (icon: an image URL before the label, in the list and on the button; pill: `{ color, ink }`, the label as a pill in that colour) (disabled: greyed, can't be
  chosen, skipped by the keyboard), groups under headings, hover +
  keyboard-active highlight; opening scrolls the list (not the page) to the selected option, centred. Radix gives the
  ARIA combobox, keyboard (↑/↓, Home/End, Enter/Space, Esc, type-ahead) and touch handling; the list is in a portal and
  modal (the page doesn't scroll behind it). Scenario pickers are `src/ScenarioPicker.tsx` on top of it: the real scenarios,
  then the `COMBINED` ones in an "Averaged" group; display names via `scenarioName()` (short names per the setting; never show a raw key), each a pill in its cover's colour (`color`, text by `ink()`) as on the scenario pages. Scenarios not launched on the
  selected server (`isReleased()`, `src/scenarioRelease.ts`, from `data/scenarios.json`) are in italics with a
  "Not released yet" note, on the button too; the one running now on it (`isCurrent()`) has a "Current" badge
  (none on JP while its newest scenario isn't one the tier list ranks). Every scenario in `data/scenarios.json` is
  listed, newest first; those the tier list doesn't rank yet are disabled with "Not in the tier list yet".
- `deploy.yml` — on push to main, daily, and manually: install → `pnpm lint` → `pnpm typecheck` → `update-cards` →
  `scrape-gametora` → `update-jp` → `update-global` (both not committed) → `setup-ml` + `predict-gl` → `fetch-pull-guide` → `pnpm test` → `pnpm test:e2e` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- `news.yml` — manual for now (the daily 23:43 UTC schedule and the redeploy are commented out): `news:latest` for
  Global, then `--server jp`; if a banner, event or scenario post came in on either, `update-cards` + `scrape-gametora`,
  then `news:ai` per server that updated (OpenRouter, with the `OPENROUTER_API_KEY` repo secret; skipped when it isn't
  set, never fails the run), then `update-jp` and `update-global`; commits `data/` with both summaries as the commit
  message and job summary, and starts `deploy.yml` (a GITHUB_TOKEN push doesn't trigger it). Needs
  `contents: write`, `actions: write`.
- Pages source must be set to "GitHub Actions".
