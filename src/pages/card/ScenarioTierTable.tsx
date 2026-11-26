import clsx from 'clsx';
import { Trans, useTranslation } from 'react-i18next';
import type { Ranked } from '../../../tierlist/index.ts';
import { lbName, scenarioName } from '../../i18n/index.ts';
import { cardRanks, LIMIT_BREAKS, TIER_NAMES } from '../../lib/tiers.ts';
import ScenarioPill from '../../ui/ScenarioPill.tsx';
import { useHiddenScenarios } from '../../state/hiddenScenarios.ts';
import Status from '../../ui/Status.tsx';
import styles from './ScenarioTierTable.module.css';

type RowProps = {
  scenario: string;
  ranking: Ranked[] | undefined;
  cardId: number;
  highlighted: boolean;
  // An averaged one ("Overall"…): not a real scenario, so no pill.
  averaged: boolean;
  // No stats to rank the card: the cells drawn empty under the message.
  blank: boolean;
};

function ScenarioRow({ scenario, ranking, cardId, highlighted, averaged, blank }: RowProps) {
  const { t } = useTranslation();
  const ranks = ranking && cardRanks(ranking);
  const mlb = ranks?.get(`${cardId}/4`);
  return (
    <tr className={clsx(highlighted && styles.highlighted)}>
      <th scope="row" className={styles.name}>
        {averaged ? scenarioName(scenario) : <ScenarioPill scenario={scenario} />}
      </th>
      {LIMIT_BREAKS.map((lb) => {
        const rank = ranks?.get(`${cardId}/${lb}`);
        return rank ? (
          <td key={lb} className={clsx(styles.tier, `tier-${rank.tier}`)} title={t('common.rankOf', rank)}>
            {TIER_NAMES[rank.tier]}
          </td>
        ) : (
          <td key={lb} className={clsx(styles.tier, styles.empty)}>
            {blank ? '' : ranks ? '–' : '…'}
          </td>
        );
      })}
      <td className={styles.position}>
        {mlb ? (
          <Trans i18nKey="card.rankSlash" values={mlb} components={[<span key="total" className={styles.total} />]} />
        ) : ranks && !blank ? (
          '–'
        ) : (
          ''
        )}
      </td>
    </tr>
  );
}

type TableProps = {
  cardId: number;
  scenarios: string[];
  combined: string[];
  /** The row to highlight. */
  scenario: string;
  rankings: Record<string, Ranked[]>;
  // Known up front to have no stats (not out, nothing to rank it among).
  noStats?: boolean;
};

// Filled in as the rankings finish.
export default function ScenarioTierTable({
  cardId,
  scenarios,
  combined,
  scenario,
  rankings,
  noStats = false,
}: TableProps) {
  const { t } = useTranslation();
  // The rows the reader hid (the Options sheet); a scenario added later shows.
  const hidden = useHiddenScenarios((state) => state.hidden);
  const shownScenarios = scenarios.filter((key) => !hidden.includes(key));
  const shownCombined = combined.filter((key) => !hidden.includes(key));
  const row = (key: string) => (
    <ScenarioRow
      key={key}
      scenario={key}
      ranking={rankings[key]}
      cardId={cardId}
      highlighted={key === scenario}
      averaged={combined.includes(key)}
      blank={blank}
    />
  );
  // Every ranking done and the card in none: the tier list has no stats for it.
  const keys = [...scenarios, ...combined];
  const blank =
    noStats || (keys.every((key) => rankings[key]) && !keys.some((key) => rankings[key]?.some((r) => r.id === cardId)));
  if (shownScenarios.length + shownCombined.length === 0) return <Status>{t('card.scenarioFilter.allHidden')}</Status>;
  return (
    <div className={styles.panel}>
      {blank && (
        <p className={styles.noStats}>
          <span>{t('card.noStats')}</span>
        </p>
      )}
      <table className={styles.table} aria-hidden={blank || undefined}>
        <thead>
          <tr>
            <th scope="col" className={styles.name}>
              {t('common.scenario')}
            </th>
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
        <tbody>{shownScenarios.map(row)}</tbody>
        {shownCombined.length > 0 && <tbody className={styles.averaged}>{shownCombined.map(row)}</tbody>}
      </table>
    </div>
  );
}
