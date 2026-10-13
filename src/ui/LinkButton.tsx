// A link drawn as an outlined pill (the card page's GameTora link, the Timeline sheet's post links).
// `external` opens it in a new tab with a trailing ExternalLink icon; `icon` (a lucide icon) is shown
// before the label and replaces that trailing icon.
//
// <LinkButton href="…" external>View on GameTora</LinkButton>
// <LinkButton href="#/timeline/…" icon={ArrowLeftRight}>Other server</LinkButton>

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
