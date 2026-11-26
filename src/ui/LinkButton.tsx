import type { LucideIcon } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './LinkButton.module.css';

type LinkButtonCommon = {
  icon?: LucideIcon;
  // Filled in the accent: the one link that leads on (the Timeline sheet's other server's).
  filled?: boolean;
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
};

// A link, or a button that goes somewhere (onClick) in the same look.
export type LinkButtonProps = LinkButtonCommon &
  (
    | { href: string; external?: boolean; onClick?: undefined }
    | { onClick: () => void; href?: undefined; external?: undefined }
  );

export default function LinkButton({
  href,
  external = false,
  onClick,
  icon: Icon,
  filled = false,
  className,
  'aria-label': label,
  children,
}: LinkButtonProps) {
  const content = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
      {external && !Icon && <ExternalLink size={16} aria-hidden="true" />}
    </>
  );
  const classes = clsx(styles.linkButton, filled && styles.filled, className);
  return onClick ? (
    <button type="button" className={classes} onClick={onClick} aria-label={label}>
      {content}
    </button>
  ) : (
    <a
      className={classes}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      aria-label={label}
    >
      {content}
    </a>
  );
}
