// @ts-nocheck
// The app's filter, shared by the Cards tab and the Timeline: a button with a count of what differs from the defaults,
// opening a sheet (src/Sheet.jsx) with a title, an action beside it (a reset), and sections of toggle chips, each with
// All / None. Every change applies at once (no Done); the pages keep and save the state.
//
// <FilterButton count countTitle onClick disabled />
// <FilterSheet open onClose title action>…</FilterSheet>
// <FilterSection heading note off chips onToggle onAll />: `chips` [{ key, label, shown, tone }] (`tone`: its colour,
//   a `data-tone` of src/styles/global.css), `onToggle(key)`, `onAll(shown)` (true: All, false: None); `off` greys the whole section out.

import { Check, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Sheet, { SheetTitle } from './Sheet.tsx';
import './FilterSheet.css';

export function FilterButton({ count, countTitle, onClick, disabled }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={clsx('filter-button', count > 0 && 'active')}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
    >
      <SlidersHorizontal size={18} aria-hidden="true" />
      {t('filter.button')}
      {count > 0 && (
        <span className="filter-count" title={countTitle}>
          {count}
        </span>
      )}
    </button>
  );
}

export function FilterSheet({ open, onClose, title, action, children }) {
  return (
    <Sheet open={open} onClose={onClose} className="filter-sheet">
      <div className="filter-head">
        <SheetTitle className="filter-title">{title}</SheetTitle>
        {action}
      </div>
      {children}
    </Sheet>
  );
}

export function FilterSection({ heading, note, off, chips, onToggle, onAll }) {
  const { t } = useTranslation();
  if (!chips.length) return null;
  return (
    <section className={clsx('filter-section', off && 'off')}>
      <div className="filter-section-head">
        <h3>{heading}</h3>
        <div className="filter-all">
          <button type="button" onClick={() => onAll(true)} disabled={off || chips.every((chip) => chip.shown)}>
            {t('filter.all')}
          </button>
          <button type="button" onClick={() => onAll(false)} disabled={off || chips.every((chip) => !chip.shown)}>
            {t('filter.none')}
          </button>
        </div>
      </div>
      {note && <p className="filter-note">{note}</p>}
      <div className="filter-chips">
        {chips.map((chip) => (
          <button
            type="button"
            key={chip.key}
            className="filter-chip"
            data-tone={chip.tone}
            aria-pressed={chip.shown}
            disabled={off}
            onClick={() => onToggle(chip.key)}
          >
            <span className="filter-check" aria-hidden="true">
              {chip.shown && <Check size={12} strokeWidth={3} />}
            </span>
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
