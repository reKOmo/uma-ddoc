import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { DatedDay } from '../../../shared/schemas/common.ts';
import type { PredictionsFile } from '../../../shared/schemas/predictions.ts';
import type { Server } from '../../../tierlist/cards.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { formatDay, serverName } from '../../i18n/index.ts';
import type { HistoryPoint } from '../../lib/rankHistory.ts';
import { cardRanks, type Rank } from '../../lib/tiers.ts';
import ScenarioPill from '../../ui/ScenarioPill.tsx';
import TierChip from '../../ui/TierChip.tsx';
import { useSettings } from '../../state/settings.tsx';
import { dateFormats } from '../../timeline/format.ts';
import { useUpcomingAdvice } from './advice.ts';
import { useRankHistory } from './hooks.ts';
import { currentScenario, scenarioAt } from './shared.ts';
import styles from './Summary.module.css';

function Tile({ label, className, children }: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={clsx(styles.tile, className)}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{children}</div>
    </div>
  );
}

type RankTileProps = {
  scenario: string;
  // undefined = still ranking, null = not in the ranking.
  rank: Rank | null | undefined;
  // The rank it's predicted to arrive at, for a card not on the server yet.
  arrival?: boolean;
};

export function RankTile({ scenario, rank, arrival = false }: RankTileProps) {
  const { t } = useTranslation();
  return (
    <Tile
      className={styles.rankTile}
      label={
        <Trans
          i18nKey={arrival ? 'card.summary.arrivalLabel' : 'card.summary.rankLabel'}
          components={{ scenario: <ScenarioPill scenario={scenario} className={styles.scenario} /> }}
        />
      }
    >
      <TierChip className={styles.bigChip} pending={rank === undefined} tier={rank?.tier} />
      {rank && <span className={styles.rank}>{t('common.rankOf', rank)}</span>}
    </Tile>
  );
}

// Nothing without a predicted drop.
export function HoldsTile({ now, drop }: { now: HistoryPoint | undefined; drop: HistoryPoint | undefined }) {
  const { t } = useTranslation();
  if (!now || !drop) return null;
  return (
    <Tile label={t('card.summary.holdsLabel')}>
      <span className={styles.sentence}>
        <Trans
          i18nKey="card.summary.holds"
          values={{ date: formatDay(drop.date) }}
          components={{
            from: <TierChip className={styles.inlineChip} tier={now.tier} />,
            to: <TierChip className={styles.inlineChip} tier={drop.tier} />,
            date: <em />,
          }}
        />
      </span>
    </Tile>
  );
}

// Nothing without a release date to come.
// `date`: the release as shown (its banner's start in the Settings timezone, when it has one).
export function ReleaseTile({
  server,
  release,
  date,
}: {
  server: Server;
  release: DatedDay | undefined;
  date: string;
}) {
  const { t } = useTranslation();
  if (!release) return null;
  const confirmed = release.status === 'confirmed';
  return (
    <Tile label={t(confirmed ? 'card.summary.confirmedLabel' : 'card.summary.predictedLabel')}>
      <span className={styles.sentence}>
        <Trans
          i18nKey={confirmed ? 'card.summary.releaseConfirmed' : 'card.summary.releasePredicted'}
          values={{ server: serverName(server), date }}
          components={{ date: <em /> }}
        />
      </span>
    </Tile>
  );
}

type SummaryTilesProps = {
  cardId: number;
  server: Server;
  stat: Stat | undefined;
  rankings: Record<string, Ranked[]>;
  // undefined = still loading them, null = the server has none.
  predictions: PredictionsFile | null | undefined;
  // Whether the server has the card, null while loading.
  released: boolean | null;
  // Another tile after these (the pull advice).
  pull?: ReactNode;
};

// The card at a glance, in the server's current scenario at MLB.
export default function SummaryTiles({
  cardId,
  server,
  stat,
  rankings,
  predictions,
  released,
  pull,
}: SummaryTilesProps) {
  const release = released === false ? predictions?.cards[cardId]?.release_gl : undefined;
  // A card still to come arrives on its next banner (the one its predicted date comes from): that banner's start, in the
  // Settings timezone like the banner's own dates, so the two never read as different days.
  const { timeZone } = useSettings().settings;
  const advice = useUpcomingAdvice(cardId, server);
  const releaseBanner = release ? advice?.banner : null;
  const releaseAt = releaseBanner ? Date.parse(releaseBanner.start.date) : release && Date.parse(release.date);
  const releaseText = releaseBanner
    ? dateFormats(timeZone).long(releaseBanner.start.date)
    : release
      ? formatDay(release.date)
      : '';
  // A card still to come is ranked in the scenario it arrives into.
  const scenario = releaseAt ? scenarioAt(server, releaseAt) : currentScenario(server);
  const { ranking, history, now, drop } = useRankHistory({
    cardId,
    server,
    scenario,
    lb: 4,
    stat,
    rankings,
    predictions,
  });
  const ranked = rankings[scenario];
  const arrival = history?.[0];

  return (
    <div className={styles.summary}>
      <div className={styles.tiles}>
        <ReleaseTile server={server} release={release} date={releaseText} />
        {released === null ? (
          <RankTile scenario={scenario} rank={undefined} />
        ) : released ? (
          <RankTile scenario={scenario} rank={ranked ? (cardRanks(ranked).get(`${cardId}/4`) ?? null) : undefined} />
        ) : release && !ranking ? (
          <RankTile scenario={scenario} rank={undefined} arrival />
        ) : (
          arrival && <RankTile scenario={scenario} rank={arrival} arrival />
        )}
        <HoldsTile now={now} drop={drop} />
      </div>
      {pull}
    </div>
  );
}
