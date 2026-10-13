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
