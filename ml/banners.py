"""Predicted Global banners: every JP banner that started after the last JP date Global has caught
up to, moved to its predicted Global dates. Written as generated/predicted_global_banners.json in
the same shape as data/global_banners.json, so the Banners page can draw them alongside:

  { source: { predicted_from, fitted_at }, characters: [banner…], cards: [banner…] }

Each banner is the JP one (its JP graphic, featured items) with Global start / end, plus
  predicted: true, jp_start, jp_end, margin_days (± range of the start, from the backtest).
Banners Global already has (data/global_banners.json, ours: seeded from GameTora, kept up from the
official news) are left out, whatever their dates. Banners with confirmed dates (data/known_dates.json
`banners`) take them: start, end, confirmed: true, confirmed_source, margin_days 0.
Names and titles are swapped for English ones where we have them (Global banners, our card
metadata, Global's card titles, GameTora's card URLs and titles); the rest stay Japanese.
"""

import json

import numpy as np
import pandas as pd

from adjust import confirmed_banners, snap_weekday
from data import DATA, GENERATED, load_card_info, slug_name

BANNERS_OUTPUT = GENERATED / 'predicted_global_banners.json'
GLOBAL_START_HOUR = 22  # UTC; 07:00 JST the next day
DAY_MS = 86_400_000


def epoch_days(iso):
    return pd.Timestamp(iso).value / 1e9 / 86400  # .value is ns since the epoch, whatever the unit


def iso_at(day, hour, minus_ms=0):
    ts = pd.Timestamp(int(day) * DAY_MS + hour * 3_600_000 - minus_ms, unit='ms', tz='UTC')
    return ts.strftime('%Y-%m-%dT%H:%M:%S.') + f'{ts.microsecond // 1000:03d}Z'


def english_names():
    """char_id → English name (from Global's banners and our card metadata), card id → English title."""
    read = lambda name: json.loads((GENERATED / name).read_text())  # noqa: E731
    glob, jp, metadata, gametora = (
        json.loads((DATA / 'global_banners.json').read_text()),
        read('jp_banners.json'),
        read('metadata.json'),
        load_card_info(),
    )
    chars = {}
    for banner in jp['cards']:
        for item in banner['featured']:
            card = str(item['id'])
            url = gametora.get(card, {}).get('url')
            name = metadata.get(card, {}).get('name_en') or (url and slug_name(url))
            if name and not metadata.get(card, {}).get('name_en') and item['char_id'] in chars:
                continue  # keep a real name over one guessed from a URL
            if name:
                chars[item['char_id']] = name
    for banner in glob['characters'] + glob['cards']:
        for item in banner['featured']:
            chars[item['char_id']] = item['name']
    titles = {int(card_id): card['title_en'] for card_id, card in gametora.items() if card.get('title_en')}
    return jp, chars, titles


def translate(item, chars, titles, is_card):
    if not item:
        return item
    out = {**item, 'name': chars.get(item.get('char_id'), item.get('name'))}
    if is_card and item['id'] in titles:
        out['title'] = titles[item['id']]
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
    result = {'source': {'predicted_from': 'jp_banners.json', 'fitted_at': fitted_at}}
    for kind in ['characters', 'cards']:
        todo = sorted(
            (
                b
                for b in jp[kind]
                if b['id'] not in on_global and (b['id'] in confirmed or np.floor(epoch_days(b['start'])) > anchor_jp)
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
                **banner,
                'main': translate(banner.get('main'), chars, titles, kind == 'cards'),
                'featured': [translate(item, chars, titles, kind == 'cards') for item in banner['featured']],
                'start': iso_at(start, GLOBAL_START_HOUR),
                'end': iso_at(end, GLOBAL_START_HOUR, minus_ms=1000),
                'predicted': True,
                'jp_start': banner['start'],
                'jp_end': banner['end'],
                'margin_days': round(float(m)),
                **confirmation(confirmed.get(banner['id'])),
            }
            for banner, start, end, m in zip(todo, starts, ends, margin)
        ]
    BANNERS_OUTPUT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')
    return result
