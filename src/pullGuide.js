// Pull advice per card from Luh's Umamusume Support Card Encyclopedia (`pnpm fetch-pull-guide`,
// see scripts/fetch-pull-guide.js). Optional: the glob is empty when the file hasn't been generated,
// and loadPullGuide() gives null.
const FILES = import.meta.glob('../generated/pull_guide.json', { import: 'default' });

let loaded;
export function loadPullGuide() {
  const [load] = Object.values(FILES);
  loaded ??= load ? load() : Promise.resolve(null);
  return loaded;
}

// A banner runs about two weeks; one that started less than that ago may still be on.
const RUNNING_DAYS = 14;

// The card's banner the guide's advice is for now: the first that's running or still ahead on `today`
// ("YYYY-MM-DD"), counting the author's month estimates as ahead through their month. Null when every
// banner the guide lists is over (no rerun to come).
export function upcomingEntry(entries, today) {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - RUNNING_DAYS * 86400000).toISOString().slice(0, 10);
  return (
    entries.find((entry) =>
      entry.date ? entry.date >= since : entry.month ? entry.month >= today.slice(0, 7) : false
    ) ?? null
  );
}

// A link to an entry's row in the sheet (its tab, at least), or to the sheet.
export function sheetLink(url, entry) {
  if (entry?.gid == null) return url;
  return `${url}/edit#gid=${entry.gid}${entry.row ? `&range=B${entry.row}` : ''}`;
}

// Where in its month an estimate ("early Jun") points, as a day.
const PART_DAY = { early: 5, mid: 15, late: 25 };

// The Global card banner (real or predicted) an entry is about. Its first release is the earliest banner
// featuring the card (the guide's estimates and our predictions can be months apart that far ahead);
// a rerun, the one starting closest to the guide's date — within 3 weeks of an exact date, 6 weeks of an
// estimate. Null if none (event and story cards aren't on gacha banners).
export function findBanner(banners, cardId, entries, entry) {
  const featuring = banners
    .filter((banner) => banner.featured.some((item) => item.id === cardId))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (entry === entries[0]) return featuring[0] ?? null;
  const target = entry.date
    ? Date.parse(`${entry.date}T00:00:00Z`)
    : entry.month
      ? Date.parse(`${entry.month}-${String(PART_DAY[entry.part] ?? 15).padStart(2, '0')}T00:00:00Z`)
      : null;
  if (target === null) return null;
  const within = (entry.date ? 21 : 42) * 86400000;
  let best = null;
  for (const banner of featuring) {
    const distance = Math.abs(Date.parse(banner.start) - target);
    if (distance <= within && (!best || distance < best.distance)) best = { banner, distance };
  }
  return best?.banner ?? null;
}

// The notes as one paragraph: the author rarely ends a sentence with a full stop, so one is added
// where a sentence has no closing punctuation of its own.
export const notesParagraph = (notes) => notes.map((note) => (/[.!?…:)]$/.test(note) ? note : `${note}.`)).join(' ');
