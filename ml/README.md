# Global release-date predictions

Predicts when JP support cards come out on Global, from their release dates in `generated/cards.json`
(`pnpm build-cards`): JP's from our history of JP's cards (`data/jp_cards.json`: a frozen record of GameTora's,
then the JP news' new cards, release = their first banner or event, `pnpm update-jp`), Global's from our own
`data/global_cards.json` (kept up from the official news by `pnpm update-global`). Global releases JP's cards
in JP's order, faster than JP did, so the models extrapolate Global's pace from its last release.

```sh
pnpm setup-ml             # once: ml/.venv with Python 3.13 (uv) + requirements
pnpm predict-gl:backtest   # walk-forward backtest of every candidate model
pnpm predict-gl            # predictions with the best one → generated/predicted_gl_releases.json
```

- `data.py` — cards + "batches" (all cards released in JP on one day). JP cards older than
  Global's progress that never came out on Global are `skipped` and left out.
- `models.py` — candidates: linear / Huber slope (anchored at the last release), recency-weighted
  linear (weights halve every 60–480 days), quadratic, and gradient boosting on release gaps. A plain linear fit over all history wins the backtest
  (median error ~1–6 days); the ML ones overfit with ~50 batches to learn from.
- `adjust.py` — applied to every prediction: passes through the known dates (`known_dates.json`, plus
  every Global banner in `data/global_banners.json` that reruns a JP banner newer than the anchor: Global uses
  JP's banner ids, so its JP start → its Global start; hand entries win, out-of-order ones are dropped with a
  warning), and
  never lands on a Japanese weekend (Global banners start 22:00 UTC = 07:00 JST next day, Mon–Fri
  JST only, so a predicted UTC Friday becomes Thursday, a Saturday becomes Sunday).
- `known_dates.json` — Global dates we know ahead of time (announcements). Either by JP release date,
  or per banner (JP's gacha id, which Global reuses; e.g. from the monthly release schedule image):
  `{ "dates": [{ "release_jp": "2023-02-24", "release_gl": "2026-11-26", "note": "…" }],
     "banners": [{ "id": 30137, "start": "2026-10-14T22:00:00.000Z", "end": "2026-10-23T21:59:59.000Z", "source": "…" }] }`.
  A banner entry is a known date (its JP start → its Global start; a JP day's earliest wins), and
  `banners.py` gives that predicted banner its exact dates with `confirmed: true` (the Timeline page shows it
  as "confirmed"); cards on a confirmed JP day get `confirmed: true` and no range.
  Predictions are linear between known dates and use the model's pace past the last one. Entries
  whose JP date Global has already released are ignored, so stale ones are harmless. In a backtest,
  one known date ~300 JP days out cut the median error from 4 to 1 day (max 14 → 7).
- `banners.py` — every JP banner after Global's progress, moved to its predicted Global dates
  (start 22:00 UTC; same length as in JP, which Global keeps for 88% of card banners), with the JP art
  and English names where known → `generated/predicted_global_banners.json`, same shape as
  `data/global_banners.json` plus `predicted`, `jp_start`, `jp_end`, `margin_days`; ids Global already has
  are left out. The Timeline page
  draws them on Global's calendar.
- `scenarios.py` — predicted Global launches of Career scenarios, written into `data/scenarios.json` (start dates
  `{ date, tag: 'predicted', lo, hi }`; confirmed / out dates from the news are never touched). A scenario's JP launch
  day goes through the same model and known dates as cards: Aoharu, MANT and GL each launched on Global the same day
  as the cards from their JP launch day.
- `events.py` — Global's events paired with JP's (`data/global_events.json` ↔ `data/jp_events.json`, top-level events)
  → `generated/event_pairs.json` `{ pairs: [{ gl, jp, kind, how, gl_start, jp_start, dev_days, anchor }], rejected }`:
  `post` (Global's in-game news reuses JP's post ids: Global's post 1076 is JP's 1076), `card` (a support card both
  give: story SSRs; JP's story events before mid-2022 come from GameTora's history, `source: 'gametora'`), `name`
  (cups: Taurus Cup ↔ タウラス杯; recurring specials, celebrations by anniversary / season and part, recurring
  campaigns: `NAMES`), `order` (Legend Races, Transfer Requests). A pair must fall within 10 days of where JP's card
  releases put the JP event (interpolated between Global's releases, then the model); one that doesn't is rejected
  (Global moved it) but its JP event isn't predicted. Within a kind, Global's order must be JP's. Every pair is a known
  date (`adjust.py`, after the hand entries and banners; an order pair only if no other JP event of the kind fits;
  cups compare their round 1). Then every unpaired JP event after Global's progress, with its parts, moved to its
  predicted Global start (22:00 UTC, never a JP weekend; parts and phases by the same amount) →
  `generated/predicted_global_events.json` `{ source, events }`, JP's fields + `id: 'jp-<id>'`, `predicted`,
  `confirmed` (on a known date's JP day), `jp_id`, `jp_start`, `jp_end`, `margin_days`.
- `backtest.py` — fits on the batches Global had released at each point, predicts the rest. A second table does the
  same through the event pairs Global had run by the day before each next release, as known dates (2026-10-12:
  linear(all) 3.4 → 2.9 mean median error; events run a few days ahead of Global's card releases).
- `predict.py` — best model, ranges from the backtest's 90th-percentile error per JP day from the
  nearest fixed point (last release or known date). Deploys rerun it after the banner scrape.
  The backtest only covers ~2 years of JP history ahead, so far-out ranges assume Global keeps
  its current pace.
