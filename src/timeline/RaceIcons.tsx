import {
  Cloud,
  CloudRain,
  CloudSnow,
  Flower2,
  Leaf,
  Moon,
  type LucideIcon,
  MoveRight,
  RotateCcw,
  RotateCw,
  Snowflake,
  Sun,
  Sunset,
} from 'lucide-react';
import type { Race } from '../../shared/schemas/event.ts';
import styles from './RaceIcons.module.css';

const CATEGORIES = ['sprint', 'mile', 'medium', 'long'];
const ICON = 16;

// Four rising bars, as many filled as the distance is long (Sprint 1 … Long 4).
export function DistanceBars({ category }: Pick<Race, 'category'>) {
  const filled = CATEGORIES.indexOf(category ?? '') + 1;
  if (!filled) return null;
  return (
    <svg className={styles.icon} width={ICON} height={ICON} viewBox="0 0 16 16" aria-hidden="true">
      {CATEGORIES.map((key, i) => (
        <rect
          key={key}
          className={i < filled ? styles.on : styles.off}
          x={1 + i * 4}
          y={12 - i * 3}
          width={2.5}
          height={3 + i * 3}
          rx={0.75}
        />
      ))}
    </svg>
  );
}

const GROUNDS = ['firm', 'good', 'soft', 'heavy'];
// A drop 6 wide, 8.5 tall, its tip at (3, 0).
const DROP = 'M3 0.5 C3 0.5 0.5 3.6 0.5 5.6 A2.5 2.5 0 0 0 5.5 5.6 C5.5 3.6 3 0.5 3 0.5 Z';

// Three drops, as many filled as the ground is wet (Firm none … Heavy all three).
export function GroundDrops({ ground }: Pick<Race, 'ground'>) {
  const filled = GROUNDS.indexOf(ground ?? '');
  if (filled < 0) return null;
  return (
    <svg className={styles.drops} width={20} height={16} viewBox="0 -3.5 20 15" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <path key={i} className={i < filled ? styles.wet : styles.dry} d={DROP} transform={`translate(${i * 7} 0)`} />
      ))}
    </svg>
  );
}

// Clockwise for a right-handed course, anticlockwise for a left-handed one, straight on for a straight one.
export function TurnArrow({ direction }: Pick<Race, 'direction'>) {
  const Icon = { right: RotateCw, left: RotateCcw, straight: MoveRight }[direction ?? 'straight'];
  return direction ? <Icon className={styles.icon} size={ICON} aria-hidden="true" /> : null;
}

// Each season, weather and time of day its own icon and colour (RaceIcons.module.css).
const SEASONS: Record<NonNullable<Race['season']>, LucideIcon> = {
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
};
const WEATHERS: Record<NonNullable<Race['weather']>, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
};

export function SeasonIcon({ season }: Pick<Race, 'season'>) {
  if (!season) return null;
  const Icon = SEASONS[season];
  return <Icon className={styles[season]} size={ICON} aria-hidden="true" />;
}

export function WeatherIcon({ weather }: Pick<Race, 'weather'>) {
  if (!weather) return null;
  const Icon = WEATHERS[weather];
  return <Icon className={styles[weather]} size={ICON} aria-hidden="true" />;
}

const TIMES: Record<NonNullable<Race['time']>, LucideIcon> = {
  day: Sun,
  evening: Sunset,
  night: Moon,
};

export function TimeIcon({ time }: Pick<Race, 'time'>) {
  if (!time) return null;
  const Icon = TIMES[time];
  return <Icon className={styles[time]} size={ICON} aria-hidden="true" />;
}
