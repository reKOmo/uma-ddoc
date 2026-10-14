import { useTranslation } from 'react-i18next';
import { COMBINED } from '../../tierlist/index.ts';
import { cards, loadCards } from '../../tierlist/cards.ts';
import type { Server } from '../../tierlist/cards.ts';
import { getServerConfig } from '../../tierlist/scenarios.ts';
import { STAT_OF_TYPE } from '../tiers.ts';
import { useAsync } from '../useAsync.ts';
import { cardArt, cardPage } from '../gametora.ts';
import BackToTop from '../BackToTop.tsx';
import { serverName, statName } from '../i18n/index.ts';
import LinkButton from '../ui/LinkButton.tsx';
import Pill from '../ui/Pill.tsx';
import Status from '../ui/Status.tsx';
import { formatDay } from './RankChart.tsx';
import Origins, { OriginPill } from './card/Origins.tsx';
import PullAdvice from './card/PullAdvice.tsx';
import RankOverTime from './card/RankOverTime.tsx';
import ScenarioTierTable from './card/ScenarioTierTable.tsx';
import { useOrigins, usePredictions, useScenarioRankings } from './card/hooks.ts';
import { nameOf, titleOf } from './card/shared.ts';
import './card.css'; // the Rank over time picker's size (a global class of the Dropdown's)
import styles from './CardPage.module.css';

type CardPageProps = { cardId: number; server: Server; scenario: string };

export default function CardPage({ cardId, server, scenario }: CardPageProps) {
  const { t } = useTranslation();
  const card = cards[cardId];
  // null while loading, then whether the selected server has this card.
  const releasedLoad = useAsync(
    () => loadCards(server).then((list) => list.some((c) => c.id === cardId)),
    [server, cardId]
  );
  const released = releasedLoad.pending ? null : releasedLoad.data;

  const origins = useOrigins(cardId, server);
  const stat = card && STAT_OF_TYPE[card.type];
  const rankings = useScenarioRankings(server, stat, !!stat && released === true);
  const predictions = usePredictions(server);
  const predicted = predictions?.cards[cardId];

  if (!card) {
    return (
      <div className="page">
        <Status>{t('card.notFound', { id: cardId })}</Status>
      </div>
    );
  }

  const name = nameOf(cardId, server);
  const scenarios = getServerConfig(server).availableScenarios;
  const combined = Object.keys(COMBINED);
  const rankOverTime = (
    <RankOverTime
      cardId={cardId}
      server={server}
      scenarios={scenarios}
      combined={combined}
      defaultScenario={scenario}
      rankings={rankings}
      predictions={predictions}
      stat={stat}
    />
  );
  const title = titleOf(cardId, server) ?? card.title.en;
  const gametora = cardPage(card.links.gametora);

  return (
    <div className="page">
      <div className={styles.hero}>
        <img className={styles.art} src={cardArt(cardId)} alt={name} />
        <div className={styles.facts}>
          <h1>{name}</h1>
          {title && <p className={styles.title}>{title}</p>}
          <p className={styles.tags}>
            {origins && origins.length > 0 && <OriginPill origins={origins} />}
            <Pill variant="tag">{t(`rarity.${card.rarity}`)}</Pill>
            {stat && <Pill variant="tag">{statName(stat)}</Pill>}
            {card.type === 'group' && <Pill variant="tag">{t('card.group')}</Pill>}
          </p>
          {gametora && (
            <LinkButton href={gametora} external>
              {t('card.viewOnGameTora')}
            </LinkButton>
          )}
        </div>
      </div>

      <PullAdvice cardId={cardId} />

      <Origins card={card} server={server} origins={origins} />

      <h2 className={styles.section}>{t('card.tierByScenario')}</h2>
      {released === null ? (
        <Status>{t('common.loading')}</Status>
      ) : !released && predicted ? (
        <>
          <Status>
            {t(predicted.confirmed ? 'card.notReleasedConfirmed' : 'card.notReleasedPredicted', {
              server: serverName(server),
              date: formatDay(predicted.predicted_gl),
            })}
          </Status>
          {rankOverTime}
        </>
      ) : !released && card.release[server] ? (
        <Status>{t('card.notRanked', { server: serverName(server) })}</Status>
      ) : !released ? (
        <Status>{t('card.notReleased', { server: serverName(server) })}</Status>
      ) : (
        <>
          <ScenarioTierTable
            cardId={cardId}
            server={server}
            stat={stat}
            scenarios={scenarios}
            combined={combined}
            scenario={scenario}
            rankings={rankings}
          />
          {rankOverTime}
        </>
      )}
      <BackToTop />
    </div>
  );
}
