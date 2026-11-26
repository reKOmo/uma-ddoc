import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './CardRow.module.css';

export type CardRowProps = {
  // Without one, a row that isn't a link (a trainee: no page).
  href?: string;
  icon?: string;
  name: ReactNode;
  title?: ReactNode;
  // Lines under the title.
  meta?: ReactNode;
  // On the icon's bottom edge (the row leaves room under it).
  badge?: ReactNode;
  // A tile's: a bigger icon, its title wrapping.
  large?: boolean;
  className?: string;
  // After the text, at the row's end.
  children?: ReactNode;
};

export function CardRow({ href, icon, name, title, meta, badge, large = false, className, children }: CardRowProps) {
  const content = (
    <>
      <span className={clsx(styles.icon, !!badge && styles.withBadge)}>
        {icon && <img src={icon} alt="" loading="lazy" />}
        {!!badge && <span className={styles.badge}>{badge}</span>}
      </span>
      <span className={styles.text}>
        <strong>{name}</strong>
        {title && <small className={styles.title}>{title}</small>}
        {meta}
      </span>
      {children}
    </>
  );
  const classes = clsx(styles.row, large && styles.large, className);
  return href ? (
    <a className={classes} href={href}>
      {content}
    </a>
  ) : (
    <div className={classes}>{content}</div>
  );
}
