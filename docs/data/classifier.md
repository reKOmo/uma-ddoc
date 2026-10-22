# The post classifiers and the gold sets

News posts used to be categorized by title rules alone, and a title the rules didn't know dropped a whole event
(Global's "New Beginnings Part 1 now available!", 1122, was read as an app update: the celebration vanished and its
free scout showed up alone). Now a hand-labelled gold set per server says what every post is, classifiers learned from
it label new posts, and both servers' events are built from those labels. JP's matter most: its events come first, and
Global's Timeline predicts its future from them. Every command takes `--server jp` (`pnpm gold:review:jp`).

## The gold set

`data/news/gl/gold.json` (committed, one post per line; `GoldFileSchema` in `shared/schemas/news.ts`): every stored
Global post's label, `{ id, category, kind, phase, name, units: [{ role, kind, name }], note, reviewed, post_updated }`.
`post_updated` is the post's `update_at` when it was labelled: a post edited since (JP 3523, a maintenance notice that
gained a gift note) is no gold until it's labelled again (`gold.ts` `stale()`; the models categorize it as a new post,
the update summary says "Edited since labelled", the review page shows it unreviewed and saves the post's version).

- **Units:** a post cut at its header art as `eventBlocks()` does, its intro (text before the first art) a unit of its
  own (`scripts/lib/gold.ts` `units()`), so a celebration's intro and the part after it ("…the New Year's Countdown
  Login Bonus has begun!") are two. An event post has one unit label per unit, other posts none.
- **`pnpm gold:review`** (localhost:5190, `scripts/gold-review.ts` + `gold-review/`): a local page with each post's
  units next to its label, today's rules' and the same-id JP post's (Global's in-game posts reuse JP's ids); posts the
  rules and JP disagree on first. New posts get today's rules' label (unreviewed) when it starts. It saves one label at
  a time into the file as it is then.
- **Conventions** (labelled 2026-10-21; new posts the same way):
  - `role`: `event` the post's own event (a celebration's intro, every unit of a one-event post); `part` a unit with a
    timed event of its own, named from its opening sentence ("Lucky Draw", "New Year's Countdown Login Bonus"; never
    a heading or the celebration's name); `none` content that is no event (songs, stamps, comics, features,
    scenarios, story episodes, home screens, permanent shop or race additions); `continues` a unit a picture cut off
    mid-section.
  - Parts: a celebration's G1 limited-time missions and Race Giveaway gifts (`missions`, `gift`); an event page that
    gives a daily gift (`gift`); paid guaranteed scouts (`campaign`); a card gifted "through the login bonus and
    missions" (`gift`); discounted carats and voucher packs (`sale`).
  - Posts: a digest previewing things that get posts of their own is `other` / `roundup` (363, 118) whatever its
    title says; content additions are `update` (jukebox songs, permanent missions or titles, features); a gift
    correction with compensation is `issue`; phase from the title's wording (`announced` also for "out soon",
    "coming in …"; none for roundups and notices). A post's `name` is as the game names the event (295, "Uma Quest:
    Epic Odyssey has ended!", is "Epic Odyssey Uma Quest" like its other posts).

**JP's gold set** (`data/news/jp/gold.json`, every JP post, 2021-02 →; labelled by Claude reading the Japanese, the
developer spot-checking a sample and every "Unsure:" note): Global's conventions, so a JP event and its Global replay
are labelled alike (of the 225 posts sharing an id with a labelled Global post, 210 agree; the rest differ in content:
JP community posts where Global reused the id, JP 813 a three-part celebration Global replayed as one gift), plus:

- Kinds: "さんぽ" walks (ウマさんぽ, ギャルさんぽ, KFCさんぽ) are `uma_outing`; a "開催決定" post announcing a multi-part
  campaign is a `celebration` (it merges with its started post), its described parts parts too; "新春レース応援" is a
  `campaign` (bonus Star Pieces); video series ("…お悩み相談！配信中") and real-world prize notices are `other` /
  `misc`; a scenario update or a spin-off release carrying campaigns of its own is a `celebration` (1060, 1155, 2106).
- Parts: special Home screens (特別ホーム), "限定セール追加対象" and permanent shop / race / card-exchange additions are
  `none`; paid ★3/SSR guaranteed, step-up and group-select gacha are `campaign` (an ordinary or セレクトピックアップ gacha
  is `none`); card presents, G1 "記念プレゼント" lists, "応援キャンペーン" item give-aways and an event page's petit gifts
  are `gift`; temporary story unlocks (ストーリー解放) and real-prize draws are `campaign`; in-game events, factor research
  and 特別移籍 editions inside a celebration are `special` / `factor_research` / `transfer_requests`.

## The classifiers

`pnpm news:features` (`scripts/news-features.ts` → `generated/news_features.json`: what the TS parsers see in each
post and unit, so Python needs no parser) and `pnpm news:categorize` (`ml/categorize.py`, scikit-learn logistic
regressions → `data/news/gl/categories.json`, `CategoriesFileSchema`). Features: title, opening sentence and text
words, Global's template phrases (`en.ts` `signals`), art series (`banner_<3 digits>`: 301 story, 302 Legend Race,
303 Champions Meeting…; a celebration's standalone posts share its series), id series, the same-id JP post's category
and today's rules' answer, so the models learn where the rules go wrong.

