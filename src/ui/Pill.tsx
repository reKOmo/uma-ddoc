import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillStatus = 'live' | 'predicted' | 'confirmed' | 'ended';
export type PillSize = 'sm' | 'lg';

type PillCommon = {
  tone?: string;
  size?: PillSize;
  title?: string;
  className?: string;
  children: ReactNode;
};

// `status` without a status: the same small badge, in its tone (the Timeline sheet's "paid").
export type PillProps = PillCommon &
  (
    | { variant: 'status'; status?: PillStatus }
    | { variant: 'tag' | 'kind' | 'tinted' | 'verdict' | 'label' | 'count'; status?: undefined }
  );

type PillLook = { variant: PillProps['variant']; status?: PillStatus; size?: PillSize };

// A pill's classes, for an element that must be something else than Pill's <span> (the Timeline search's chips are
// downshift's buttons and options); its colour still comes from `data-tone` on that element.
export const pillClass = ({ variant, status, size }: PillLook): string =>
  clsx(styles[variant], status && styles[status], size && styles[size]);

export default function Pill({ variant, status, tone, size, title, className, children }: PillProps) {
  return (
    <span
      className={clsx(pillClass({ variant, status, size }), className)}
      data-tone={tone}
      title={title}
      // A count beside a heading repeats what its list tells a screen reader.
      aria-hidden={variant === 'count' || undefined}
    >
      {children}
    </span>
  );
}
