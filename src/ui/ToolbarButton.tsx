import type { LucideIcon } from 'lucide-react';
import styles from './ToolbarButton.module.css';

export type ToolbarButtonProps = {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  /** Only the icon on phones (the label still names it, and shows on desktop). */
  phoneIconOnly?: boolean;
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
  phoneIconOnly,
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
      title={title ?? (phoneIconOnly ? label : undefined)}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      {!iconOnly && <span className={phoneIconOnly ? styles.phoneHidden : undefined}>{label}</span>}
      {!!badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}
