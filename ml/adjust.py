"""Adjustments applied on top of a model's prediction:

- known dates: Global release dates we already know for a JP date: entered by hand in
  data/known_dates.json (`dates`: JP date → Global date; `banners`: confirmed Global dates of a JP banner
  id, e.g. from the official release schedule images), and every Global banner in data/global_banners.json (ours, kept up from the
  official news) that reruns a JP banner newer than Global's card releases have reached: its JP start →
  its Global start (Global reruns JP's banners under JP's ids). Predictions are interpolated between
  them and extrapolated past the last one. Also every Global event paired with a JP one (events.py): its JP start
  day (JST) → its Global start day (UTC), for JP days the others don't give.
- weekdays: Global banners start at 22:00 UTC, i.e. 07:00 JST the next day, and never on a Japanese
  weekend, so a predicted UTC date is never a Friday or Saturday.
"""

import json

import numpy as np
import pandas as pd

from data import DATA, jp_banners, to_date, to_days

KNOWN_DATES = DATA / 'known_dates.json'


def snap_weekday(days):
    """Rounds to whole days and moves a UTC Friday back to Thursday, a Saturday on to Sunday."""
    days = np.round(days)
    weekday = (days.astype(int) + 3) % 7  # 0 = Monday (day 0, 1970-01-01, was a Thursday)
    return np.where(weekday == 4, days - 1, np.where(weekday == 5, days + 1, days))


def in_order(points):
    return all(b[1] >= a[1] for a, b in zip(points, points[1:]))


def known_file():
    return json.loads(KNOWN_DATES.read_text()) if KNOWN_DATES.exists() else {}


def confirmed_banners():
    """Banner id → { id, start, end, source } from known_dates.json's `banners`: Global dates of JP
    banners confirmed ahead of time (Global reruns JP's banners under JP's ids)."""
    return {b['id']: b for b in known_file().get('banners', [])}


def hand_known_days():
    """The JP days whose Global day someone announced for everything on it: known_dates.json's `dates`. With
    confirmed_cards(), the only things that make a prediction `confirmed` (a date known from Global's banners or paired
    events, or a confirmed banner's day, says nothing about another card or event of that JP day)."""
    entries = known_file().get('dates', [])
    return {float(d) for d in to_days([e['release_jp'] for e in entries])} if entries else set()


def confirmed_cards():
    """Ids of the cards on known_dates.json's confirmed `banners` (the release schedule names them)."""
    ids = set(confirmed_banners())
    jp = jp_banners()
    return {f['id'] for b in jp['characters'] + jp['cards'] if b['id'] in ids for f in b['featured'] if f.get('id')}


def banner_dates(banners):
    """(jp, gl) days of Global banners ({ id, start }) with a JP one of the same id: the JP start's date
    in JST (cards' release_jp) → the Global start's date in UTC (cards' release_gl; Global banners start
    at 22:00 UTC)."""
    jp = jp_banners()
    jp_start = {b['id']: b['start'] for b in jp['characters'] + jp['cards']}
    pairs = [(jp_start[b['id']], b['start']) for b in banners if b['id'] in jp_start]
    if not pairs:
        return []
    jst = [(pd.Timestamp(j) + pd.Timedelta(hours=9)).date().isoformat() for j, _ in pairs]
    return list(zip(to_days(jst), to_days([g[:10] for _, g in pairs])))


def earliest(points, after_jp, skip=()):
    """{ jp: earliest gl } over (jp, gl) points later than after_jp (a JP day's banners can start on
    different Global days; its cards come with the first)."""
    result = {}
    for jp, gl in points:
        if jp > after_jp and float(jp) not in skip:
            result[float(jp)] = min(float(gl), result.get(float(jp), np.inf))
    return result


def load_known_dates(after_jp, events=()):
    """Known (jp, gl) days for JP dates later than after_jp (earlier ones are already in the data):
    known_dates.json's (`dates`, then `banners`), plus Global banners' (data/) for other JP dates, then `events`:
    (jp, gl) days of Global events paired with JP's (events.py's anchors) for JP dates none of those has. A data/
    banner's or an event's date out of order with the rest is left out with a warning (Global rarely reorders
    banners); a hand-entered one out of order is an error."""
    entries = known_file().get('dates', [])
    known = sorted(zip(to_days([e['release_jp'] for e in entries]), to_days([e['release_gl'] for e in entries])))
    known = {float(jp): float(gl) for jp, gl in known if jp > after_jp}
    known.update(earliest(banner_dates(list(confirmed_banners().values())), after_jp, skip=known))
    known = sorted(known.items())
    if not in_order(known):
        raise ValueError(f'{KNOWN_DATES.name}: Global dates must be in the same order as the JP dates')
    by_hand = {jp for jp, _ in known}
    glob = json.loads((DATA / 'global_banners.json').read_text())
    from_banners = {}
    for jp, gl in banner_dates(glob['characters'] + glob['cards']):
        if jp > after_jp and jp not in by_hand:
            from_banners[float(jp)] = min(float(gl), from_banners.get(float(jp), np.inf))
    known = merge_in_order(known, from_banners, 'Global banner')
    taken = {jp for jp, _ in known}
    return merge_in_order(known, earliest(events, after_jp, skip=taken), 'Global event')


def merge_in_order(known, points, what):
    """known + points ({ jp: gl }), leaving out (with a warning) each point out of order with the rest."""
    for point in sorted(points.items()):
        merged = sorted([*known, point])
        if in_order(merged):
            known = merged
        else:
            print(f'warning: {what} date JP {to_date(point[0])} → Global {to_date(point[1])} is out of '
                  'order with the other known dates; left out')
    return known


def with_known_dates(jp, model, known):
    """Predicted Global days, through the model's anchor and every known date: linear between
    them, the model's slope past the last one. Also returns each JP day's distance to the nearest
    fixed point (for the error range)."""
    if not known:
        return model.predict(jp), jp - model.anchor[0]
    points = np.array([model.anchor, *known])
    predicted = np.interp(jp, points[:, 0], points[:, 1])
    past = jp > points[-1, 0]
    predicted[past] = points[-1, 1] + model.slope * (jp[past] - points[-1, 0])
    distance = np.abs(jp[:, None] - points[None, :, 0]).min(axis=1)
    return predicted, distance
