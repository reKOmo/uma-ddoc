import { type Ref, useRef, useState } from 'react';
import clsx from 'clsx';
import { Info, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { lbName, serverName } from '../../i18n/index.ts';
import ScenarioPicker from '../../ui/ScenarioPicker.tsx';
import { Section } from '../../ui/Section.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import Status from '../../ui/Status.tsx';
import { WIDE, useMediaQuery } from '../../hooks/useMediaQuery.ts';
import RankChart from './RankChart.tsx';
import { SCENARIOS } from '../../../shared/scenarioRelease.ts';
import { scenarioSegments } from '../../timeline/scenarioStrip.ts';

// The chart's zoom steps: 1 fits the card's whole life, past it the chart scrolls sideways.
const ZOOMS = [1, 2, 4, 8];
import { useRankHistory } from './hooks.ts';
import PassedBy from './PassedBy.tsx';
import { LIMIT_BREAKS } from './shared.ts';
import Pill from '../../ui/Pill.tsx';
import styles from './RankOverTime.module.css';

type RankHistorySectionProps = {
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

type RankHistory = ReturnType<typeof useRankHistory>;

type RankOverTimeProps = {
  server: Server;
  rankHistory: RankHistory;
  height: number;
  zoom?: number;
  onSelect?: (date: string) => void;
  chartRef?: Ref<HTMLDivElement>;
};

// The chart; how it's ranked is behind an (i) by the pickers (RankHistorySection).
export function RankOverTime({ server, rankHistory, height, zoom, onSelect, chartRef }: RankOverTimeProps) {
  const { t } = useTranslation();
  const { ranking, history, first, end } = rankHistory;
  if (!ranking) return <Status>{t('common.ranking')}</Status>;
  if (!history || !first || !end) return <Status>{t('card.noReleaseDate', { server: serverName(server) })}</Status>;
  return (
    <RankChart
      className={styles.rankChart}
      ref={chartRef}
      history={history}
      height={height}
      zoom={zoom}
      onSelect={onSelect}
      scenarios={scenarioSegments(SCENARIOS, server)}
    />
  );
}

// "Rank over time": one panel, the chart beside (or above) the cards that passed it.
export default function RankHistorySection({
  cardId,
  server,
  scenarios,
  combined,
  defaultScenario,
  rankings,
  predictions,
  stat,
}: RankHistorySectionProps) {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState(defaultScenario);
  const [lb, setLb] = useState(4);
  const [zoom, setZoom] = useState(0); // an index into ZOOMS
  // The server's scenario list can change under us; fall back to the page's.
  const shown = scenarios.includes(scenario) || combined.includes(scenario) ? scenario : defaultScenario;
  const rankHistory = useRankHistory({ cardId, server, scenario: shown, lb, stat, rankings, predictions });
  const { history, passes, now, first } = rankHistory;
  // Desktop: a taller chart, Passed by beside it as tall, scrolling (CSS); phones fold it under the chart.
  const wide = useMediaQuery(WIDE);
  // The marker last clicked on the chart (n tells a second click on the same one apart), for Passed by to scroll to.
  const [picked, setPicked] = useState<{ date: string; n: number } | null>(null);
  const chart = useRef<HTMLDivElement>(null);

  return (
    <Section title={t('card.rankOverTime')}>
      <div className={styles.panel}>
        <div className={styles.chart}>
          <div className={clsx('history-controls', styles.controls)}>
            <ScenarioPicker
              label={t('common.scenario')}
              value={shown}
              scenarios={scenarios}
              combined={combined}
              server={server}
              onChange={setScenario}
              hideLabel
            />
            <Segmented
              label={t('card.limitBreak')}
              options={LIMIT_BREAKS.map((n) => ({ value: n, label: lbName(n) }))}
              value={lb}
              onChange={setLb}
            />
            <div className={styles.zoom}>
              <button
                type="button"
                aria-label={t('timeline.zoomOut')}
                title={t('timeline.zoomOut')}
                disabled={zoom === 0}
                onClick={() => setZoom((z) => z - 1)}
              >
                <ZoomOut size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t('timeline.zoomIn')}
                title={t('timeline.zoomIn')}
                disabled={zoom === ZOOMS.length - 1}
                onClick={() => setZoom((z) => z + 1)}
              >
                <ZoomIn size={16} aria-hidden="true" />
              </button>
            </div>
            <details className={styles.info}>
              <summary aria-label={t('card.howRanked')} title={t('card.howRanked')}>
                <Info size={16} aria-hidden="true" />
              </summary>
              <p>{t('card.historyNote')}</p>
            </details>
          </div>
          <RankOverTime
            server={server}
            rankHistory={rankHistory}
            height={wide ? 340 : 280}
            zoom={ZOOMS[zoom]}
            chartRef={chart}
            onSelect={(date) => setPicked((p) => ({ date, n: (p?.n ?? 0) + 1 }))}
          />
        </div>
        {history && first && (
          <div className={styles.passed}>
            <h3 className={styles.passedHeading}>
              {t('card.passedBy')}
              {passes.length > 0 && <Pill variant="count">{passes.length}</Pill>}
            </h3>
            <div className={clsx('scroll-fade', styles.passedList)}>
              <PassedBy
                cardId={cardId}
                server={server}
                history={history}
                passes={passes}
                first={first}
                now={now}
                showAll={wide}
                picked={picked}
                keepInView={chart}
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
