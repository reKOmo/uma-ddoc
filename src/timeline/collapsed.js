// Which of the Timeline's groups (banner sections, event groups) are collapsed, kept here so they survive leaving the
// page, and in this browser's storage so they survive a reload. Storage can be missing or throw (private windows,
// blocked site data); then they're only kept until the page is closed.
//   getCollapsed() → Set of group keys ('characters', 'cards', 'events-story'…)
//   saveCollapsed(set)

const KEY = 'uma-ddoc.timelineCollapsed';

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

let current = load();

export const getCollapsed = () => current;

export function saveCollapsed(collapsed) {
  current = collapsed;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([...collapsed]));
  } catch {
    // Not remembered across reloads; still kept while the page is open.
  }
}