- **Units** (role + kind; a `continues` counts as `none`: in the gold set it only follows a `none`) and **phase** are
  the models'. **A post's category + kind are the rules'**: no learned model beats them (their misses are one-off
  posts a held-out fold can't learn), so the rules were improved instead: `en.ts` `revise` changes the title rules'
  answer by template phrases, each checked on every gold post ("details of included events" → celebration, a gift
  "to all trainers" opening the post → gift, a login bonus opening it → login bonus, a "Regarding …" title → no
  event). The post model checks them: `confidence` (its probability for the rules' answer) and `flag` (its own
  answer where it differs in what the pipeline reads), listed in `summary.md` as "Unsure: post … label it".
- `categories.json` is the gold label where there is one (its name too), else the rules' + the models'.
- **Guarded by** `test/news-replay-*.test.ts`: the newest posts replayed one by one must never wipe an older event,
  and each must make its event, both with their gold labels and categorized by the models as if new (`--hold-out`).
- **Trust the held-out numbers.** The models are 100% on what they trained on; `--evaluate` scores them cross-validated
  by post (optimistic: folds share near-twin posts, a cup's "coming soon" and "is here") and trained on the older
  three quarters, scored on the newest posts (what to trust). 2026-10-22, newest: units 98.0% vs the rules' 92.9%
  (97.0% without the rules as a feature), phase 100%; the post model misses the first Uma Outings, a kind it never
  saw. The rules' scores (98.9% of what the pipeline reads, posts) are in-sample: they were written against these
  posts. Regularization (C 0.3–30) changes nothing; the unit misses are rare unit types (special Home screens).
- **JP** (2026-10-22): the same split. Posts: the rules 99.6% (newest 99.9%) vs the model's 99.6% (99.7%: it takes two
  shops for banners), so the rules decide, the model flags; units the model 98.4% (newest 97.8%) vs the rules' 93.9%
  (92.1%); phase 99.8% / 100% both. JP's title rules (`ja.ts`) gained, checked on every gold post: さんぽ →
  `uma_outing`, 新春レース応援 → `campaign`, お悩み相談 → `misc`, and a one-part celebration (a part's art after
  "本キャンペーンでは…" / "キャンペーンの詳細は、下記"). Left to the gold labels and the model's flag: the "開催決定"
  announced celebrations and the update / release celebrations. JP's art ids give the series too (leading digits, or
  a campaign's date, CP_20261017), and Global reuses JP's: 1122 is series 264 on both.

## Events from the labels

`update-jp` / `update-global` run both commands first when `ml/.venv` exists (`pnpm setup-ml`; news.yml sets it up
and classifies before asking the AI, whose answers are keyed by the classified events' ids) and build the events from
`categories.json` (`scripts/lib/categories.ts`; a post missing from it falls back to the rules):

- **Cutting** (`postEvents()`, given a post's labels): a celebration is its `event` units (its own text and period,
  never a part's); each `part` unit a sub-event of its kind (an in-game event's sentence, "The in-game event, X, is set
  to kick off", makes it `special` whatever the model says: 1093's Sparkly Magic Show), id `<post>-<unit>`;
  `continues` joins the group before; `none` is left out (a song's text gives no rewards). Without labels the rules'
  block heuristics cut it (and give `ruleLabel()`'s units).
- **Names**: a part's from its opening sentence. Global: `en.ts` `subName`, then `subNames`; `cleanName` drops
  "campaign", turns "Part 2 of the X" into "X Part 2" and capitalizes "Special Missions"; fixed names for parts a
  sentence only describes: Limited-time Missions, Discounted Carats; a card gift its sentence doesn't name is the one
  card its "Gift Contents" list (138 / 141 gold part names, in-sample; 607-1's "Special Valentine's gift" is right
  too, the other two are only on the banner art). JP: `ja.ts` `partName()`: a pair of paid scouts, a rental boost or
  story unlock told in a sentence, a daily gift, else its quoted name; `cleanName` drops a card's "SSR" (665 / 678).
- **Merging** (`buildEvents()`; `pnpm news:merges` lists every merge by kind): parts of two celebration posts are one
  event only within one series (name without "Part N") and only a shop re-listed with new items or a part with the
  very same start (Part 3's "Discounted Carats" isn't Part 2's); two posts that both say an event has begun keep the
  first one's start (a story's "Part 2" post doesn't move it); a gift is never "announced without dates" (it's sent
  when posted); a standalone post that is one short window of a part's period stays its own event (JP's weekly
  「育成報酬」ピース追加キャンペーン under a G1 celebration's part for all of them, as Global's "Bonus Star Piece rewards
  in Career" are; found against uma.moe's timeline, 2026-10-22).
- **AI answers** are keyed by event id: after a change of cutting, re-ask them (`pnpm news:ai --provider ollama`).

## The JP rule

What JP has, Global gets. `ml/events.py` predicts every unpaired JP event from up to 30 JP days before Global's card
progress whose predicted Global start is at most 14 days ago (JP 1122 started on the very day Global's releases had
reached and was never predicted); the Timeline hides a predicted event 14 days past its predicted start
(`withPredicted(real, predicted, now)`), not when a newer real event of its kind starts.

A paired celebration's parts pair by the art id Global reuses (JP's おみくじ and Global's Lucky Draw are both
26400004), else by kind and offset from the celebration's start (2026-10-22: every part of the 15 paired celebrations
pairs, 49 by art). A JP part Global's celebration lacks is predicted under it at the celebrations' offset while it
runs, none once it is over (Global has never run a skipped part later, JP 813's included).
