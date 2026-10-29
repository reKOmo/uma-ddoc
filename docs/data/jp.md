# JP: cards, banners, events from the JP news

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
  banner GameTora has gets `news_url`, `news_image` (official art, shown over GameTora's; dates stay
  GameTora's: all 574 post/GameTora pairs agree on start, end and type, so the dates a post gives are status `news`, the
  rest `gametora`) and the R cards the post lists,
  as `from_news` featured items (GameTora leaves R cards out). Banners GameTora lacks (select-pickup supports, Twinkle
  Collection 30xxx, paid 50xxx) are made from the post (`from_news: true`, featured resolved: supports by cards.json
  title.jp + name.jp, trainees by title + name on the items of data/jp_banners.json and data/global_banners.json, and
  a trainee no banner has shown yet (a debut) by GameTora's trainee list (`generated/raw/gametora_trainees.json`, from
  `scrape-gametora`; until GameTora lists it, by name only, id null, and listed in update-jp's summary; once stored it
  resolves from our banners without the list); a card still pending, see above, stays id null). `paid: true` per banner (gacha id ≥ 50000; a post
  can mix both). Re-runs (decision 6): the original keeps its dates and gets `rerun: { id, start, end }`; the re-run is
  GameTora's banner with the same featured starting then (`rerunOf`; it gets its original's post and
  official art), else ours with id `<id>-rerun` (the only string
  ids). JP scouts: only the first featured list after a banner's art counts, labelled windows in one period section,
  a `再開催期間` section re-holds every scout of its post. Every news-confirmed banner gets `name`, the scout's name from its post (its heading in
  group-select posts, else the next 「…ガチャ…」 in the post that fits its type: ★ / 育成 / プリティーダービー for trainees,
  SSR / サポートカード for cards; a post naming only its whole scout gives every banner that name), and one without a
  featured list (JP's paid scouts: guaranteed ★3/SSR, step-up, start dash list only which releases can appear) gets
  `note`, the post's line about what it draws from. The Timeline labels a bar with no featured item by its `name`
  (every JP banner has a label) and shows `name` under the sheet's art, `note` in place of the empty featured list. `regularBanners()` (and ml/data.py's `jp_banners()`) is what
  Global's news pairing, `globalProgress` and `ml/` read: no paid banners, no string ids, GameTora's featured (no
  `from_news` items), so their output didn't change. The Timeline shows paid badges and links re-runs both ways.
- **JP events** (`buildEvents(posts, { lang: ja, categories })` → `data/jp_events.json`, `pnpm update-jp`): Global's
  model, JP wording; each post's category and an event post's parts come from JP's gold set and classifiers
  (`data/news/jp/categories.json`, [classifier](classifier.md)), the cutting below only where no label is. Celebration posts are cut at part art (`header_…`, `banner_…`, `header_CP_/EV_…`, bare `<img>` too; the
  intro is its own block; scout links and paid gachas, card-copy summaries and feature news aren't parts). Periods are
  JST; gifts run to their 対象のトレーナー deadline; Champions Meetings have Global's phases (the headings never changed
  since 2022), League of Heroes its own (team formation, main stage, extra stage registration / matching / votes /
  race). Races from 対象レース (with 昼/夕/夜; a Legend Race's 天候・バ場 list splits it by opponent, named as Global's
  cards name them; race names Global's from the hand table in `news-lang/ja-races.ts`: the race test lists a missing
  one). Items: Global's canonical name where Global has the item (Carats, Monies, Support Points, shards, tickets, Toughness 30,
  Alarm Clock, hint books, "N Anniversary SSR Voucher": `aliases` + `showItem` in `news-lang/ja.ts`) with
  the Japanese one in `local`, else the Japanese name; paid packs, costs and exchanges excluded. Cards by title.jp +
  name.jp; campaign copies per part from the post's summary (「…」で最大2枚). A sale part doesn't stretch its
  celebration (`notSpanning`: a pack stays on sale a year or more). Before mid-2022, where the news archive is thin,
  GameTora's JP story events (with their SSR), Champions Meetings (from round 1: GameTora has no league selection;
  phases round_1 → final_race) and Legend Races fill in (`source: 'gametora'`, ids `gt-story-<id>` / `gt-cm-<id>` /
  `gt-lr-…`, no news_url or art; `scripts/lib/gametora-events.ts`, from `generated/raw/gametora_events.json`; news
  events always win; without the raw file the fills in data/ are kept). Checked
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
  <start>". `fetch-news-latest --server jp` categorizes with the JP lexicon (summary + `update`). `news:run`: Global's
  news, then JP's; cards + GameTora if either updated; the model for each server that updated;
  `update-jp`, then `update-global` (Global's news pairs with JP's banners by id); one commit whose subject sums both
  servers. `deploy.yml` runs `update-jp` before `update-global` (not committed).
