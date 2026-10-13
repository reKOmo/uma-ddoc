// @ts-nocheck
import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { scenarioName } from '../i18n/index.ts';
import { dateRange } from './format.ts';
import { scenarioUrl } from '../routes.ts';

// Label every day when there's room, else every 2nd day, else weekly. Weekly labels stop at the 22nd so they never
// collide with the next month's 1st.
const dayLabelStep = (px) => (px >= 16 ? 1 : px >= 8 ? 2 : 7);
const showDayLabel = (date, step) => (date - 1) % step === 0 && (step < 7 || date <= 22);
const scenarioStyle = (s) => s.color && { '--scenario-color': s.color };

// The calendar's sticky header: which Career scenario runs when (each opens its page), months, days.
// `timeline`: buildTimeline() (./layout.js); `scenarios`: scenarioSegments() (./scenarioStrip.js); `px`: per day.
// Memoised, like the lanes: a day label per day.
export const TimelineAxis = memo(function TimelineAxis({ timeline, scenarios, px, format }) {
  const { t } = useTranslation();
  const step = dayLabelStep(px);
  return (
    <div className="axis">
      <ul className="axis-scenarios" aria-label={t('timeline.scenarios')}>
        {scenarios.map((s) => {
          const from = Math.max(timeline.at(s.start), 0);
          const to = s.end === null ? timeline.days : timeline.at(s.end);
          if (to <= 0 || from >= timeline.days) return null;
          return (
            <li
              key={s.key}
              className={clsx('scenario', `tag-${s.tag}`, s.current && 'current', s.ink && `ink-${s.ink}`)}
              style={{ left: from * px, width: (to - from) * px, ...scenarioStyle(s) }}
              title={t('timeline.scenarioTitle', {
                name: s.name,
                status: t(`timeline.scenarioTag.${s.tag}`),
                dates: dateRange({ start: s.start, end: s.end }, format.long),
              })}
            >
              <a className="scenario-link" href={scenarioUrl(s.key)}>
                {/* The arrow: right after the name on desktop (moves with it), at the right edge on phones. */}
                <span className="scenario-label">
                  <span className="scenario-name">
                    <strong>{scenarioName(s.key)}</strong> {s.name}
                  </span>
                  <ChevronRight className="scenario-arrow inline" size={16} aria-hidden="true" />
                </span>
                <ChevronRight className="scenario-arrow edge" size={16} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      <div className="axis-months">
        {timeline.months.map(({ date, day }) => (
          <span key={day} className={clsx('tick', format.isJanuary(date) && 'year')} style={{ left: day * px }}>
            {format.month(date, format.isJanuary(date))}
          </span>
        ))}
      </div>
      <div className="axis-days">
        {timeline.dayDates
          .filter(({ date }) => showDayLabel(date, step))
          .map(({ day, date }) => (
            <span
              key={day}
              className={clsx('day', Math.floor(timeline.today) === Math.floor(day) && 'today')}
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
export const CalendarLines = memo(function CalendarLines({ timeline, scenarios, marks, px, format }) {
  const { t } = useTranslation();
  return (
    <>
      {scenarios
        .filter((s) => timeline.at(s.start) > 0 && timeline.at(s.start) < timeline.days)
        .map((s) => (
          <div
            key={s.key}
            className={`scenario-line tag-${s.tag}`}
            style={{ left: timeline.at(s.start) * px, ...scenarioStyle(s) }}
          />
        ))}
      <div className="today-line" style={{ left: timeline.today * px }} />
      {marks.map((mark) => (
        <div key={mark.key} className={`mark mark-${mark.key}`}>
          {mark.window && (
            <div
              className={clsx('mark-window', mark.window.open && 'open-end')}
              style={{
                left: timeline.at(mark.window.from) * px,
                width: Math.max((timeline.at(mark.window.to) - timeline.at(mark.window.from)) * px, 2),
              }}
            />
          )}
          <div
            className="mark-line"
            style={{ left: timeline.at(mark.at) * px }}
            data-label={t(`timeline.mark.${mark.key}.line`, { date: format.short(mark.at) })}
          />
        </div>
      ))}
    </>
  );
});
