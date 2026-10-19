"""Predicted Global launches of Career scenarios, written into data/scenarios.json (the format is
scripts/lib/scenarios.ts': one scenario per line, start dates as { date, status }).

Global releases JP's scenarios in JP's order, each with a celebration banner that reruns JP's launch
banner, so a scenario's Global launch is predicted like a card release: its JP launch day through the
same model and known dates (predict.py's `predict`), at 22:00 UTC, never on a Japanese weekend, and
after Global's latest known launch. Only scenarios without a known Global date (none, or an older
prediction) are written; known dates (from the news) are never touched.
"""

import json

import numpy as np

from adjust import snap_weekday
from banners import GLOBAL_START_HOUR, epoch_days, iso_at
from data import DATA, dated, to_date

SCENARIOS = DATA / 'scenarios.json'


def jst_day(iso):
    """The JP launch's day as JP counts it (JST), like cards' release_jp."""
    return np.floor(epoch_days(iso) + 9 / 24)


def write(file):
    lines = ',\n'.join(json.dumps(s, ensure_ascii=False, separators=(',', ':')) for s in file['scenarios'])
    source = json.dumps(file['source'], ensure_ascii=False, separators=(',', ':'))
    SCENARIOS.write_text(f'{{\n"source": {source},\n"scenarios": [\n{lines}\n]\n}}\n')


def predict_scenarios(predict):
    """predict: JP days (sorted) → (Global days, ± days). Returns the scenarios it predicted."""
    if not SCENARIOS.exists():
        return []
    file = json.loads(SCENARIOS.read_text())
    scenarios = file['scenarios']

    known_days = [np.floor(epoch_days(s['en_start_date']['date'])) for s in scenarios
                  if s['en_start_date'] and s['en_start_date']['status'] != 'predicted']
    floor = max(known_days, default=-np.inf) + 1  # after Global's latest known launch
    todo = [s for s in scenarios
            if s['jp_start_date'] and (not s['en_start_date'] or s['en_start_date']['status'] == 'predicted')]
    if todo:
        days, width = predict(np.array([jst_day(s['jp_start_date']['date']) for s in todo]))
        days = np.maximum(snap_weekday(np.maximum(days, floor)), floor)
        for s, day, w in zip(todo, days, np.broadcast_to(width, days.shape)):
            s['en_start_date'] = dated(iso_at(day, GLOBAL_START_HOUR), 'predicted', lo=to_date(day - w), hi=to_date(day + w))
    write(file)
    return todo
