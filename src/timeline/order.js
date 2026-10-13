// The order of the Timeline's lane groups (its lanes and its filter follow it), as the viewer arranged it: kept here so
// it survives leaving the page, and in this browser's storage so it survives a reload (storage can be missing or
// throw: then only until the page is closed). The same for both servers.
//   getOrder() → group keys (LANE_GROUPS' keys), in order; saveOrder(keys)
//   DEFAULT_ORDER, isDefaultOrder(keys)
//   orderedGroups(keys) → LANE_GROUPS in that order (a group the keys lack, e.g. one added since, at its default place)
//   reorderGroups(keys, shown, from, to) → the keys with the shown group at index `from` (among `shown`: the groups
//     the calendar has, in order) dropped at index `to`; the others keep their places

import { LANE_GROUPS } from './layout.js';

const KEY = 'uma-ddoc.timelineOrder';
export const DEFAULT_ORDER = LANE_GROUPS.map((group) => group.key);

export const isDefaultOrder = (keys) => keys.every((key, i) => key === DEFAULT_ORDER[i]);

// Known keys only, each once, then any group missing after the one before it by default.
function normalize(keys) {
  const known = [...new Set(keys.filter((key) => DEFAULT_ORDER.includes(key)))];
  DEFAULT_ORDER.forEach((key, i) => {
    if (known.includes(key)) return;
    const before = DEFAULT_ORDER.slice(0, i).findLast((k) => known.includes(k));
    known.splice(before ? known.indexOf(before) + 1 : 0, 0, key);
  });
  return known;
}

function load() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    return Array.isArray(saved) ? normalize(saved.filter((k) => typeof k === 'string')) : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
}

let current = load();

export const getOrder = () => current;

export function saveOrder(keys) {
  current = keys;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(keys));
  } catch {
    // Not remembered across reloads; still kept while the page is open.
  }
}

export function orderedGroups(keys) {
  const byKey = new Map(LANE_GROUPS.map((group) => [group.key, group]));
  return normalize(keys).map((key) => byKey.get(key));
}

export function reorderGroups(keys, shown, from, to) {
  const visible = keys.filter((k) => shown.includes(k));
  if (from === to || !visible[from] || !visible[to]) return keys;
  const [moved] = visible.splice(from, 1);
  visible.splice(to, 0, moved);
  // The shown groups' slots, refilled in their new order.
  let i = 0;
  return keys.map((k) => (shown.includes(k) ? visible[i++] : k));
}
