import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import RaceTrack from '../RaceTrack.tsx';
import { DistanceBars, GroundDrops, SeasonIcon, TimeIcon, TurnArrow, WeatherIcon } from '../RaceIcons.tsx';
import type { Race } from '../../../shared/schemas/event.ts';
import shared from './shared.module.css';
import styles from './Races.module.css';

// Each race a card: its course as a headline ("Nakayama Turf 2500m"), the rest as labelled facts. A predicted
// event's are JP's.
export function Races({ races, predicted }: { races: Race[]; predicted: boolean }) {
  const { t } = useTranslation();
  if (!races.length) return null;
  const word = (field: string, value: string | null) => value && t(`events.race.${field}.${value}`);
  return (
    <>
      <h3 className={shared.heading}>{t('events.race.heading', { count: races.length })}</h3>
      <ul className={styles.races}>
        {races.map((race, i) => {
          const direction = word('direction', race.direction);
          const course = word('course', race.course);
          const varies = race.variable && t('events.race.varies');
          const facts: [string, string | null | false, (() => ReactNode)?][] = [
            ['category', word('category', race.category), () => <DistanceBars category={race.category} />],
            [
              'turns',
              direction && course ? t('events.race.turns', { direction, course }) : direction,
              () => <TurnArrow direction={race.direction} />,
            ],
            ['season', word('season', race.season), () => <SeasonIcon season={race.season} />],
            ['weather', word('weather', race.weather) || varies, () => <WeatherIcon weather={race.weather} />],
            ['ground', word('ground', race.ground) || varies, () => <GroundDrops ground={race.ground} />],
            ['time', word('time', race.time), () => <TimeIcon time={race.time} />],
          ];
          const name = [race.name, race.opponent && t('events.race.vs', { name: race.opponent })]
            .filter(Boolean)
            .join(' · ');
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a post's races in its order, never reordered
            <li key={i} className={styles.race}>
              {name && <span className={styles.raceName}>{name}</span>}
              <div className={styles.raceHead}>
                <RaceTrack distance={race.distance} direction={race.direction} />
                <strong className={styles.raceCourse}>
                  {[
                    t(`events.race.track.${race.track}`, { defaultValue: race.track }),
                    word('surface', race.surface),
                    race.distance != null && `${race.distance}m`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </strong>
              </div>
              <dl className={styles.raceFacts}>
                {facts.map(
                  ([key, value, icon]) =>
                    value && (
                      <div key={key} className={key === 'turns' ? styles.wide : undefined}>
                        <dt className="section-label">{t(`events.race.label.${key}`)}</dt>
                        <dd>
                          {icon?.()}
                          {value}
                        </dd>
                      </div>
                    )
                )}
              </dl>
            </li>
          );
        })}
      </ul>
      {predicted && <p className={shared.rankNote}>{t('events.race.fromJp')}</p>}
    </>
  );
}
