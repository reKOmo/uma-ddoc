import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Redirect, Route, Router, Switch, useLocation, useRoute } from 'wouter';
import { ArrowLeft, CalendarRange, Route as RouteIcon, Settings, Trophy } from 'lucide-react';
import { getServerConfig } from '../tierlist/scenarios.ts';
import { scenarioOptions } from '../tierlist/index.ts';
import { SERVERS, type Server } from './servers.ts';
import { serverName } from './i18n/index.ts';
import TierListPage from './pages/TierListPage.tsx';
import TimelinePage from './pages/TimelinePage.tsx';
import CardPage from './pages/CardPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { useSettings } from './settings.tsx';
import ScenarioPage from './pages/ScenarioPage.tsx';
import ScenariosPage from './pages/ScenariosPage.tsx';
import { useTranslation } from 'react-i18next';
import { ALIAS, PATTERNS, TAB_URLS, isServer, useHashLocation } from './routes.ts';
import { Segmented } from './ui/Segmented.tsx';
import styles from './App.module.css';

// The tabs, in order. Settings (src/settings.tsx) come through context, not props.
const TABS = [
  { url: TAB_URLS.cards, label: 'nav.tierList', Icon: Trophy },
  { url: TAB_URLS.timeline, label: 'nav.timeline', Icon: CalendarRange },
  { url: TAB_URLS.scenarios, label: 'nav.scenarios', Icon: RouteIcon },
  { url: TAB_URLS.settings, label: 'nav.settings', Icon: Settings },
];
// Each tab's top bar title. The detail pages (a card, a scenario) have none: the top bar shows a back button.
const TITLES: Record<string, string> = {
  [TAB_URLS.cards]: 'tierList.title',
  [TAB_URLS.timeline]: 'timeline.title',
  [TAB_URLS.scenarios]: 'scenarioList.title',
  [TAB_URLS.settings]: 'settings.title',
};

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = TAB_URLS.cards;
}

const SERVER_KEYS = Object.keys(SERVERS) as Server[];

function Shell() {
  const { t } = useTranslation();
  const [location] = useLocation();
  // Re-render everything when a setting changes: some readers are plain functions (scenarioName()).
  useSettings();
  const [server, setServer] = useState<Server>('gl');
  const [scenario, setScenario] = useState(getServerConfig('gl').defaultScenario);

  // Servers offer different scenarios; fall back to the new server's default.
  function changeServer(next: Server) {
    setServer(next);
    if (!scenarioOptions(next).includes(scenario)) setScenario(getServerConfig(next).defaultScenario);
  }

  // Which page: the detail pages (a card's, a scenario's) have no title and a back button; anything unknown is the
  // Cards tab.
  const [onCard, cardParams] = useRoute(PATTERNS.card);
  const [onScenario, scenarioParams] = useRoute(PATTERNS.scenario);
  const [onTimeline, timelineParams] = useRoute(PATTERNS.timeline);
  const [onScenarios] = useRoute(PATTERNS.scenarios);
  const [onSettings] = useRoute(PATTERNS.settings);
  const cardId = onCard && /^\d+$/.test(cardParams.id) ? Number(cardParams.id) : null;
  // A card's page keeps the Cards tab highlighted, a scenario's the Scenarios tab.
  let tab: string = TAB_URLS.cards;
  if (onTimeline) tab = TAB_URLS.timeline;
  else if (onScenarios || onScenario) tab = TAB_URLS.scenarios;
  else if (onSettings) tab = TAB_URLS.settings;
  const detail = cardId !== null || onScenario;
  // A card's pages share a key: going from one to the next keeps the scroll position, as before.
  const pageKey = cardId !== null ? 'card' : onScenario ? `scenario/${scenarioParams.key}` : tab;

  // A Timeline link names its server; switch to it (every new link: a banner's or event's counterpart goes there).
  // (An address that isn't a server's is just the Timeline.)
  const linkServer = onTimeline && isServer(timelineParams?.server) ? timelineParams.server : undefined;
  const linkId = linkServer ? timelineParams?.id : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new link switches; picking a server by hand afterwards stays.
  useEffect(() => {
    if (linkServer && linkServer !== server) changeServer(linkServer);
  }, [location]);

  const tierListProps = { server, scenario, onScenarioChange: setScenario };
  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        {detail ? (
          <button type="button" className={styles.backButton} onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('common.back')}
          </button>
        ) : (
          <h1>{t(TITLES[tab])}</h1>
        )}
        <Segmented
          label={t('common.server')}
          options={SERVER_KEYS.map((key) => ({ value: key, label: serverName(key) }))}
          value={server}
          onChange={changeServer}
          className={styles.serverSwitch}
        />
      </header>
      {/* Keyed by route so each page starts scrolled to the top. */}
      <main
        key={pageKey}
        data-scroll-root
        className={clsx(styles.appMain, tab === TAB_URLS.timeline && !detail && styles.fullHeight)}
      >
        <Switch>
          <Route path={ALIAS.from}>
            <Redirect to={ALIAS.to} replace />
          </Route>
          <Route path={PATTERNS.timeline}>
            <TimelinePage server={server} scenario={scenario} linkId={linkId} />
          </Route>
          <Route path={PATTERNS.scenarios}>
            <ScenariosPage server={server} />
          </Route>
          <Route path={PATTERNS.scenario}>
            <ScenarioPage scenarioKey={scenarioParams?.key} onScenarioChange={setScenario} />
          </Route>
          <Route path={PATTERNS.settings}>
            <SettingsPage />
          </Route>
          <Route path={PATTERNS.card}>
            {cardId !== null ? (
              <CardPage cardId={cardId} server={server} scenario={scenario} />
            ) : (
              <TierListPage {...tierListProps} />
            )}
          </Route>
          <Route>
            <TierListPage {...tierListProps} />
          </Route>
        </Switch>
      </main>
      <nav className={styles.tabbar}>
        {TABS.map(({ url, label, Icon }) => (
          <a key={url} href={url} aria-current={url === tab ? 'page' : undefined}>
            <Icon className={styles.tabIcon} size={22} aria-hidden="true" />
            {t(label)}
          </a>
        ))}
      </nav>
    </div>
  );
}

// Hash routing (wouter), so GitHub Pages never has to serve a deep link.
export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}
