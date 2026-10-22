"""Global's events paired with JP's, and Global's future events predicted from JP's.

Global runs JP's events in JP's order, years later (data/global_events.json, from the official news; data/jp_events.json,
from the JP news + GameTora's history, `pnpm update-jp`). Top-level events are paired, in this order of trust:

  post   the same post: Global's in-game news reuses JP's post ids (Global's 1076 "Illuminate the Heart" is JP's 1076),
         so an event and the JP one sharing a post id (its id, or its news_url's) are one; a JP celebration's part too
         (Global's own posts are JP's parts at times). Global's own posts (100001… series) never match.
  card   the same support card given (story events' SSRs; a celebration's card; JP's GameTora fills give theirs)
  name   the same name across the languages (NAMES: Champions Meeting cups, recurring specials, celebrations by
         anniversary / season and part, recurring campaigns); names repeat (cups every year), so the one whose date
         fits best is taken
  order  Legend Races and Transfer Requests (no names): the JP one of the kind whose date fits best

A JP event's expected Global day (`ref`) is where JP's card releases put it: interpolated between Global's release
batches (JP release day → Global release day, data.batches()) up to Global's progress, then the release model with
its known dates. A pair whose Global day is more than TOL days off it is rejected (reported: Global moved that event,
e.g. a song gift months later), as is one out of JP's order among its kind. A paired celebration's parts are paired
too (pair_parts()): by the art id Global reuses (JP's おみくじキャンペーン and Global's Lucky Draw are both 26400004),
else by kind and the same offset from the celebration's start; never anchors. Every pair is an anchor, an order pair only when
unambiguous: no other JP event of its kind within TOL of the expected day.

Pairs → generated/event_pairs.json:
  { pairs: [{ gl, jp, kind, how, gl_start, jp_start, dev_days, anchor }], rejected: [{ …, why }],
    missing_parts: [{ gl_parent, jp_parent, jp }] }  (a paired celebration's JP parts Global's lacks)
  (kind: the JP event's; dev_days: Global day − expected day; anchor: used as a known date)
Anchors are known dates for the release model (adjust.load_known_dates(),
after the hand entries and Global's banners): the JP event's start day in JST → the Global one's in UTC.

Predicted events → generated/predicted_global_events.json (optional for the site, like predicted banners):
  { source: { predicted_from, fitted_at }, events: [event…] }, newest first. Every top-level JP event with no pair
  starting at most LOOKBACK JP days before the last JP day Global's card releases have reached (the banners' anchor)
  and predicted to start on Global at most SHOWN_DAYS ago, with its parts: JP's fields
  (kind, name in Japanese, cards, items, titles, phases, races, image, news_url = the JP post, source) and
  id 'jp-<JP id>', parent 'jp-<JP parent id>' | null, start / end: the top-level event's predicted Global start (its JST
  start day through predict(), 22:00 UTC like banners, never a Japanese weekend), its parts and phases moved by the
  same amount (JP's lengths kept); every date status predicted (the start with lo / hi), a start confirmed when
  known_dates.json's `dates` give its JP day; predicted: true, jp_id, jp_start, jp_end. Also every missing part of
  a Global celebration not over yet: parent the Global celebration, moved by the celebrations' offset (none once
  it is over: Global has never run a part it skipped later).

Fills → data/global_events.json (write_fills()): a paired Global event's dates its news doesn't give yet (a "coming
soon" cup's end and later phases), JP's moved by the pair's offset, status predicted. Each run drops the old fills
first, so a date the news has given since is the news' alone. (Not a gift's end: JP's are the deadline of who gets it.)
"""

import json
import re
import unicodedata
from collections import defaultdict

import numpy as np
import pandas as pd

from adjust import hand_known_days, snap_weekday
from banners import GLOBAL_START_HOUR, epoch_days, iso_at
from data import DATA, FILLS, GENERATED, dated, day_range, read, to_date

