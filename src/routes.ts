import { useSyncExternalStore } from 'react';
import type { BaseLocationHook } from 'wouter';
import { navigate } from 'wouter/use-hash-location';
import type { Server } from './servers.ts';

// Hash routes, so GitHub Pages never has to serve a deep link. Every link in the app is built here.
// The Timeline keeps `#/timeline/<server>/<id>` in the address while a sheet is open (replaced, not pushed), so going
// back to it from a card's page reopens that sheet.

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

// One location for the whole app, changed only by `hashchange`. The Timeline puts the open sheet in the address with
// `history.replaceState`, which fires none: the app must not be routed again for it. (wouter's own hash hook reads
// the address on every render, and a hook with its own state per component reads it whenever that component mounts:
// after the Timeline has replaced it, so a link's entry got lost.)
// (Listening from the first read on, for good: React's StrictMode unsubscribes and subscribes again on mount, and a
// location read again then would be the Timeline's replaced one.)
let shared: string | null = null;
const listeners = new Set<() => void>();
function snapshot(): string {
  if (shared === null) {
    shared = currentLocation();
    window.addEventListener('hashchange', () => {
      shared = currentLocation();
      for (const listener of listeners) listener();
    });
  }
  return shared;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** wouter's location hook: the app's one location (above), and wouter's hash navigation. */
export const useHashLocation: BaseLocationHook = () => [useSyncExternalStore(subscribe, snapshot), navigate];
