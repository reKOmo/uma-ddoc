# Events and the model for doubted fields

- **Events** (`scripts/lib/events.ts` → `data/global_events.json`): Global's in-game events from the news alone (no
  GameTora; Global's upcoming ones are predicted from JP's: "Global ↔ JP events" below). **Everything with dates of its
  own is a bar** (except inside one event: Champions Meeting rounds, reward collection, repeated windows stay in its
  bar), newest first: `{ id, kind, name, parent, start, end, cards, items, titles, phases?, races?, scouts?, news_url, image, source }`
  (`phases`: a Champions Meeting's, JP League of Heroes', else any event whose post gives two or more of `lang.eventPhases`: event, tallying, results, reward collection). `races` (`scripts/lib/event-races.ts`, wording in `lang.race`): every event whose
  post has a "Race Condition(s)" section (Champions Meetings, Legend Races, the Racing Carnival, Dream Team), `{ name,
  opponent, track, surface, distance, category, direction, course, season, weather, ground, time, variable }` as keys
  the app translates; read word by word from "Tenno Sho (Spring) / Kyoto / Turf / 3,200m (Long) / Right-Handed / Outer
  / Spring" (older posts' "2000 m", "Weather: Sunny", "Outer→Inner" too; a missing category from the metres; a first
  part that isn't a word is a Legend Race's name). One race per line; a Legend Race's "Weather / Track Condition" list
  splits it by opponent; Dream Team's "Racecourse: A, B" one per racecourse with its season (`variable`: weather and
  ground change between races). The latest post's races win, its blanks filled from an earlier post's same races (the
  Pisces Cup's last post dropped its season). A test checks every word of every stored race line is known. What matters most is whether an event gives a **support card**: `cards` `[{ id, rarity,
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
  blocks (a new song, stamps, a dated "has been added" sentence) belong to the block before. A block 0 whose period
  starts with a later opening sentence, not the celebration's own, announces an included event: from that sentence on
  it's a sub-event `<post>-0` (Holiday Celebration Part 2's "The in-game collaboration event …, Sparkly Magic Show, is
  set to kick off at …": kind special, `lang.inGameEvent`; 1st Anniversary Part 3's login bonus), and the event's own
  post merges into it (Global's 1109 → `1093-0`). A celebration without a
  period of its own runs from its opening sentence's date to its last sub-event's end. Dates (`blockPeriod()`): the
  block's period headings (main ones first: availability / event / sale / league selection; never reward collection, expiry,
  registration, matching, sneak peek, ranking, exchange), every short non-bullet line under them; "Gift Timing" lists
  run first → last moment; else an opening "As of / From … (UTC)" sentence. "has ended" posts give no dates. A
  one-event post is read as one block (`joinBlocks()`: lines after a picture stay under the heading before it; a Legend
  Race post shows its second race's art between the race periods). A Champions Meeting runs from its league selection
  to its final race (the post's "Event Availability Period" and GameTora's dates start at round 1, 3–4 days later; the
  league selection is the event's start) and has `phases` [{ key, start, end }] from its
  schedule headings (`cmPhases()`, `CM_PHASES`: league_selection, round_1, round_2, final_registration,
  final_matching, final_race; from the latest post that has them; a "coming soon" post's "League Selection: From …"
  lines give their starts, and `predict-gl` fills the rest from JP's cup, status `predicted`: [pipeline](pipeline.md#dates)).
  Every date is `{ date, status }` ([pipeline](pipeline.md#dates)): `news` here, `gametora` for GameTora's.
  Mission sets get the reward names of their post's sentence about the missions ("rewards including carats, monies
  and Support Points"), never amounts (posts don't give per-set amounts).
  Merging (`buildEvents()`): same kind + name and overlapping dates (a cup counts from its league selection, so a
  "coming soon" post dated there meets it; the frequent "Bonus Star Piece" posts stay apart, as do two celebration
  series' parts: New Beginnings' Star Pieces aren't Fall G1's; an event with a post of its own that a celebration's
  post lists too becomes that celebration's part, the Daily Free 10x Scout); a post with a period but
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
- **Free scouts** (`scripts/lib/free-scouts.ts`, wording in `lang.scouts`, both servers): a daily free scout campaign
  (Global's "Daily Free 10x Scout" / a celebration's "Daily Free Scout"; JP's 「1日1回10連ガチャ無料キャンペーン」 /
  「毎日ガチャ1回無料キャンペーン」) gets `scouts` `[{ scout, type, banner, start, end, size, scouts }]`: each eligible scout
  as the post names it ("• Spotlight Support Card Scout" + its window on the next line; JP: 「・… ガチャ」, or a list under
  the campaign's 開催期間 that takes that period), its type (support / character from the name; null when it doesn't
  say), single or 10x (`size`, from the sentence naming the scout's type: 364 holds a single scout's campaign and a
  10x's), and `scouts`, the free scouts a player who logs in every day gets: one at each daily reset in the window
  (Global 15:00 UTC, JP 5:00 JST) plus one when it opens off a reset, unless it carries on the window before it (same
  size, starting the minute it ends: that day's scout was the earlier scout's); a parallel window does open with one
  (236's "(9 days)"). Pulls = scouts × size; stock ("Free Scout Stock" / ガチャストック) doesn't change the maximum.
  Checked against what the post states: "up to a maximum of 10 times" / 「最大12回まで」 = the windows' total (scouts
  sharing one window count once: either takes that day's), "(9 days total)" / 「（2日分）」 = a window's count; a mismatch,
  or a campaign whose windows the rules don't read (the launch's labelled "Pretty Derby Scout:" windows, 121), is a
  `scouts` doubt for the model. Every stated total and day count matched (Global 18 campaigns, JP 68). `banner`
  (`bannerOf()`, by `update-global` / `update-jp`, which pass their banners to `buildEvents()`): of the window's type,
  open when the window starts, never a paid scout; the one named as the post names the scout (JP's banners have names:
  3145's is 「ピックアップ プリティーダービーガチャ」, not the premium one beside it), else the newest (Global runs two of a
  type at once and the newer is the "Spotlight"; 373: one opening later in the window isn't eligible); every window
  matches one. Each banner then gets `free_pulls` (`withFreePulls()`): its windows' pulls, a window two posts list
  (364's part and 373's) once. Banner posts that mention a free scout (366, 376) aren't read: the celebrations list
  the same windows. Global's counts equal Luh's on every banner both give but 30073 (the post gives 6, Luh 5;
  `test/free-scouts.test.ts` lists the differences); JP's 30153 count (11) is the trainee banner's, Luh put it on the
  card banner.
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
  a model put among the items count as copies. Free scouts (`scouts`): the model gives each window (the scout as the
  text names it, start, end, the days the text states) and the stated total; the code sizes and counts them as the
  rules do (`counted()`; a stated day count stands: the launch's first window has no time), and takes them only if
  every scout name and number is in the text and they add up to the total. Local 26b read the launch's 7 + 8 = 15
  right and matched the rules on six campaigns of both servers. Models: Gemma 4 — locally `gemma4:26b` through Ollama (native API,
  `think: false`: thinking took minutes and its reasoning filled Ollama's default 4,096-token context, so `num_ctx`
  16,384), on OpenRouter `google/gemma-4-26b-a4b-it:free` (OPENROUTER_API_KEY; free models: 20 requests a minute, 50 a
  day, 1,000 once the account bought $10 of credits; paced and 429s retried), falling back to
  `nvidia/nemotron-3.5-super-vl:free` when Google throttles the free Gemma for everyone (each answer stores the model
  that gave it; `--compare` on 20 events: every kind, end and amount the same as the rules, its few differences
  defensible, e.g. a gift series' first gift day as its start). A run stops asking once every model stays unavailable through the
  retries; the rest are asked on the next. `gemma4:e4b` is ~6× faster but missed the
  multiplications. Results (2026-10-11): 142 events asked; on hard cases with known answers 26b got every one (Umayuru's
  150 × 22 windows = 3,300 carats, 3,000-carat login bonuses, Golshi Mode's 1,200,000 Monies, ×5 card gifts, ×2 login
  and ×3 missions copies); every number and date it changed is in its post. `--compare` asks events about every field
  and reports agreement with the rules per field (how these were chosen).
