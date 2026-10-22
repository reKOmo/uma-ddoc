// The gold review page (pnpm gold:review): a post's units on the left, its label on the right. Posts whose rules
// and same-id JP post disagree come first, then celebrations, then the rest, newest first in each.

import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EVENT_KINDS } from '../../shared/schemas/event.ts';
import { type GoldLabel, type GoldUnit, OTHER_KINDS, POST_PHASES, UNIT_ROLES } from '../../shared/schemas/news.ts';
import type { PostView } from '../gold-review.ts';
import './style.css';

type Data = { server: 'gl' | 'jp'; posts: PostView[]; gold: Record<number, GoldLabel> };

const OTHER = { gl: 'JP', jp: 'Global' };
const unsure = (label: GoldLabel | undefined) => !!label?.note?.startsWith('Unsure');

const disagrees = (p: PostView) => !!p.twin && (p.twin.category !== p.rules.category || p.twin.kind !== p.rules.kind);
const rank = (p: PostView) => (disagrees(p) ? 0 : p.rules.kind === 'celebration' ? 1 : 2);
const kindsOf = (category: GoldLabel['category']): readonly string[] =>
  category === 'event' ? EVENT_KINDS : category === 'other' ? OTHER_KINDS : [];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function App() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<GoldLabel | null>(null);
  const [hideReviewed, setHideReviewed] = useState(true);
  const [unsureOnly, setUnsureOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/posts')
      .then((r) => r.json())
      .then((d: Data) => setData(d));
  }, []);

  // (Fixed at load, so a saved post doesn't move under the cursor.)
  const order = useMemo(() => (data ? [...data.posts].sort((a, b) => rank(a) - rank(b) || b.id - a.id) : []), [data]);
  const shown = order.filter(
    (p) =>
      (!hideReviewed || !data?.gold[p.id]?.reviewed || p.id === selected) &&
      (!unsureOnly || unsure(data?.gold[p.id]) || p.id === selected) &&
      (!search || String(p.id).includes(search) || p.title.toLowerCase().includes(search.toLowerCase()))
  );
  const post = order.find((p) => p.id === selected) ?? null;

  const open = useCallback(
    (id: number | null) => {
      setSelected(id);
      setDraft(id != null && data ? structuredClone(data.gold[id]) : null);
      setError(null);
    },
    [data]
  );
  useEffect(() => {
    if (selected == null && shown.length) open(shown[0].id);
  }, [selected, shown, open]);

  const next = useCallback(() => {
    if (!data || selected == null) return;
    const i = order.findIndex((p) => p.id === selected);
    const after = order.slice(i + 1).find((p) => !data.gold[p.id]?.reviewed);
    open(after?.id ?? null);
  }, [data, order, selected, open]);

  const save = useCallback(async () => {
    if (!draft || !data) return;
    const label = { ...draft, reviewed: true };
    const res = await fetch('/api/gold', { method: 'PUT', body: JSON.stringify(label) });
    if (!res.ok) return setError((await res.json()).error);
    setData({ ...data, gold: { ...data.gold, [label.id]: label } });
    next();
  }, [draft, data, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  if (!data) return <p className="loading">Loading posts…</p>;
  const reviewed = Object.values(data.gold).filter((l) => l.reviewed).length;

  return (
    <div className="app">
      <aside className="list">
        <header>
          <strong>
            {reviewed} / {data.posts.length} reviewed
          </strong>
          <input placeholder="Search id or title" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label>
            <input type="checkbox" checked={hideReviewed} onChange={(e) => setHideReviewed(e.target.checked)} />
            Hide reviewed
          </label>
          <label>
            <input type="checkbox" checked={unsureOnly} onChange={(e) => setUnsureOnly(e.target.checked)} />
            Unsure only
          </label>
        </header>
        <ul>
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" className={p.id === selected ? 'item current' : 'item'} onClick={() => open(p.id)}>
                <span className="meta">
                  {p.id} · {data.gold[p.id]?.category}/{data.gold[p.id]?.kind ?? '—'}
                  {disagrees(p) && <span className="flag">{OTHER[data.server]} differs</span>}
                  {unsure(data.gold[p.id]) && <span className="flag">unsure</span>}
                  {data.gold[p.id]?.reviewed && <span className="done">✓</span>}
                </span>
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {post && draft ? (
        <Editor
          post={post}
          other={OTHER[data.server]}
          draft={draft}
          setDraft={setDraft}
          save={save}
          skip={next}
          error={error}
        />
      ) : (
        <p className="loading">Nothing left to review.</p>
      )}
    </div>
  );
}

type EditorProps = {
  post: PostView;
  // the other server's name, for its same-id post's hint
  other: string;
  draft: GoldLabel;
  setDraft: (label: GoldLabel) => void;
  save: () => void;
  skip: () => void;
  error: string | null;
};

function Editor({ post, other, draft, setDraft, save, skip, error }: EditorProps) {
  const set = (patch: Partial<GoldLabel>) => setDraft({ ...draft, ...patch });
  const setCategory = (category: GoldLabel['category']) =>
    set({
      category,
      kind: null,
      units:
        category === 'event'
          ? draft.units.length
            ? draft.units
            : post.units.map((): GoldUnit => ({ role: 'event', kind: null, name: null }))
          : [],
    });
  const setUnit = (i: number, patch: Partial<GoldUnit>) =>
    set({ units: draft.units.map((u, n) => (n === i ? { ...u, ...patch } : u)) });
  const changed = (field: keyof GoldLabel) => !same(draft[field], post.rules[field]);

  return (
    <main className="editor">
      <section className="post">
        <h1>
          <a href={post.url} target="_blank" rel="noreferrer">
            {post.id}
          </a>{' '}
          {post.title}
        </h1>
        <p className="meta">Posted {post.posted} (UTC)</p>
        {post.units.map((unit, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a post's units never reorder
          <article key={`${post.id}-${i}`} className={`unit role-${draft.units[i]?.role ?? 'event'}`}>
            <div className="unit-head">
              <span className="unit-no">
                Unit {i}
                {unit.art ? ` · art ${unit.artId ?? ''}` : ' · intro'}
              </span>
              {draft.category === 'event' && draft.units[i] && (
                <UnitControls unit={draft.units[i]} set={(patch) => setUnit(i, patch)} />
              )}
            </div>
            {unit.art && <img src={unit.art} alt="" loading="lazy" />}
            {unit.intro.map((line, n) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a post's lines never reorder
              <p key={n}>{line}</p>
            ))}
            {unit.sections.map((s, n) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a post's sections never reorder
              <div key={n} className="section">
                <h3>{s.heading}</h3>
                {s.lines.map((line, m) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a post's lines never reorder
                  <p key={m}>{line}</p>
                ))}
              </div>
            ))}
          </article>
        ))}
      </section>

      <section className="label">
        <h2>Label</h2>
        <div className="hints">
          <p>
            <b>Rules:</b> {post.rules.category}/{post.rules.kind ?? '—'} · {post.rules.phase ?? '—'} ·{' '}
            {post.rules.name ?? '—'}
          </p>
          <p>
            <b>{other}:</b>{' '}
            {post.twin ? (
              <>
                {post.twin.category}/{post.twin.kind ?? '—'}
                {post.twin.labelled ? ' (gold)' : ''} · {post.twin.title}
              </>
            ) : (
              'no same-id post'
            )}
          </p>
        </div>
        <label className={changed('category') ? 'changed' : undefined}>
          Category
          <select value={draft.category} onChange={(e) => setCategory(e.target.value as GoldLabel['category'])}>
            {['banner', 'event', 'other'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={changed('kind') ? 'changed' : undefined}>
          Kind
          <select
            value={draft.kind ?? ''}
            onChange={(e) => set({ kind: (e.target.value || null) as GoldLabel['kind'] })}
          >
            <option value="">—</option>
            {kindsOf(draft.category).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className={changed('phase') ? 'changed' : undefined}>
          Phase
          <select
            value={draft.phase ?? ''}
            onChange={(e) => set({ phase: (e.target.value || null) as GoldLabel['phase'] })}
          >
            <option value="">—</option>
            {POST_PHASES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className={changed('name') ? 'changed' : undefined}>
          Name
          <input value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value || null })} />
        </label>
        <label>
          Note
          <textarea value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value || null })} rows={3} />
        </label>
        {changed('units') && <p className="changed-note">Units differ from the rules.</p>}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="primary" onClick={save}>
            Save &amp; next <kbd>Ctrl+Enter</kbd>
          </button>
          <button type="button" onClick={skip}>
            Skip
          </button>
          <button type="button" onClick={() => setDraft({ ...structuredClone(post.rules), note: draft.note })}>
            Reset to rules
          </button>
        </div>
      </section>
    </main>
  );
}

function UnitControls({ unit, set }: { unit: GoldUnit; set: (patch: Partial<GoldUnit>) => void }) {
  return (
    <span className="unit-controls">
      <select
        aria-label="Role"
        value={unit.role}
        onChange={(e) => {
          const role = e.target.value as GoldUnit['role'];
          set(role === 'part' ? { role } : { role, kind: null, name: null });
        }}
      >
        {UNIT_ROLES.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {unit.role === 'part' && (
        <>
          <select
            aria-label="Part kind"
            value={unit.kind ?? ''}
            onChange={(e) => set({ kind: (e.target.value || null) as GoldUnit['kind'] })}
          >
            <option value="">—</option>
            {EVENT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input
            aria-label="Part name"
            placeholder="Part name"
            value={unit.name ?? ''}
            onChange={(e) => set({ name: e.target.value || null })}
          />
        </>
      )}
    </span>
  );
}

// biome-ignore lint/style/noNonNullAssertion: index.html has #root
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
