"""Loads cards and their release dates from generated/cards.json (`pnpm build-cards`): JP's from our
history of JP's cards (data/jp_cards.json: GameTora's, frozen, then the JP news' new cards), Global's from Global's own
record (data/global_cards.json, see scripts/lib/global.js).

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


def jp_banners():
    """JP's banners (data/jp_banners.json: GameTora's history + the JP news, `pnpm update-jp`) that Global could run:
    without paid scouts (`paid`, gacha ids 50000+) and our own re-run entries (string ids, "<id>-rerun")."""
    jp = json.loads((DATA / 'jp_banners.json').read_text())
    regular = lambda b: not b.get('paid') and isinstance(b['id'], int)  # noqa: E731
    # as GameTora lists them: without the R cards the news adds to its banners (`from_news` items)
    gametora = lambda b: b if b.get('from_news') else {**b, 'featured': [f for f in b['featured'] if not f.get('from_news')]}  # noqa: E731
    return {**jp, **{kind: [gametora(b) for b in jp[kind] if regular(b)] for kind in ('characters', 'cards')}}


def to_days(dates):
    return (pd.to_datetime(pd.Series(dates)).astype('datetime64[s]').astype('int64') // 86400).to_numpy()


def to_date(days):
    return (pd.Timestamp(0) + pd.Timedelta(days=round(float(days)))).date().isoformat()


def is_promo(card):
    """A promo card (GameTora's `obtained`: collabs, campaigns, real-world tie-ins): Global isn't expected to get
    promo banners or cards, so they're never predicted (one that does come is in data/ from the news)."""
    return 'promo' in (card.get('source') or [])


def promo_ids():
    """Ids of the promo cards in generated/cards.json."""
    return {int(i) for i, card in json.loads((GENERATED / 'cards.json').read_text()).items() if is_promo(card)}


def load_cards():
    """One row per JP-released card (generated/cards.json, `pnpm build-cards`): id, name, title, rarity,
    jp, gl (days; gl NaN if not on Global), status: 'released' | 'skipped' (older than Global's progress
    but never released) | 'upcoming' | 'promo' (not on Global, never predicted: is_promo())."""
    data = json.loads((GENERATED / 'cards.json').read_text())
    rows = [
        {
            'id': card_id,
            'name': card['name']['en'] or card['name']['jp'],
            'title': card['title']['en'] or card['title']['jp'],
            'rarity': card['rarity'],
            'release_jp': card['release']['jp'],
            'release_gl': card['release']['gl'],
            'promo': is_promo(card),
        }
        for card_id, card in data.items()
        if card['release']['jp']
    ]
    cards = pd.DataFrame(rows)
    cards['jp'] = to_days(cards['release_jp'])
    cards['gl'] = np.where(cards['release_gl'].notna(), to_days(cards['release_gl'].fillna('1970-01-01')), np.nan)
    caught_up_to = cards.loc[cards['gl'].notna(), 'jp'].max()
    cards['status'] = np.where(
        cards['gl'].notna(),
        'released',
        np.where(cards['promo'], 'promo', np.where(cards['jp'] <= caught_up_to, 'skipped', 'upcoming')),
    )
    return cards.sort_values(['jp', 'id']).reset_index(drop=True)


def batches(cards):
    """Released cards grouped by JP date: jp, gl (the batch's earliest Global date), sorted by jp."""
    released = cards[cards['status'] == 'released']
    return released.groupby('jp', as_index=False)['gl'].min().sort_values('jp').reset_index(drop=True)
