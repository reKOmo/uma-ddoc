# JP news pipeline: plan

Goal: the same pipeline we have for Global's English news (fetch → categorize → banners/events → model for doubts →
Timeline), for JP, reading the **Japanese originals**: the official site for what it still serves, umapyoi.net's
mirror of the Japanese posts for the rest. Not umapyoi's machine-translated English.

Read CLAUDE.md first ("Official news", "Post categories", "Events", "A model for what the rules doubt"): the EN
pipeline described there is the template.

## What we know (checked 2026-10-11)

**Official JP site** (`https://umamusume.jp/news/`, a Nuxt app). It uses the same endpoints as EN, but called
differently:

| | EN (umamusume.com) | JP (umamusume.jp) |
|---|---|---|
| index | `POST /api/ajax/pr_info_index?format=json` `{announce_label, limit, offset}` | `GET /api/ajax/pr_info_index?format=json&announce_label=0&per_page=10&page=1` (1-based) |
| index reply | `information_list`, `show_more_button` | `information_list`, `total_page_count` (32 on 2026-10-11, so ~320 posts) |
| detail | `POST pr_info_detail` `{announce_id}` | `GET pr_info_detail?format=json&announce_id=<id>` |
| detail reply | `detail`, `next_announce_id` (older post) | `detail`, `prev_announce_id` (next **lower id** served; by id, not post date), `next_announce_id` (next higher, 0 for the newest) |
| times | UTC strings | **JST** strings: post 3497 `post_at: "2026-10-09 15:00:00"` = umapyoi's unix 1791525600 = 06:00 UTC |
| post page | `/news/<id>/` | `/news/detail/?id=<id>` (200, client-rendered shell) |

- A POST to the JP endpoint returns the site's HTML, not JSON. The page code also sends optional
  `device` (Steam news) and `transition_id` params; we don't need them.
- `detail` fields: `announce_id, title, message (HTML), from_date, to_date, post_at, update_at ("None" when never
  edited), announce_label, image_big, og_image, post_platform_flag`.
- `update_at` is null when never edited (index and detail). The EN "edited?" check compares `update_at`, so that still
  works.
- The index lists every post the site serves (317, phase 1): all from 2026-07-23 on, plus 188 older ones kept
  (back to April 2023, a few from 2021; known issues 155 sits among the newest), so index order isn't post order. The prev chain finds nothing
  more. Index items have `message: ""` and `image` (thumbnail).

**umapyoi.net JP mirror.** It is `/api/v1/news`: no language segment; `/api/v1/jp/news` and `/ja/news` are 404.
- `GET https://umapyoi.net/api/v1/news` lists 2,663 ids (100 … 3497, so back to the 2021 launch).
- `GET /api/v1/news/<id>` returns `{ announce_id, announce_label, article_image, id, image, label_color,
  label_name_en, message, message_english, post_at (unix, string), post_platform_flag, row_number, title,
  title_english, update_at (unix) }`.
- `message` / `title` are the Japanese originals. Drop `message_english` / `title_english` (machine translations),
  names stay untranslated (decision 1).
- `article_image` is the post's header art on older posts only (null on recent ones; `image` is the thumbnail, the
  same file under `Thumbnail/` instead of `Header/`), e.g. `https://prd-info-umamusume.akamaized.net/announce/847/Header/gacha_banner_30102.png`.
  `gacha_banner_<id>` is the gacha id, the same as GameTora's JP banners.
- **Ids are shared with the official site**: 3497 is the same post on both.

## Decisions (taken 2026-10-11)

