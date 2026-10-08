# Global release-date predictions

Predicts when JP support cards come out on Global, from JP release dates (GameTora,
`generated/gametora_cards.json`, `pnpm scrape-gametora`) and Global's (our own `data/global_cards.json`,
kept up from the official news by `pnpm update-global`). Global releases JP's cards
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
- `backtest.py` — fits on the batches Global had released at each point, predicts the rest.
- `predict.py` — best model, ranges from the backtest's 90th-percentile error per JP day from the
  nearest fixed point (last release or known date). Deploys rerun it after the banner scrape.
  The backtest only covers ~2 years of JP history ahead, so far-out ranges assume Global keeps
  its current pace.
