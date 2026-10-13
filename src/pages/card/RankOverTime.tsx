import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import { cards } from '../../../tierlist/cards.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { formatDuration, lbName, scenarioName, serverName, statName } from '../../i18n/index.ts';
import { cardIcon } from '../../gametora.ts';
import { rankHistory } from '../../rankHistory.ts';
import type { HistoryPoint } from '../../rankHistory.ts';
import { cardUrl } from '../../routes.ts';
import ScenarioPicker from '../../ScenarioPicker.tsx';
import { TIER_NAMES } from '../../tiers.ts';
import { CardRow } from '../../ui/CardRow.tsx';
import FoldToggle from '../../ui/FoldToggle.tsx';
import { Section } from '../../ui/Section.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import SeeMore from '../../ui/SeeMore.tsx';
import Status from '../../ui/Status.tsx';
import RankChart, { formatDay } from '../RankChart.tsx';
import { useUpcomingRanking } from './hooks.ts';
import { LIMIT_BREAKS, nameOf, titleOf } from './shared.ts';
import styles from './RankOverTime.module.css';

const UPCOMING_SHOWN = 2;

function timelineClass(predicted: boolean, next: HistoryPoint | undefined, fade = false): string {
  return clsx(
    predicted && styles.predicted,
    next && styles.hasNext,
    next?.predicted && styles.nextPredicted,
    fade && styles.fade
  );
}

function RankChange({ point, history }: { point: HistoryPoint; history: HistoryPoint[] }) {
  const { t } = useTranslation();
  const before = history[history.indexOf(point) - 1];
  const change = before ? Math.sign(before.position - point.position) : 0;
  const Arrow = change > 0 ? ArrowUp : change < 0 ? ArrowDown : null;
  return (
    <span className={clsx(styles.rank, change > 0 && styles.up, change < 0 && styles.down)}>
      {Arrow && <Arrow size={15} aria-label={t(change > 0 ? 'card.rankUp' : 'card.rankDown')} />}
      {t('common.rank', point)}
    </span>
  );
}

type RankOverTimeProps = {
  cardId: number;
  server: Server;
  scenarios: string[];
  combined: string[];
  defaultScenario: string;
  rankings: Record<string, Ranked[]>;
  // undefined = still loading them, null = the server has none.
  predictions: PredictionsFile | null | undefined;
  stat: Stat | undefined;
};

