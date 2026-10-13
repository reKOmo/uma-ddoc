// A support card as a link row: its square icon (shown whole), the name in bold, the title small beneath, then `meta`
// (anything extra, e.g. a date or a pill). Used by the card page's "passed" list and the sheets' featured items.
//
// <CardRow href="/card/30001" icon={iconUrl} name="Kitasan Black" title="Dreams" meta={<Pill />} />

import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './CardRow.module.css';

export type CardRowProps = {
  href: string;
  icon: string;
  name: string;
  title?: string | null;
  meta?: ReactNode;
  className?: string;
};

export function CardRow({ href, icon, name, title, meta, className }: CardRowProps) {
  return (
    <a className={clsx(styles.row, className)} href={href}>
      <img className={styles.icon} src={icon} alt="" loading="lazy" />
      <span className={styles.text}>
        <strong>{name}</strong>
        {title && <small className={styles.title}>{title}</small>}
      </span>
      {meta}
    </a>
  );
}
