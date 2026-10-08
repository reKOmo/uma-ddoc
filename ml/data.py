"""Loads release dates and our card metadata: JP's from GameTora (generated/gametora_cards.json),
Global's from Global's own record (data/global_cards.json, see scripts/lib/global.js).

Global releases JP's support cards in JP's order, so the unit of prediction is a
"batch": every card released in JP on the same day. Dates are days since the epoch.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / 'generated'
DATA = ROOT / 'data'


def to_days(dates):
    return (pd.to_datetime(pd.Series(dates)).astype('datetime64[s]').astype('int64') // 86400).to_numpy()


def to_date(days):
    return (pd.Timestamp(0) + pd.Timedelta(days=round(float(days)))).date().isoformat()


def slug_name(url):
    """'…/supports/30126-yamanin-zephyr' → 'Yamanin Zephyr' (for cards newer than our metadata)."""
    return url.rsplit('/', 1)[-1].split('-', 1)[-1].replace('-', ' ').title()


def load_card_info():
    """card id → { url, title_en, title_jp, release_gl, release_jp }, merged like src/cardInfo.js:
    Global's title and date from data/global_cards.json (GameTora's English title only for cards
    not on Global yet), the rest from GameTora."""
    gametora = json.loads((GENERATED / 'gametora_cards.json').read_text())
    global_cards = json.loads((DATA / 'global_cards.json').read_text())
    info = {}
    for card_id in {*gametora, *global_cards}:
        gt, gl = gametora.get(card_id, {}), global_cards.get(card_id)
        info[card_id] = {
            'url': gt.get('url'),
            'title_en': (gl or {}).get('title_en') or gt.get('title_en'),
            'title_jp': gt.get('title_jp'),
            'release_gl': (gl or {}).get('release_gl'),
            'release_jp': gt.get('release_jp'),
        }
    return info


def load_cards():
    """One row per JP-released card: id, name, rarity, type, jp, gl (days; gl NaN if not on Global),
    status: 'released' | 'skipped' (older than Global's progress but never released) | 'upcoming'."""
    info = load_card_info()
    metadata = json.loads((GENERATED / 'metadata.json').read_text())
    rows = [
        {
            'id': card_id,
            'name': metadata.get(card_id, {}).get('name_en') or slug_name(card['url']),
            'title': card.get('title_en') or card.get('title_jp'),
            'rarity': metadata.get(card_id, {}).get('rarity'),
            'release_jp': card['release_jp'],
            'release_gl': card['release_gl'],
        }
        for card_id, card in info.items()
        if card.get('release_jp')
    ]
    cards = pd.DataFrame(rows)
    cards['jp'] = to_days(cards['release_jp'])
    cards['gl'] = np.where(cards['release_gl'].notna(), to_days(cards['release_gl'].fillna('1970-01-01')), np.nan)
    caught_up_to = cards.loc[cards['gl'].notna(), 'jp'].max()
    cards['status'] = np.where(cards['gl'].notna(), 'released', np.where(cards['jp'] <= caught_up_to, 'skipped', 'upcoming'))
    return cards.sort_values(['jp', 'id']).reset_index(drop=True)


def batches(cards):
    """Released cards grouped by JP date: jp, gl (the batch's earliest Global date), sorted by jp."""
    released = cards[cards['status'] == 'released']
    return released.groupby('jp', as_index=False)['gl'].min().sort_values('jp').reset_index(drop=True)
