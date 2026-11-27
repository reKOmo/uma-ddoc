"""Predicted Global launches of Career scenarios, written into data/scenarios.json (the format is
scripts/lib/scenarios.ts': one scenario per line, start dates as { date, status }).

Global releases JP's scenarios in JP's order, each with a celebration banner that reruns JP's launch
banner, so a scenario's Global launch is predicted like a card release: its JP launch day through the
same model and known dates (predict.py's `predict`), at 22:00 UTC, never on a Japanese weekend, and
after Global's latest known launch. Only scenarios without a Global date from the news are written (`confirmed`
when known_dates.json's `dates` give their JP day, like cards, or an entry's `only` names their key; else `predicted`); news dates are never touched.
"""

import json

import numpy as np

from adjust import confirmed_only, hand_known_days, snap_weekday
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

    ours = ('predicted', 'confirmed')  # written here, so redone each run; the rest come from the news
    known_days = [np.floor(epoch_days(s['en_start_date']['date'])) for s in scenarios
                  if s['en_start_date'] and s['en_start_date']['status'] not in ours]
    floor = max(known_days, default=-np.inf) + 1  # after Global's latest known launch
    todo = [s for s in scenarios
            if s['jp_start_date'] and (not s['en_start_date'] or s['en_start_date']['status'] in ours)]
    if todo:
        jp_days = np.array([jst_day(s['jp_start_date']['date']) for s in todo])
        days, width = predict(jp_days)
        days = np.maximum(snap_weekday(np.maximum(days, floor)), floor)
        days_known, keys = hand_known_days(), confirmed_only('scenarios')
        for s, jp, day, w in zip(todo, jp_days, days, np.broadcast_to(width, days.shape)):
            start = iso_at(day, GLOBAL_START_HOUR)
            s['en_start_date'] = (dated(start, 'confirmed') if float(jp) in days_known or s['key'] in keys
                                  else dated(start, 'predicted', lo=to_date(day - w), hi=to_date(day + w)))
    write(file)
    return todo
