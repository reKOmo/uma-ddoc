---
name: known-dates
description: Update data/known_dates.json from Global's official release schedule image (the monthly "Release Schedule" post on the game's socials), so the Timeline shows upcoming banners and events at their confirmed dates. Use when the user shares a release schedule image or asks to update the known / confirmed dates.
---

# Known dates from a release schedule image

Global posts a monthly release schedule image: one row per banner or event, with its UTC period. This turns it into
`data/known_dates.json` entries (format and meaning: `ml/README.md`, `ml/adjust.py`; docs/data/predictions.md).

## 1. Get the image

If the user hasn't attached one, ask for it (the image itself, not a link) and stop until they do. Read every row:
its title ("New Trainee!", "Spotlight Support Card Scout!", "Champions Meeting Capricorn Cup", "Race the legends
now!", a story event's name, "New Beginnings Part 1"…), what the art shows (trainees, card art), and its period.
Times are UTC: "10:00 p.m., Oct 20 – 9:59 p.m., Nov 1" → start `2026-10-20T22:00:00.000Z`, end
`2026-11-01T21:59:59.000Z` (the year from the image's title). "Begins …" rows have only a start.

## 2. Leave out what the news already has

Rows already live or announced are in `data/global_banners.json` / `data/global_events.json` (from the official news;
`update-global` also drops `banners` entries the news has). Only rows still to come go in. Refresh first so the
predictions match the stored news: `pnpm predict-gl`.

## 3. Match each row to JP's banner or event

List what's predicted around the image's dates (widen the window to the month shown):

```sh
python3 - <<'EOF'
import json, datetime
jst = lambda iso: (datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')) + datetime.timedelta(hours=9)).date()
b = json.load(open('generated/predicted_global_banners.json'))
for kind in ('characters', 'cards'):
    for x in b[kind]:
        if '2026-10-01' <= x['start'] < '2026-11-15':
            print('BANNER', kind, x['id'], x['start'][:16], x['end'][:16], 'jp day', jst(x['jp_start']),
                  [f"{i['name']} {i.get('title') or ''}" for i in x['featured']])
e = json.load(open('generated/predicted_global_events.json'))
for x in e['events']:
    if '2026-10-01' <= x['start'] < '2026-11-15' and not x.get('parent'):
        print('EVENT', x['id'], x['kind'], x['name'], x['start'][:16], (x['end'] or '')[:16], 'jp day', jst(x['jp_start']))
EOF
```

- **Banners** by kind (trainee / support card), the featured trainees or cards the art shows, and order. A match is
  usually within a few days of its predicted start.
- **Events** by kind and name: story events by name (JP's Japanese title; the image's English one), Champions
  Meetings by cup (Capricorn Cup ↔ カプリコーン杯), "Race the legends" ↔ legend_race, multi-part celebrations by
  part ("New Beginnings Part 1/2" ↔ ゆく年くる年キャンペーン第1弾/第2弾).

If a row matches nothing, or two things equally, say so in the report; don't guess.

## 4. Write the entries

- **`banners`**: one per banner row: `{ "id": <JP gacha id>, "start", "end", "source" }`. The id is JP's (Global
  reuses it). A banner entry confirms that banner and the cards on it.
- **`dates`**: one per JP day with an event on the image: `{ "release_jp": <the JP start's day in JST>,
  "release_gl": <the row's Global start day, UTC>, "source" }`. Events are confirmed only through these. An entry
  says **everything** on that JP day lands on that Global day, so check what else starts on that JP day: banners with
  a `banners` entry keep their own dates (a trainee banner can start days before the rest of its JP day), but say in
  the report what else the entry moves.
- `source`: `"<Month YYYY> release schedule (official socials): <the rows' titles>"`.
- Keep `dates` sorted by `release_jp`; both lists must stay in order (a later JP day never on an earlier Global day:
  `predict-gl` drops out-of-order entries with a warning). Keep existing entries unless the image contradicts them;
  stale ones (JP days Global has passed) are harmless.

## 5. Check

```sh
pnpm exec biome format --write data/known_dates.json
pnpm predict-gl                      # prints each "known date: JP … → Global …"; no warnings
pnpm exec vitest run test/schemas.test.ts
```

Re-run the listing from step 3: every row on the image should now have the image's start and end exactly, with
`confirmed: true`. Then, if the pull guide's banners are affected (new confirmed banner ids), `pnpm fetch-pull-guide`.

## 6. Report

A table: each image row → what it matched (JP id, JP day), the predicted date before → the confirmed date now.
Then anything left out (already in the news, unmatched) and anything a `dates` entry moved that the image doesn't
show. Don't commit.
