import { useEffect, useState } from 'react';
import { CalendarRange, ListOrdered } from 'lucide-react';
import { getServerConfig } from '../tierlist/scenarios.js';
import { scenarioOptions } from '../tierlist/index.js';
import TierListPage from './pages/TierListPage.jsx';
import BannersPage from './pages/BannersPage.jsx';
import CardPage from './pages/CardPage.jsx';
import { useTranslation } from 'react-i18next';

// Hash routes, so GitHub Pages never has to serve a deep link. These are the tabs.
const ROUTES = {
  '#/': { label: 'nav.tierList', Icon: ListOrdered, Page: TierListPage },
  '#/banners': { label: 'nav.banners', Icon: CalendarRange, Page: BannersPage, fullHeight: true },
};
// Detail pages (not tabs): #/card/<id>.
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

export default function App() {
  const { t } = useTranslation();
  const { route, Page, fullHeight, params } = useHashRoute();
  const [server, setServer] = useState('gl');
  const [scenario, setScenario] = useState(getServerConfig('gl').defaultScenario);

  // Servers offer different scenarios; fall back to the new server's default.
  function changeServer(next) {
    setServer(next);
    if (!scenarioOptions(next).includes(scenario)) setScenario(getServerConfig(next).defaultScenario);
  }

  return (
    <div className="app">
      {/* Keyed by route so each page starts scrolled to the top. */}
      <main key={route} className={fullHeight ? 'app-main full-height' : 'app-main'}>
        <Page
          {...params}
          server={server}
          scenario={scenario}
          onServerChange={changeServer}
          onScenarioChange={setScenario}
        />
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