PAIRS_OUTPUT = GENERATED / 'event_pairs.json'
EVENTS_OUTPUT = GENERATED / 'predicted_global_events.json'
DAY_MS = 86_400_000
TOL = 10  # days a pair may be off its expected Global day
# An unpaired JP event from up to LOOKBACK JP days before Global's progress is still predicted (JP 1122 started on the
# very day Global's card releases had reached, and its Global post was misread: it vanished), as long as its predicted
# Global start is at most SHOWN_DAYS ago: the Timeline hides a predicted event that long past its start
# (src/timeline/events.ts' withPredicted(), the same 14 days).
LOOKBACK = 30
SHOWN_DAYS = 14

ZODIAC = {
    'aries': 'アリエス', 'taurus': 'タウラス', 'gemini': 'ジェミニ', 'cancer': 'キャンサー', 'leo': 'レオ',
    'virgo': 'ヴァルゴ', 'libra': 'ライブラ', 'scorpio': 'スコーピオ', 'sagittarius': 'サジタリウス',
    'capricorn': 'カプリコーン', 'aquarius': 'アクエリアス', 'pisces': 'ピスケス',
}
CUPS = ('SPRINT', 'MILE', 'CLASSIC', 'LONG', 'DIRT')  # JP's cups from 2023 (Global's names not known yet)

# Names that mean the same event: (Global's pattern, JP's pattern, key). Patterns match the NFKC-normalised name
# (GⅠ → GI, full-width → half-width), case-insensitively; a key may use the groups (anniversary, part).
NAMES = [
    (r"^trainer aptitude test$", r"^トレーナー技能試験$", 'aptitude'),
    (r"^racing carnival$", r"^レーシングカーニバル$", 'carnival'),
    (r"^aim for the stars! dream team$", r"^目指せ!最強チーム$", 'dream_team'),
    (r"^fuji kiseki's showtime$", r"^フジキセキのショータイム$", 'fuji'),
    (r"^(?:agnes tachyon's )?factor research$", r"^アグネスタキオンの因子研究$", 'factor'),
    (r"^masters challenge$", r"^マスターズチャレンジ$", 'masters'),
    (r"^uma outing$", r"^ウマさんぽキャンペーン$", 'outing'),
    (r"^bonus star piece rewards in career$", r"^「育成報酬」ピース追加キャンペーン$", 'star_pieces'),
    (r"^(?:bonus|increased) daily race (?:tickets|attempts)$", r"^「デイリーレース」挑戦回数増量キャンペーン$", 'daily_race'),
    (r"^daily free 10x? ?-?scout$", r"^1日1回10連ガチャ無料キャンペーン$", 'free_scout'),
    (r"^additional free retries$", r"^無料コンティニュー回数増加キャンペーン$", 'retries'),
    (r"^valentine's day celebration$", r"^バレンタインキャンペーン$", 'valentine'),
    (r"^white day celebration$", r"^ホワイトデーキャンペーン$", 'white_day'),
    (r"^g1 celebration$", r"^giキャンペーン$", 'g1'),
    (r"^spring g1 celebration part (\d+)$", r"^春のgiキャンペーン第(\d+)弾$", 'spring_g1_{0}'),
    (r"^fall g1 celebration part (\d+)$", r"^秋のgiキャンペーン第(\d+)弾$", 'fall_g1_{0}'),
    (r"^holiday celebration part (\d+)$", r"^クリスマスキャンペーン第(\d+)弾$", 'christmas_{0}'),
    (r"^(?:new year'?s? celebration|new beginnings) part (\d+)$", r"^ゆく年くる年キャンペーン第(\d+)弾$", 'new_year_{0}'),
    (r"^half anniversary celebration part (\d+)$", r"^ハーフアニバーサリーキャンペーン第(\d+)弾$", 'anniversary_0.5_{0}'),
    (r"^(\d+(?:\.5)?)(?:st|nd|rd|th)?(?:-year)? anniversary celebration part (\d+)$",
     r"^(\d+(?:\.5)?)(?:st|nd|rd|th) anniversaryキャンペーン第(\d+)弾$", 'anniversary_{0}_{1}'),
]


