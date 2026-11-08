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
import { nameOf, otherNames, titleOf } from './card/shared.ts';
import { useLanguage, useTranslations } from '../translations.ts';
import { FanTl } from '../ui/FanTl.tsx';
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
  const language = useLanguage(server);
  const tl = useTranslations();
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

  const name = nameOf(cardId, language);
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
  const title = titleOf(cardId, language, tl);
  const other = otherNames(cardId, language, tl);
  const gametora = cardPage(card.links.gametora);

  return (
    <div className="page">
      <div className={styles.hero}>
        <img className={styles.art} src={cardArt(cardId)} alt={name} />
        <div className={styles.facts}>
          <div className={styles.names}>
            <h1>
              <span>{name}</span>
              {other.name && <small className={styles.other}>{other.name}</small>}
            </h1>
            {title && (
              <p className={styles.title}>
                <span>
                  <FanTl fan={title.fan}>{title.text}</FanTl>
                </span>
                {other.title && (
                  <small className={styles.other}>
                    <FanTl fan={other.title.fan}>{other.title.text}</FanTl>
                  </small>
                )}
              </p>
            )}
          </div>
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
            {t(
              predicted.release_gl.status === 'confirmed' ? 'card.notReleasedConfirmed' : 'card.notReleasedPredicted',
              {
                server: serverName(server),
                date: formatDay(predicted.release_gl.date),
              }
            )}
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
