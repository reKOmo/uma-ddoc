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


def errors(template, b):
    """Signed errors (predicted − actual, days) with their JP horizon from the last training batch."""
    jp, gl = b['jp'].to_numpy(float), b['gl'].to_numpy(float)
    rows = []
    for i in range(MIN_TRAIN, len(jp)):
        model = deepcopy(template).fit(jp[:i], gl[:i])
        predicted = snap_weekday(model.predict(jp[i:]))
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


def run():
    b = batches(load_cards())
    results = []
    for template in candidates():
        summary = summarize(errors(template, b))
        results.append((template, summary, score(summary)))
    return sorted(results, key=lambda r: r[2]), b


if __name__ == '__main__':
    results, b = run()
    print(f'{len(b)} release batches, walk-forward from batch {MIN_TRAIN}')
    print('abs error in days: median / p90 (n) by JP horizon\n')
    header = ''.join(f'{f"{lo}-{hi if hi < 10_000 else "∞"} d":>18}' for lo, hi in BUCKETS)
    print(f'{"model":<20}{header}{"score":>8}')
    for model, summary, s in results:
        cells = ''.join(
            f'{"{:.1f} / {:.0f} ({})".format(*summary[f"{lo}-{hi}"]):>18}' if f'{lo}-{hi}' in summary else f'{"-":>18}'
            for lo, hi in BUCKETS
        )
        print(f'{model.name:<20}{cells}{s:>8.2f}')
