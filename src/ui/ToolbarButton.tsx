// A button of a page's toolbar (the Timeline's): an icon with its label beside it, or the icon alone (iconOnly), the
// label then its aria-label. `pressed` makes it a toggle (aria-pressed), `disabled` greys it out.
//
// <ToolbarButton icon={Filter} label="Filter" onClick={open} iconOnly />

import type { LucideIcon } from 'lucide-react';
import styles from './ToolbarButton.module.css';

export type ToolbarButtonProps = {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  title?: string;
};

export function ToolbarButton({ icon: Icon, label, onClick, pressed, disabled, iconOnly, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={iconOnly ? label : undefined}
      title={title}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      {!iconOnly && label}
    </button>
  );
}
