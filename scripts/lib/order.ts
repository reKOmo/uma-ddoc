// The data files' one order: newest start first. Ties: events by id as text, banners by id as a number (the files
// were always written this way; switching either reorders data/).
type Started = { start: { date: string } };
// (a JP banner id may carry a suffix after its number: parseInt, not Number)
const bannerNumber = (id: string | number): number => Number.parseInt(String(id), 10);

export const newestEventsFirst = (a: Started & { id: string }, b: Started & { id: string }): number =>
  b.start.date.localeCompare(a.start.date) || b.id.localeCompare(a.id);

export const newestBannersFirst = (
  a: Started & { id: string | number },
  b: Started & { id: string | number }
): number => b.start.date.localeCompare(a.start.date) || bannerNumber(b.id) - bannerNumber(a.id);
