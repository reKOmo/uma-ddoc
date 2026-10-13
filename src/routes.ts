import { useEffect, useState } from 'react';
import type { BaseLocationHook } from 'wouter';
import { navigate } from 'wouter/use-hash-location';
import type { Server } from './servers.ts';

// Hash routes, so GitHub Pages never has to serve a deep link. Every link in the app is built here.
//   #/                          the Cards tab (the tier list)
//   #/timeline                  the Timeline tab (#/banners still works: it redirects here)
//   #/timeline/<gl|jp>/<id>     the Timeline on that server with one entry (a banner or an event, by its id: unique on
//                               a server) open, e.g. the card page's "See banner". The Timeline keeps its address so
//                               while a sheet is open, so going back to it (from a card's page) opens that sheet again.
//   #/scenarios                 the Scenarios tab
//   #/settings                  the Settings tab
//   #/card/<id>                 one support card (not a tab: keeps the Cards tab highlighted)
//   #/scenario/<key>            one Career scenario (not a tab: keeps the Scenarios tab highlighted)

/** The tabs' addresses. */
export const TAB_URLS = {
  cards: '#/',
  timeline: '#/timeline',
  scenarios: '#/scenarios',
  settings: '#/settings',
} as const;

export const cardUrl = (id: number): string => `#/card/${id}`;
export const scenarioUrl = (key: string): string => `#/scenario/${key}`;
/** The Timeline, or (with a server and an id) the Timeline with that entry open. */
export const timelineUrl = (server?: Server, id?: string | number): string =>
  server !== undefined && id !== undefined ? `#/timeline/${server}/${id}` : TAB_URLS.timeline;

/** What wouter matches (the address without its `#`). */
export const PATTERNS = {
  cards: '/',
  // Both `/timeline` and `/timeline/<server>/<id>` in one route, so a link never remounts the page.
  timeline: '/timeline/:server?/:id?',
  scenarios: '/scenarios',
  scenario: '/scenario/:key',
  settings: '/settings',
  card: '/card/:id',
} as const;
/** Old addresses that still work: the alias and where it goes. */
export const ALIAS = { from: '/banners', to: '/timeline' } as const;

export const isServer = (value: string | undefined): value is Server => value === 'gl' || value === 'jp';

const currentLocation = (): string => `/${window.location.hash.replace(/^#?\/?/, '')}`;

/**
 * wouter's hash location, but it only follows `hashchange`. The Timeline puts the open sheet in the address with
 * `history.replaceState`, which fires none: the page must not be routed again for it (wouter's own hook reads the
 * address on every render, which would).
 */
export const useHashLocation: BaseLocationHook = () => {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const onChange = () => setLocation(currentLocation());
    window.addEventListener('hashchange', onChange);
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [location, navigate];
};
