// The app's filter, shared by the Cards tab and the Timeline: a button with a count of what differs from the defaults,
// opening a sheet (src/Sheet.tsx) with a title, an action beside it (a reset), and sections of toggle chips, each with
// All / None. Every change applies at once (no Done); the pages keep and save the state.
//
// <FilterButton count countTitle onClick disabled />
// <FilterSheet open onClose title action>…</FilterSheet>
// <FilterSection heading note off chips onToggle onAll />: `chips` [{ key, label, shown, tone }] (`tone`: its colour,
//   a `data-tone` of src/styles/global.css), `onToggle(key)`, `onAll(shown)` (true: All, false: None); `off` greys the whole section out.

import type { ReactNode } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Sheet, { SheetTitle } from './Sheet.tsx';
import styles from './FilterSheet.module.css';
import './FilterSheet.css';

export type FilterButtonProps = {
  count: number;
  countTitle?: string;
  onClick: () => void;
  disabled?: boolean;
};

export function FilterButton({ count, countTitle, onClick, disabled }: FilterButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={clsx(styles.filterButton, count > 0 && styles.active)}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
    >
      <SlidersHorizontal size={18} aria-hidden="true" />
      {t('filter.button')}
      {count > 0 && (
        <span className={styles.filterCount} title={countTitle}>
          {count}
        </span>
      )}
    </button>
  );
}

export type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
};

export function FilterSheet({ open, onClose, title, action, children }: FilterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} className={styles.filterSheet}>
      <div className={styles.filterHead}>
        <SheetTitle className={styles.filterTitle}>{title}</SheetTitle>
        {action}
      </div>
      {children}
    </Sheet>
  );
}

export type FilterChip = {
  key: string | number;
  label: ReactNode;
  shown: boolean;
  /** A `data-tone` of src/styles/global.css. */
  tone?: string;
};

export type FilterSectionProps = {
  heading: ReactNode;
  note?: ReactNode;
  off?: boolean;
  chips: FilterChip[];
  onToggle: (key: string | number) => void;
  onAll: (shown: boolean) => void;
};

export function FilterSection({ heading, note, off, chips, onToggle, onAll }: FilterSectionProps) {
  const { t } = useTranslation();
  if (!chips.length) return null;
  return (
    <section className={clsx('filter-section', off && 'off')}>
      <div className="filter-section-head">
        <h3>{heading}</h3>
        <div className={styles.filterAll}>
          <button type="button" onClick={() => onAll(true)} disabled={off || chips.every((chip) => chip.shown)}>
            {t('filter.all')}
          </button>
          <button type="button" onClick={() => onAll(false)} disabled={off || chips.every((chip) => !chip.shown)}>
            {t('filter.none')}
          </button>
        </div>
      </div>
      {note && <p className="filter-note">{note}</p>}
      <div className={styles.filterChips}>
        {chips.map((chip) => (
          <button
            type="button"
            key={chip.key}
            className={styles.filterChip}
            data-tone={chip.tone}
            aria-pressed={chip.shown}
            disabled={off}
            onClick={() => onToggle(chip.key)}
          >
            <span className={styles.filterCheck} aria-hidden="true">
              {chip.shown && <Check size={12} strokeWidth={3} />}
            </span>
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
