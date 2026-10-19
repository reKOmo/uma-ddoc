import type { Race } from '../../shared/schemas/event.ts';
import styles from './RaceTrack.module.css';

// A picture, not the real course: the race runs from the start line on the home straight, and the longest race
// (3600m) goes once round; the flag is where it ends.
const FULL = 3600;
const START_X = 26;
const R = 12;

type Point = [number, number];
// The track from the start line in a right-handed race's direction (clockwise: leftwards along the home straight at the
// bottom); a left-handed race is the mirror image. Lines and arcs (centre, angles), in order.
type Segment = { line: [Point, Point] } | { arc: { c: Point; from: number; to: number } };
const OVAL: Segment[] = [
  {
    line: [
      [START_X, 30],
      [18, 30],
    ],
  },
  { arc: { c: [18, 18], from: Math.PI / 2, to: (3 * Math.PI) / 2 } },
  {
    line: [
      [18, 6],
      [46, 6],
    ],
  },
  { arc: { c: [46, 18], from: -Math.PI / 2, to: Math.PI / 2 } },
  {
    line: [
      [46, 30],
      [START_X, 30],
    ],
  },
];
const STRAIGHT: Segment[] = [
  {
    line: [
      [8, 18],
      [56, 18],
    ],
  },
];

const length = (s: Segment) =>
  'line' in s ? Math.hypot(s.line[1][0] - s.line[0][0], s.line[1][1] - s.line[0][1]) : R * (s.arc.to - s.arc.from);

// The point a share of the way along the segments.
function pointAt(segments: Segment[], share: number): Point {
  let left = share * segments.reduce((sum, s) => sum + length(s), 0);
  for (const s of segments) {
    const l = length(s);
    if (left <= l || s === segments.at(-1)) {
      const f = Math.min(left / l, 1);
      if ('line' in s) {
        const [[x0, y0], [x1, y1]] = s.line;
        return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
      }
      const a = s.arc.from + (s.arc.to - s.arc.from) * f;
      return [s.arc.c[0] + R * Math.cos(a), s.arc.c[1] + R * Math.sin(a)];
    }
    left -= l;
  }
  return [0, 0];
}

const pathOf = (segments: Segment[]) =>
  segments
    .map((s, i) => {
      if ('line' in s) return `${i === 0 ? `M${s.line[0].join(' ')} ` : ''}L${s.line[1].join(' ')}`;
      const end = [s.arc.c[0] + R * Math.cos(s.arc.to), s.arc.c[1] + R * Math.sin(s.arc.to)];
      return `A${R} ${R} 0 0 1 ${end.join(' ')}`;
    })
    .join(' ');

// A chequered flag on a pole, the pole's foot at (x, y).
function Flag({ x, y }: { x: number; y: number }) {
  const top = y - 11;
  return (
    <g>
      <path className={styles.pole} d={`M${x} ${y} V${top}`} />
      <rect className={styles.flagLight} x={x} y={top} width={6} height={4} />
      {[
        [0, 0],
        [4, 0],
        [2, 2],
      ].map(([dx, dy]) => (
        <rect key={`${dx}${dy}`} className={styles.flagDark} x={x + dx} y={top + dy} width={2} height={2} />
      ))}
    </g>
  );
}

export default function RaceTrack({ distance, direction }: Pick<Race, 'distance' | 'direction'>) {
  if (distance == null) return null;
  const share = Math.min(distance / FULL, 1);
  const straight = direction === 'straight';
  const segments = straight ? STRAIGHT : OVAL;
  const path = pathOf(segments);
  const [fx, fy] = pointAt(segments, share);
  const start = straight ? 'M8 13 V23' : `M${START_X} 25 V35`;
  return (
    // Room above the track for the flag.
    <svg className={styles.track} viewBox="0 -8 64 44" aria-hidden="true">
      <g transform={direction === 'left' ? 'translate(64 0) scale(-1 1)' : undefined}>
        <path className={styles.lane} d={path} pathLength={1} />
        <path className={styles.run} d={path} pathLength={1} strokeDasharray={`${share} 1`} />
        <path className={styles.start} d={start} />
        <Flag x={fx} y={fy} />
      </g>
    </svg>
  );
}