def norm(name):
    return unicodedata.normalize('NFKC', name or '').strip().lower()


def name_key(event, server):
    """The event's NAMES key (or a cup's), or None."""
    name = norm(event['name'])
    if event['kind'] == 'champions_meeting':
        if server == 'gl':
            cup = re.sub(r'\s*cup$', '', name)
            return f'cm_{ZODIAC[cup]}' if cup in ZODIAC else (f'cm_{cup.upper()}' if cup.upper() in CUPS else None)
        cup = re.sub(r'杯$', '', name)
        return f'cm_{cup}' if cup in ZODIAC.values() else (f'cm_{cup.upper()}' if cup.upper() in CUPS else None)
    for gl, jp, key in NAMES:
        m = re.match(gl if server == 'gl' else jp, name)
        if m:
            return key.format(*[str(float(g)).removesuffix('.0') for g in m.groups()])
    return None


def post_ids(event):
    """The JP-series post ids an event comes from: its id and its news_url's (Global's own series 100001… left out)."""
    ids = {event['id']} if re.fullmatch(r'\d+', event['id']) else set()
    url = re.search(r'(?:/news/|id=)(\d+)', event.get('news_url') or '')
    if url:
        ids.add(url[1])
    return {i for i in ids if int(i) < 100_000}


def cards_of(event, parts):
    """Support card ids an event gives, its parts' included."""
    ids = {c['id'] for c in event['cards']}
    for part in parts.get(event['id'], []):
        ids |= cards_of(part, parts)
    return ids


def jst_day(iso):
    return float(np.floor(epoch_days(iso) + 9 / 24))


def utc_day(iso):
    return float(np.floor(epoch_days(iso)))


def events_file(server):
    return DATA / f'{"global" if server == "gl" else server}_events.json'


def load(server):
    # (Global's: only what its news says, without the fills of an earlier run)
    events = read(events_file(server), fills=server != 'gl')
    parts = defaultdict(list)
    for e in events:
        if e['parent']:
            parts[e['parent']].append(e)
    return events, [e for e in events if not e['parent']], parts


# An event's art id (Global reuses JP's for a celebration's parts: JP's おみくじキャンペーン and Global's Lucky Draw are
# both 26400004): the number in its picture's name, or a JP campaign picture's date (CP_20261017).
ART = re.compile(r'(?:header|banner)_(?:((?:CP|EV)_\d{8})_\d+|(\d{4,10}))')
PART_TOL = 2  # days a part paired by kind may be off its JP offset from the celebration's start


def art_of(event):
    m = ART.search(event.get('image') or '')
    return m and (m[1] or m[2])


def pair_parts(gl, jp, gl_parts, jp_parts, paired_gl, paired_jp):
    """A paired celebration's parts: [(Global part, JP part, how)] and the JP parts left. By art id where it is one
    part's alone on both sides (a part without art of its own shows its celebration's), else by kind with the same
    offset from the celebration's start (within PART_TOL days). Parts already paired (by post) are left out."""
    own = lambda e: not re.search(r'-m\d+$', e['id'])  # noqa: E731  (mission sets go with their missions)
    gs = [e for e in gl_parts.get(gl['id'], []) if own(e) and e['id'] not in paired_gl]
    js = [e for e in jp_parts.get(jp['id'], []) if own(e) and e['id'] not in paired_jp]
    found = []

    def unique(parts):
        arts = [art_of(e) for e in parts]
        return {a: e for a, e in zip(arts, parts) if a and arts.count(a) == 1}

    g_art, j_art = unique(gs), unique(js)
    for a, j in j_art.items():
        if a in g_art:
            found.append((g_art[a], j, 'art'))
    used_g, used_j = {g['id'] for g, _, _ in found}, {j['id'] for _, j, _ in found}
    offset = lambda e, top: utc_day(e['start']) - utc_day(top['start'])  # noqa: E731
    for j in [e for e in js if e['id'] not in used_j]:
        near = [g for g in gs if g['id'] not in used_g and g['kind'] == j['kind']
                and abs(offset(g, gl) - offset(j, jp)) <= PART_TOL]
        if near:
            g = min(near, key=lambda g: abs(offset(g, gl) - offset(j, jp)))
            found.append((g, j, 'kind'))
            used_g.add(g['id'])
            used_j.add(j['id'])
    return found, [j for j in js if j['id'] not in used_j]


