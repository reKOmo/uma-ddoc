// <FilterButton count countTitle onClick disabled small />, <FilterSheet open onClose title action note>…</FilterSheet>
// <FilterSection heading note off chips onToggle onAll />: `chips` [{ key, label, shown, tone }] (`tone`: a `data-tone`
// of src/styles/global.css; or `color`, any CSS colour, e.g. a scenario's), `onToggle(key)`, `onAll(shown)` (true: All, false: None); `off` greys the section out.
// With a `catchAll` chip (ticked while nothing else is), All ticks it, there's no None and no `onAll`.
// <FilterGroup heading headingId action note>…</FilterGroup>: a section of the sheet holding anything else.
// <ResetButton onClick disabled icon>…</ResetButton>: the sheet's reset (its `action`), or one like it.

import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { pillClass } from './Pill.tsx';
import Sheet, { SheetTitle } from './Sheet.tsx';
import { ToolbarButton } from './ToolbarButton.tsx';
import styles from './FilterSheet.module.css';

export type FilterButtonProps = {
  count: number;
  countTitle?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Only the icon on phones (the label still names it, and shows on desktop). */
  phoneIconOnly?: boolean;
  /** Compact, for a section heading rather than a toolbar. */
  small?: boolean;
};

export function FilterButton({ count, countTitle, ...props }: FilterButtonProps) {
  const { t } = useTranslation();
  return (
    <ToolbarButton
      icon={SlidersHorizontal}
      label={t('filter.button')}
      badge={count}
      badgeTitle={countTitle}
      opensDialog
      {...props}
    />
  );
}

export type ResetButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
};

export function ResetButton({ onClick, disabled, icon: Icon = RotateCcw, className, children }: ResetButtonProps) {
  return (
    <button type="button" className={clsx(styles.reset, className)} onClick={onClick} disabled={disabled}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </button>
  );
}

export type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  action?: ReactNode;
  /** A line under the title. */
  note?: ReactNode;
  children?: ReactNode;
};

export function FilterSheet({ open, onClose, title, action, note, children }: FilterSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} className={styles.filterSheet}>
      <div className={styles.filterHead}>
        <SheetTitle className={styles.filterTitle}>{title}</SheetTitle>
        {action}
      </div>
      {note && <p className={clsx(styles.note, styles.sheetNote)}>{note}</p>}
      {children}
    </Sheet>
  );
}

export type FilterGroupProps = {
  heading?: ReactNode;
  /** For a control labelled by the heading (`aria-labelledby`). */
  headingId?: string;
  /** Beside the heading. */
  action?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
};

export function FilterGroup({ heading, headingId, action, note, children }: FilterGroupProps) {
  return (
    <section className={styles.group}>
      {heading && (
        <div className={styles.groupHead}>
          <h3 id={headingId} className="section-label">
            {heading}
          </h3>
          {action}
        </div>
      )}
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </section>
  );
}

export type FilterChip<K extends string | number = string> = {
  key: K;
  label: ReactNode;
  shown: boolean;
  /** A `data-tone` of src/styles/global.css. */
  tone?: string;
  /** A colour of its own (the chip's --tone), where no `data-tone` has it: a scenario's. */
  color?: string;
  catchAll?: boolean;
};

export type FilterSectionProps<K extends string | number = string> = {
  heading: ReactNode;
  note?: ReactNode;
  off?: boolean;
  chips: FilterChip<K>[];
  onToggle: (key: K) => void;
  onAll?: (shown: boolean) => void;
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
  const catchAll = chips.find((chip) => chip.catchAll);
  return (
    <FilterGroup
      heading={heading}
      note={note}
      action={
        <div className={styles.filterAll}>
          <button
            type="button"
            onClick={() => (catchAll ? onToggle(catchAll.key) : onAll?.(true))}
            disabled={off || (catchAll ? catchAll.shown : chips.every((chip) => chip.shown))}
          >
            {t('filter.all')}
          </button>
          {!catchAll && (
            <button type="button" onClick={() => onAll?.(false)} disabled={off || chips.every((chip) => !chip.shown)}>
              {t('filter.none')}
            </button>
          )}
        </div>
      }
    >
      <div className={styles.filterChips}>
        {chips.map((chip) => (
          <button
            type="button"
            key={chip.key}
            className={clsx(pillClass({ variant: 'tinted' }), styles.filterChip)}
            // ('': the default grey tone, under a scenario's own --tone)
            data-tone={chip.tone ?? ''}
            style={chip.color ? ({ '--tone': chip.color } as CSSProperties) : undefined}
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
    </FilterGroup>
  );
}
