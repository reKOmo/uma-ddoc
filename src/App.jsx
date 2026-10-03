import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarRange, ListOrdered } from 'lucide-react';
import { getServerConfig } from '../tierlist/scenarios.js';
import { scenarioOptions } from '../tierlist/index.js';
import { SERVERS } from './servers.js';
import { serverName } from './i18n/index.js';
import TierListPage from './pages/TierListPage.jsx';
import BannersPage from './pages/BannersPage.jsx';
import CardPage from './pages/CardPage.jsx';
import { useTranslation } from 'react-i18next';

// Hash routes, so GitHub Pages never has to serve a deep link. These are the tabs.
const ROUTES = {
  '#/': { label: 'nav.tierList', title: 'tierList.title', Icon: ListOrdered, Page: TierListPage },
  '#/banners': {
    label: 'nav.banners',
    title: 'banners.title',
    Icon: CalendarRange,
    Page: BannersPage,
    fullHeight: true,
  },
};
// Detail pages (not tabs, no title; the top bar shows a back button): #/card/<id>.
const CARD_ROUTE = /^#\/card\/(\d+)$/;

function parseHash(hash) {
  const card = hash.match(CARD_ROUTE);
  if (card) return { route: '#/card', Page: CardPage, params: { cardId: Number(card[1]) } };
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
  const { route, Page, title, fullHeight, params } = useHashRoute();
  const [server, setServer] = useState('gl');
  const [scenario, setScenario] = useState(getServerConfig('gl').defaultScenario);

  // Servers offer different scenarios; fall back to the new server's default.
  function changeServer(next) {
    setServer(next);
    if (!scenarioOptions(next).includes(scenario)) setScenario(getServerConfig(next).defaultScenario);
  }

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
          <a key={hash} href={hash} className={hash === route ? 'active' : undefined}>
            <Icon className="tab-icon" size={22} aria-hidden="true" />
            {t(label)}
          </a>
        ))}
      </nav>
    </div>
  );
}