def lis_keep(pairs):
    """The pairs to keep so that, sorted by Global start, JP starts never go back (longest such run)."""
    pairs = sorted(pairs, key=lambda p: (p['gl_start'], p['jp_start']))
    n = len(pairs)
    best, prev = [1] * n, [-1] * n
    for i in range(n):
        for j in range(i):
            if pairs[j]['jp_start'] <= pairs[i]['jp_start'] and best[j] + 1 > best[i]:
                best[i], prev[i] = best[j] + 1, j
    keep, i = set(), int(np.argmax(best)) if n else -1
    while i >= 0:
        keep.add(id(pairs[i]))
        i = prev[i]
    return keep


def pair_events(ref):
    """ref: JP days (array) → expected Global days. Returns { pairs, rejected }."""
    gl_all, gl_top, gl_parts = load('gl')
    jp_all, jp_top, jp_parts = load('jp')
    jp_days = np.array([jst_day(e['start']) for e in jp_top])
    expected = dict(zip((e['id'] for e in jp_top), ref(jp_days)))
    pairs, rejected = [], []
    paired_gl, paired_jp = set(), set()

    def day_pair(gl, jp):
        """(JP day, Global day) the pair's dates compare: their starts, or both cups' round 1 (a GameTora cup starts
        at round 1, the news' at the league selection)."""
        r1 = lambda e: next((p['start'] for p in e.get('phases') or [] if p['key'] == 'round_1'), None)  # noqa: E731
        if r1(gl) and r1(jp):
            return jst_day(r1(jp)), utc_day(r1(gl))
        return jst_day(jp['start']), utc_day(gl['start'])

    def record(gl, jp, how, **extra):
        jp_day, gl_day = day_pair(gl, jp)
        return {
            'gl': gl['id'], 'jp': jp['id'], 'kind': jp['kind'], 'how': how,
            'gl_start': gl['start'], 'jp_start': jp['start'], 'dev_days': round(float(gl_day - ref(np.array([jp_day]))[0]), 1),
            **extra, 'jp_day': jp_day, 'gl_day': gl_day,
        }

    def take(pair, gl, jp):
        """Keeps a pair whose Global day fits; one that doesn't is rejected (reported), but its events count as paired
        (it's the same event, Global moved it): neither is paired again, nor is the JP one predicted."""
        paired_gl.add(gl['id'])
        paired_jp.add(jp['id'])
        if abs(pair['dev_days']) > TOL:
            rejected.append({**{k: v for k, v in pair.items() if k != 'anchor'},
                             'why': f'{pair["dev_days"]:+.0f} days off the expected Global day'})
        else:
            pairs.append(pair)

    # (JP's parts too, after its top-level events: an event Global runs on its own can be part of a JP celebration,
    # Global's 1109 Sparkly Magic Show JP's 1093-1 KIRARI MAGIC SHOW, from the same post)
    by_post = defaultdict(list)
    for jp in jp_top + [e for e in jp_all if e['parent']]:
        for i in post_ids(jp):
            by_post[i].append(jp)
    jp_cards = {jp['id']: cards_of(jp, jp_parts) for jp in jp_top}
    jp_keys = defaultdict(list)
    for jp in jp_top:
        key = name_key(jp, 'jp')
        if key:
            jp_keys[key].append(jp)

    def nearest(gl, candidates, within=np.inf):
        """The candidate (not paired yet) whose expected Global day is nearest the Global event's (within `within`
        days), and the runner-up's distance."""
        free = [c for c in candidates if c['id'] not in paired_jp]
        if not free:
            return None, np.inf
        dist = sorted((abs(utc_day(gl['start']) - expected[c['id']]), i) for i, c in enumerate(free))
        best = free[dist[0][1]] if dist[0][0] <= within else None
        return best, (dist[1][0] if len(dist) > 1 else np.inf)

    gl_sorted = sorted(gl_top, key=lambda e: e['start'])
    # post: the same post; several JP events of one post → the one of the same kind
    for gl in gl_sorted:
        found = {jp['id']: jp for i in post_ids(gl) for jp in by_post.get(i, []) if jp['id'] not in paired_jp}
        if found:
            jp = next((j for j in found.values() if j['kind'] == gl['kind']), next(iter(found.values())))
            take(record(gl, jp, 'post'), gl, jp)
    # a Global part with a post of its own (Global's 1109 Sparkly Magic Show, merged into its celebration's 1093-0): by
    # that post, never an anchor (a part's dates follow its celebration's)
    by_id = {e['id']: e for e in gl_all}
    own_post = [e for e in gl_all if e['parent'] and post_ids(e) - post_ids(by_id[e['parent']])]
    for gl in sorted(own_post, key=lambda e: e['start']):
        found = [jp for i in post_ids(gl) - post_ids(by_id[gl['parent']]) for jp in by_post.get(i, [])
                 if jp['id'] not in paired_jp]
        if found:
            jp = next((j for j in found if j['kind'] == gl['kind']), found[0])
            take(record(gl, jp, 'post', anchor=False), gl, jp)
    # card: a support card both give (the nearest such JP event)
    for gl in gl_sorted:
        ids = gl['id'] not in paired_gl and cards_of(gl, gl_parts)
        if ids:
            jp, _ = nearest(gl, [j for j in jp_top if jp_cards[j['id']] & ids])
            if jp:
                take(record(gl, jp, 'card'), gl, jp)
    # name: the same event in either language, the nearest that fits
    for gl in gl_sorted:
        key = gl['id'] not in paired_gl and name_key(gl, 'gl')
        if key:
            jp, _ = nearest(gl, jp_keys.get(key, []), TOL)
            if jp:
                take(record(gl, jp, 'name'), gl, jp)
    # order: unnamed kinds, the nearest of the kind that fits; an anchor only if no other one fits
    for gl in gl_sorted:
        if gl['id'] in paired_gl or gl['kind'] not in ('legend_race', 'transfer_requests'):
            continue
        jp, runner_up = nearest(gl, [j for j in jp_top if j['kind'] == gl['kind']], TOL)
        if jp:
            take(record(gl, jp, 'order', anchor=bool(runner_up > TOL)), gl, jp)

    # JP's order within each kind
    for kind in {p['kind'] for p in pairs}:
        of_kind = [p for p in pairs if p['kind'] == kind]
        keep = lis_keep(of_kind)
        for p in of_kind:
            if id(p) not in keep:
                pairs.remove(p)
                rejected.append({**p, 'why': f'out of JP order among {kind} pairs'})
    for p in pairs:
        p.setdefault('anchor', True)
    # A paired celebration's parts, by the art Global reuses (else kind and offset): pairs, never anchors (a part's
    # dates follow its celebration), outside the order check; JP's parts without a Global one: `missing_parts`.
    missing = []
    by_gl, by_jp = {e['id']: e for e in gl_all}, {e['id']: e for e in jp_all}
    for top in [p for p in pairs + rejected if p['kind'] == 'celebration']:
        gl, jp = by_gl.get(top['gl']), by_jp.get(top['jp'])
        if not gl or not jp or gl['kind'] != 'celebration':
            continue
        found, left = pair_parts(gl, jp, gl_parts, jp_parts, paired_gl, paired_jp)
        for g, j, how in found:
            paired_gl.add(g['id'])
            paired_jp.add(j['id'])
            pairs.append(record(g, j, how, anchor=False))
        missing += [{'gl_parent': gl['id'], 'jp_parent': jp['id'], 'jp': j['id']} for j in left]
    pairs.sort(key=lambda p: p['gl_start'])
    rejected.sort(key=lambda p: p['gl_start'])
    check(pairs, gl_top)
    return {'pairs': pairs, 'rejected': rejected, 'done_jp': paired_jp, 'missing_parts': missing}


