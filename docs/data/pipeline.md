# Data pipeline

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
| Official Global news (banners, events, updates) | `data/news/gl/posts.json` (each post as the API sends it), `data/news/gl/summary.md` (last run's additions) | yes | `pnpm news:latest` (`news.yml`, manual for now); `pnpm news:all` once |
| Official JP news (Japanese originals) | `data/news/jp/posts.json`, `data/news/jp/summary.md`, `ai_answers.json` | yes | `pnpm news:all:jp` + `news:umapyoi:jp` once; `news:latest:jp` (`news.yml`); answers: `news:ai --server jp` |
| Upstream code (for comparison only) | `upstream/` | no | `pnpm clone-upstream` (manual locally; CI clones it) |


## Dates

Every date an item has, in every file (events' start / end / phases, banners' start / end / `rerun`, card release
days, scenario launches, predictions), is `{ date, status, lo?, hi?, source? }` (`Dated` in
`shared/schemas/common.ts`; `date` a moment, or a day for card releases):

- `status`: where the date came from: `news` (an official post), `confirmed` (`data/known_dates.json`, Global's release
  schedule), `predicted` (from JP's, `ml/`), `gametora` (GameTora's history). Whether it's upcoming, live or over is the
  app's to work out from today (`bannerStatus()`, `launchTag()`); it's never stored.
- `lo` / `hi`: a predicted date's range (days). `source`: what confirmed it.
- Plain strings stay for what isn't the item's own date: `jp_start` / `jp_end` (what a prediction is from), event pairs'
  dates, post times, and `known_dates.json` (the hand input itself).
- **Per date, the news wins**: news > confirmed > predicted. `data/global_events.json` / `global_banners.json` hold what
  Global's news has plus fills for the dates it lacks: `predict-gl` fills a paired event's end and missing phases from its
  JP pair (status `predicted`, `ml/events.py` `write_fills()`, recomputed each run); `update-global` keeps a banner's end
  `confirmed` from `known_dates.json` when the post gives none, and gives a news banner without an end JP's length
  (`predicted`). A rebuild from the news carries the fills over for the dates the news still lacks
  (`scripts/lib/dates.ts`). Pure predictions (nothing on Global yet) stay in `generated/predicted_global_*.json`.
- The Timeline fades a bar whose end is only predicted (`Entry.endPredicted`); the sheet says "end predicted" and marks
  schedule rows with a predicted date.

- `ensureCards()` fetches upstream's card data if it's missing and builds the card data if that's missing; it runs
  from a Vite plugin (dev/build) and from `test/global-setup.ts`.

Details per source: [cards](cards.md), [GameTora](gametora.md), [news](news.md), [events](events.md), [JP](jp.md), [scenarios](scenarios.md), [predictions](predictions.md), [pull guide](pull-guide.md).
