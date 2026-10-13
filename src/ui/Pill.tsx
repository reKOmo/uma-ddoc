// A small pill. `variant` picks the look: tag (plain), kind (an entry's kind, coloured by `tone`), status (a
// banner's status: live, upcoming, predicted, confirmed, ended; needs `status`), verdict (a pull verdict,
// `tone` = yes / no / free / whale / dolphin), label (a filled accent pill). `tone` is rendered as data-tone.
//
// <Pill variant="kind" tone={entry.tone}>Story</Pill>
// <Pill variant="status" status="live">Live</Pill>

import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export type PillStatus = 'live' | 'upcoming' | 'predicted' | 'confirmed' | 'ended';

type PillCommon = {
  tone?: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

export type PillProps = PillCommon &
  ({ variant: 'status'; status: PillStatus } | { variant: 'tag' | 'kind' | 'verdict' | 'label'; status?: undefined });

export default function Pill({ variant, status, tone, title, className, children }: PillProps) {
  return (
    <span
      className={clsx(styles[variant], variant === 'status' && status !== undefined && styles[status], className)}
      data-tone={tone}
      title={title}
    >
      {children}
    </span>
  );
}
