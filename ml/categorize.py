"""Categorizes a server's news posts and the units of its event posts, learned from its hand-labelled gold set
(data/news/<server>/gold.json, `pnpm gold:review`) on what the parsers see in each post
(generated/news_features[_jp].json, `pnpm news:features`). See docs/data/classifier.md.

Three logistic regressions over words (title, opening sentences, headings, text), the server's template phrases
(the lexicon's `signals`) and categories (art series, id series, the other server's same-id post's category / kind:
JP's for Global, Global's gold label for JP; and today's rules' answer, so they learn where the rules go wrong):

  post   category + kind ("event/celebration", "other/roundup", "banner/")
  phase  announced / started / … or none (also the title's letters: "coming in", "out soon")
  unit   an event post's unit: event / none, or part/<kind> ("part/campaign"); a gold `continues` counts as none (in
         the gold set it only ever follows a none: more of nothing)

The post's category + kind stay the rules' (they score best on the gold set: post-categories.ts + en.ts' `revise`);
the post model checks them. Phase and units are the models'.

Writes data/news/<server>/categories.json, one post per line, newest first:
  [{ id, category, kind, phase, name, source: gold | model, confidence, flag, units: [{ role, kind }] }]
the gold label where there is one, else the rules' category + kind (name null: the rules') and the models' phase and
units (confidence: the post model's probability for the rules' answer; flag: its own answer where it differs in what
the pipeline reads).

Usage: ml/.venv/bin/python ml/categorize.py [--server jp]              (pnpm news:categorize)
       ml/.venv/bin/python ml/categorize.py [--server jp] --evaluate   (against the rules on the same posts)
       ml/.venv/bin/python ml/categorize.py [--server jp] --hold-out 1122,1124
         (those posts as if new: trained without their gold labels → generated/categories_held_out[_jp].json, for
         test/news-replay.test.ts)
"""

import argparse
import json
import re

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder
from threadpoolctl import threadpool_limits

from data import DATA, GENERATED

FEATURES = {'gl': GENERATED / 'news_features.json', 'jp': GENERATED / 'news_features_jp.json'}
GOLD = {server: DATA / 'news' / server / 'gold.json' for server in FEATURES}
OUTPUT = {server: DATA / 'news' / server / 'categories.json' for server in FEATURES}
HELD_OUT = {'gl': GENERATED / 'categories_held_out.json', 'jp': GENERATED / 'categories_held_out_jp.json'}
FOLDS = 5


def words(text):
    """Dates and amounts vary post to post; their shape doesn't."""
    return re.sub(r'\d+', '0', text.lower())


def text(column, ngrams=(1, 2), min_df=1):
    return (column, TfidfVectorizer(preprocessor=words, ngram_range=ngrams, sublinear_tf=True, min_df=min_df), column)


def letters(column):
    return (f'{column}_letters', TfidfVectorizer(preprocessor=words, analyzer='char_wb', ngram_range=(2, 5),
                                                 sublinear_tf=True), column)


def flags(column):
    return (column, CountVectorizer(binary=True, token_pattern=r'\S+'), column)


def categories(*columns):
    return ('cats', OneHotEncoder(handle_unknown='ignore'), list(columns))


def model(*columns, C=10):
    return make_pipeline(ColumnTransformer(list(columns)), LogisticRegression(C=C, max_iter=5000))


def label(category, kind):
    return f'{category}/{kind or ""}'


def bucket(n):
    return str(n) if n < 3 else '3+'


def post_rows(features):
    return pd.DataFrame([{
        'id': f['id'],
        'posted': f['posted'],
        'title': f['title'],
        'opening': f['opening'],
        'body': f['body'],
        'signals': ' '.join(f['signals']) or '-',
        'art': f['art'] or '-',
        'arts': bucket(f['arts']),
        'series': f['idSeries'],
        'rules': label(f['rules']['category'], f['rules']['kind']),
        'rules_phase': f['rules']['phase'] or 'none',
        'twin': label(f['twin']['category'], f['twin']['kind']) if f['twin'] else '-',
    } for f in features])