1. **Event names on the JP Timeline: untranslated.** Keep the Japanese names as the posts give them (`name`), and
   show them as they are. No machine translations (umapyoi's `title_english`) and no model translation for now.
2. **JP banners: move new ones to the JP news.** The JP history stays GameTora's. New JP banners come from the JP
   news, like Global's: seeded history + news-made entries carrying `news_url`, the news winning for the banners it
   announces. The JP news has the exact times, art and the featured list. GameTora fills in what a post lacks
   (rates, icons) and is a check. This means JP banners become committed data like Global's, e.g.
   `data/jp_banners.json`, seeded once from GameTora's history, then `bannerPost()` (with the JP lexicon) +
   an `applyNews`-like merge. Today `generated/jp_banners.json` is rebuilt from GameTora every deploy. The Timeline,
   `ml/`, `update-global` (which pairs Global news banners with JP's by gacha id) and the card page read JP banners,
   so move each reader to the new file and check none breaks.
3. **Storage: move the EN news to `data/news/gl/`** (`posts.json`, `summary.md`, `ai_answers.json`), and JP goes in
   `data/news/jp/`. Update `scripts/lib/paths.js` (a per-server news dir), the scripts, `biome.json`'s excludes,
   `news.yml` (`git add`, the summary path in the commit message), CLAUDE.md and the tests that read the files. Use
   `git mv` so history follows.

## Plan

### Phase 1: fetch and store (no parsing)

- **Move EN first** to `data/news/gl/` (decision 3) as its own commit-sized step; `pnpm test` and `update-global`
  must give identical `data/global_events.json` / `global_banners.json` before and after.
- **Storage**: `data/news/jp/posts.json` (same format: one post per line, newest first, each post exactly as the
  official detail sends it, + `prev_announce_id` / `next_announce_id`, `fetched_at`, `source`), `data/news/jp/summary.md`.
  Exclude it from Biome like the EN file (`biome.json`). Add `NEWS_JP_DIR` to `scripts/lib/paths.js`.
- **`scripts/lib/news-api.js` → per-server.** Don't copy it. Give it a server config:
  `{ site, method: 'POST'|'GET', page(offset|page), headers (Accept-Language ja), postsFile, newsUrl(id), timeZone }`.
  `indexPage()` returns `{ items, more }` on both (JP: `more = page < total_page_count`). `fetchPost()` keeps
  `older_announce_id` under one name for both (EN `next_announce_id`, JP `prev_announce_id`); keep the EN file's
  field as it is.
  `news-text.js`'s `newsUrl` / `SITE` / `apiDate` need the server too: `apiDate(s, 'jp')` parses as `+09:00`.
- **Scripts take `--server jp`** (default gl): `fetch-news-latest.js` (same stop-at-known-page logic),
  `fetch-news-all.js` (JP: page through all `total_page_count` index pages, then fetch the details of ids we don't
  have, or walk `prev_announce_id`; resumable, 1–2 s pauses, one request at a time), `fetch-news-umapyoi.js` (JP:
  `/api/v1/news`; to the official shape: unix → **JST** `"YYYY-MM-DD HH:MM:SS"`, `article_image` → `image_big`,
  `source: 'umapyoi'`; only ids the official site doesn't serve; official always wins).
  package.json: `news:latest:jp`, `news:all:jp`, `news:umapyoi:jp` (or document the flag).
- **Check before parsing anything**:
  - an id on both sources: compare umapyoi's `message` with the official HTML (same markup? umapyoi's 3497 is
    781 chars);
  - that `prev_announce_id` is really "older";
  - the oldest post the official site serves;
  - how many of the 2,663 umapyoi ids are already on the official site.
  Write it down in CLAUDE.md like the EN numbers.
- **Etiquette**: ~320 official + ~2,350 umapyoi requests for the backfill. Keep EN's pacing (official 1–2 s for the
  one-off, 3–8 s for periodic runs; umapyoi 1–2 s), one at a time, resumable (save every N posts).

### Phase 2: look at the posts before writing parsers

**Done 2026-10-11**: findings in [jp-news-findings.md](jp-news-findings.md) (incl. open questions for phase 3), sample
ids in `test/fixtures/jp-news-samples.json`.

Sample ~30 JP posts per kind (gacha, story event, Champions Meeting, Legend Race, campaign/celebration, login bonus,
missions, maintenance/update) and note:
- **HTML structure**: heading tags/levels, how header art appears (official `prd-info-umamusume.akamaized.net/announce/<id>/Header/…`;
  `eventBlocks()` keys on `<figure><img …/header_<8 digits>_…>`), lists, tables. The official JP `message` uses
  `<p data-local-id …>` (a different CMS from EN's), so expect differences.
- **Date formats**: e.g. `2026年10月9日(木) 15:00 ～ 10月20日(月) 11:59`, `10/20 12:00から`, `メンテナンス後`. All JST.
- **Title patterns per kind**, the JP equivalents of `post-categories.js`' RULES: `「…」ガチャ開催`, `ストーリーイベント`,
  `チャンピオンズミーティング`, `レジェンドレース`, `キャンペーン`, `ログインボーナス`, `ミッション`, `開催予告` / `開催中` /
  `終了` (phases).
- **Rewards wording**: `×N`, `N個`, `サポートカード「[title]name」`, copies (`N枚`, `最大N回`), ジュエル (carats), マニー
  (monies), etc.

Save the samples' ids in the tests' fixtures list.

### Phase 3: parsers, language-aware

**Done 2026-10-11** (uncommitted): `scripts/lib/news-lang/` (en, ja, ja-banners), `data/jp_banners.json`, `data/jp_events.json`,
`pnpm update-jp`; Global byte-identical; checked against GameTora. Details and numbers: CLAUDE.md ("One parser, two
languages", "JP categories", "News → JP banners", "JP events"). Open problems are listed there and in the report.

Keep the structure (`postEvents`, `eventFragments`, `buildEvents`, merging, doubts, mission bars) shared. Move the
English wording into a lexicon per language instead of forking files:
- `scripts/lib/news-lang/en.js` (today's regexes: period headings, MAIN/NOT_OWN, STARTS, item/login/dated line
  patterns, COPIES, title RULES, phases, sub-event kinds, ALIASES) and `news-lang/ja.js`;
- the code takes `lang`.
- `parsePeriod` gets a JP counterpart (JST → UTC ISO), and the year comes from `post_at` as in EN.

In order (each with tests on real JP samples, like EN's):
1. `categorize()` for JP (`news:categories --server jp`): category, kind, phase, name. Check every stored post's
   category by eye, as was done for EN.
2. `eventBlocks()` / `joinBlocks()` on JP markup (the header art pattern may differ).
3. Dates (`headingPeriod` / `openingPeriod` with the JP lexicon).
4. Cards: `cardIndex` by `title.jp` + `name.jp` from `generated/cards.json` (GameTora has every JP card); `cardsIn`
   with the JP bracket style `［…］` / `[…]`, full-width characters normalized (`norm` uses NFKD, so it already folds
   full-width).
5. Items, titles (称号), mission sets.
6. Champions Meeting phases (JP's schedule headings).
7. `buildEvents` → **`data/jp_events.json`** (same shape as `global_events.json`; `news_url` to the official JP post
   page, umapyoi-only posts link to umapyoi or nothing). Built by a JP sibling of `update-global`
   (`update-jp.js`: JP banners + events from the JP news).
8. JP banners from the news (decision 2): `bannerPost()` with the JP lexicon (scout headings, `gacha_banner_<id>`
   art, the featured list `［title］name`, periods in JST), seed `data/jp_banners.json` once from GameTora, merge the
   news-made ones over it, and move every reader of `generated/jp_banners.json` over. Verify: for banners both
   GameTora and the news have, the same ids, featured cards and dates.

Verify against GameTora's JP event data with a one-off script, like `scratchpad/verify.mjs` did for Global (story
events, Champions Meetings, Legend Races, limited missions by JP dates). Less info is fine, wrong info is not.

### Phase 4: the model for doubts, in Japanese

**Done 2026-10-12**: see CLAUDE.md, "The model on JP events".

- `event-questions.js`: the SYSTEM prompt + FIELDS + EXAMPLES per language (made-up Japanese examples, including
  null ones; never copied from real posts); Gemma 4 reads Japanese.
- Answers in `data/news/jp/ai_answers.json`; `ai-events.js --server jp`.
- Run `--compare` on a JP sample to check the model, as was done for EN, before a full run.

### Phase 5: app and automation

**Done 2026-10-12** (except predicting Global's events from JP's, a separate task): see CLAUDE.md, "JP on the Timeline and
in the workflows".

- **Timeline on JP**: the event lanes (`eventGroups`, `EventRows`, `EventSheet`) for JP from `data/jp_events.json`
  (BannersPage only loads them for `gl` today); i18n for any new kinds; names per decision 1.
- `news.yml`: the same steps for JP (`news:latest --server jp` → `update-cards` + `scrape-gametora` →
  `news:ai --server jp` → build JP events), committing `data/`.
- CLAUDE.md: the JP sections, commands, data table, tests.
- Later (separate task): **predict Global's events from JP's** (the reason for all this), the way `ml/` predicts
  banners. Global follows JP's event order with a lag, and JP events + their Global matches are the training data.

## Pitfalls

- JST everywhere: `post_at`, periods in the text and umapyoi's unix times. Store what the API sends and convert at
  parse time; never mix JST strings into UTC fields.
- Don't let JP regexes leak into the EN lexicon or the other way round. Run the EN tests and diff
  `data/global_events.json` before/after every refactor of the shared code (it must not change).
- JP has ~4.5× more posts and five years of history: wording changed over time (older posts use other headings).
  Expect more doubts, and sample old posts too.
- Keep requests gentle and resumable. The official JP site is a production game site.
