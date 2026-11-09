// <FilterButton count countTitle onClick disabled />, <FilterSheet open onClose title action>…</FilterSheet>
// <FilterSection heading note off chips onToggle onAll />: `chips` [{ key, label, shown, tone }] (`tone`: a `data-tone`
// of src/styles/global.css), `onToggle(key)`, `onAll(shown)` (true: All, false: None); `off` greys the section out.

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
  /** Only the icon on phones (the label still names it, and shows on desktop). */
  phoneIconOnly?: boolean;
};

export function FilterButton({ count, countTitle, onClick, disabled, phoneIconOnly }: FilterButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={clsx(styles.filterButton, count > 0 && styles.active)}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      title={phoneIconOnly ? t('filter.button') : undefined}
    >
      <SlidersHorizontal size={18} aria-hidden="true" />
      <span className={phoneIconOnly ? styles.phoneHidden : undefined}>{t('filter.button')}</span>
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

export type FilterChip<K extends string | number = string> = {
  key: K;
  label: ReactNode;
  shown: boolean;
  /** A `data-tone` of src/styles/global.css. */
  tone?: string;
};

export type FilterSectionProps<K extends string | number = string> = {
  heading: ReactNode;
  note?: ReactNode;
  off?: boolean;
  chips: FilterChip<K>[];
  onToggle: (key: K) => void;
  onAll: (shown: boolean) => void;
};

export function FilterSection<K extends string | number>({
  heading,
  note,
  off,
  chips,
  onToggle,
  onAll,
}: FilterSectionProps<K>) {
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