export default function RankOverTime({
  cardId,
  server,
  scenarios,
  combined,
  defaultScenario,
  rankings,
  predictions,
  stat,
}: RankOverTimeProps) {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState(defaultScenario);
  const [lb, setLb] = useState(4);
  // Which card's passes are unfolded, so following a "See card" link folds them again.
  const [unfolded, setUnfolded] = useState<number | null>(null);
  const allPasses = unfolded === cardId;
  // The server's scenario list can change under us; fall back to the page's.
  const shown = scenarios.includes(scenario) || combined.includes(scenario) ? scenario : defaultScenario;
  const upcoming = useUpcomingRanking(server, shown, stat, !!predictions);
  const ranking = predictions === undefined ? null : predictions ? upcoming : (rankings[shown] ?? null);

  const released = (id: number) => cards[id]?.release[server] ?? null;
  const releaseOf = (id: number) => released(id) ?? predictions?.cards[id]?.predicted_gl ?? null;
  const isPredicted = (id: number) => !released(id) && !!predictions?.cards[id];
  const history = ranking && rankHistory(ranking, cardId, lb, releaseOf, isPredicted);
  const passes = history ? history.filter((p) => p.overtakenBy.length > 0) : [];
  // Past passes, then the next UPCOMING_SHOWN predicted ones; one more is drawn fading out.
  const firstUpcoming = passes.findIndex((p) => p.predicted);
  const foldedCount = firstUpcoming < 0 ? passes.length : firstUpcoming + UPCOMING_SHOWN;
  const foldable = passes.length > foldedCount;
  const shownCount = allPasses ? passes.length : foldedCount;
  const hiddenCount = Math.max(0, passes.length - shownCount);
  const actual = history?.filter((p) => !p.predicted) ?? [];
  const now = actual.at(-1);
  const end = history?.at(-1);
  const first = history?.[0];
  // The first predicted date it sits in a lower tier than it does today.
  const drop = now && history?.find((p) => p.predicted && p.tier > now.tier);
  const foldButton = hiddenCount > 0 || (allPasses && foldable);

  return (
    <Section title={t('card.rankOverTime')}>
      <div className={clsx('history-controls', styles.controls)}>
        <ScenarioPicker
          label={t('common.scenario')}
          value={shown}
          scenarios={scenarios}
          combined={combined}
          server={server}
          onChange={setScenario}
        />
        <Segmented
          label={t('card.limitBreak')}
          options={LIMIT_BREAKS.map((n) => ({ value: n, label: lbName(n) }))}
          value={lb}
          onChange={setLb}
        />
      </div>

      {!ranking ? (
        <Status>{t('common.ranking')}</Status>
      ) : !history || !first || !end ? (
        <Status>{t('card.noReleaseDate', { server: serverName(server) })}</Status>
      ) : (
        <>
          <p className={styles.summary}>
            {now ? (
              <Trans
                i18nKey="card.historySummary"
                values={{
                  date: formatDay(first.date),
                  start: first.position,
                  startTotal: first.total,
                  now: now.position,
                  nowTotal: now.total,
                }}
                components={{ strong: <strong /> }}
              />
            ) : (
              <Trans
                i18nKey="card.arrivalSummary"
                values={{ date: formatDay(first.date), start: first.position, startTotal: first.total }}
                components={{ strong: <strong /> }}
              />
            )}
            {end.predicted && (
              <>
                {' '}
                <Trans
                  i18nKey="card.predictedSummary"
                  values={{ date: formatDay(end.date), end: end.position, endTotal: end.total }}
                  components={{ strong: <strong /> }}
                />
              </>
            )}
            {now && end.predicted && (
              <>
                {' '}
                {drop
                  ? t('card.tierDrop', {
                      from: TIER_NAMES[now.tier],
                      to: TIER_NAMES[drop.tier],
                      date: formatDay(drop.date),
                    })
                  : t('card.tierHolds', { tier: TIER_NAMES[now.tier], date: formatDay(end.date) })}
              </>
            )}
          </p>
          <RankChart history={history} nameOf={(id: number) => nameOf(id, server)} />
          <p className={styles.note}>
            {t('card.historyNote', {
              lb: lbName(lb),
              stat: stat && statName(stat),
              server: serverName(server),
              scenario: scenarioName(shown),
            })}
            {predictions && ` ${t('card.predictedNote')}`}
          </p>

          <h3 className={styles.passedHeading}>{t('card.passedBy')}</h3>
          {passes.length === 0 ? (
            <Status>{t('card.noneAbove')}</Status>
          ) : (
            <div className={styles.box}>
              <ol className={styles.list}>
                <li className={timelineClass(!now, passes[0])}>
                  <div className={styles.entry}>
                    <span className={styles.dot} />
                    <div className={styles.head}>
                      <span className={styles.date}>
                        {t(now ? 'card.releasedOn' : 'card.arrivesOn', { date: formatDay(first.date) })}
                      </span>
                      <strong>{t('common.rankOf', first)}</strong>
                    </div>
                  </div>
                  {passes[0] && (
                    <span className={styles.gap}>
                      {t('card.passedAfter', { duration: formatDuration(first.date, passes[0].date) })}
                    </span>
                  )}
                </li>
                {passes.slice(0, shownCount + 1).map((point, i) => {
                  const next = passes[i + 1];
                  const fading = i === shownCount;
                  return (
                    <li
                      key={point.date}
                      className={timelineClass(point.predicted, next, fading)}
                      inert={fading || undefined}
                    >
                      <div className={styles.entry}>
                        <span className={styles.dot} />
                        <div className={styles.head}>
                          <span className={styles.date}>{formatDay(point.date)}</span>
                          {point.predicted && <span className={styles.badgePredicted}>{t('card.predicted')}</span>}
                        </div>
                        <div className={styles.body}>
                          <RankChange point={point} history={history} />
                          <ul className={styles.cards}>
                            {point.overtakenBy.map((c) => (
                              <li key={c.id}>
                                <CardRow
                                  href={cardUrl(c.id)}
                                  icon={cardIcon(c.id, cards)}
                                  name={nameOf(c.id, server) ?? ''}
                                  title={titleOf(c.id, server)}
                                  className={styles.cardRow}
                                />
                                <SeeMore href={cardUrl(c.id)}>{t('card.seeCard')}</SeeMore>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {next && (
                        <span className={styles.gap}>
                          {t('card.passedLater', { duration: formatDuration(point.date, next.date) })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {foldButton && (
                <FoldToggle
                  className={allPasses ? styles.less : styles.more}
                  expanded={allPasses}
                  onToggle={() => setUnfolded(allPasses ? null : cardId)}
                  moreLabel={t('card.morePasses', { count: hiddenCount })}
                  lessLabel={t('card.showLess')}
                />
              )}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
