// A free scout campaign's windows, from its event's lines ("Daily Free 10x Scout", a celebration's "Daily Free Scout"):
// each eligible scout's window, and how many free scouts a player who logs in every day gets in it; then its banner
// (bannerOf(), when the records are rebuilt with the banners).
//
// The count: one free scout at each daily reset inside the window, plus one when it opens off a reset, unless it
// carries on the window before it (the eligible scout changed: that day's scout was the earlier one's). Checked against
// what the post states ("up to a maximum of 10 times", "(9 days total)"): a mismatch is a doubt for the model, whose
// windows are counted the same way (counted()).

import { norm } from './news-text.ts';
import type { BannerType, DateRef, Lexicon, ScoutLexicon } from './news-lang/index.ts';
import type { Banner, BannerFile, BannerId } from '../../shared/schemas/banner.ts';
import type { GameEvent } from '../../shared/schemas/event.ts';

// scout: its name as the post writes it; type: null when the name doesn't say (any scout running then).
export type ScoutWindow = {
  scout: string;
  type: BannerType | null;
  start: string;
  end: string;
  size: 1 | 10;
  scouts: number;
};
// A window as read, before it's counted (days: what the post states for it, if anything).
export type FoundWindow = Pick<ScoutWindow, 'scout' | 'type' | 'start' | 'end'> & { days: number | null };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Free scouts a window gives (resetHour: the daily reset, in UTC hours).
export function windowScouts(start: string, end: string, resetHour: number, opens: boolean): number {
  const [s, e] = [Date.parse(start), Date.parse(end)];
  const reset = resetHour * HOUR;
  const resets = Math.floor((e - reset) / DAY) - Math.ceil((s - reset) / DAY) + 1;
  return Math.max(0, resets) + (opens && (s - reset) % DAY !== 0 ? 1 : 0);
}

// The lines about the daily free scout.
export const dailyLines = (lines: string[], words: ScoutLexicon): string[] => lines.filter((l) => words.daily.test(l));

// Windows counted, and their total. `stated`: a window's stated days stand for its count (the model's windows, whose
// days were checked against the text).
export function counted(
  found: FoundWindow[],
  about: string[],
  words: ScoutLexicon,
  stated = false
): { scouts: ScoutWindow[]; total: number } {
  // (A part may hold two campaigns, a single scout's and a 10x's: a sentence naming the scout's type decides.)
  const sizeOf = (type: BannerType | null): 1 | 10 => {
    const named = type ? about.filter((l) => words.named(l) === type) : [];
    return (named.length ? named : about).some((l) => words.ten.test(l)) ? 10 : 1;
  };
  const sized = found.map((w) => ({ ...w, size: sizeOf(w.type) }));
  const scouts = sized.map(({ scout, type, start, end, size, days }): ScoutWindow => {
    const opens = !sized.some((w) => w.size === size && Date.parse(w.end) + MINUTE === Date.parse(start));
    const n = stated && days != null ? days : windowScouts(start, end, words.resetHour, opens);
    return { scout, type, start, end, size, scouts: n };
  });
  // (Scouts sharing a window are a choice: that day's free scout on either.)
  const shared = new Map(scouts.map((w) => [`${w.start} ${w.end} ${w.size}`, w.scouts]));
  return { scouts, total: [...shared.values()].reduce((sum, n) => sum + n, 0) };
}

// The windows an event's lines give and why the rules doubt them, or null when the lines have no daily free scout.
export function scoutWindows(
  lines: string[],
  year: DateRef,
  lang: Lexicon
): { scouts: ScoutWindow[]; doubt: string | null } | null {
  const words = lang.scouts;
  if (!words) return null;
  const about = dailyLines(lines, words);
  if (!about.length) return null;
  const found: FoundWindow[] = [];
  // (JP: a list of eligible scouts without windows of their own, under the campaign's period: they take it.)
  let campaign: { start: string | null; end: string | null } = { start: null, end: null };
  lines.forEach((line, i) => {
    const type = words.scout(line);
    if (!type) {
      const period = lang.periodLine(line) ? lang.parsePeriod(line, year) : null;
      if (period?.start && period.end) campaign = period;
      return;
    }
    const own = lang.parsePeriod(lines[i + 1] ?? '', year);
    const { start, end } = own.start && own.end ? own : campaign;
    if (!start || !end) return;
    const days = `${lines[i + 1]} ${lines[i + 2] ?? ''}`.match(words.days);
    found.push({ scout: words.name(line), type, start, end, days: days ? Number(days[1]) : null });
  });
  if (!found.length) return { scouts: [], doubt: 'free scouts, but no windows the rules read' };
  const { scouts, total } = counted(found, about, words);
  const stated = about.map((l) => l.match(words.total)).find(Boolean);
  const wrong = found.findIndex((w, n) => w.days != null && w.days !== scouts[n].scouts);
  const doubt =
    wrong >= 0
      ? `a window gives ${scouts[wrong].scouts} days, the post says ${found[wrong].days}`
      : stated && Number(stated[1]) !== total
        ? `the windows give ${total} free scouts, the post says ${stated[1]}`
        : null;
  return { scouts, doubt };
}

// A window's banner: of its type (either, when it has none), open when the window starts, never a paid scout (JP);
// the one named as the post names the scout (JP's banners have names: 3145's free scout is 「ピックアップ プリティー
// ダービーガチャ」, not the premium one beside it), else the newest (Global runs two of a type at once and the newer is
// the "Spotlight" one; post 373: one opening later in the window isn't eligible).
export function bannerOf(window: ScoutWindow, banners: Pick<BannerFile, 'characters' | 'cards'>): BannerId | null {
  const list =
    window.type === 'support'
      ? banners.cards
      : window.type === 'character'
        ? banners.characters
        : [...banners.characters, ...banners.cards];
  const at = Date.parse(window.start);
  const open = list
    .filter((b) => !b.paid && Date.parse(b.start.date) <= at + HOUR && (!b.end || Date.parse(b.end.date) > at))
    .sort((a, b) => b.start.date.localeCompare(a.start.date));
  return (open.find((b) => b.name && norm(b.name) === norm(window.scout)) ?? open[0])?.id ?? null;
}

// Banners with the free pulls their events' windows give (`free_pulls`, pulls: scouts × size), none where they give
// none. A window two posts list (a celebration's part and the campaign's own post, 364 and 373) counts once.
export function withFreePulls(banners: BannerFile, events: GameEvent[]): BannerFile {
  const windows = new Map(
    events.flatMap((e) => e.scouts ?? []).map((w) => [`${w.banner} ${w.start} ${w.end} ${w.size}`, w])
  );
  const pulls = new Map<string, number>();
  for (const w of windows.values())
    if (w.banner != null) pulls.set(String(w.banner), (pulls.get(String(w.banner)) ?? 0) + w.scouts * w.size);
  const set = (list: Banner[]) =>
    list.map(({ free_pulls, ...b }) => {
      const n = pulls.get(String(b.id));
      return n ? { ...b, free_pulls: n } : b;
    });
  return { ...banners, characters: set(banners.characters), cards: set(banners.cards) };
}
