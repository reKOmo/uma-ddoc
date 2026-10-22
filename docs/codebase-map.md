# Codebase map

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
                     en.ts (Global), ja.ts + ja-banners.ts + ja-races.ts (JP), index.ts (lexicon(server))
  lib/global.ts      pure: applyNews() (news posts + JP banners → Global banners/releases), data/ reader/writer
  lib/dates.ts       pure: keepEventFills() / keepBannerFills() (a rebuild from the news keeps predict-gl's fills)
  lib/event-blocks.ts  pure: eventBlocks() (a post cut at its header art into blocks: intro + h2–h4 sections)
  lib/event-rewards.ts pure: cardsIn() (cards by lookup), itemsIn(), titlesIn(), missionsIn()
  lib/event-races.ts pure: blockRaces() (an event's races from its race conditions), raceConditions() (one line)
  lib/events.ts      pure: postEvents() (a post → its events, with doubts), eventFragments(), buildEvents() (mission
                     sets as bars, merged over posts, answers applied), cmPhases() (a cup's schedule), cmItems()
                     (Champions Meeting range from the hand table), data/ readers/writers (events, answers)
  lib/event-questions.ts  pure: what a model is asked about an event (askedFields(), question(): prompt + examples
                     + JSON schema), staleFields() / mergeAnswer() (per-field versions), applyAnswer() (checks + rules first)
  lib/ai.ts          the model client: Ollama (native /api/chat) or OpenRouter (OpenAI-style), aiConfig(), ask()
  ai-events.ts       `pnpm news:ai` (ask about doubted fields, store answers; --compare to test a model)
  list-events.ts     `pnpm news:events` (the events the news makes, printed, nothing written)
  list-merges.ts     `pnpm news:merges` (which posts joined which event, and how; nothing written)
  lib/colors.ts      main colour (PNGs decoded by pngjs) of an image, for scenario covers
  lib/scenarios.ts   Career scenarios (data/scenarios.json): SCENARIO_NAMES (slug → key + JP/Global short names, by hand),
                     mergeGametora() (JP side), applyScenarioNews() (Global side, from the news)
  fetch-pull-guide.ts  Luh's Support Card Encyclopedia (Google Sheet) → generated/pull_guide.json
  lib/pull-guide.ts  pure: the sheet's HTML view → entries (dates, Pull?, notes) → advice per banner (findBanner())
  fetch-news-latest.ts  new/edited posts → data/news/<server>/posts.json + summary.md (incremental, news.yml)
  fetch-news-all.ts  the whole archive → data/news/<server>/posts.json (one-off, resumable)
  fetch-news-umapyoi.ts  older posts from umapyoi.net's mirror → data/news/<server>/posts.json (one-off, resumable)
  categorize-news.ts `pnpm news:categories`
  gold-review.ts     `pnpm gold:review`: a local Vite page (gold-review/) to label every Global post by hand → gold.json
  news-features.ts   `pnpm news:features`: each Global post's features for ml/categorize.py → generated/news_features.json
  lib/categories.ts  data/news/gl/categories.json (ml/categorize.py's labels, which buildEvents() reads over the rules):
                     readCategories(), refreshCategories() (features + the classifiers, when ml/.venv exists)
  lib/gold.ts        the gold set (data/news/gl/gold.json): units() (a post cut for labelling), ruleLabel() (today's rules'
                     label, the pre-fill), jpCategories() (the same-id JP post's), reader/writer
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
    data.ts          loadTimeline(server) → { entries, others() } (others: marks + counterparts, from the other
                     server's files, loaded after the calendar is drawn), loadEntries(server) (entries alone: the card page)
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
    useCenterOn.ts, useCompactRows.ts, useRenderWindow.ts, useTimelineFilters.ts  the Timeline page's centring
                     (linked entry / today, zoom), compact mode's measuring, the time range whose bars are drawn (1.5
                     screens each side; the rest of history isn't rendered), and its hidden / order / verdict filtering
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
                     categorize.py (Global's posts and their units classified, learned from the gold set →
                     data/news/gl/categories.json),
                     (see ml/README.md)
data/                ours, committed (hand-kept records, the stored news, and what update-jp / update-global build from it; generated/ is rebuilt every deploy):
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