def check(pairs, gl_top):
    """No event in two pairs (an error); every Global story event and Champions Meeting paired (a warning: the
    one kind pairs by card and its JP side is complete since GameTora's fill, the other by name)."""
    for side in ('gl', 'jp'):
        ids = [p[side] for p in pairs]
        if len(ids) != len(set(ids)):
            raise ValueError(f'event pairs: a {side} event is in two pairs')
    paired = {p['gl'] for p in pairs}
    for e in gl_top:
        if e['kind'] in ('story', 'champions_meeting') and e['id'] not in paired:
            print(f'warning: Global {e["kind"]} {e["id"]} ({e["name"]}, {e["start"][:10]}) has no JP pair')


def write_pairs(result):
    clean = lambda p: {k: v for k, v in p.items() if k not in ('jp_day', 'gl_day')}  # noqa: E731
    lines = lambda xs: ',\n'.join(json.dumps(clean(x), ensure_ascii=False) for x in xs)  # noqa: E731
    PAIRS_OUTPUT.write_text(f'{{\n"pairs": [\n{lines(result["pairs"])}\n],\n'
                            f'"rejected": [\n{lines(result["rejected"])}\n],\n'
                            f'"missing_parts": [\n{lines(result["missing_parts"])}\n]\n}}\n')


def anchor_points(result):
    """(JP day, Global day) of the anchor pairs: the JP start's JST day → the Global start's UTC day."""
    return [(p['jp_day'], p['gl_day']) for p in result['pairs'] if p['anchor']]


