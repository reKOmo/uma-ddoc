import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { COMBINED } from '../../tierlist/index.ts';
import { cards, loadCards } from '../../tierlist/cards.ts';
import type { Server } from '../../tierlist/cards.ts';
import { getServerConfig } from '../../tierlist/scenarios.ts';
import { STAT_OF_TYPE } from '../lib/tiers.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { cardArt, cardPage } from '../lib/gametora.ts';
import BackToTop from '../ui/BackToTop.tsx';
import LinkButton from '../ui/LinkButton.tsx';
import Pill from '../ui/Pill.tsx';
import TypePill from '../ui/TypePill.tsx';
import { Section } from '../ui/Section.tsx';
import Status from '../ui/Status.tsx';
import Banners from './card/Banners.tsx';
import CardArt from './card/CardArt.tsx';
import { OriginPill } from './card/Origins.tsx';
import NextBanner from './card/NextBanner.tsx';
import SummaryTiles from './card/Summary.tsx';
import RankOverTime from './card/RankOverTime.tsx';
import ScenarioFilter from './card/ScenarioFilter.tsx';
import ScenarioTierTable from './card/ScenarioTierTable.tsx';
import { useOrigins, usePredictions, useScenarioRankings } from './card/hooks.ts';
import { currentScenario, nameOf, otherNames, titleOf } from './card/shared.ts';
import { useLanguage, useTranslations } from '../lib/translations.ts';
import { FanTl } from '../ui/FanTl.tsx';
import './card.css'; // the Rank over time picker's size (a global class of the Dropdown's)
import styles from './CardPage.module.css';

// The rarity as the game's badge, in its colours.
const RARITY_CLASS: Record<'R' | 'SR' | 'SSR', string | undefined> = { R: styles.r, SR: styles.sr, SSR: styles.ssr };

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
  const predictions = usePredictions(server);
  const predicted = predictions?.cards[cardId];
  // A card not out yet but predicted is ranked among the cards to come, by its JP stats.
  const upcoming = released === false && !!predicted;
  const rankings = useScenarioRankings(server, stat, !!stat && (released === true || upcoming), upcoming);

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
        <CardArt className={styles.art} src={cardArt(cardId)} alt={name} rarity={card.rarity} />
        <div className={styles.facts}>
          <div className={styles.identity}>
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
              <Pill variant="tag" className={clsx(styles.rarity, RARITY_CLASS[card.rarity])}>
                {t(`rarity.${card.rarity}`)}
              </Pill>
              {stat && <TypePill stat={stat} />}
              {card.type === 'group' && <Pill variant="tag">{t('card.group')}</Pill>}
            </p>
            {gametora && (
              <p className={styles.gametora}>
                <LinkButton href={gametora} external>
                  {t('card.viewOnGameTora')}
                </LinkButton>
              </p>
            )}
          </div>
          <SummaryTiles
            cardId={cardId}
            server={server}
            stat={stat}
            rankings={rankings}
            predictions={predictions}
            released={released ?? null}
            pull={<NextBanner cardId={cardId} server={server} origins={origins} />}
          />
        </div>
      </div>

      <div className={styles.columns}>
        {/* A card not out yet has no tiers; its release tile above says when it comes. */}
        <Section title={t('card.tierByScenario')} action={<ScenarioFilter scenarios={scenarios} combined={combined} />}>
          {released === null ? (
            <Status>{t('common.loading')}</Status>
          ) : (
            <ScenarioTierTable
              cardId={cardId}
              scenarios={scenarios}
              combined={combined}
              scenario={currentScenario(server)}
              rankings={rankings}
              noStats={!released && !upcoming}
            />
          )}
        </Section>
        <Banners card={card} server={server} origins={origins} />
      </div>

      {(released || upcoming) && rankOverTime}
      <BackToTop />
    </div>
  );
}
