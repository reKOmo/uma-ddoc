# Career scenarios data

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
  (`scripts/lib/colors.ts`: pngjs to decode, skin/hair hues left out since the art is mostly characters), computed
  once per cover by `fillColors` and kept. GameTora's own `bg_color` per scenario is a curated alternative. Dates
  are ISO UTC; `en_start_date` is predicted until the news gives Global's (a dated mention replaces the prediction). Links: `https://gametora.com/umamusume/<slug>`
  (GameTora's scenario pages; there's no `/scenarios/<slug>`). `scrape-gametora` refreshes the JP side and adds new
  scenarios; `update-global` the Global side from the news. The news parser only takes "new Career scenario "…""
  phrasings (plain "scenario" is everywhere: known issues, scout fine print); a launch time only when the sentence
  says it's added/begins. A news name matches by name/key/slug, else JP's next scenario Global hasn't launched
  (Global follows JP's order). Predictions (`pnpm predict-gl` → `ml/scenarios.py`): a scenario's JP launch day
  through the card release model + known dates, 22:00 UTC, no JP weekend, after Global's latest known launch —
  each past launch (Aoharu, MANT, GL) came out on Global the same day as its JP launch day's cards.
