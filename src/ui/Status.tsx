// A muted line of status text (loading, nothing to show).
//
// <Status>Loading…</Status>

import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Status.module.css';

export type StatusProps = { className?: string; children: ReactNode };

export default function Status({ className, children }: StatusProps) {
  return <p className={clsx(styles.status, className)}>{children}</p>;
}
