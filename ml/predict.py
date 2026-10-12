"""Predicts the Global release date of every JP support card that isn't on Global yet, with the
model that did best in the walk-forward backtest. Also predicts Global's future banners from JP's
(generated/predicted_global_banners.json, see banners.py), Career scenarios (into data/scenarios.json,
see scenarios.py) and events (generated/predicted_global_events.json, after pairing Global's events with JP's into
generated/event_pairs.json: see events.py; the pairs are known dates too). Writes generated/predicted_gl_releases.json:

  { model, fitted_at, anchor: { release_jp, release_gl }, global_days_per_jp_day,
    known_dates: [{ release_jp, release_gl }], backtest: { "<lo>-<hi>": [median, p90, n] },
    cards: { id: { release_jp, predicted_gl, lo, hi, confirmed } } }

`confirmed` comes only from known_dates.json: a card on a JP day its `dates` give, or on one of its confirmed `banners`.
A card on another known day (from Global's banners or paired events) has that day's Global date but isn't `confirmed`.
Predictions go through the known dates in data/known_dates.json and never fall on a Japanese
weekend (see adjust.py). lo / hi is a rough 90% range: the backtest's 90th-percentile error, scaled
with how many JP days the card is from the nearest fixed point (the last release or a known date).
The backtest only reaches ~2 years of JP history ahead, so ranges far from any fixed point are
extrapolated and optimistic.

Usage: ml/.venv/bin/python ml/predict.py   (pnpm predict-gl)
"""

import json
from copy import deepcopy
from datetime import datetime, timezone

import numpy as np

from adjust import confirmed_cards, hand_known_days, load_known_dates, snap_weekday, with_known_dates
from backtest import errors, run
from banners import BANNERS_OUTPUT, predict_banners
from events import EVENTS_OUTPUT, PAIRS_OUTPUT, anchor_points, pair_events, past_ref, predict_events, write_pairs
from events import summary as events_summary
from scenarios import SCENARIOS, predict_scenarios
from data import GENERATED, batches, load_cards, to_date

OUTPUT = GENERATED / 'predicted_gl_releases.json'


def interval_width(err, horizon):
    """Half-width of the range: the p90 error for short horizons, p90 error-per-JP-day beyond that."""
    short = err.loc[err['horizon'] <= 30, 'error'].abs().quantile(0.9)
    longer = err[err['horizon'] > 30]
    per_day = (longer['error'].abs() / longer['horizon']).quantile(0.9)
    return np.maximum(short, per_day * horizon)


def main():
    cards = load_cards()
    (best, summary, _), *_ = run()[0]
    b = batches(cards)
    model = deepcopy(best).fit(b['jp'].to_numpy(float), b['gl'].to_numpy(float))

    err = errors(best, b)

    def predictor(known):
        def predict(jp):
            """JP days (sorted) → (Global days, not snapped to a weekday; ± range in days)."""
            predicted, distance = with_known_dates(jp, model, known)
            # Global keeps JP's order: never before the last Global release or an earlier JP card.
            return np.maximum.accumulate(np.maximum(predicted, model.anchor[1])), interval_width(err, distance)
        return predict

    # Global's events paired with JP's (events.py): where JP's card releases put a JP event (between Global's
    # releases, then the model through the known dates so far) is what a pair must fit. The pairs are known dates too.
    past, future = past_ref(b), predictor(load_known_dates(model.anchor[0]))

    def ref(jp):
        order = np.argsort(jp)
        ahead = np.empty(len(jp))
        ahead[order] = future(jp[order])[0]
        return np.where(jp <= model.anchor[0], past(jp), ahead)

    pairs = pair_events(ref)
    write_pairs(pairs)
    # (only ahead of Global's last release: Global sometimes runs an event a few days before the cards of earlier JP days)
    anchors = [(jp, gl) for jp, gl in anchor_points(pairs) if gl >= model.anchor[1]]
    known = load_known_dates(model.anchor[0], events=anchors)
    predict = predictor(known)

    known_jp = {jp for jp, _ in known}
    # confirmed: only from known_dates.json: a JP day its `dates` give, or a card on one of its `banners`
    confirmed_days, confirmed_ids = hand_known_days(), confirmed_cards()
    upcoming = cards[cards['status'] == 'upcoming'].copy()
    predicted, width = predict(upcoming['jp'].to_numpy(float))
    width = np.where(upcoming['jp'].isin(known_jp), 0, width)  # on a known date: no range
    predicted = snap_weekday(predicted)
    upcoming['predicted_gl'], upcoming['lo'], upcoming['hi'] = predicted, predicted - width, predicted + width

    result = {
        'model': model.name,
        'fitted_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'anchor': {'release_jp': to_date(model.anchor[0]), 'release_gl': to_date(model.anchor[1])},
        'global_days_per_jp_day': round(float(model.slope), 4),
        'known_dates': [{'release_jp': to_date(jp), 'release_gl': to_date(gl)} for jp, gl in known],
        'backtest': {k: [round(m, 1), round(p, 1), int(n)] for k, (m, p, n) in summary.items()},
        'cards': {
            row.id: {
                'release_jp': row.release_jp,
                'predicted_gl': to_date(row.predicted_gl),
                'lo': to_date(row.lo),
                'hi': to_date(row.hi),
                'confirmed': row.jp in confirmed_days or int(row.id) in confirmed_ids,
            }
            for row in upcoming.itertuples()
        },
    }
    OUTPUT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')
    banners = predict_banners(predict, model.anchor[0], result['fitted_at'])
    scenarios = predict_scenarios(predict)
    events = predict_events(predict, model.anchor[0], known, pairs, result['fitted_at'])

    skipped = cards[cards['status'] == 'skipped']
    print(f'model: {model.name}, {model.slope:.3f} Global days per JP day, anchored at '
          f'JP {result["anchor"]["release_jp"]} → Global {result["anchor"]["release_gl"]}')
    for date in result['known_dates']:
        print(f'known date: JP {date["release_jp"]} → Global {date["release_gl"]}')
    print(f'skipped by Global (left out): {", ".join(skipped["id"])}\n')
    print(f'{"id":<7}{"name":<26}{"title":<34}{"JP":<12}{"Global (predicted)":<20}range')
    for row in upcoming.itertuples():
        card = result['cards'][row.id]
        print(f'{row.id:<7}{row.name[:25]:<26}{(row.title or "")[:33]:<34}{row.release_jp:<12}'
              f'{card["predicted_gl"]:<20}{card["lo"]} – {card["hi"]}')
    print(f'\n{len(upcoming)} cards → {OUTPUT.relative_to(GENERATED.parent)}')
    print(f'{len(banners["characters"])} character + {len(banners["cards"])} card banners → '
          f'{BANNERS_OUTPUT.relative_to(GENERATED.parent)}')
    print(f'\n{"scenario":<11}{"JP launch":<12}{"Global (predicted)":<20}range')
    for s in scenarios:
        en = s['en_start_date']
        print(f'{s["key"]:<11}{s["jp_start_date"]["date"][:10]:<12}{en["date"][:10]:<20}{en["lo"]} – {en["hi"]}')
    print(f'{len(scenarios)} scenario launches → {SCENARIOS.relative_to(GENERATED.parent)}')
    print(f'\n{events_summary(pairs, events)}')
    print(f'→ {PAIRS_OUTPUT.relative_to(GENERATED.parent)}, {EVENTS_OUTPUT.relative_to(GENERATED.parent)}')


if __name__ == '__main__':
    main()
