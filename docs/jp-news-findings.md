# JP news: what the posts look like (phase 2 findings)

Studied 2026-10-11 over all 2,663 stored JP posts (`data/news/jp/posts.json`), before writing any JP parser.
Sample ids per kind are in `test/fixtures/jp-news-samples.json`.

## Coverage

- 2,663 of the 3,398 ids 100…3497 (the rest the mirror never had). 2021 is thin (96 posts; ids 100–700 only 25–60 per
  200: no URA / Aoharu / MANT launch posts, no 1st Anniversary parts 1–2), Jan–May 2022 too (~70). **From mid-2022
  every kind looks complete** (story events, Champions Meetings, Legend Races, LoH: no unexplained gaps).
- So the JP news can't replace GameTora's banner history before ~2022-06 (68 GameTora banners have no post, 65 of
  them 2021-02 … 2022-05): keep the GameTora seed (decision 2).

## Markup (one parser for every era)

- Same HTML 2021 → 2026 on both sources: text runs joined with `<br>`, headings `<h2 class="heading">` /
  `<h3 class="subheading">` (h4 ~17 times, 2025–26 only; some posts have period headings only in h3 →
  `sections(html, '234')` as EN). Lists are `・` lines, never `<ul>`; `■…` / `【…】` lines are pseudo-headings inside
  sections (`■イベント限定称号`, `【獲得できる注目アイテム】`). Tables only in step-up / stamp-sheet gacha posts.
- Quirks to normalise: `&nbsp;` (837 posts), U+200B (106), full-width digits (`第４R`, `１日分`; NFKC), full-width
  spaces, `<span>`s splitting words (2021–23: `<span>[Nevertheless</span><span>]ナリタタイシン</span>`), unquoted
  attributes (2025 umapyoi: `<h2 class=heading>`, `<img src=https://…>`), and since 2026 a new CMS in some official
  posts (`<p data-local-id …>`, coloured `<span>`s around dates: `9/6</span><span>&nbsp;</span><span>12:00`).
- `toLines()` doesn't break at heading openings / `</h3>` / `</h4>`, so `…4:59注意事項` gets glued (3485, 3472):
  break there too for JP (check EN is unchanged).
- Tilde: `～` U+FF5E (~6,400 lines), `〜` U+301C (44), ASCII `~` (38).

## Labels, platforms, edits, duplicates

- `announce_label`: **1 = in-game** (2,296; issues, maintenance and store notices included: no separate id series as
  on EN), **3 = media / community** (365: ぱかライブTV, live events, merch, outside collabs, X giveaways, real-world
  prizes; checked: never in-game content) ≈ EN's 200001… series, 2 = one 2021 giveaway (community), **5 = one 2021
  maintenance post (559)**: so "community" is label 2 or 3, not "not 1". **Only label 1 makes events.**
- `post_platform_flag` is a bitmask: 2 iOS, 4 Android, 8 DMM, 16 website (always), 32 Steam. In-game posts are 30
  until the Steam launch (2025-06-26), 62 after; old posts carry current flags, so don't date anything by them. Every
  `ストーリーイベント「…」開催決定！` is website-only (16).
- **Per-platform duplicates**: 7 same-title, same-day groups with different flags (2212/2217/2218, 3344/3345,
  970/971): dedupe by title + date.
- Edited (`update_at` set): 484 (18%); maintenance 88%, issues 75%, banners 4%, story / Legend Race / gifts never. Event
  and banner dates are final when posted.

## Titles → category, kind, phase

Draft rules (first match wins, after the label check) classify every one of the 2,663 titles; the runnable drafts
are in the session scratchpad (`classify.mjs`), to become `news-lang/ja.js`. Totals: banner 469 · event 1,031 · other
1,163. Key rules and order:

