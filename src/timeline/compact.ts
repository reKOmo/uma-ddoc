// @ts-nocheck
// Whether the Timeline is compact (rows with nothing in view fold away; on by default), kept here so it survives
// leaving the page, and in this browser's storage so it survives a reload (storage can be missing or throw: then only
// until the page is closed).
//   getCompact() → boolean
//   saveCompact(compact)

const KEY = 'uma-ddoc.timelineCompact';

function load() {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
}

let current = load();

export const getCompact = () => current;

export function saveCompact(compact) {
  current = compact;
  try {
    globalThis.localStorage?.setItem(KEY, String(compact));
  } catch {
    // Not remembered across reloads; still kept while the page is open.
  }
}
