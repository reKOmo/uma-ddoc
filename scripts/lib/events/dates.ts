// When an event happens, from its post: the period headings, opening sentences and phase schedules, and what doubts them.

import { en } from '../news/lang/en.ts';
import type { Block, DateRef, Lexicon } from '../news/lang/index.ts';

export type Dates = { start: string | null; end: string | null };
// A phase as a post gives it (`output()` dates it as the news').
export type PostPhase = { key: string; start: string; end: string | null };

type Schedule = [string, RegExp][];

// The wording of periods, sub-events and schedules is the lexicon's (scripts/lib/news/lang/): every function below
// takes `lang`, English by default.

export function span(dates: Dates[]): Dates | null {
  const starts = dates.map((d) => d.start).filter((d): d is string => !!d);
  if (!starts.length) return null;
  const ends = dates.map((d) => d.end).filter((d): d is string => !!d);
  return { start: starts.sort()[0], end: ends.sort().at(-1) ?? null };
}

// A block's dates from its period headings (the main ones when it has any; a Champions Meeting's league selection
// counts), or null.
export function headingPeriod(block: Block, year: DateRef, lang: Lexicon): Dates | null {
  const periodSections = block.sections.filter((s) => lang.period.test(s.heading) && !lang.notOwn.test(s.heading));
  // A "Gift Timing" list is moments, not periods: from the first to the last.
  const parse = (sections: Block['sections']): Dates | null =>
    span(
      sections.flatMap((s): Dates[] => {
        const dates = s.lines.filter(lang.periodLine).map((line) => lang.parsePeriod(line, year));
        const moments = dates
          .map((d) => d.start)
          .filter((d): d is string => !!d)
          .sort();
        return lang.timing.test(s.heading) && moments.length > 1
          ? [{ start: moments[0], end: moments.at(-1) ?? null }]
          : dates;
      })
    );
  const main = periodSections.filter((s) => lang.main.test(s.heading));
  return (main.length && parse(main)) || parse(periodSections) || null;
}

// The start a block's opening sentences give ("As of 10:00 p.m., Oct 7, 2026 (UTC), …"), or null.
export function openingPeriod(block: Block, year: DateRef, lang: Lexicon): Dates | null {
  const opening = block.intro.find((line) => lang.starts.test(line) && lang.opening(line));
  return opening ? { start: lang.parsePeriod(opening, year).start, end: null } : null;
}

// An event's schedule, from its post's phase headings: [{ key, start, end }] in order (a Champions Meeting's: CM_PHASES).
// Its keys are the same in every lexicon (the app's list: src/timeline/events.ts).
export const CM_PHASES = en.cmPhases;
export function cmPhases(
  block: Block,
  year: DateRef,
  lang: Lexicon = en,
  schedule: Schedule = lang.cmPhases
): PostPhase[] {
  // (A "coming soon" post lists them as lines instead: "League Selection: From 10:00 p.m., Oct 27, 2026 (UTC)".)
  const labelled = block.sections
    .flatMap((s) => s.lines)
    .map((l) => l.match(/^(.+?)[:：]\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m);
  return schedule.flatMap(([key, re]) => {
    const section = block.sections.find((s) => re.test(s.heading));
    const line =
      section?.lines.find((l) => lang.periodLine(l) && lang.parsePeriod(l, year).start) ??
      labelled.find(
        ([, label, rest]) => (re.test(label) || re.test(`${label} period`)) && lang.parsePeriod(rest, year).start
      )?.[2];
    if (!line) return [];
    const { start, end } = lang.parsePeriod(line, year);
    // TODO(ts): the line was picked for having a start, which the compiler can't follow
    return [{ key, start: start as string, end }];
  });
}

// Why an event's dates may be wrong, or null (`headed`: they come from period headings).
export function datesDoubt(
  blocks: Block[],
  period: Dates | null,
  headed: boolean | Dates | null,
  lang: Lexicon
): string | null {
  if (!period) return null;
  if (blocks.some((b) => b.sections.some((s) => lang.timing.test(s.heading)))) return 'dates from a list of moments';
  return headed ? null : 'dates from a sentence, not a period heading';
}
