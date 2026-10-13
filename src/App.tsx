// @ts-nocheck
import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarRange, Route, Settings, Trophy } from 'lucide-react';
import { getServerConfig } from '../tierlist/scenarios.ts';
import { scenarioOptions } from '../tierlist/index.ts';
import { SERVERS } from './servers.ts';
import { serverName } from './i18n/index.ts';
import TierListPage from './pages/TierListPage.tsx';
import TimelinePage from './pages/TimelinePage.tsx';
import CardPage from './pages/CardPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { useSettings } from './settings.tsx';
import ScenarioPage from './pages/ScenarioPage.tsx';
import ScenariosPage from './pages/ScenariosPage.tsx';
import { useTranslation } from 'react-i18next';

// Hash routes, so GitHub Pages never has to serve a deep link. These are the tabs.
// Settings (src/settings.jsx) come through context, not props.
const ROUTES = {
  '#/': { label: 'nav.tierList', title: 'tierList.title', Icon: Trophy, Page: TierListPage },
  '#/timeline': {
    label: 'nav.timeline',
    title: 'timeline.title',
    Icon: CalendarRange,
    Page: TimelinePage,
    fullHeight: true,
  },
  '#/scenarios': { label: 'nav.scenarios', title: 'scenarioList.title', Icon: Route, Page: ScenariosPage },
  '#/settings': { label: 'nav.settings', title: 'settings.title', Icon: Settings, Page: SettingsPage },
};
// Detail pages (not tabs, no title; the top bar shows a back button): #/card/<id>, #/scenario/<key>.
const CARD_ROUTE = /^#\/card\/(\d+)$/;
const SCENARIO_ROUTE = /^#\/scenario\/([\w-]+)$/;
// The Timeline on a given server with one entry (a banner or an event, by its id: unique on a server) open, e.g. the
// card page's "See banner". The Timeline keeps its address so while a sheet is open, so going back to it (from a
// card's page) opens that sheet again.
const TIMELINE_ROUTE = /^#\/timeline\/(gl|jp)\/([\w-]+)$/;

// Old addresses that still work.
const ALIASES = { '#/banners': '#/timeline' };

function parseHash(raw) {
  const hash = ALIASES[raw] ?? raw;
  const card = hash.match(CARD_ROUTE);
  // A card's page keeps the Cards tab highlighted, a scenario's the Scenarios tab.
  if (card) return { route: '#/card', tab: '#/', Page: CardPage, params: { cardId: Number(card[1]) } };
  const scenario = hash.match(SCENARIO_ROUTE);
  if (scenario) return { route: hash, tab: '#/scenarios', Page: ScenarioPage, params: { scenarioKey: scenario[1] } };
  const link = hash.match(TIMELINE_ROUTE);
  if (link) {
    return {
      route: '#/timeline',
      ...ROUTES['#/timeline'],
      params: { linkServer: link[1], linkId: link[2] },
    };
  }
  const route = ROUTES[hash] ? hash : '#/';
  return { route, ...ROUTES[route], params: {} };
}

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return { ...parseHash(hash), hash };
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export default function App() {
  const { t } = useTranslation();
  const { route, tab, Page, title, fullHeight, params, hash } = useHashRoute();
  // Re-render everything when a setting changes: some readers are plain functions (scenarioName()).
  useSettings();
  const [server, setServer] = useState('gl');
  const [scenario, setScenario] = useState(getServerConfig('gl').defaultScenario);

  // Servers offer different scenarios; fall back to the new server's default.
  function changeServer(next) {
    setServer(next);
    if (!scenarioOptions(next).includes(scenario)) setScenario(getServerConfig(next).defaultScenario);
  }

  // A Timeline link names its server; switch to it (every new link: a banner's or event's counterpart goes there).
  const { linkServer } = params;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new link switches; picking a server by hand afterwards stays.
  useEffect(() => {
    if (linkServer && linkServer !== server) changeServer(linkServer);
  }, [hash]);

  return (
    <div className="app">
      <header className="topbar">
        {title ? (
          <h1>{t(title)}</h1>
        ) : (
          <button type="button" className="back-button" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('common.back')}
          </button>
        )}
        <fieldset className="segmented server-switch" aria-label={t('common.server')}>
          {Object.keys(SERVERS).map((key) => (
            <button type="button" key={key} aria-pressed={key === server} onClick={() => changeServer(key)}>
              {serverName(key)}
            </button>
          ))}
        </fieldset>
      </header>
      {/* Keyed by route so each page starts scrolled to the top. */}
      <main key={route} className={fullHeight ? 'app-main full-height' : 'app-main'}>
        <Page {...params} server={server} scenario={scenario} onScenarioChange={setScenario} />
      </main>
      <nav className="tabbar">
        {Object.entries(ROUTES).map(([hash, { label, Icon }]) => (
          <a key={hash} href={hash} className={hash === (tab ?? route) ? 'active' : undefined}>
            <Icon className="tab-icon" size={22} aria-hidden="true" />
            {t(label)}
          </a>
        ))}
      </nav>
    </div>
  );
}
