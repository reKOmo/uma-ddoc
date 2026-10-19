# Predictions (ml/)


`ml/` is Python in its own venv (`pnpm setup-ml`). Deploys rerun it after the banner scrape, so predictions
restart from Global's latest release. The Timeline page reads `generated/predicted_global_banners.json`
through an `import.meta.glob`, so it's optional: without `pnpm predict-gl` there are just no predicted bars. Announced Global dates go in

- **Known dates from Global's banners** (`ml/adjust.py`): every Global banner rerunning a JP banner newer than the
  anchor is a known date (JP start's JST date → Global start's UTC date), merged with `known_dates.json` (hand
  entries win; out-of-order ones dropped with a warning). Predicted banners skip ids `data/` already has. **Event
  pairs** are known dates too, with the lowest priority (hand entries, then banner reruns, then events; only at or
  after Global's last release; a Champions Meeting compared on round 1 on both sides). Backtest (mean of the
  per-bucket median errors, linear(all)): 3.40 → 2.90 days with them (2026-10-12).
- **Global ↔ JP events and predicted Global events** (`ml/events.py`, run by `predict-gl`): each Global top-level
  event is paired with JP's (`generated/event_pairs.json`: `{ pairs: [{ gl, jp, kind, how, gl_start, jp_start, dev_days,
  anchor }], rejected: [… why] }`): `how` = `post` (same post id, the commonest; a JP celebration's part too, after its top-level events; and a Global part with a post of
  its own, never an anchor: Global's 1093-0 Sparkly Magic Show ↔ JP's 1093-1), `card` (story events' SSR), `name`
  (Champions Meeting cups, EN ↔ JP: Taurus Cup ↔ タウラス杯…; a small table of recurring specials / celebrations,
  `NAMES`, `CUPS`) or `order` (Legend Races); every pair keeps Global's order = JP's per kind and lies within 10 days of
  where JP's card releases put it (else rejected: 2, events Global moved). 94 pairs on 2026-10-12 (story 20/20, CM
  20/20, LR 15/15, …); unpaired: mostly 2025 gifts/campaigns whose 2021 JP posts aren't in the archive, Transfer
  Requests (GameTora has none). Predicted events: every JP event (all kinds, user decision) after the JP date Global
  has caught up to with no pair, at the same predicted Global date as banners (22:00 UTC, no JP weekend; a known date
  exactly), JP's durations, parts and phases shifted with their top-level event, JP's races as they are; `generated/predicted_global_events.json`
  `{ source, events: [JP event fields + id 'jp-<jp id>', parent 'jp-…', predicted, jp_id, jp_start, jp_end] }`, every
  date status `predicted` (starts with `lo` / `hi`: ± the margin), a start `confirmed` on a known JP day (below). 368
  top-level + 616 parts on 2026-10-12. Paired Global events get the dates their news lacks filled in from their JP pair
  (`write_fills()`: a "coming soon" cup's end and later phases; not a gift's end, JP's being a delivery deadline):
  [pipeline](pipeline.md#dates). Banners and cards likewise: start / end, `release_gl` as `{ date, status, lo?, hi? }`.
  **Status `confirmed` comes only from `data/known_dates.json`** (`ml/adjust.py`: `hand_known_days()`, `confirmed_cards()`):
  a banner on its `banners`; a card on one of those banners or on a JP day its `dates` give; an event only on a JP day
  its `dates` give. A JP day known otherwise (Global's banners, paired events, a confirmed banner's day) still gives
  the exact Global day, but nothing on it is `confirmed` (its status stays `predicted`): sharing a day with an announced banner or cup confirms
  nothing about a gift on that day.
  `update-global` drops a `banners` entry once the news has that banner (live or announced): it's Global's own then
  (its end kept as a `confirmed` date while the post gives none).
