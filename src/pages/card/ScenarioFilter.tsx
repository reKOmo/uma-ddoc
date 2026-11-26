import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scenarioName } from '../../i18n/index.ts';
import { scenarioByKey } from '../../lib/scenarioRelease.ts';
import { scenarioCssColor } from '../../lib/vividColor.ts';
import { useHiddenScenarios } from '../../state/hiddenScenarios.ts';
import { FilterButton, FilterSection, FilterSheet } from '../../ui/FilterSheet.tsx';

type ScenarioFilterProps = { scenarios: string[]; combined: string[] };

// The "Tier by scenario" table's Options button and sheet: a chip per scenario, then the averaged ones, to hide rows.
export default function ScenarioFilter({ scenarios, combined }: ScenarioFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { hidden, setHidden } = useHiddenScenarios();
  const count = [...scenarios, ...combined].filter((key) => hidden.includes(key)).length;
  const toggle = (key: string) => setHidden(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  const setAll = (keys: string[], shown: boolean) =>
    setHidden(shown ? hidden.filter((k) => !keys.includes(k)) : [...new Set([...hidden, ...keys])]);
  // Each scenario in its cover's colour, as its pill is everywhere (the averaged ones have none).
  const chips = (keys: string[]) =>
    keys.map((key) => {
      const color = scenarioByKey(key)?.color;
      return { key, label: scenarioName(key), shown: !hidden.includes(key), color: color && scenarioCssColor(color) };
    });

  return (
    <>
      <FilterButton
        count={count}
        countTitle={t('card.scenarioFilter.hiddenCount', { count })}
        onClick={() => setOpen(true)}
        phoneIconOnly
        small
      />
      <FilterSheet open={open} onClose={() => setOpen(false)} title={t('card.scenarioFilter.title')}>
        <FilterSection
          heading={t('card.scenarioFilter.scenarios')}
          chips={chips(scenarios)}
          onToggle={toggle}
          onAll={(shown) => setAll(scenarios, shown)}
        />
        <FilterSection
          heading={t('card.scenarioFilter.averaged')}
          chips={chips(combined)}
          onToggle={toggle}
          onAll={(shown) => setAll(combined, shown)}
        />
      </FilterSheet>
    </>
  );
}
