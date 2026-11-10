import { useTranslation } from 'react-i18next';
import styles from './TimelineSkeleton.module.css';

// Where the placeholder bars sit in each group's lanes: [start, width] in % of the row, a fixed pattern (not random,
// so it doesn't jump between renders).
const GROUPS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [2, 22],
    [30, 34],
    [70, 26],
  ],
  [
    [8, 30],
    [46, 22],
  ],
  [
    [0, 18],
    [24, 40],
    [72, 20],
  ],
];
const LANES_PER_GROUP = 2;

// The calendar's shape while it loads: the scenario strip, months and days, then groups of lanes with bars. A screen
// reader hears only "Loading timeline…".
export default function TimelineSkeleton() {
  const { t } = useTranslation();
  return (
    <div className={styles.skeleton} role="status">
      <span className={styles.label}>{t('timeline.loading')}</span>
      <div className={styles.axis} aria-hidden="true">
        <div className={styles.strip} />
        <div className={styles.month} />
        <div className={styles.days} />
      </div>
      <div aria-hidden="true">
        {GROUPS.map((bars, group) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pattern, never reordered
          <div key={group} className={styles.group}>
            <div className={styles.groupPill} />
            {Array.from({ length: LANES_PER_GROUP }, (_, lane) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pattern, never reordered
              <div key={lane} className={styles.lane}>
                {bars.map(([start, width], bar) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pattern, never reordered
                    key={bar}
                    className={styles.bar}
                    // Each lane a little further along, as banners overlap.
                    style={{ left: `${(start + lane * 7) % 80}%`, width: `${width}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
