import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Server } from '../../../tierlist/cards.ts';
import type { Ranked, Stat } from '../../../tierlist/index.ts';
import { scenariosOf } from '../../../tierlist/index.ts';
import { lbName, scenarioName, serverName, statName } from '../../i18n/index.ts';
import { cardRanks } from '../../tiers.ts';
import TierChip from '../../ui/TierChip.tsx';
import { LIMIT_BREAKS } from './shared.ts';
import styles from './ScenarioTierTable.module.css';

type RowProps = { scenario: string; ranking: Ranked[] | undefined; cardId: number; current: boolean };

function ScenarioRow({ scenario, ranking, cardId, current }: RowProps) {
  const { t } = useTranslation();
  const ranks = ranking && cardRanks(ranking);
  const mlb = ranks?.get(`${cardId}/4`);
  return (
    <tr className={clsx(current && styles.current)}>
      <th scope="row">{scenarioName(scenario)}</th>
      {LIMIT_BREAKS.map((lb) => {
        const rank = ranks?.get(`${cardId}/${lb}`);
        return (
          <td key={lb}>
            {!ranks ? (
              <TierChip pending />
            ) : rank ? (
              <TierChip tier={rank.tier} title={t('common.rankOf', rank)} />
            ) : (
              <TierChip />
            )}
          </td>
        );
      })}
      <td className={styles.position}>{mlb ? t('card.rankSlash', mlb) : ranks ? '–' : ''}</td>
    </tr>
  );
}

type TableProps = {
  cardId: number;
  server: Server;
  stat: Stat | undefined;
  scenarios: string[];
  combined: string[];
  scenario: string;
  rankings: Record<string, Ranked[]>;
};

// Filled in as the rankings finish.
export default function ScenarioTierTable({
  cardId,
  server,
  stat,
  scenarios,
  combined,
  scenario,
  rankings,
}: TableProps) {
  const { t } = useTranslation();
  const row = (key: string) => (
    <ScenarioRow key={key} scenario={key} ranking={rankings[key]} cardId={cardId} current={key === scenario} />
  );
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('common.scenario')}</th>
            {LIMIT_BREAKS.map((lb) => (
              <th key={lb} scope="col">
                {lbName(lb)}
              </th>
            ))}
            <th scope="col" className={styles.position}>
              {t('card.mlbRank')}
            </th>
          </tr>
        </thead>
        <tbody>{scenarios.map(row)}</tbody>
        <tbody className={styles.averaged}>{combined.map(row)}</tbody>
      </table>
      <p className={styles.note}>
        {t('card.tableNote', { stat: stat && statName(stat), server: serverName(server) })}{' '}
        {combined
          .map((key) =>
            t('card.averages', { name: scenarioName(key), scenarios: scenariosOf(server, key).map(scenarioName) })
          )
          .join(' ')}
      </p>
    </>
  );
}
