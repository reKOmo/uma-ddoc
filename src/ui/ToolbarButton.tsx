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
  /** A count shown by the icon (none when 0). */
  badge?: number;
};

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  pressed,
  disabled,
  iconOnly,
  title,
  badge,
}: ToolbarButtonProps) {
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
      {!!badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}
