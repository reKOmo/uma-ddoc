import type { LucideIcon } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './LinkButton.module.css';

export type LinkButtonProps = {
  href: string;
  external?: boolean;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
};

export default function LinkButton({ href, external = false, icon: Icon, className, children }: LinkButtonProps) {
  return (
    <a
      className={clsx(styles.linkButton, className)}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
      {external && !Icon && <ExternalLink size={16} aria-hidden="true" />}
    </a>
  );
}
