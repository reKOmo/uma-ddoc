import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import Dropdown, { type DropdownOption } from './Dropdown.tsx';
import { scenarioName } from '../i18n/index.ts';
import { SCENARIOS, isCurrent, isReleased, scenarioByKey } from '../../shared/scenarioRelease.ts';
import type { Server } from '../lib/servers.ts';
import ScenarioPill from './ScenarioPill.tsx';

// A scenario as its pill (plain for a key data/scenarios.json lacks).
const pillOf = (key: string) => (scenarioByKey(key)?.color ? <ScenarioPill scenario={key} /> : undefined);

type PickerArgs = { scenarios: string[]; combined: string[]; server: Server; t: TFunction };

export function scenarioPickerOptions({ scenarios, combined, server, t }: PickerArgs): DropdownOption[] {
  // Every scenario newest first (data/scenarios.json is in JP launch order); ranked keys the data
  // doesn't know go at the end, in their own order.
  const known = SCENARIOS.map((s) => s.key).reverse();
  const keys = [...known, ...scenarios.filter((key) => !known.includes(key))];
  return [
    ...keys.map((key) => {
      if (!scenarios.includes(key)) {
        return {
          value: key,
          label: scenarioName(key),
          content: pillOf(key),
          disabled: true,
          note: t('common.notRanked'),
        };
      }
      const released = isReleased(key, server);
      return {
        value: key,
        label: scenarioName(key),
        content: pillOf(key),
        italic: !released,
        badge: isCurrent(key, server) ? t('common.current') : undefined,
        note: released ? undefined : t('common.notReleased'),
      };
    }),
    ...combined.map((key) => ({ value: key, label: scenarioName(key), group: t('common.averaged') })),
  ];
}

type ScenarioPickerProps = Omit<PickerArgs, 't'> & {
  label: string;
  value: string;
  onChange: (key: string) => void;
  hideLabel?: boolean;
};

export default function ScenarioPicker({
  label,
  value,
  scenarios,
  combined,
  server,
  onChange,
  hideLabel,
}: ScenarioPickerProps) {
  const { t } = useTranslation();
  const options = scenarioPickerOptions({ scenarios, combined, server, t });
  return <Dropdown label={label} value={value} options={options} onChange={onChange} hideLabel={hideLabel} />;
}