| order | title | → |
|---|---|---|
| label | `announce_label` 2 / 3 | other / community |
| 1 | `メンテナンス` | other / maintenance (before issue: `…機能不具合に伴うメンテナンス`) |
| 2 | `不具合\|障害\|現象について\|エラー\|強制終了\|誤表記\|詐欺\|…` | other / issue (before store and gacha) |
| 3 | `WebStore\|ウマ箱\|ウマスク\|ウマプラン\|コラボ(?:限定)?セット\|販売開始！$\|…` | other / sale |
| 4 | `ガチャ.*無料\|無料.*ガチャ` (1日1回10連ガチャ無料) | event / campaign |
| 5 | `ガチャ.*プレゼント！$` (SSRメイクデビューガチャ gift) | event / gift |
| 6 | banner: `/ガチャ(?:」\|』)?(?:\s*(?:DAY\d\|第[0-9０-９]+R\|in [A-Z]+))?(?:も)?開催(?:決定)?！$/` | banner — exactly the 466 posts with `gacha_banner_` art, no misses |
| 7 | `^レースイベント「チャンピオンズミーティング[ 　](name)」(参加リーグ選択開始\|開催\|特別開催決定)！$`, previews `^(M/D\|N月[上中下]旬)「チャンピオンズミーティング …」開催予定！$` | event / champions_meeting |
| 8 | `^レースイベント「リーグ オブ ヒーローズ」(チーム編成期間開始\|開催)！$` (+ previews) | event / **league_of_heroes** (a kind EN lacks) |
| 9 | `^レジェンドレース(開催決定\|開催)！$` | event / legend_race |
| 10 | `^ストーリーイベント「(name)」(開催決定\|開催\|終了)！$` | event / story |
| 11 | `^「特別移籍(?: (.+ Edition))?」(開催決定\|開催)！$` (none after 2023-10) | event / transfer_requests |
| 12 | `^\d+月～\d+月対戦レースイベント` (6-month CM/LoH schedule, from 2025) | other / roundup |
| 13 | `^育成シナリオ「(name)」公開！$` (anchored: 公開記念キャンペーン is a campaign, …がアップデート！ an update) | other / scenario |
| 14 | `^(?:特別\|コラボ)?イベント「(name)」…(開催予告\|開催決定\|開催中\|開催\|追加\|終了迫る\|終了予告\|終了)！$`, `^レースコンテンツ「…」β版…`, `^「フジキセキのショータイム」イベント…` | event / special (因子研究, マスターズチャレンジ, 技能試験, 最強チーム, レーシングカーニバル, one-offs) |
| 15 | `ショップの開催\|ショップラインナップ追加` · `ログインボーナス` · `ミッション` (but `ミッションの追加について` = update) | event / shop · login_bonus · missions |
| 16 | `ピース追加` (「育成報酬」ピース追加キャンペーン = EN's Bonus Star Piece) | event / campaign |
| 17 | `キャンペーン` with ≥ 2 boundary arts in the body (G1, Anniversary 第N弾, ゆく年くる年…); else | event / celebration; event / campaign |
| 18 | `プレゼント\|配布` | event / gift (no phase in the title: started) |
| … | policy, devices, item expiry, `アップデートのお知らせ`, adjustments, new features, content added, releases, `について$` | other / misc / update |

- Anchors (`^…` and a `！$` phase ending) keep out the near misses: event-named bug posts (3043, 3334), ぱかライブ
  summaries, `…の今後の開催について`, real-world events (`Nthイベント「…」`). Never match a bare `RT` (CM "DIRT").
- Strip before reading names: `^【予告】`, `^【修正済み】`, `^【重要】`, `【N/N HH:MM公開】$` (192 update notices).
- CM names repeat (CLASSIC 15+ times since 2023; zodiac cups before): merge by name + dates (+ the 対象レース course),
  never by name alone.

Phases: announced `【予告】|開催決定|開催予告|開催予定|特別開催決定|公開予定` · league_selection
`参加リーグ選択開始|チーム編成期間開始` · started `開催中|開催！|開催$|追加！|公開！|販売開始` · ending `終了迫る|終了予告`
(`終了間近` never occurs) · ended `終了！`. No 終了 posts for CM, LoH or Legend Races; story / special 終了 posts only
give the reward-collection period. Named events since 2023 come as 開催予告 → 開催中 → 終了.

## Art

All under `https://prd-info-umamusume.akamaized.net/announce/<post id>/Header/<file>?c=<stamp>`:

- Scouts: `gacha_banner_<gacha id>.png`, also `_new`, `_new2`, `_<n>` suffixes → `/gacha_banner_(\d+)(?:_[^"./]*)?\.png/`.
  **EN's art regex (`gacha_banner_\d+_…`) misses almost all of them.**
- Events / campaigns: `header_<8–10 digits>.png`, `banner_<digits>.png`, and since Sep 2026 `header_EV_<YYYYMMDD>_<NNN>` /
  `header_CP_…` / `banner_EV_…`. The leading digits are a content id: 301 story, 302 Legend Race, 303 CM, 304 main
  story, 305 特別移籍, 306 技能試験, 307 レーシングカーニバル, 309 最強チーム, 311 anniversary/collab specials, 312 因子研究,
  313 マスターズチャレンジ, 314 LoH, 315 マンスリーマッチ, 2xx campaigns, 402 gacha story-unlock, 5xx scenario art (`_EV_`: 01x story,
  02x LR, 03x CM). A cheap cross-check for `categorize()`; it doesn't give a sub-event's kind.
- **Block boundaries** (celebration posts): `/(?:<figure>\s*)?<img[^>]*src="?[^" >]*\/(?:header|banner|announce_banner)_(?:(?:CP|EV)_\d{8}_\d+|\d{4,10})(?:_[^"\/.]+)?\.(?:png|jpg)/`
  — no `<figure>` required (30 bare `<img>`s, 1299); not `gacha_banner_`, `banner_detail_` (inline pictures), hero
  `.jpg`s (`1500man_dl.jpg`), `pakalive…`. An `announce_banner_<n>` block links to a gacha post: skip it.
  `header_402000NN` in scout posts is the attached story-unlock campaign, not an event.
- In **event** posts art is never a boundary (one post = one event, EN's rule): story posts carry three pictures,
  Legend Races one per race.
- `image_big`: the header art (official); don't read gacha ids from it.

## Dates

- All **JST**. Dominant form `M/D H:MM ～ M/D H:MM` (no year, no weekday, no padding); years only in long-running
  gachas (`2024/5/24 12:00 ～ 2025/3/31 11:59`) and a few cross-year rows; `YYYY年M月D日（曜）H:MM` only in label-3
  roundups. `メンテナンス後` never appears. Open-ended `M/D H:MM ～` and `～ 終了日時未定` (3110) exist. Typos exist
  (`8:27 12:00 ～`, 2081).
- Ends are inclusive minutes: 11:59, 4:59 (the game day starts at **5:00 JST**), 23:59. GameTora stores 11:59 as
  `…:59:59`; pick one convention (end = shown minute + 59 s, as GameTora, so banners compare equal).
- **Year inference (EN's `parsePeriod` would get JP wrong)**: 82 of 91 New-Year-crossing ranges have no year
  (`12/26 12:00 ～ 1/8 11:59`). Rule that fits all 3,707 event dates and every gacha period: give each date the year
  that puts it nearest `post_at` (±6 months), roll an end forward a year if it's before its start, and in a run of
  rows roll a date forward when it's before the previous row (3466: `12/21 5:00 ～ 2027/1/4 4:59` then `1/4 5:00 ~ 1/11`).
- Opening sentence `M/D H:MMから、…を開催中です！` (and variants) in ~600 of 621 event posts and in most celebration
  blocks: the fallback start. Ended `M/D H:MMに、…の開催期間が終了しました。`.
- `from_date` / `to_date` (official only) are the post's display window: ignore.

Period headings:
- the event's: `開催期間`, `イベント開催期間` (event posts; CM's starts at round 1), `ピックアップガチャ開催期間` and other
  `…ガチャ開催期間` (scouts; two labelled windows in one section in 2592/2593), `販売期間` (sale), `対象レース・開催期間・報酬`
  (piece campaigns), `ログインボーナス開催期間`, `…ショップ開催期間`, `公開期間`, `開催予定時期` (CM / LoH previews:
  `参加リーグ選択期間：7/22 12:00 ～` or just `9月下旬`); instants `プレゼント予定日時`, `プレゼント日時`, `追加日時`.
- never the event's: `報酬受け取り期間` / `報酬受取…` (story, 因子研究, 技能試験, カーニバル), `受け取り期限`, `集計期間`, `結果発表`,
  `ウマ娘ストーリー解放期間` (in scouts), `再開催期間` (a scout's re-run, see below), `対象のトレーナー`.
- Champions Meeting phases (identical 2022-06 → 2026, 72/72 posts), h3 under `イベント開催期間`: `参加リーグ選択期間`
  (league_selection; starts 3–4 days before round 1, ends with round 2: take its start), `ラウンド1`, `ラウンド2`,
  `決勝ラウンド：出走登録期間`, `決勝ラウンド：マッチング期間`, `決勝ラウンド：レース開催期間`. LoH: `チーム編成期間`,
  `メインステージ開催期間`, … `エクストラステージ レース開催期間`.
- Gifts without a period: `お贈りいたしました` (sent) → start = the sentence's `M/D H:MMに`, else `post_at`;
  `お贈りいたします` (future) → `プレゼント予定日時`, else the block's `から`, else `post_at`. End = the
  `対象のトレーナー` `YYYY/M/D H:MMまでにゲームを開始した` deadline when present.

## Scouts (banner posts)

- Phases: `【予告】…開催決定！` (208, the day before) and `…開催！` (257); nothing else.
- Type = the h2 the art sits under: `/^育成ウマ娘\d*$|★\d確定/` → character, `/^サポートカード$|SSR確定/` → support
  (group-select posts give each banner its own h2). All 574 GameTora-known banners sit under the right heading.
- Featured lists: half-width brackets, no space before the name: `★★★ [T]Name` (also `★★★[T]`, ★★, ★), `・SSR [T]Name`,
  `・SR`, `・R`, bare `SSR [T]Name`; titles may need trimming (`[万福龍湯伝・頂 ]`); 予告 placeholders `・SR ？？？`.
  Read only the **first `■` list after each banner's art** (trainees are listed 2–3 times; revival 2973 puts both
  banners' lists after the second art). Full-line item regexes keep out skill / bonus / eligibility notes:
  `/^(★{1,3})\s*\[([^\]]+)\]\s*([^\s\[\]「」、。]+)$/`, `/^(?:・\s*)?(SSR|SR|R)\s*\[([^\]]+)\]\s*([^\s\[\]「」、。]+)$/`.
- **Checked against GameTora**: all 574 banners it has match on start, end (to the minute) and type; featured match
  after dropping R cards (GameTora lists none) except GameTora's own gaps (30434 GOLD WEEK has no featured; 1384's
  title lacks a `！`).
- **Paid / special**: gacha id ≥ 50000 (guaranteed ★3/SSR, step-up, stamp sheet, group select, early Twinkle
  Collection; all mention `有償ジュエル`; GameTora has none). Paid is **per banner**: 58 posts pair a regular 30xxx
  banner with a 50xxx one, and 42 regular-only posts mention `有償ジュエル` for an optional paid pull.
- Regular banners GameTora lacks: every select-pickup support banner and every Twinkle Collection banner since 2024-04
  (67 ids).
- **Re-runs**: a broken pickup re-held later gets a new gacha id the post never shows; the original post is edited
  with a `再開催期間` (2446 → GameTora 30338; 947 → 30130/30131).

## Events: rewards

- **Support cards**: looked up by `title.jp` + `name.jp` (NFKC, whitespace removed): 89/89 in event posts, every one
  in campaign posts. Story events: `・イベント限定SSRサポートカード「[T]Name」` (+ the BINGO line), **copies never
  stated**. Campaigns: `SSRサポートカード「[T]Name」をプレゼント`, `「SSR[T]Name」を最大2枚プレゼント！`; copies `最大N枚` /
  `合計N枚` / `N枚ずつ`, often split per part in one sentence (`「…ログインボーナス」で最大2枚、「…ミッション第2弾」で最大3枚、合計5枚`:
  EN's copies-in-several-places doubt), or per episode (3466, 2525). `[T]Xのピース` (1,052 mentions) are trainee
  pieces, never cards; `[ヘルプ]`, `[プレゼント]`… are UI words.
- **Items**: `・X×N`, `「X」×N`, `X × N`, `ジュエル300個` / `ジュエル1500個` (bare, under `プレゼントの内容`), in 「」 in
  sentences (`「ジュエル3000個」をお贈りいたしました`). CM's `タフネス30×3` (the name has a number: split on the last
  `×`). Daily dated rows `6/10 12:00 「目覚まし時計」×3` → sum. Login bonuses are mostly prose with a total
  (`…1日ジュエルを150個、…最大で1500個のジュエルをプレゼント` → take `最大でN個`; day-1 specials like 1122 are a
  doubt); `ログインN日目：` lines only in 1093, `・N日目` headers in 3210. Mission sets name rewards without amounts
  (`「ジュエル」や「マニー」などの報酬`), as on EN. Legend Races / specials list names without amounts (`主な報酬`,
  `【獲得できる注目アイテム】`). Event currencies (イベントPt, ルーレットコイン…) aren't rewards.
- **Not rewards** (paid / costs): `販売内容`, `販売期間`, `必要ジュエル`, `価格`, `セット内容` sections (a sale block's `×N`
  lines are its contents: 3472), `有償ジュエル`, `使用して`, `消費`, `必要`, `購入`, `税込`, `引換券付きジュエル` (a paid
  pack, unlike the free `N.Nth Anniversary SSR引換券`), shops and exchanges (`交換に必要なマニー`).
- **Titles (称号)**: `イベント限定称号「X」` (story, LoH), CM's `■イベント限定称号` + `・CLASSICプラチナ` … bullets; none in
  campaign posts.

## Celebrations

- Cut at boundary art (above): 135 campaign-ish posts have ≥ 2 blocks (839 blocks), 252 are one block. Sub-event name
  from the opening sentence's first balanced 「…」 / 『…』 (`M/D H:MMから「X」を開催中です！`, `…[ミッション]に「X」が登場！`,
  `…[ショップ]に「X」が登場！`, `…購入できる「X」を販売中です！`); some open with an h2 instead (2363).
- Sub-event kind from the opening sentence, then headings, in this order: sale (`販売|購入できる|必要ジュエル`), login_bonus,
  missions (`[ミッション]|ミッション」?が登場`), shop, gift (`プレゼント|お贈り`), gacha blocks (not parts, or a campaign
  for free pulls), campaign, and feature-update blocks (`追加しました|公開中です`: fold into nothing); `イベント「…」を
  開催中` blocks inside a celebration are special events (3437).
- Anniversaries come as separate `第N弾` posts (each its own celebration) plus a `終了予告` post (skip, like EN's "ending
  soon"). Announcements (`開催決定` / `開催予定`) merge into the `開催` post of the same name a few days later.

## Scenario launches

`育成シナリオ「X」公開！`, opening `M/D 12:00から育成シナリオ「X」を公開しました！`: 11 posts (GL 2022-08 → 2026-06), all
12:00 JST and equal to `data/scenarios.json`'s `jp_start_date`. Announced ahead only in ぱかライブ roundups (label 3:
`YYYY年M月D日（曜）HH:MMから、新育成シナリオ「X」を追加予定！`). Names differ in spacing from `scenarios.json`: compare
with whitespace removed, NFKC.

## Decisions (2026-10-11, for phase 3)

1. **R cards**: news-made JP banners keep them (the post lists them; GameTora-seeded banners don't have them).
2. **All banners the news shows**: also the regular ones GameTora lacks (select-pickup support, Twinkle Collection) and
   the **paid / special** ones (gacha id ≥ 50000), marked as paid (`paid: true` per banner). Unlike Global, which
   skips paid scouts.
3. **Anniversary `第N弾`**: each part its own celebration, as on Global.
4. **New event kinds**: `league_of_heroes`, and any other recurring JP kind Global lacks (candidates: 因子研究,
   マスターズチャレンジ; decided when building the rules).
5. **Item names**: mapped to the canonical names where Global has the item (Carats, Monies, Support Points, shards…),
   so both servers' events read and sort alike; the Japanese name is kept too and shown on JP.
6. **Re-runs**: the re-run is its own bar on the Timeline. The original keeps its own dates and id (Global and
   `ml/` pair banners by id and JP start). Each points to the other: the re-run's sheet says what it re-runs (the
   original's dates), the original's that it was re-held. Where GameTora lacks the re-run (2446's select-pickup card
   banner), the news makes it, with an id of our own (`<original id>-rerun`).
