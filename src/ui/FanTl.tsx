import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FanTl.module.css';

const UMATL_URL = 'https://github.com/UmaTL/hachimi-tl-en';

// Not an <a>: the mark sits inside bar buttons and card-row links, where a nested link is invalid HTML.
function open(event: MouseEvent | KeyboardEvent) {
  if ('key' in event && event.key !== 'Enter') return;
  event.preventDefault();
  event.stopPropagation();
  window.open(UMATL_URL, '_blank', 'noopener');
}

// A name, marked when it's UmaTL's fan translation (their terms: credited, and told apart from official names).
export function FanTl({ fan, children }: { fan: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  if (!fan) return children;
  return (
    <>
      {children}
      {/* biome-ignore lint/a11y/useSemanticElements: nested inside <button> / <a>, see open() */}
      <span className={styles.mark} role="link" tabIndex={0} title={t('fanTl.more')} onClick={open} onKeyDown={open}>
        {t('fanTl.mark')}
      </span>
    </>
  );
}
