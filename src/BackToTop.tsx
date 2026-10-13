// Pages scroll inside App's <main data-scroll-root>, not the window, so this watches the container it sits in.

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './BackToTop.module.css';

export default function BackToTop() {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('[data-scroll-root]');
    if (!scroller) return;
    const update = () => setShown(scroller.scrollTop > scroller.clientHeight);
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.closest<HTMLElement>('[data-scroll-root]')?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      ref={ref}
      type="button"
      className={clsx(styles.backToTop, shown && styles.shown)}
      onClick={toTop}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
