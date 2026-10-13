// @ts-nocheck
// Which banner sections and event kinds the Timeline's filter hides, kept here so they survive leaving the page, and
// in this browser's storage so they survive a reload. Storage can be missing or throw (private windows, blocked site
// data); then they're only kept until the page is closed. The same for both servers (a kind a server hasn't got is
// just ignored there).
//   getHidden() → Set of kinds ('characters', 'cards': banner sections; 'story', 'gift'…: EVENT_KINDS) and
//     'pull:<verdict>' (support card banners by their cards' pull advice: VERDICTS in src/pullGuide.js)
//   saveHidden(set)

const KEY = 'uma-ddoc.timelineHidden';

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

let current = load();

export const getHidden = () => current;

export function saveHidden(hidden) {
  current = hidden;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([...hidden]));
  } catch {
    // Not remembered across reloads; still kept while the page is open.
  }
}
