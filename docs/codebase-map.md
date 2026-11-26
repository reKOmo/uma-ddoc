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
scripts/             commands (`pnpm …`, docs/commands.md); their code in lib/ (a command imports libs, never another
                     command; each runs its main behind isMain(import.meta.url))
  clone-upstream.ts  shallow clone (or fetch + reset) of upstream main into upstream/
  update-cards.ts    download upstream's card data into generated/raw/upstream/ (lib/cards/files.ts)
  build-cards.ts     raw inputs → generated/cards.json + card_stats/<gl|jp>_card_stats.json (lib/cards/files.ts)
  build-schemas.ts   schemas/*.json from shared/schemas/ (z.toJSONSchema)
  convert-mdb.ts     a server's master.mdb → data/<gl|jp>_card_stats.json (its card list, instead of upstream's)
  scrape-gametora.ts  GameTora: support card list + JP event history (generated/raw/), JP scenarios (data/)
  update-global.ts   data/news/ → Global's banners + card releases in data/, appends to data/news/gl/summary.md
  update-jp.ts       data/news/jp/ → new cards in data/jp_cards.json (+ build-cards), data/jp_banners.json +
                     data/jp_events.json, appends to data/news/jp/summary.md
  ai-events.ts       `pnpm news:ai` (ask about doubted fields, store answers; --compare to test a model)
  list-events.ts     `pnpm news:events` (the events the news makes, printed, nothing written)
  list-merges.ts     `pnpm news:merges` (which posts joined which event, and how; nothing written)
  fetch-pull-guide.ts  Luh's Support Card Encyclopedia (Google Sheet) → generated/pull_guide.json
  fetch-umatl.ts     UmaTL's tables → generated/raw/umatl_*.json → generated/translations.json
  fetch-news-latest.ts  new/edited posts → data/news/<server>/posts.json + summary.md (incremental, news:run)
  fetch-news-all.ts  the whole archive → data/news/<server>/posts.json (one-off, resumable)
  fetch-news-umapyoi.ts  older posts from umapyoi.net's mirror → data/news/<server>/posts.json (one-off, resumable)
  categorize-news.ts `pnpm news:categories`
  gold-review.ts     `pnpm gold:review`: a local Vite page (gold-review/) to label every Global post by hand → gold.json
  news-features.ts   `pnpm news:features`: each Global post's features for ml/categorize.py → generated/news_features.json
                     (lib/news/features.ts)
  lib/paths.ts       ROOT, GENERATED_DIR, DATA_DIR, CARDS_JSON, newsDir(server), dataFile(server, kind),
                     serverSuffix(), summaryFile() / appendSummary(), isMain() (every script's paths)
  lib/json.ts        readJson(path, fallback?) (every script's JSON reads; a fallback for a file not there yet);
                     jsonLines() / jsonEntries() / jsonEnvelope(): the data files' one-record-per-line writers;
                     sameJson(), changedSince()
  lib/order.ts       newestEventsFirst / newestBannersFirst: the data files' order
  lib/schemas.ts     jsonSchema(), schemaText() (build-schemas, test/schemas.test.ts)
  lib/http.ts        sleep(), paced(): one request at a time with a pause between (every fetching script's pacing);
                     getOk() / getJson() / getText(), SCRAPER_HEADERS
  lib/sources.ts     generated/sources.json (file → where its data came from): readSources(), writeSources()
  lib/upstream.ts    everything that knows about the upstream repo (REPO, DATA_FILES,
                     UPSTREAM_DIR, UPSTREAM_RAW, download)
  lib/fills.ts       pure: keepEventFills() / keepBannerFills() (a rebuild from the news keeps predict-gl's fills)
  lib/colors.ts      main colour (PNGs decoded by pngjs) of an image, for scenario covers
  lib/scenarios.ts   Career scenarios (data/scenarios.json): SCENARIO_NAMES (slug → key + JP/Global short names, by hand),
                     mergeGametora() (JP side), applyScenarioNews() (Global side, from the news)
  lib/umatl.ts       pure: buildTranslations() (UmaTL + Global's names joined with our JP data), cleanText(), textKey()
  lib/news/          the official news
    api.ts           the news API client per server (gl / jp; gentle pacing), posts.json reader/writer, --server
    text.ts          pure: HTML → lines/sections, period dates (parsePeriod, parsePeriodJp, nearestYear), MINUTE / HOUR /
                     DAY / JST, minuteText(), jstDay(), isoOfUnix(), norm(), bareTitle(), cardKey(); shared by the news parsers
    features.ts      writeFeatures(): each post's features for ml/categorize.py (news:features, refreshCategories())
    lang/            the news' wording per language, read by every parser (`lang`, English by default):
                     en.ts (Global), jp.ts + jp-banners.ts + jp-races.ts (JP), index.ts (lexicon(server))
    categorize.ts    pure: categorize(post) → banner / event (+ kind) / other, phase, name
    categories.ts    data/news/gl/categories.json (ml/categorize.py's labels, which buildEvents() reads over the rules):
                     readCategories(), refreshCategories() (features + the classifiers, when ml/.venv exists)
    gold.ts          the gold set (data/news/gl/gold.json): units() (a post cut for labelling), ruleLabel() (today's rules'
                     label, the pre-fill), jpCategories() (the same-id JP post's), reader/writer
    scenario-posts.ts  pure: scenarioPost() (a post's scenario mentions, for scenarios.ts)
  lib/banners/       scout banners from the news
    posts.ts         pure: bannerPost(post) → a scout post's banners (gacha id, type, period, art, featured list)
    common.ts        what both servers' banners share: BANNER_KINDS, ScoutPost types, pickMain(), endOfMinute(),
                     withoutNews(), newestPerBanner(), writeBannerFile()
    global.ts        pure: applyNews() (news posts + JP banners → Global banners/releases), data/ reader/writer
    jp.ts            pure: applyJpNews() (JP news → data/jp_banners.json), regularBanners() (what Global and ml/ read),
                     reader / writer
  lib/cards/         support cards
    files.ts         ensureCards() / updateCards() (upstream's data), buildCardFiles() (→ cards.json + card_stats)
    build.ts         pure: buildCards() (the merge, + the round-trip check against upstream's lists)
    mdb.ts           convertMdb() (upstream's db-convert.py ported), cardRows() (ours, else upstream's), the file's read/write
    jp.ts            pure: newsCards() (every support card the JP news shows, at its first appearance),
                     applyNewsCards() (→ the history + pending, GameTora augmenting; GameTora-only cards listed),
                     data/jp_cards.json + jp_cards_pending.json readers/writers, updateJpCards()
    pull-guide.ts    pure: the sheet's HTML view → entries (dates, Pull?, notes) → advice per banner (findBanner())
  lib/events/        in-game events from the news (docs/data/events.md)
    build.ts         pure: buildEvents() (fragments → answers applied → merged → output), cmItems() (Champions
                     Meeting range from the hand table)
    fragments.ts     pure: postEvents() (a post → its events: singleEvent() or a celebration's), missionBars(),
                     eventFragments()
    celebration.ts   pure: a celebration post cut into sub-events, by the classified units
                     (groupsFromUnits()) or the rules (groupsFromRules(), splitOpening())
    blocks.ts        pure: eventBlocks() (a post cut at its header art into blocks: intro + h2–h4 sections)
    dates.ts         pure: a block's period (headingPeriod(), openingPeriod()), cmPhases() (a cup's schedule)
    names.ts         pure: a sub-event's name and kind (subEventName(), subEventKind())
    rewards.ts       pure: cardsIn() (cards by lookup), itemsIn(), titlesIn(), missionsIn()
    races.ts         pure: blockRaces() (an event's races from its race conditions), raceConditions() (one line)
    free-scouts.ts   pure: a free scout campaign's windows (scoutWindows(), counted()), its banners (bannerOf()),
                     each banner's free pulls (withFreePulls())
    doubts.ts        pure: the Fragment type, withDoubts(), rewards(), aiKey()
    merge.ts         pure: posts about the same event merged (mergePosts(), joinUndated(), resolveParents(),
                     spanParts())
    gametora.ts      GameTora's JP story events / Champions Meetings / Legend Races → fills in jp_events.json
    files.ts         data/ readers/writers (events, answers, Champions Meeting table)
    context.ts       newsContext(server): a server's lexicon, posts and events as the news tools see them
                     (news:events, news:merges, news:ai)
  lib/ai/            a model for the event fields the rules doubt
    client.ts        the model client: Ollama (native /api/chat) or OpenRouter (OpenAI-style), aiConfig(), ask()
    questions.ts     pure: what a model is asked about an event (askedFields(), question(): prompt + examples
                     + JSON schema), staleFields() / mergeAnswer() (per-field versions)
    questions-en.ts / questions-jp.ts  each language's question set (system prompt, fields, made-up examples);
                     shared parts in questions-spec.ts
    answers.ts       pure: applyAnswer() (a model's answer checked, then applied rules first)
src/                 (components' styles: `X.module.css` beside each, `camelCaseOnly` names; global ones below)
  main.tsx           mounts App (StrictMode); imports styles/global.css first, then App.css
  styles/global.css  what is global on purpose: colour tokens (light, dark; --radius-control), resets, tier colours
                     (.tier-0…7), the tones: an element's colour (--tone) from its `data-tone` (a Timeline entry's
                     `tone`, a chip's), and three utility classes: .visually-hidden, .phone-visually-hidden,
                     .section-label (the small uppercase muted heading)
  App.css            .page (every page's box) and the desktop h1 size
  App.tsx            shell: wouter routes (src/routes.ts), top bar (title or back button + server switch), tab bar
                     (current tab aria-current="page"), shared server + scenario state; <main data-scroll-root>
  routes.ts          every address the app links to, built here (cardUrl, scenarioUrl, timelineUrl, TAB_URLS): no page
                     writes `#/…` by hand; wouter's patterns; `useHashLocation`: one location for the whole app,
                     changed only by `hashchange` (the Timeline's replaceState of the open sheet must not re-route)
  hooks/
    useAsync.ts      useAsync(load, deps) → { data, error, pending }: loads, ignoring a superseded run (pages' data)
    useRanking.ts    useRanking(compute, deps, delay): a ranking computed after a yield, stopped when superseded
                     (`show` publishes partial results): the Cards tab, the card page, the sheet's ranks
    useDragScroll.ts mouse drag-to-pan (marks the scroller data-dragging)
    useMediaQuery.ts DESKTOP: the desktop layout's breakpoint
    useRowsHeight.ts an unfolded list's height for its first six rows (Available on, Passed by on phones)
  state/             what the app remembers (zustand stores) and the settings
    rawStorage.ts    the persisted stores' factory: persisted() / persistedValue() / stringSetStore() / booleanStore()
                     on a localStorage adapter; each store keeps its own stored format (never zustand's
                     { state, version } wrapper), every access guarded (private windows)
    settingsStore.ts user settings (zustand + persist; getSetting / setSetting / subscribe for non-React readers):
                     timeZone 'utc' | 'local', scenarioNames 'global' | 'jp', jpNewsLanguage 'jp' | 'en',
                     fanTlGlobal / jpNames 'jp' | 'official' | 'all'
    settings.ts      useSettings() (the settings store's hook); App calls it so plain readers like scenarioName()
                     refresh on change
    hiddenScenarios.ts  the scenarios hidden from the card page's "Tier by scenario" table (zustand store, `{ hidden }`)
    tierListFilters.ts  the Cards tab's stat / LB filter / search / card size (zustand store): getFilters(),
                     saveFilters(), DEFAULTS, SIZES, isDefault()
    theme.ts         the theme on <html> (data-theme) and the browser bar's colour
  ui/                the shared components (each with its module): LinkButton, SeeMore, FoldToggle, RailList (a timeline list folding on phones: Available on, Passed by), FanTl (the "Translation from UmaTL" mark), Pill (tag / kind
                     / tinted / status / verdict / label / count; size sm | lg; a status with only a tone is a badge; pillClass(): its
                     classes for an element that isn't a <span>, the Timeline search's chips),
                     StatusBadge (a status Pill with its label), TierChip, Status, Segmented, Section, SearchInput, ToolbarButton,
                     CardRow (icon + name + title; badge on the icon, meta under the title, `large`), LinkButton (a
                     link, or a button with onClick; `filled`); pages use them where they look identical, else keep
                     their own markup
    BackToTop.tsx    floating "back to top" button (the tier list, the card page), watches the [data-scroll-root]
                     scroll container
    Dropdown.tsx     the app's dropdown on Radix Select (every dropdown uses it; keeps a global `dropdown-button`
                     class on its button for card.css; `hideLabel`: the label for screen readers only)
    FilterSheet.tsx  the app's filter (Cards tab, Timeline): FilterButton (a ToolbarButton with the count),
                     FilterSheet (on Sheet.tsx: title, note + a reset), FilterGroup (a section: heading, action, note),
                     FilterSection (a FilterGroup of toggle chips: ticked a tinted Pill in its data-tone, All / None), ResetButton;
                     changes apply at once
    Sheet.tsx        the app's detail sheet on vaul's drawer: phones, a bottom sheet dragged down to close (down arrow);
                     desktop (hooks/useMediaQuery.ts' DESKTOP), a centred near-square dialog, fading, × button, no drag
                     (`handleOnly`); focus, Escape, click outside, scroll lock; its heading is a <SheetTitle>
    ScenarioPicker.tsx  scenario dropdown on top of it (italic + note when unreleased)
    ScenarioPill.tsx  a scenario's name as a pill in its cover's colour (the card page's tile + tier table)
    TabHighlight.tsx the open tab's pill, sliding from tab to tab
  lib/               the app's data: loaders and pure helpers
    servers.ts       SERVERS: gl/jp ↔ banner file names; SERVER_ORDER (JP first, the Scenarios pages)
    tiers.ts         toTiers(), cardRanks(), TIER_NAMES, LIMIT_BREAKS, STAT_OF_TYPE
    dates.ts         dateFormats(timeZone, clock) + useDateFormats() (Settings' timezone + clock, memoised),
                     dateRange(), daysUntil(), DAY, dayStart(day) / dayOf(ms) (YYYY-MM-DD ↔ ms, UTC),
                     localTimeZone()
    scenarioStrip.ts pure: scenario segments (launch → next launch, cover colour + text ink) for the calendar's strip
                     and RankChart's rule
    gametora.ts      GameTora's URLs built from ids (no data file stores them): cardPage(slug), cardArt(id),
                     cardIcon(id, cards) (upstream's icon from cards.json, else GameTora's), traineeIcon(charId, id),
                     bannerArt(id, 'global' | 'jp'), withArt(file, art, cards) (a banner file's art + item icons, filled
                     by timeline/data.ts when it loads one; `officialArt`: the news' art, over GameTora's; ArtBanner…)
    rankHistory.ts   pure: a card's position at each release date (marks predicted ones)
    cardOrigins.ts   pure: cardOrigins(cardId, entries, server) (a card's banners and events, as Timeline entries,
                     oldest first), originKinds()
    memo.ts          memoAsync(): one promise per key (the Timeline's file loaders)
    optional.ts      optionalJson(glob): a memoised loader for a generated/ file that may be missing (null)
    predictions.ts   optional loader for generated/predicted_gl_releases.json
    translations.ts  optional loader for generated/translations.json; languageOf() / useLanguage() (the Names settings)
    pullGuide.ts     optional loader for generated/pull_guide.json (the card page's NextBanner tile + Banners), upcomingBanner(),
                     currentAdvice(), sheetLink()
    search.ts        normalizeSearch(): text as the Cards tab and Timeline searches compare it (no case, accents, punctuation)
    umapyoi.ts       umapyoiUrl(news_url): umapyoi.net's copy of an official post (JP's in Japanese)
    statIcons.ts     STAT_ICONS: the game's stat type icons by stat key (src/icons/stats/<stat>.png, committed: 70×70,
                     from upstream's src/icons/utx_ico_obtain_00–05), bundled; the Cards tab's Stat picker shows them
    vividColor.ts    a colour from art (a scenario's cover) made vivid for display
  pages/SettingsPage.tsx               the Settings tab
  pages/TierListPage.tsx               the Cards tab
  pages/TimelinePage.tsx               the Timeline tab: loads a server's timeline, draws its groups and marks, opens
                                       the sheet; no server-specific code (src/timeline/)
  pages/CardPage.tsx                   one card (the entry App imports): art, tags, GameTora link, its parts:
  pages/card/        CardArt (the art in its rarity's in-game frame colours), Summary (the tiles beside the art: rank,
                     tier outlook, release), NextBanner (the next
                     banner on its art + the guide's pull advice), Banners (the card's banners/events), OriginPills (OriginPill, KindPill), ScenarioTierTable (heatmap),
                     RankOverTime (RankHistorySection: RankChart + PassedBy), RankChart (SVG step chart of rank over
                     time: the card's whole life at the panel's width, zoom scrolls; the line in its tier's colour,
                     scenarios as a rule under the dates); hooks.ts (usePredictions, useOrigins,
                     useScenarioRankings, useUpcomingRanking, useRankHistory), advice.ts (useUpcomingAdvice: the
                     guide + next banner, for NextBanner and Banners' pull pills), shared.ts (nameOf, titleOf…)
  pages/card.css     global on purpose: the Rank over time picker's size (`.history-controls .dropdown-button`)
  pages/ScenariosPage.tsx              the Scenarios tab (list)
  pages/ScenarioPage.tsx               one scenario
  timeline/          the Timeline, the same for both servers:
    data.ts          loadTimeline(server) → { entries, others() } (others: marks + counterparts, from the other
                     server's files, loaded after the calendar is drawn), loadEntries(server, language) (entries alone:
                     the card page; the last ones built, reused for a minute) (MARKS: per-server overlays + toolbar
                     buttons, JP's "Global now"); banner / event file loaders (real + optional predicted, cached),
                     shared with the card page
    entries.ts       pure: bannerEntries(), eventEntries() → entries (`Entry`: one shape, documented there),
                     bannerStatus()
    layout.ts        pure: buildTimeline(entries) (months, days, `at(ms)` → position), laneGroups() (LANE_GROUPS:
                     the one order of the Timeline and its filter: support cards, trainees, then EVENT_GROUPS; rows
                     packed, parts nested under their parent; generic: rows keep the entries given), partCount()
    events.ts        pure: EVENT_GROUPS, items with currencies first (itemList()), withPredicted()
    format.ts        an entry's labels: kindName(), barLabel(), entryTitle(), labelIsFan(), courseName(), daysOf()
    useRankings.ts   MLB ranks of a sheet's cards (server's own tier list, else looking ahead)
    useViewport.ts   the scroller's visible range: one scroll / resize listener, published once per frame (calls
                     useCenterOn); the three hooks below take it, so they can't run before the centring
    useCenterOn.ts, useCompactRows.ts, useRenderWindow.ts, useStickyBars.ts, useTimelineFilters.ts  the Timeline page's
                     centring (linked entry / the end of today, zoom), compact mode's measuring, the time range whose bars and
                     day labels are drawn (0.75 screens each side; the rest of history isn't rendered), which bars' label /
                     fold button are sticky (only those crossing the screen's edge), and its hidden / order / verdict filtering
    TimelineSheet.tsx  the one sheet for every entry, in sections (Header, Provenance, Relations, Featured,
                     Rewards, Schedule, Titles, Parts, RankNote, Links)
    TimelineAxis.tsx scenario strip + months + days; CalendarLines (scenario starts, today, marks)
    Lanes.tsx        LaneGroup (foldable label + rows), one Bar for banners and events (chip when short, +N parts;
                     its button data-testid="bar"); an entry's colour: data-tone
    collapsed.ts     which Timeline groups are folded (zustand store): getCollapsed() / saveCollapsed()
    order.ts         the lane groups' order (the filter's Order tab; zustand store): getOrder() / saveOrder(),
                     orderedGroups(), reorderGroups()
    GroupOrder.tsx   the Order tab's draggable list (dnd-kit, by handles; rows `data-vaul-no-drag`: they don't drag
                     the sheet)
    hidden.ts        banner sections + event kinds the filter hides (zustand store): getHidden() / saveHidden()
    pulls.ts         the pull-advice verdicts the filter picks (zustand store; none: every banner): getPulls() / savePulls()
    sets.ts          toggled() / withAll(): a set with a key flipped / every key added or removed
    TimelineFilter.tsx  the toolbar's filter button + sheet (toggles per banner section / event kind / pull verdict)
    search.ts        pure: the search's suggestions (searchIndex), chip matching, its results (matches + parents + parts),
                     jumpTarget()
    TimelineSearch.tsx  the toolbar's search button + field (downshift combobox, chips, match-sorter suggestions)
    searchOverride.ts  whether a search shows matches the filter hides (zustand store, default on)
    compact.ts       compact mode on/off (default on; zustand store): getCompact() / saveCompact()
    globalProgress.ts pure: where Global is in JP's history (window between banners + linear estimate)
    translate.ts     pure: translateEntries() (Japanese names → English by the language; fan names, originals)
  i18n/index.ts      i18next setup; statName/serverName/scenarioName/lbName, formatDate, formatDay,
                     formatDayRange, formatDateRange
  i18n/en.json       every UI string (English)
shared/schemas/      zod schemas + their types for every data file (card, banner, event, scenario, pullGuide, news,
                     predictions, sources, gametora, common); files.ts: each data file's schema, the JSON Schemas
shared/scenarioRelease.ts  data/scenarios.json's launches: SCENARIOS, scenarioByKey, isReleased / isCurrent(key, server)
                     (the app and tierlist/'s getCurrentScenario / scenarioAt both read them)
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
