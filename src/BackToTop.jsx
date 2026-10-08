// A floating "back to top" button, shown once the page has scrolled past one screen. Pages scroll inside
// App's <main class="app-main">, not the window, so it watches the scroll container it sits in.

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BackToTop() {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const scroller = ref.current?.closest('.app-main');
    if (!scroller) return;
    const update = () => setShown(scroller.scrollTop > scroller.clientHeight);
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.closest('.app-main')?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      ref={ref}
      type="button"
      className={shown ? 'back-to-top shown' : 'back-to-top'}
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