def past_ref(b):
    """JP days → Global days where Global's card releases already are: interpolated between release batches."""
    jp, gl = b['jp'].to_numpy(float), b['gl'].to_numpy(float)
    return lambda days: np.interp(days, jp, gl)


def backtest_anchors(b):
    """Anchors for the backtest (backtest.py): pairs made with Global's card releases as the expected days (linear past
    the last one)."""
    jp, gl = b['jp'].to_numpy(float), b['gl'].to_numpy(float)
    slope = np.polyfit(jp, gl, 1)[0]
    past = past_ref(b)

    def ref(days):
        return np.where(days <= jp[-1], past(days), gl[-1] + slope * (days - jp[-1]))

    pairs = pair_events(ref)
    return anchor_points(pairs), pairs


def shift(iso, ms):
    if not iso:
        return iso
    t = pd.Timestamp(iso).value // 1_000_000 + ms
    return pd.Timestamp(t, unit='ms', tz='UTC').strftime('%Y-%m-%dT%H:%M:%S.') + f'{t % 1000:03d}Z'


def predict_events(predict, anchor_jp, known, pairs, fitted_at):
    """predict: JP days (sorted) → (Global days, ± days); anchor_jp: the last JP day Global has released cards of;
    known: the known dates [(JP day, Global day)]; pairs: pair_events()'s."""
    known = dict(known)
    confirmed_days = hand_known_days()
    events, jp_top, parts = load('jp')
    paired = pairs['done_jp']
    todo = sorted((e for e in jp_top if e['id'] not in paired and jst_day(e['start']) >= anchor_jp - LOOKBACK),
                  key=lambda e: e['start'])
    out = []

    def emit(e, offset, m, confirmed, parent=None):
        fields = {k: v for k, v in e.items() if k not in ('id', 'parent', 'start', 'end', 'phases', 'news_url', 'image', 'source')}
        moved = lambda iso: dated(shift(iso, offset), 'predicted')  # noqa: E731
        start = shift(e['start'], offset)
        event = {
            'id': f'jp-{e["id"]}',
            **{k: fields[k] for k in ('kind', 'name')},
            'parent': parent or (f'jp-{e["parent"]}' if e['parent'] else None),
            'start': dated(start, 'confirmed') if confirmed else dated(start, 'predicted', **day_range(utc_day(start), m)),
            'end': moved(e['end']),
            **{k: fields[k] for k in ('cards', 'items', 'titles')},
            **({'phases': [{**p, 'start': moved(p['start']), 'end': moved(p['end'])}
                           for p in e['phases']]} if e.get('phases') is not None else {}),
            # JP's race conditions: Global has mostly reused them (the sheet says whose they are).
            **({'races': e['races']} if e.get('races') else {}),
            'news_url': e['news_url'],
            'image': e['image'],
            'source': e['source'],
            'predicted': True,
            'jp_id': e['id'],
            'jp_start': e['start'],
            'jp_end': e['end'],
        }
        out.append(event)
        for part in parts.get(e['id'], []):
            emit(part, offset, m, confirmed)

    if todo:
        days, margin = predict(np.array([jst_day(e['start']) for e in todo]))
        jp_days = [jst_day(e['start']) for e in todo]
        # On a known date's JP day: that Global day as it is (known days can be weekends); else never a JP weekend.
        days = np.where([d in known for d in jp_days], [known.get(d, 0) for d in jp_days], snap_weekday(days))
        margin = np.broadcast_to(margin, days.shape)

        shown_from = epoch_days(fitted_at) - SHOWN_DAYS
        for e, day, m in zip(todo, days, margin):
            if day < shown_from:
                continue
            start = iso_at(day, GLOBAL_START_HOUR)
            offset = pd.Timestamp(start).value // 1_000_000 - pd.Timestamp(e['start']).value // 1_000_000
            # confirmed: only a JP day known_dates.json's `dates` give (hand_known_days()), not one known otherwise
            emit(e, offset, m, jst_day(e['start']) in confirmed_days)
    # A paired celebration's JP parts Global's post doesn't list, under Global's celebration at JP's offset from its
    # start; none once Global's celebration is over (Global has never run a skipped part later: it speeds JP up).
    gl_events = {e['id']: e for e in load('gl')[0]}
    jp_events = {e['id']: e for e in events}
    now = pd.Timestamp(fitted_at).value // 1_000_000
    for miss in pairs['missing_parts']:
        gl, jp, part = gl_events.get(miss['gl_parent']), jp_events.get(miss['jp_parent']), jp_events.get(miss['jp'])
        if not gl or not jp or not part or pd.Timestamp(gl['end'] or gl['start']).value // 1_000_000 < now:
            continue
        offset = pd.Timestamp(gl['start']).value // 1_000_000 - pd.Timestamp(jp['start']).value // 1_000_000
        emit(part, offset, 0, False, parent=gl['id'])
    out.sort(key=lambda e: (e['start']['date'], e['id']), reverse=True)
    result = {'source': {'predicted_from': 'jp_events.json', 'fitted_at': fitted_at}, 'events': out}
    lines = ',\n'.join(json.dumps(e, ensure_ascii=False) for e in out)
    source = json.dumps(result['source'])
    EVENTS_OUTPUT.write_text(f'{{\n"source": {source},\n"events": [\n{lines}\n]\n}}\n')
    return result


