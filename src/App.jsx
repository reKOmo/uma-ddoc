import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarRange, Route, Settings, Trophy } from 'lucide-react';
import { getServerConfig } from '../tierlist/scenarios.js';
import { scenarioOptions } from '../tierlist/index.js';
import { SERVERS } from './servers.js';
import { serverName } from './i18n/index.js';
import TierListPage from './pages/TierListPage.jsx';
import BannersPage from './pages/BannersPage.jsx';
import CardPage from './pages/CardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { useSettings } from './settings.jsx';
import ScenarioPage from './pages/ScenarioPage.jsx';
import ScenariosPage from './pages/ScenariosPage.jsx';
import { useTranslation } from 'react-i18next';

// Hash routes, so GitHub Pages never has to serve a deep link. These are the tabs.
// Settings (src/settings.jsx) come through context, not props.
const ROUTES = {
  '#/': { label: 'nav.tierList', title: 'tierList.title', Icon: Trophy, Page: TierListPage },
  '#/timeline': {
    label: 'nav.banners',
    title: 'banners.title',
    Icon: CalendarRange,
    Page: BannersPage,
    fullHeight: true,
  },
  '#/scenarios': { label: 'nav.scenarios', title: 'scenarioList.title', Icon: Route, Page: ScenariosPage },
  '#/settings': { label: 'nav.settings', title: 'settings.title', Icon: Settings, Page: SettingsPage },
};
// Detail pages (not tabs, no title; the top bar shows a back button): #/card/<id>, #/scenario/<key>.
const CARD_ROUTE = /^#\/card\/(\d+)$/;
const SCENARIO_ROUTE = /^#\/scenario\/([\w-]+)$/;
// The Timeline with one card banner open, on a given server (the card page's "See banner").
const BANNER_ROUTE = /^#\/timeline\/(gl|jp)\/(\d+)$/;

// Old addresses that still work.
const ALIASES = { '#/banners': '#/timeline' };

function parseHash(raw) {
  const hash = ALIASES[raw] ?? raw;
  const card = hash.match(CARD_ROUTE);
  if (card) return { route: '#/card', Page: CardPage, params: { cardId: Number(card[1]) } };
  const scenario = hash.match(SCENARIO_ROUTE);
  // A scenario's page keeps the Scenarios tab highlighted.
  if (scenario) return { route: hash, tab: '#/scenarios', Page: ScenarioPage, params: { scenarioKey: scenario[1] } };
  const banner = hash.match(BANNER_ROUTE);
  if (banner) {
    return {
      route: '#/timeline',
      ...ROUTES['#/timeline'],
      params: { linkServer: banner[1], bannerId: Number(banner[2]) },
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
  return parseHash(hash);
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/';
}

export default function App() {
  const { t } = useTranslation();
  const { route, tab, Page, title, fullHeight, params } = useHashRoute();
  // Re-render everything when a setting changes: some readers are plain functions (scenarioName()).
  useSettings();
  const [server, setServer] = useState('gl');
  const [scenario, setScenario] = useState(getServerConfig('gl').defaultScenario);

  // Servers offer different scenarios; fall back to the new server's default.
  function changeServer(next) {
    setServer(next);
    if (!scenarioOptions(next).includes(scenario)) setScenario(getServerConfig(next).defaultScenario);
  }

  // A banner link names its server; switch to it.
  const { linkServer } = params;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new link switches; picking a server by hand afterwards stays.
  useEffect(() => {
    if (linkServer && linkServer !== server) changeServer(linkServer);
  }, [linkServer]);

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
