import type { Phase } from '../../../shared/schemas/event.ts';

// When a phase ends: its own end, else when the next one starts, else the event's end.
export const phaseEnd = (phases: Phase[], i: number, eventEnd: string | null): string | null =>
  phases[i].end?.date ??
  phases.slice(i + 1).find((p) => Date.parse(p.start.date) > Date.parse(phases[i].start.date))?.start.date ??
  eventEnd;

// The phase running now (-1 when none); of overlapping ones, the one that started last.
export function currentPhase(
  phases: Phase[],
  eventEnd: string | null,
  now: number
): { current: number; end: string | null; ended: boolean[] } {
  const ends = phases.map((_, i) => phaseEnd(phases, i, eventEnd));
  const ended = ends.map((end) => end != null && Date.parse(end) <= now);
  let current = -1;
  phases.forEach((phase, i) => {
    const start = Date.parse(phase.start.date);
    if (start <= now && !ended[i] && (current < 0 || start >= Date.parse(phases[current].start.date))) current = i;
  });
  return { current, end: current >= 0 ? ends[current] : null, ended };
}