def unit_rows(features, kinds):
    """kinds: post id → the post's kind (gold when training, the post model's when predicting)."""
    rows = []
    for f in features:
        if f['id'] not in kinds:
            continue
        for i, u in enumerate(f['units']):
            rows.append({
                'id': f['id'],
                'posted': f['posted'],
                'unit': i,
                'opening': u['opening'],
                'headings': ' | '.join(u['headings']),
                'body': u['body'],
                'art': u['art'] or '-',
                'position': 'intro' if i == 0 and not u['art'] else bucket(i),
                'dated': str(u['dated']),
                'empty': str(u['empty']),
                'rules': f"{u['rules']['role']}/{u['rules']['kind'] or ''}" if u['rules'] else '-',
                'post_kind': kinds[f['id']] or '-',
            })
    return pd.DataFrame(rows)


def unit_target(u):
    return f"part/{u['kind']}" if u['role'] == 'part' else 'none' if u['role'] == 'continues' else u['role']


def used(post_label):
    """What the pipeline reads of a post's label: its category, an event's kind and `scenario`; other kinds
    (update, misc, issue, roundup…) are for people."""
    category, kind = post_label.split('/', 1)
    return post_label if category != 'other' or kind == 'scenario' else 'other/'


POST_MODEL = lambda: model(text('title'), text('opening'), text('body', min_df=2), flags('signals'),  # noqa: E731
                           categories('art', 'arts', 'series', 'rules', 'twin'))
PHASE_MODEL = lambda: model(text('title', (1, 3)), letters('title'), categories('rules_phase', 'series'))  # noqa: E731
UNIT_MODEL = lambda: model(text('opening'), text('headings'), text('body', min_df=2),  # noqa: E731
                           categories('art', 'position', 'dated', 'empty', 'rules', 'post_kind'))


def load(server):
    features = json.loads(FEATURES[server].read_text())
    # (A label of a post edited since is no gold: the post goes the new posts' way until it's labelled again.)
    stale = {f['id'] for f in features if f['stale']}
    gold = {g['id']: g for g in json.loads(GOLD[server].read_text()) if g['reviewed'] and g['id'] not in stale}
    posts = post_rows(features)
    posts['label'] = posts['id'].map(lambda i: label(gold[i]['category'], gold[i]['kind']) if i in gold else None)
    posts['phase'] = posts['id'].map(lambda i: (gold[i]['phase'] or 'none') if i in gold else None)
    events = {i: g['kind'] for i, g in gold.items() if g['category'] == 'event'}
    units = unit_rows(features, events)
    units['target'] = [unit_target(gold[r.id]['units'][r.unit]) for r in units.itertuples()]
    return features, gold, posts, units


def unit_rule(rules):
    """The rules' unit label in the target's shape ('part/campaign' stays, 'event/' → 'event'); a post the rules don't
    take for an event they'd make one event."""
    if rules == '-':
        return 'event'
    role, kind = rules.split('/', 1)
    return unit_target({'role': role, 'kind': kind})


def report(name, truth, predicted, rules, keys):
    truth, predicted, rules = np.asarray(truth), np.asarray(predicted), np.asarray(rules)
    print(f'{name}: model {np.mean(predicted == truth):.1%} ({np.sum(predicted == truth)}/{len(truth)}), '
          f'rules {np.mean(rules == truth):.1%} ({np.sum(rules == truth)}/{len(truth)})')
    for key, t, p, r in zip(keys, truth, predicted, rules):
        if p != t:
            print(f'  {key}: gold {t}, model {p}, rules {r}')
    fixed = [key for key, t, p, r in zip(keys, truth, predicted, rules) if p == t and r != t]
    print(f'  rules wrong, model right: {", ".join(map(str, fixed)) or "none"}')


def newest(name, make, rows, target, rules, keys, read=lambda x: x):
    """Trained on the older three quarters of the posts, scored on the newest: as posts that just came out, with no
    near-twin (a cup's "coming soon" and "is here") on the training side, as random folds have."""
    cut = rows['posted'].sort_values().iloc[int(len(rows) * 0.75)]
    old, new = rows['posted'] < cut, rows['posted'] >= cut
    predicted = pd.Series(make().fit(rows[old], target[old]).predict(rows[new])).map(read)
    report(f'{name}, newest posts (from {cut[:10]})', target[new].map(read), predicted, rules[new].map(read), keys[new])


