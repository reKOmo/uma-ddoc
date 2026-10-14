# Ranking semantics and upstream parity

- **The calculation is ours** (`tierlist/tierlist-calc.ts`, `scenarios.ts`): nothing
  syncs it automatically. Upstream's UI-only parts were dropped (the per-card `info`
  breakdown, scenario `version`/`currentState`/`show`, server `referenceDocUrl`,
  `defaultLocale`, `defaultFilters`, `defaultTierListDropdown`, `useLegacyFsBonusDisplay`).
  Keep the MIT attribution in their headers and `tierlist/LICENSE`.
- **Hearing about upstream changes:** `test/upstream/parity.test.ts` imports upstream's
  calc, scenarios and card lists straight from the clone (Vite resolves their
  extensionless imports) and requires our rankings to match exactly. When it fails,
  port the change by hand (or update the test if we diverge on purpose). It also checks
  the clone and `generated/` are the same upstream commit (`sources.json` `ref`) — if
  not, run `pnpm clone-upstream && pnpm update-cards`.
- `vite.config.ts` keeps Vite's dependency scan and watcher out of `upstream/` (it's a
  whole other app with its own `index.html`).

- `processCards` (upstream) scores each candidate card as its **marginal** value when
  added to a fixed 5-card deck. Scores are only comparable within one
  server + scenario + stat.
- `rankByUsefulness` averages that score over the site's default deck and all deck
  presets; if a deck already holds the candidate's character, the candidate is scored
  against the other 4 cards (the game forbids duplicate characters).
- Tiers (S, A, B…) split the score range into 7 equal bands (upstream's banding).
- **Averaged rankings** (`COMBINED` in `tierlist/index.ts`) are offered next to the real
  scenarios everywhere a scenario is picked: `overall` (every scenario) and `upcoming`
  ("Current + future": the server's `defaultScenario` plus every scenario listed before
  it, since `availableScenarios` is newest first). Each scenario's ranking is rescaled to
  0–1000 (bottom → top card) and those are averaged. Scenarios the server lists but
  doesn't define are left out of the averages: Global lists `DYI` but has no weights for
  it, so `getScenario` silently falls back to GL — Global's DYI row/option is a copy of GL.
- Banner sheet ranks use the **LB4 (MLB)** copy in the currently selected scenario.
  The card page ranks every LB in every scenario of the selected server (one scenario
  at a time, so rows fill in as they finish).
- **Rank over time** relies on candidates being scored independently: the tier list on
  a past date is the current ranking filtered to cards whose release date
  (`release_gl` from `data/`, `release_jp` from `data/jp_cards.json`) is on or before it. The card is compared with other
  cards at the **same LB**. Preset decks stay as they are today. Cards without a
  release date (a few Global promo cards) are left out. The last step runs on to today,
  so where upstream's card lists lag the game the line is just flat at the end.
  **On Global it continues as a dashed line** through JP's cards Global doesn't have yet, at
  their predicted dates (`generated/predicted_gl_releases.json` via `src/predictions.ts`,
  optional). They're ranked with `rankByUsefulness(…, { upcoming: true })`: JP's stats
  (identical to Global's for every shared card), English names via another card of the same
  character; existing cards' scores don't change (averaged rankings keep the Global-only
  0–1000 scale, so upcoming cards can score above 1000). JP's newest cards have no stats
  upstream yet and are left out. Cards not on Global with a prediction get the chart too.
  **Promo cards** (cards.json `source` promo: collabs, campaigns) are never predicted: Global isn't expected to get promo
  banners or cards (ml/data.py `is_promo()`: status 'promo'; ml/banners.py drops them from predicted banners and skips a
  banner of nothing else). One Global does get comes from the news like any release.
- Server keys: `gl` / `jp` for tier-list code, `global` / `jp` for banner files
  (`src/servers.ts` maps them). GameTora card types map to stat tabs via `STAT_OF_TYPE`
  (`intelligence` → `wisdom`, `group` → `friend`).

