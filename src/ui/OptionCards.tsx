import { Check } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './OptionCards.module.css';

export type OptionCard<V extends string> = { value: V; label: ReactNode; detail?: ReactNode };

export type OptionCardsProps<V extends string> = {
  labelledBy: string;
  options: readonly OptionCard<V>[];
  value: V;
  onChange: (value: V) => void;
};

// A setting's choices as cards side by side, a check on the chosen one: a group of aria-pressed buttons, like
// Segmented, with room for a detail line.
export function OptionCards<V extends string>({ labelledBy, options, value, onChange }: OptionCardsProps<V>) {
  return (
    // (as many side by side as there are: two, or three)
    <fieldset
      className={styles.group}
      aria-labelledby={labelledBy}
      data-columns={options.length}
      style={{ '--columns': options.length } as CSSProperties}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={styles.option}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.text}>
              <span className={styles.label}>{option.label}</span>
              {option.detail && <small className={styles.detail}>{option.detail}</small>}
            </span>
            {selected && (
              <span className={styles.check} aria-hidden="true">
                <Check size={11} strokeWidth={3.5} />
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