def evaluate(server):
    """Cross-validated by post (folds share near-twins: optimistic), then on the newest posts (what to trust). The
    rules were checked against every gold post, so theirs are optimistic either way."""
    _, _, posts, units = load(server)
    labelled = posts[posts['label'].notna()].reset_index(drop=True)
    folds = StratifiedKFold(FOLDS, shuffle=True, random_state=0)
    predicted = cross_val_predict(POST_MODEL(), labelled, labelled['label'], cv=folds)
    report('post category/kind', labelled['label'], predicted, labelled['rules'], labelled['id'])
    report('post, as the pipeline reads it', labelled['label'].map(used), pd.Series(predicted).map(used),
           labelled['rules'].map(used), labelled['id'])
    phase = cross_val_predict(PHASE_MODEL(), labelled, labelled['phase'], cv=folds)
    report('phase', labelled['phase'], phase, labelled['rules_phase'], labelled['id'])
    unit = cross_val_predict(UNIT_MODEL(), units, units['target'], cv=GroupKFold(FOLDS), groups=units['id'])
    unit_keys = pd.Series([f'{r.id}:{r.unit}' for r in units.itertuples()], index=units.index)
    report('unit role/kind', units['target'], unit, units['rules'].map(unit_rule), unit_keys)
    newest('post, as the pipeline reads it', POST_MODEL, labelled, labelled['label'], labelled['rules'], labelled['id'],
           used)
    newest('phase', PHASE_MODEL, labelled, labelled['phase'], labelled['rules_phase'], labelled['id'])
    newest('unit role/kind', UNIT_MODEL, units, units['target'], units['rules'].map(unit_rule), unit_keys)


def main(server, held_out=()):
    features, gold, posts, units = load(server)
    if held_out:
        gold = {i: g for i, g in gold.items() if i not in held_out}
        posts.loc[posts['id'].isin(held_out), ['label', 'phase']] = None
        units = units[~units['id'].isin(held_out)]
    labelled = posts[posts['label'].notna()]
    post_model = POST_MODEL().fit(labelled, labelled['label'])
    phase_model = PHASE_MODEL().fit(labelled, labelled['phase'])
    unit_model = UNIT_MODEL().fit(units, units['target'])

    new = posts[posts['label'].isna()]
    out = {i: {'id': int(i), 'category': g['category'], 'kind': g['kind'], 'phase': g['phase'], 'name': g['name'],
               'source': 'gold',
               'confidence': None, 'flag': None,
               'units': [{'role': u['role'], 'kind': u['kind']} for u in g['units']]}
           for i, g in gold.items()}
    if len(new):
        # The post is the rules' (they score best, en.ts' revise); the post model checks them: its probability for the
        # rules' answer, and a flag where it would answer otherwise.
        proba = post_model.predict_proba(new)
        classes = list(post_model.classes_)
        for row, p, phase in zip(new.itertuples(), proba, phase_model.predict(new)):
            category, kind = row.rules.split('/', 1)
            model_says = classes[p.argmax()]
            out[row.id] = {'id': int(row.id), 'category': category, 'kind': kind or None,
                           'phase': None if phase == 'none' else phase, 'name': None, 'source': 'model',
                           'confidence': round(float(p[classes.index(row.rules)]) if row.rules in classes else 0.0, 3),
                           'flag': model_says if used(model_says) != used(row.rules) else None, 'units': []}
        events = {i: o['kind'] for i, o in out.items() if o['source'] == 'model' and o['category'] == 'event'}
        new_units = unit_rows(features, events)
        if len(new_units):
            for row, target in zip(new_units.itertuples(), unit_model.predict(new_units)):
                role, _, kind = target.partition('/')
                out[row.id]['units'].append({'role': role, 'kind': kind or None})
    output = HELD_OUT[server] if held_out else OUTPUT[server]
    lines = ',\n'.join(json.dumps(out[i], ensure_ascii=False) for i in sorted(out, reverse=True))
    output.write_text(f'[\n{lines}\n]\n')
    new_ones = [o for o in out.values() if o['source'] == 'model']
    print(f'{len(out)} posts ({len(out) - len(new_ones)} gold, {len(new_ones)} new: '
          f'{sum(1 for o in new_ones if o["flag"])} flagged) → {output.relative_to(DATA.parent)}')


if __name__ == '__main__':
    # One BLAS thread: on matrices this small more threads only wait on each other (twice as slow, and they starve the
    # tests running beside it).
    threadpool_limits(1)
    parser = argparse.ArgumentParser()
    parser.add_argument('--evaluate', action='store_true', help='cross-validate against the rules instead')
    parser.add_argument('--server', choices=list(FEATURES), default='gl')
    parser.add_argument('--hold-out', default='', help='post ids (comma-separated) to categorize as if new')
    args = parser.parse_args()
    if args.evaluate:
        evaluate(args.server)
    else:
        main(args.server, {int(i) for i in args.hold_out.split(',') if i})