def write_fills(pairs):
    """Fills the dates paired Global events' news lacks (see the top) into data/global_events.json; returns how many
    events have fills."""
    events = json.loads(events_file('gl').read_text())
    jp = {e['id']: e for e in read(events_file('jp'))}
    gl_plain = {e['id']: e for e in plain_gl(events)}
    by_gl = {p['gl']: jp[p['jp']] for p in pairs['pairs'] + pairs['rejected'] if p['jp'] in jp}
    filled = 0
    for e in events:
        strip_fills(e)
        source = by_gl.get(e['id'])
        if not source:
            continue
        gl = gl_plain[e['id']]
        # moved as the pair compares them: both cups' round 1, else the starts
        r1 = lambda x: next((p['start'] for p in x.get('phases') or [] if p['key'] == 'round_1'), None)  # noqa: E731
        a, b = (r1(gl), r1(source)) if r1(gl) and r1(source) else (gl['start'], source['start'])
        offset = pd.Timestamp(a).value // 1_000_000 - pd.Timestamp(b).value // 1_000_000
        moved = lambda iso: dated(shift(iso, offset), 'predicted')  # noqa: E731
        before = json.dumps(e)
        if not e['end'] and source['end'] and e['kind'] != 'gift':
            e['end'] = moved(source['end'])
        own = {p['key']: p for p in e.get('phases') or []}
        added = False
        for p in source.get('phases') or []:
            if p['key'] not in own:
                own[p['key']] = {'key': p['key'], 'start': moved(p['start']), 'end': moved(p['end'])}
                added = True
            elif not own[p['key']]['end'] and p['end']:
                own[p['key']]['end'] = moved(p['end'])
        if own:
            phases = list(own.values())
            # (the news' order is the schedule's; phases only a fill has go in by start)
            e['phases'] = sorted(phases, key=lambda p: p['start']['date']) if added else phases
            # (in the news events' key order: phases after titles)
            for key in ('races', 'news_url', 'image', 'source'):
                if key in e:
                    e[key] = e.pop(key)
        filled += json.dumps(e) != before
    lines = ',\n'.join(json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in events)
    events_file('gl').write_text(f'[\n{lines}\n]\n')
    return filled


