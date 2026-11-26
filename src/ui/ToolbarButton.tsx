import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
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
  /** The count's tooltip. */
  badgeTitle?: string;
  /** Compact, for a section heading rather than a toolbar. */
  small?: boolean;
  /** It opens a dialog (a filter sheet). */
  opensDialog?: boolean;
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
  badgeTitle,
  small,
  opensDialog,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={clsx(styles.button, small && styles.small)}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
      aria-label={iconOnly ? label : undefined}
      title={title ?? (phoneIconOnly ? label : undefined)}
    >
      {Icon && <Icon size={small ? 15 : 18} aria-hidden="true" />}
      {!iconOnly && <span className={phoneIconOnly ? 'phone-visually-hidden' : undefined}>{label}</span>}
      {!!badge && (
        <span className={styles.badge} title={badgeTitle}>
          {badge}
        </span>
      )}
    </button>
  );
}
