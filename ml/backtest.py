"""Walk-forward backtest: for each point in Global's history, fit on the batches released so far,
predict the later ones, and compare with when they actually came out.

Usage: ml/.venv/bin/python ml/backtest.py   (pnpm predict-gl:backtest)
"""

from copy import deepcopy

import numpy as np
import pandas as pd

from adjust import snap_weekday
from data import batches, load_cards
from models import candidates

MIN_TRAIN = 15
BUCKETS = [(0, 30), (30, 90), (90, 180), (180, 365), (365, 10_000)]


def known_then(anchors, jp_last, gl_last, gl_next):
    """The anchors ((jp, gl) days) known the day before Global's next release (gl_next), the last one being (jp_last,
    gl_last): Global ran them since its last release, for later JP days (as predict.py takes them); earliest per JP
    day, in order."""
    known = {}
    for j, g in anchors:
        if j > jp_last and gl_last <= g < gl_next:
            known[j] = min(g, known.get(j, np.inf))
    points = []
    for point in sorted(known.items()):
        if not points or point[1] >= points[-1][1]:
            points.append(point)
    return points


def through(model, jp, known):
    """The model's predictions through known (jp, gl) days: linear between them, the model's pace past the last."""
    if not known:
        return model.predict(jp)
    points = np.array([model.anchor, *known])
    predicted = np.interp(jp, points[:, 0], points[:, 1])
    past = jp > points[-1, 0]
    predicted[past] = points[-1, 1] + model.predict(jp[past]) - model.predict(np.array([points[-1, 0]]))[0]
    return predicted


def errors(template, b, anchors=None):
    """Signed errors (predicted − actual, days) with their JP horizon from the last training batch. With `anchors`
    ((jp, gl) days of Global events paired with JP's, events.py), predictions go through those Global had run by the
    day before the next release, as known dates."""
    jp, gl = b['jp'].to_numpy(float), b['gl'].to_numpy(float)
    rows = []
    for i in range(MIN_TRAIN, len(jp)):
        model = deepcopy(template).fit(jp[:i], gl[:i])
        known = known_then(anchors, jp[i - 1], gl[i - 1], gl[i]) if anchors else []
        predicted = snap_weekday(through(model, jp[i:], known))
        rows += [(jp[i:][j] - jp[i - 1], predicted[j] - gl[i:][j]) for j in range(len(predicted))]
    return pd.DataFrame(rows, columns=['horizon', 'error'])


def summarize(err):
    out = {}
    for lo, hi in BUCKETS:
        abs_err = err.loc[(err['horizon'] > lo) & (err['horizon'] <= hi), 'error'].abs()
        if len(abs_err):
            out[f'{lo}-{hi}'] = (abs_err.median(), abs_err.quantile(0.9), len(abs_err))
    return out


def score(summary):
    """Mean of the per-bucket medians: ranks models without letting the many short-horizon samples dominate."""
    return np.mean([median for median, _, _ in summary.values()])


def run(anchors=None):
    b = batches(load_cards())
    results = []
    for template in candidates():
        summary = summarize(errors(template, b, anchors))
        results.append((template, summary, score(summary)))
    return sorted(results, key=lambda r: r[2]), b


def table(results):
    header = ''.join(f'{f"{lo}-{hi if hi < 10_000 else "∞"} d":>18}' for lo, hi in BUCKETS)
    print(f'{"model":<20}{header}{"score":>8}')
    for model, summary, s in results:
        cells = ''.join(
            f'{"{:.1f} / {:.0f} ({})".format(*summary[f"{lo}-{hi}"]):>18}' if f'{lo}-{hi}' in summary else f'{"-":>18}'
            for lo, hi in BUCKETS
        )
        print(f'{model.name:<20}{cells}{s:>8.2f}')


if __name__ == '__main__':
    results, b = run()
    print(f'{len(b)} release batches, walk-forward from batch {MIN_TRAIN}')
    print('abs error in days: median / p90 (n) by JP horizon\n')
    table(results)
    # The same with Global's events paired with JP's as known dates (those Global had run by each point), as
    # predict.py uses them.
    from events import backtest_anchors

    anchors, pairs = backtest_anchors(b)
    print(f'\nwith event pairs as known dates ({len(anchors)} anchors of {len(pairs["pairs"])} pairs; at each point '
          'only those Global had run by the day before its next release)\n')
    table(run(anchors)[0])
