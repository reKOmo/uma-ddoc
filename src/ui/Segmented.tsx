// A toggle group: a <fieldset> of buttons, one pressed (aria-pressed) and the others a click away. The server switch,
// the limit break and card size pickers, the zoom and the settings all use it. Its label is an aria-label, or the id of
// an element that labels it (labelledBy).
//
// <Segmented label="Server" options={[{ value: 'gl', label: 'Global' }]} value="gl" onChange={setServer} />

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import styles from './Segmented.module.css';

export type SegmentedOption<V extends string | number> = {
  value: V;
  label: ReactNode;
  icon?: LucideIcon;
  ariaLabel?: string;
  title?: string;
};

type SegmentedLabel = { label: string; labelledBy?: undefined } | { labelledBy: string; label?: undefined };

export type SegmentedProps<V extends string | number> = SegmentedLabel & {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  className?: string;
};

export function Segmented<V extends string | number>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  disabled,
  className,
}: SegmentedProps<V>) {
  return (
    <fieldset className={clsx(styles.group, className)} aria-label={label} aria-labelledby={labelledBy}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={styles.option}
            aria-pressed={option.value === value}
            aria-label={option.ariaLabel}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon size={18} aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}