def plain_gl(events):
    return [{**e, 'start': e['start']['date']} | {'phases': [{**p, 'start': p['start']['date']} for p in e.get('phases') or []
                                                             if p['start']['status'] not in FILLS]}
            for e in events]


def strip_fills(e):
    """An event as its news gives it (an earlier run's fills taken off)."""
    fill = lambda d: d and d['status'] in FILLS  # noqa: E731
    if fill(e['end']):
        e['end'] = None
    if 'phases' in e:
        e['phases'] = [{**p, 'end': None if fill(p['end']) else p['end']} for p in e['phases'] if not fill(p['start'])]


def summary(pairs, predicted):
    count = lambda xs, key: dict(sorted(pd.Series([key(x) for x in xs], dtype=object).value_counts().items()))  # noqa: E731
    lines = [
        f'event pairs: {len(pairs["pairs"])} ({count(pairs["pairs"], lambda p: p["how"])}), '
        f'{sum(p["anchor"] for p in pairs["pairs"])} anchors',
        f'  by kind: {count(pairs["pairs"], lambda p: p["kind"])}',
        f'rejected: {len(pairs["rejected"])}',
    ]
    lines += [f'  {p["gl"]} ↔ JP {p["jp"]} ({p["kind"]}, {p["how"]}): {p["why"]}' for p in pairs['rejected']]
    gl_parents = {e['parent'] for e in predicted['events'] if e['parent'] and not e['parent'].startswith('jp-')}
    lines.append(f'JP parts missing from a Global celebration: {len(pairs["missing_parts"])}, '
                 f'{sum(m["gl_parent"] in gl_parents for m in pairs["missing_parts"])} predicted (the rest are over)')
    top = [e for e in predicted['events'] if not e['parent']]
    lines.append(f'predicted events: {len(top)} top-level + {len(predicted["events"]) - len(top)} parts '
                 f'({count(top, lambda e: e["kind"])})')
    return '\n'.join(lines)


__all__ = ['pair_events', 'write_pairs', 'write_fills', 'anchor_points', 'past_ref', 'predict_events', 'summary', 'to_date']
