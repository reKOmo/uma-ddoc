"""Candidate models. Each is fit on released batches (jp, gl days, sorted by jp) and predicts
Global days for later JP days. All of them extrapolate from the last known batch (the anchor),
so a prediction is "last Global release + predicted Global gap"."""

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import HuberRegressor


class AnchoredLinear:
    """Global gap = slope × JP gap, slope by least squares over the last k batches."""

    def __init__(self, k=None):
        self.k = k
        self.name = f'linear(last {k})' if k else 'linear(all)'

    def fit(self, jp, gl):
        jp, gl = jp[-self.k :] if self.k else jp, gl[-self.k :] if self.k else gl
        self.slope = np.polyfit(jp, gl, 1)[0]
        self.anchor = (jp[-1], gl[-1])
        return self

    def predict(self, jp):
        return self.anchor[1] + self.slope * (jp - self.anchor[0])


class WeightedLinear(AnchoredLinear):
    """Like AnchoredLinear over all batches, but older ones count less: a batch's weight halves for
    every half_life Global days between it and the latest release."""

    def __init__(self, half_life=180):
        self.half_life = half_life
        self.name = f'weighted(½ {half_life} d)'

    def fit(self, jp, gl):
        weights = 0.5 ** ((gl[-1] - gl) / self.half_life)
        self.slope = np.polyfit(jp, gl, 1, w=np.sqrt(weights))[0]
        self.anchor = (jp[-1], gl[-1])
        return self


class AnchoredHuber(AnchoredLinear):
    """Like AnchoredLinear, but the slope comes from a Huber fit (ignores the odd outlier batch)."""

    def __init__(self, k=None):
        super().__init__(k)
        self.name = f'huber(last {k})' if k else 'huber(all)'

    def fit(self, jp, gl):
        x, y = (jp[-self.k :], gl[-self.k :]) if self.k else (jp, gl)
        model = HuberRegressor().fit((x - x.mean()).reshape(-1, 1) / 100, y - y.mean())
        self.slope = model.coef_[0] / 100
        self.anchor = (jp[-1], gl[-1])
        return self


class AnchoredQuadratic(AnchoredLinear):
    """Slope that keeps changing at the rate it did over the last k batches (Global speeding up)."""

    def __init__(self, k=40):
        super().__init__(k)
        self.name = f'quadratic(last {k})'

    def fit(self, jp, gl):
        x, y = jp[-self.k :] - jp[-1], gl[-self.k :]
        a, b, _ = np.polyfit(x, y, 2)
        self.curve, self.slope = a, b
        self.anchor = (jp[-1], gl[-1])
        return self

    def predict(self, jp):
        x = jp - self.anchor[0]
        return self.anchor[1] + self.slope * x + self.curve * x**2


class GapBoosting:
    """Gradient boosting on consecutive gaps: predicts each Global gap from the JP gap, the JP
    month and the recent Global/JP ratio, then chains the gaps forward from the anchor."""

    name = 'gap boosting'

    def __init__(self, window=10):
        self.window = window

    def _ratio(self, jp, gl):
        span = slice(-self.window - 1, None)
        return (gl[span][-1] - gl[span][0]) / (jp[span][-1] - jp[span][0])

    @staticmethod
    def _features(jp_gap, jp_day, ratio):
        month = ((jp_day / 30.4375) % 12).astype(float)
        return np.column_stack([jp_gap, np.sin(month / 12 * 2 * np.pi), np.cos(month / 12 * 2 * np.pi), ratio])

    def fit(self, jp, gl):
        start = self.window + 1
        ratios = np.array([self._ratio(jp[:i], gl[:i]) for i in range(start, len(jp))])
        jp_gap, gl_gap = np.diff(jp)[start - 1 :], np.diff(gl)[start - 1 :]
        self.model = GradientBoostingRegressor(n_estimators=150, max_depth=2, learning_rate=0.05, loss='huber', random_state=0)
        self.model.fit(self._features(jp_gap, jp[start:], ratios), gl_gap / np.maximum(jp_gap, 1))
        self.ratio = self._ratio(jp, gl)
        self.anchor = (jp[-1], gl[-1])
        return self

    def predict(self, jp):
        days = np.unique(jp)
        gaps = np.diff(np.concatenate([[self.anchor[0]], days]))
        rate = self.model.predict(self._features(gaps, days, np.full(len(days), self.ratio)))
        gl = self.anchor[1] + np.cumsum(np.maximum(rate, 0) * gaps)
        return gl[np.searchsorted(days, jp)]


def candidates():
    return [
        AnchoredLinear(10),
        AnchoredLinear(20),
        AnchoredLinear(),
        WeightedLinear(60),
        WeightedLinear(120),
        WeightedLinear(240),
        WeightedLinear(480),
        AnchoredHuber(20),
        AnchoredHuber(),
        AnchoredQuadratic(40),
        GapBoosting(),
    ]
