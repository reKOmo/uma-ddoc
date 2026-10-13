import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Section.module.css';

export type SectionProps = {
  title: ReactNode;
  level?: 2 | 3;
  action?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
};

export function Section({ title, level = 2, action, id, className, children }: SectionProps) {
  const heading = level === 3 ? <h3 className={styles.title}>{title}</h3> : <h2 className={styles.title}>{title}</h2>;
  return (
    <section id={id} className={clsx(styles.section, className)}>
      <div className={styles.head}>
        {heading}
        {action}
      </div>
      {children}
    </section>
  );
}
