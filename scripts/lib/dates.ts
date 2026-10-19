// A rebuild from the news keeps the fills `predict-gl` wrote into data/ for the dates the news lacks: the news (or
// GameTora) always wins; a stored fill stays over a rebuilt guess unless it ranks lower (a confirmed date over a
// predicted one; between two guesses, predict-gl's).

import type { DatedMoment } from '../../shared/schemas/common.ts';
import type { Banner } from '../../shared/schemas/banner.ts';
import type { GameEvent, Phase } from '../../shared/schemas/event.ts';

const RANK = { news: 3, gametora: 3, confirmed: 2, predicted: 1 };
const isFill = (d: DatedMoment) => d.status === 'confirmed' || d.status === 'predicted';

export function keepDate(next: DatedMoment, stored: DatedMoment | null | undefined): DatedMoment;
export function keepDate(next: DatedMoment | null, stored: DatedMoment | null | undefined): DatedMoment | null;
export function keepDate(next: DatedMoment | null, stored: DatedMoment | null | undefined): DatedMoment | null {
  if (!stored || !isFill(stored)) return next;
  if (!next) return stored;
  return RANK[stored.status] >= RANK[next.status] ? stored : next;
}

function keepPhases(next: Phase[] | undefined, stored: Phase[] | undefined): Phase[] | undefined {
  if (!stored?.length) return next;
  const own = new Map((next ?? []).map((p) => [p.key, p]));
  const keys = [...new Set([...(next ?? []).map((p) => p.key), ...stored.map((p) => p.key)])];
  const phases = keys.flatMap((key): Phase[] => {
    const n = own.get(key);
    const s = stored.find((p) => p.key === key);
    const start = n ? keepDate(n.start, s?.start) : s && isFill(s.start) ? s.start : null;
    return start ? [{ key, start, end: keepDate(n?.end ?? null, s?.end) }] : [];
  });
  // (The news' order is the schedule's; phases only a fill has go in by start.)
  return keys.length > own.size ? phases.sort((a, b) => a.start.date.localeCompare(b.start.date)) : phases;
}

export function keepEventFills(events: GameEvent[], stored: GameEvent[]): GameEvent[] {
  const byId = new Map(stored.map((e) => [e.id, e]));
  return events.map((e) => {
    const s = byId.get(e.id);
    if (!s) return e;
    const phases = keepPhases(e.phases, s.phases);
    // (in the news events' key order: phases after titles)
    const { races, news_url, image, source, ...rest } = e;
    return {
      ...rest,
      start: keepDate(e.start, s.start),
      end: keepDate(e.end, s.end),
      ...(phases && { phases }),
      ...(races && { races }),
      news_url,
      image,
      source,
    };
  });
}

export function keepBannerFills(banners: Banner[], stored: Banner[]): Banner[] {
  const byId = new Map(stored.map((b) => [b.id, b]));
  return banners.map((b) => {
    const s = byId.get(b.id);
    return s ? { ...b, start: keepDate(b.start, s.start), end: keepDate(b.end, s.end) } : b;
  });
}
