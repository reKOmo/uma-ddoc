// Radix Select underneath: keyboard, type-ahead, ARIA, touch and the popup's portal come from it. Every dropdown
// uses it (not a <select>: phones' native pickers ignore option styling).
// Options: { value, label, icon?, pill?, group?, note?, badge?, italic?, disabled? }. `pill` { color, ink: 'dark' |
// 'light' } sets the label as a pill (the --ink-* token for its text); `disabled` options are greyed and skipped by the
// keyboard.

import * as Select from '@radix-ui/react-select';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { type CSSProperties, useId, useRef } from 'react';
import styles from './Dropdown.module.css';

export type DropdownOption = {
  value: string;
  label: string;
  icon?: string;
  pill?: { color: string; ink?: 'dark' | 'light' };
  group?: string;
  note?: string;
  badge?: string;
  italic?: boolean;
  disabled?: boolean;
};

type DropdownProps = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
};

export default function Dropdown({ label, value, options, onChange }: DropdownProps) {
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);

  const groups = [...new Set(options.filter((o) => o.group).map((o) => o.group as string))];
  const ungrouped = options.filter((o) => !o.group);
  const selected = options.find((o) => o.value === value) ?? ungrouped[0] ?? options[0];

  // On opening, the list scrolls to the selected option, centred (only the list, never the page).
  function centreSelected(node: HTMLElement | null) {
    const box = viewport.current;
    const item = node?.querySelector<HTMLElement>('[role="option"][data-state="checked"]');
    if (!box || !item) return;
    const top = item.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTop = top - (box.clientHeight - item.offsetHeight) / 2;
  }

  return (
    <div className={styles.dropdown}>
      <span id={`${id}-label`}>{label}</span>
      <Select.Root value={selected?.value} onValueChange={onChange}>
        <Select.Trigger
          id={`${id}-button`}
          className={clsx(styles.button, 'dropdown-button', selected?.italic && styles.italic)}
          aria-labelledby={`${id}-label ${id}-button`}
          title={selected?.note}
        >
          {/* (Radix's Value span takes no className or style: the flex box is its child, .button > :first-child sizes it.) */}
          <Select.Value>
            <span className={styles.value}>
              {selected?.icon && <img className={styles.icon} src={selected.icon} alt="" />}
              <Label option={selected} />
            </span>
          </Select.Value>
          <Select.Icon asChild>
            <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={styles.list}
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            ref={(node) => {
              // Radix mounts the items after this ref runs: centre on the next frame.
              if (node) requestAnimationFrame(() => centreSelected(node));
            }}
          >
            <Select.Viewport ref={viewport} className={styles.viewport}>
              {ungrouped.map((o) => (
                <Option key={o.value} option={o} />
              ))}
              {groups.map((group) => (
                <Select.Group key={group}>
                  <Select.Label className={styles.group}>{group}</Select.Label>
                  {options
                    .filter((o) => o.group === group)
                    .map((o) => (
                      <Option key={o.value} option={o} />
                    ))}
                </Select.Group>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function Option({ option }: { option: DropdownOption }) {
  return (
    <Select.Item
      value={option.value}
      textValue={option.label}
      disabled={option.disabled}
      className={clsx(styles.option, option.italic && styles.italic)}
    >
      <span className={styles.check}>
        <Select.ItemIndicator>
          <Check size={16} aria-hidden="true" />
        </Select.ItemIndicator>
      </span>
      {option.icon && <img className={styles.icon} src={option.icon} alt="" />}
      <Select.ItemText>
        <Label option={option} />
      </Select.ItemText>
      {option.badge && <span className={styles.badge}>{option.badge}</span>}
      {option.note && <span className={styles.note}>{option.note}</span>}
    </Select.Item>
  );
}

// An option's label: plain, or a pill in its colour.
function Label({ option }: { option?: DropdownOption }) {
  if (!option?.pill) return <span className={styles.label}>{option?.label}</span>;
  const ink = option.pill.ink === 'dark' ? styles.inkDark : option.pill.ink === 'light' ? styles.inkLight : undefined;
  return (
    <span className={styles.label}>
      <span className={clsx(styles.pill, ink)} style={{ '--pill-color': option.pill.color } as CSSProperties}>
        {option.label}
      </span>
    </span>
  );
}
