import clsx from 'clsx';
import type { ReactNode } from 'react';
import { scenarioName } from '../i18n/index.ts';
import { scenarioByKey } from '../lib/scenarioRelease.ts';
import { ink, scenarioStyle } from '../lib/vividColor.ts';
import styles from './ScenarioPill.module.css';

type ScenarioPillProps = { scenario: string; className?: string; children?: ReactNode };

// A scenario as a pill in its cover's colour (neutral for a key data/scenarios.json lacks, e.g. the averaged ones);
// the text's ink is picked from the colour's luminance, not the theme. `children`: other text than its name.
export default function ScenarioPill({ scenario, className, children }: ScenarioPillProps) {
  const color = scenarioByKey(scenario)?.color ?? null;
  const tone = ink(color);
  return (
    <span
      className={clsx(styles.pill, tone === 'dark' && styles.inkDark, tone === 'light' && styles.inkLight, className)}
      style={scenarioStyle(color)}
    >
      {children ?? scenarioName(scenario)}
    </span>
  );
}
