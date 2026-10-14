# Official news (Global + JP)

- **Official news** (`umamusume.com/api/ajax/pr_info_index` / `pr_info_detail`, POST JSON, no cookies needed):
  keep it gentle. `news:latest` pages 10 posts at a time like the site, stops at the first page with a known post,
  fetches details only for new/edited posts (index `update_at` changed), then probes the unknown ids of
  each id series (JP: just the one) from 8 below its newest id to 4 above (Global serves some posts before its index lists them: 1094,
  a carat gift; JP too, in case; an unknown id answers `response_code` 500 on both), one request at a time with 3–8 s random
  pauses — a normal day is ~25 requests. Don't make it refetch everything. The index only lists the last few months;
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
  [docs/jp-news-findings.md](../jp-news-findings.md). Names stay as the posts give them: no machine translation (umapyoi's `title_english`) or model translation.
- **JP categories** (`news-lang/ja.ts`): label 2/3 = community (≈ EN's 200001 series; label 5 is one maintenance post),
  scouts by their art (exactly the 466 posts with `gacha_banner_` art), then anchored title rules (`^ストーリーイベント「…」
  (開催決定|開催|終了)！$`, `^(レースイベント|M/D|N月下旬)「チャンピオンズミーティング X」`, …) so event-named bug posts stay
  other. JP kinds Global lacks: `league_of_heroes` (no name, in UNNAMED_KINDS), `factor_research` (因子研究),
  `masters_challenge`. A campaign post showing ≥ 2 parts' art is a celebration. Names stay Japanese (decision 1): a
  name is the leading 「…」/『…』 when only the phase follows it, else the title without its phase.
