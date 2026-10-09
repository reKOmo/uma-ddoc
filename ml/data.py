"""Loads cards and their release dates from generated/cards.json (`pnpm build-cards`): JP's from
GameTora, Global's from Global's own record (data/global_cards.json, see scripts/lib/global.js).

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


def load_cards():
    """One row per JP-released card (generated/cards.json, `pnpm build-cards`): id, name, title, rarity,
    jp, gl (days; gl NaN if not on Global), status: 'released' | 'skipped' (older than Global's progress
    but never released) | 'upcoming'."""
    data = json.loads((GENERATED / 'cards.json').read_text())
    rows = [
        {
            'id': card_id,
            'name': card['name']['en'] or card['name']['jp'],
            'title': card['title']['en'] or card['title']['jp'],
            'rarity': card['rarity'],
            'release_jp': card['release']['jp'],
            'release_gl': card['release']['gl'],
        }
        for card_id, card in data.items()
        if card['release']['jp']
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
