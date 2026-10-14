"""Predicted Global banners: every JP banner that started after the last JP date Global has caught
up to, moved to its predicted Global dates. Written as generated/predicted_global_banners.json in
the same shape as data/global_banners.json, so the Banners page can draw them alongside:

  { source: { predicted_from, fitted_at }, characters: [banner…], cards: [banner…] }

Each banner is the JP one (featured items; no art URL: the app shows JP's GameTora art, built from the id, or the
JP's official art as `news_image` when the JP news showed it) with Global start / end, plus
  predicted: true, jp_start, jp_end, margin_days (± range of the start, from the backtest), news_url (JP's post, when
  the JP news showed it).
Banners Global already has (data/global_banners.json, ours: seeded from GameTora, kept up from the
official news) are left out, whatever their dates. Banners with confirmed dates (data/known_dates.json
`banners`) take them: start, end, confirmed: true, confirmed_source, margin_days 0.
Names and titles are swapped for English ones where we have them (Global banners, our cards in
generated/cards.json); the rest stay Japanese.
"""

import json

import numpy as np
import pandas as pd

from adjust import confirmed_banners, snap_weekday
from data import DATA, GENERATED, jp_banners, promo_ids

BANNERS_OUTPUT = GENERATED / 'predicted_global_banners.json'
GLOBAL_START_HOUR = 22  # UTC; 07:00 JST the next day
DAY_MS = 86_400_000


def epoch_days(iso):
    return pd.Timestamp(iso).value / 1e9 / 86400  # .value is ns since the epoch, whatever the unit


def iso_at(day, hour, minus_ms=0):
    ts = pd.Timestamp(int(day) * DAY_MS + hour * 3_600_000 - minus_ms, unit='ms', tz='UTC')
    return ts.strftime('%Y-%m-%dT%H:%M:%S.') + f'{ts.microsecond // 1000:03d}Z'


def english_names():
    """JP's banners, char_id → English name (our cards' then Global's banners'), card id → English
    name and title (for support cards; a group card's name is the group's)."""
    read = lambda name: json.loads((GENERATED / name).read_text())  # noqa: E731
    glob, jp, cards = json.loads((DATA / 'global_banners.json').read_text()), jp_banners(), read('cards.json')
    # Group cards are named after the group, not their character.
    chars = {c['charId']: c['name']['en'] for c in cards.values() if c['charId'] and c['name']['en'] and c['type'] != 'group'}
    for banner in glob['characters'] + glob['cards']:
        for item in banner['featured']:
            chars[item['char_id']] = item['name']
    titles = {c['id']: (c['name']['en'], c['title']['en']) for c in cards.values()}
    return jp, chars, titles


def translate(item, chars, titles, is_card):
    if not item:
        return item
    out = {**item, 'name': chars.get(item.get('char_id'), item.get('name'))}
    if is_card and item['id'] in titles:
        name, title = titles[item['id']]
        out['name'] = name or out['name']
        out['title'] = title or out['title']
    return out


# What the JP news adds to a JP banner (data/jp_banners.json): not Global's.
JP_NEWS_KEYS = ('announced', 'news_url', 'news_image', 'from_news', 'rerun', 'rerunOf', 'paid', 'name', 'note')


def jp_banner(banner):
    """The JP banner without what the JP news added, but its official art (`news_image`, or a news-made banner's
    `image`): the Timeline shows it over GameTora's, which the app builds from the id."""
    out = {k: v for k, v in banner.items() if k not in JP_NEWS_KEYS}
    if art := banner.get('news_image') or banner.get('image'):
        out['news_image'] = art
    return out


def confirmation(known):
    """Fields that replace the prediction for a banner whose Global dates are confirmed."""
    if not known:
        return {}
    iso = lambda t: pd.Timestamp(t).strftime('%Y-%m-%dT%H:%M:%S.000Z')  # noqa: E731
    return {
        'start': iso(known['start']),
        'end': iso(known['end']),
        'confirmed': True,
        'confirmed_source': known.get('source'),
        'margin_days': 0,
    }


def predict_banners(predict, anchor_jp, fitted_at):
    """predict: JP days (sorted) → (Global days, ± days); anchor_jp: last JP day Global has released."""
    jp, chars, titles = english_names()
    glob = json.loads((DATA / 'global_banners.json').read_text())
    on_global = {b['id'] for b in glob['characters'] + glob['cards']}
    confirmed = confirmed_banners()
    # Global doesn't get promo cards: they're left out of a banner, and a banner of nothing else isn't predicted.
    promo = promo_ids()
    only_promo = lambda b: bool(b['featured']) and all(f['id'] in promo for f in b['featured'])  # noqa: E731
    result = {'source': {'predicted_from': 'jp_banners.json', 'fitted_at': fitted_at}}
    for kind in ['characters', 'cards']:
        todo = sorted(
            (
                b
                for b in jp[kind]
                if b['id'] not in on_global
                and not only_promo(b)
                and (b['id'] in confirmed or np.floor(epoch_days(b['start'])) > anchor_jp)
            ),
            key=lambda b: b['start'],
        )
        if not todo:
            result[kind] = []
            continue
        starts, margin = predict(np.floor([epoch_days(b['start']) for b in todo]))
        starts = snap_weekday(starts)
        # Global keeps JP's banner lengths (88% of card banners to the day): only the starts move.
        lengths = np.round([epoch_days(b['end']) - epoch_days(b['start']) for b in todo])
        ends = starts + np.maximum(lengths, 1)
        result[kind] = [
            {
                **jp_banner(banner),
                'main': translate(banner.get('main'), chars, titles, kind == 'cards'),
                'featured': [
                    translate(item, chars, titles, kind == 'cards') for item in banner['featured'] if item['id'] not in promo
                ],
                'start': iso_at(start, GLOBAL_START_HOUR),
                'end': iso_at(end, GLOBAL_START_HOUR, minus_ms=1000),
                'predicted': True,
                # JP's post about it (the Timeline links it, as it does a predicted event's).
                **({'news_url': banner['news_url']} if banner.get('news_url') else {}),
                'jp_start': banner['start'],
                'jp_end': banner['end'],
                'margin_days': round(float(m)),
                **confirmation(confirmed.get(banner['id'])),
            }
            for banner, start, end, m in zip(todo, starts, ends, margin)
        ]
    BANNERS_OUTPUT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')
    return result
