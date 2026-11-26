import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Scenario } from '../../../shared/schemas/scenario.ts';
import { scenarioUrl } from '../../routes.ts';
import styles from './ScenarioNav.module.css';

type ScenarioNavProps = {
  previous: Scenario | undefined;
  next: Scenario | undefined;
};

export default function ScenarioNav({ previous, next }: ScenarioNavProps) {
  const { t } = useTranslation();
  return (
    <nav className={styles.nav} aria-label={t('scenarioPage.others')}>
      {previous ? (
        <a href={scenarioUrl(previous.key)}>
          <ChevronLeft size={18} aria-hidden="true" />
          <span>
            <small>{t('scenarioPage.previous')}</small>
            {previous.full_en ?? previous.full_jp}
          </span>
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a href={scenarioUrl(next.key)} className={styles.next}>
          <span>
            <small>{t('scenarioPage.next')}</small>
            {next.full_en ?? next.full_jp}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
      )}
    </nav>
  );
}
