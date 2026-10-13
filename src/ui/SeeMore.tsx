import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './SeeMore.module.css';

export type SeeMoreProps = {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
};

export default function SeeMore({ href, onClick, className, children }: SeeMoreProps) {
  if (href !== undefined) {
    return (
      <a className={clsx(styles.seeMore, className)} href={href}>
        {children}
        <ChevronRight size={15} aria-hidden="true" />
      </a>
    );
  }
  return (
    <button type="button" className={clsx(styles.seeMore, className)} onClick={onClick}>
      {children}
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}
