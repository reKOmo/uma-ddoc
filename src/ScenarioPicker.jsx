// The scenario dropdown (tier list, card page): the real scenarios, then the averaged ones in their own
// group. Scenarios not launched on the selected server yet are in italics with a "Not released yet"
// note (isReleased, from data/scenarios.json); the one running now on it has a "Current" badge.
// Scenarios the tier list doesn't rank yet (in data/scenarios.json, not in the server's list) are
// listed too, disabled, where they fall in launch order (newest first, like the tier list's).

import { useTranslation } from 'react-i18next';
import Dropdown from './Dropdown.jsx';
import { scenarioName } from './i18n/index.js';
import { SCENARIOS, isCurrent, isReleased } from './scenarioRelease.js';

// The Dropdown's options for a server's scenarios (keys) and averaged rankings (keys). `t` translates.
export function scenarioPickerOptions({ scenarios, combined, server, t }) {
  // Every scenario newest first (data/scenarios.json is in JP launch order); ranked keys the data
  // doesn't know go at the end, in their own order.
  const known = SCENARIOS.map((s) => s.key).reverse();
  const keys = [...known, ...scenarios.filter((key) => !known.includes(key))];
  return [
    ...keys.map((key) => {
      if (!scenarios.includes(key)) {
        return { value: key, label: scenarioName(key), disabled: true, note: t('common.notRanked') };
      }
      const released = isReleased(key, server);
      return {
        value: key,
        label: scenarioName(key),
        italic: !released,
        badge: isCurrent(key, server) ? t('common.current') : undefined,
        note: released ? undefined : t('common.notReleased'),
      };
    }),
    ...combined.map((key) => ({ value: key, label: scenarioName(key), group: t('common.averaged') })),
  ];
}

export default function ScenarioPicker({ label, value, scenarios, combined, server, onChange }) {
  const { t } = useTranslation();
  const options = scenarioPickerOptions({ scenarios, combined, server, t });
  return <Dropdown label={label} value={value} options={options} onChange={onChange} />;
}
