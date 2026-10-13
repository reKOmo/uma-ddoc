import { type CSSProperties, memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { scenarioName } from '../i18n/index.ts';
import { type DateFormats, dateRange } from './format.ts';
import type { Timeline } from './layout.ts';
import type { ScenarioSegment } from './scenarioStrip.ts';
import type { loadTimeline } from './data.ts';
import styles from './TimelineAxis.module.css';
import { scenarioUrl } from '../routes.ts';

// Label every day when there's room, else every 2nd day, else weekly. Weekly labels stop at the 22nd so they never
// collide with the next month's 1st.
const dayLabelStep = (px: number) => (px >= 16 ? 1 : px >= 8 ? 2 : 7);
const showDayLabel = (date: number, step: number) => (date - 1) % step === 0 && (step < 7 || date <= 22);
const scenarioStyle = (s: ScenarioSegment): CSSProperties | undefined =>
  s.color ? ({ '--scenario-color': s.color } as CSSProperties) : undefined;

// A server's mark over the calendar (loadTimeline()'s).
type Mark = Awaited<ReturnType<typeof loadTimeline>>['marks'][number];

type AxisProps = { timeline: Timeline; scenarios: ScenarioSegment[]; px: number; format: DateFormats };

// The calendar's sticky header: which Career scenario runs when (each opens its page), months, days.
// `timeline`: buildTimeline() (./layout.js); `scenarios`: scenarioSegments() (./scenarioStrip.js); `px`: per day.
// Memoised, like the lanes: a day label per day.
export const TimelineAxis = memo(function TimelineAxis({ timeline, scenarios, px, format }: AxisProps) {
  const { t } = useTranslation();
  const step = dayLabelStep(px);
  return (
    <div className={styles.axis}>
      <ul className={styles.axisScenarios} aria-label={t('timeline.scenarios')}>
        {scenarios.map((s) => {
          const from = Math.max(timeline.at(s.start), 0);
          const to = s.end === null ? timeline.days : timeline.at(s.end);
          if (to <= 0 || from >= timeline.days) return null;
          return (
            <li
              key={s.key}
              className={clsx(
                styles.scenario,
                s.tag === 'confirmed' && styles.tagConfirmed,
                s.tag === 'predicted' && styles.tagPredicted,
                s.current && styles.current,
                s.ink === 'dark' && styles.inkDark,
                s.ink === 'light' && styles.inkLight
              )}
              style={{ left: from * px, width: (to - from) * px, ...scenarioStyle(s) }}
              title={t('timeline.scenarioTitle', {
                name: s.name,
                status: t(`timeline.scenarioTag.${s.tag}`),
                dates: dateRange(
                  {
                    start: new Date(s.start).toISOString(),
                    end: s.end === null ? null : new Date(s.end).toISOString(),
                  },
                  format.long
                ),
              })}
            >
              <a className={styles.scenarioLink} href={scenarioUrl(s.key)}>
                {/* The arrow: right after the name on desktop (moves with it), at the right edge on phones. */}
                <span className={styles.scenarioLabel}>
                  <span className={styles.scenarioName}>
                    <strong>{scenarioName(s.key)}</strong> {s.name}
                  </span>
                  <ChevronRight className={clsx(styles.scenarioArrow, styles.inline)} size={16} aria-hidden="true" />
                </span>
                <ChevronRight className={clsx(styles.scenarioArrow, styles.edge)} size={16} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      <div className={styles.axisMonths}>
        {timeline.months.map(({ date, day }) => (
          <span
            key={day}
            className={clsx(styles.tick, format.isJanuary(date) && styles.year)}
            style={{ left: day * px }}
          >
            {format.month(date, format.isJanuary(date))}
          </span>
        ))}
      </div>
      <div className={styles.axisDays}>
        {timeline.dayDates
          .filter(({ date }) => showDayLabel(date, step))
          .map(({ day, date }) => (
            <span
              key={day}
              className={clsx(styles.day, Math.floor(timeline.today) === Math.floor(day) && styles.today)}
              style={{ left: day * px, width: px * step }}
            >
              {date}
            </span>
          ))}
      </div>
    </div>
  );
});

// Lines down the whole calendar: where each Career scenario begins, today, and the server's marks (loadTimeline()
// in ./data.js: a window and a dashed line, e.g. where Global is in JP's history).
export const CalendarLines = memo(function CalendarLines({
  timeline,
  scenarios,
  marks,
  px,
  format,
}: AxisProps & { marks: Mark[] }) {
  const { t } = useTranslation();
  return (
    <>
      {scenarios
        .filter((s) => timeline.at(s.start) > 0 && timeline.at(s.start) < timeline.days)
        .map((s) => (
          <div
            key={s.key}
            className={clsx(styles.scenarioLine, s.tag === 'predicted' && styles.tagPredicted)}
            style={{ left: timeline.at(s.start) * px, ...scenarioStyle(s) }}
          />
        ))}
      <div className={styles.todayLine} style={{ left: timeline.today * px }} />
      {marks.map((mark) => (
        <div key={mark.key} className={clsx(styles.mark, mark.key === 'global' && styles.markGlobal)}>
          {mark.window && (
            <div
              className={clsx(styles.markWindow, mark.window.open && styles.openEnd)}
              style={{
                left: timeline.at(mark.window.from) * px,
                width: Math.max((timeline.at(mark.window.to) - timeline.at(mark.window.from)) * px, 2),
              }}
            />
          )}
          <div
            className={styles.markLine}
            style={{ left: timeline.at(mark.at) * px }}
            data-label={t(`timeline.mark.${mark.key}.line`, { date: format.short(new Date(mark.at).toISOString()) })}
          />
        </div>
      ))}
    </>
  );
});
