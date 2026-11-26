import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillStatus = 'live' | 'predicted' | 'confirmed' | 'ended';

type PillCommon = {
  tone?: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

export type PillProps = PillCommon &
  (
    | { variant: 'status'; status: PillStatus }
    | { variant: 'tag' | 'kind' | 'verdict' | 'label' | 'count'; status?: undefined }
  );

export default function Pill({ variant, status, tone, title, className, children }: PillProps) {
  return (
    <span
      className={clsx(styles[variant], variant === 'status' && status !== undefined && styles[status], className)}
      data-tone={tone}
      title={title}
      // A count beside a heading repeats what its list tells a screen reader.
      aria-hidden={variant === 'count' || undefined}
    >
      {children}
    </span>
  );
}
