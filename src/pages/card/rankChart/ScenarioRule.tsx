import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateRange, scenarioName } from '../../../i18n/index.ts';
import { scenarioStyle } from '../../../lib/vividColor.ts';
import { scenarioUrl } from '../../../routes.ts';
import type { Plot, ShownScenario } from './layout.ts';
import styles from '../RankChart.module.css';

export default function ScenarioRule({ scenario: s, plot }: { scenario: ShownScenario; plot: Plot }) {
  const { t } = useTranslation();
  const w = s.right - s.left;
  const name = scenarioName(s.key);
  return (
    <a
      href={scenarioUrl(s.key)}
      className={clsx(styles.scenario, s.tag !== 'out' && styles.upcoming)}
      style={scenarioStyle(s.color)}
    >
      <title>
        {t('timeline.scenarioTitle', {
          name: s.name,
          status: t(`timeline.scenarioTag.${s.tag}`),
          dates:
            s.end === null
              ? t('timeline.since', { date: formatDate(s.start, { dateStyle: 'medium', timeZone: 'UTC' }) })
              : formatDateRange(s.start, s.end, { dateStyle: 'medium', timeZone: 'UTC' }),
        })}
      </title>
      {/* A taller transparent target than the 4px rule. */}
      <rect className={styles.scenarioHit} x={s.left} y={plot.b + 22} width={w} height={22} />
      <rect
        className={styles.scenarioRule}
        x={s.left + 1}
        y={plot.b + 24}
        width={Math.max(w - 2, 1)}
        height={4}
        rx={2}
      />
      {name.length * 6 + 4 <= w && (
        <text className={styles.scenarioName} x={s.left + 2} y={plot.b + 40}>
          {name}
        </text>
      )}
    </a>
  );
}
