import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eye, ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterButton, FilterGroup, FilterSection, FilterSheet, ResetButton } from '../ui/FilterSheet.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import GroupOrder, { type LaneGroup } from './GroupOrder.tsx';
import styles from './TimelineFilter.module.css';
import type { Verdict } from '../lib/pullGuide.ts';
import { getPulls, savePulls, usePulls } from './pulls.ts';
import { saveSearchOverride, useSearchOverride } from './searchOverride.ts';
import { toggled, withAll } from './sets.ts';

type TabKey = 'show' | 'order';
const TABS: Record<TabKey, LucideIcon> = { show: Eye, order: ListOrdered };

const BANNERS = ['cards', 'characters'];
const BANNER_LABELS: Record<string, string> = { characters: 'timeline.characters', cards: 'timeline.supportCards' };
// The All chip of pull advice (pulls.ts: picks rather than hides): ticked while nothing is picked, it unpicks everything.
const PULL_ALL = 'pullAll';

type FilterKey = string;
type HiddenUpdate = (old: Set<FilterKey>) => Set<FilterKey>;

type TimelineFilterProps = {
  kinds: string[];
  verdicts: readonly Verdict[];
  hidden: Set<FilterKey>;
  onChange: (update: HiddenUpdate) => void;
  groups: LaneGroup[];
  onReorder: (from: number, to: number) => void;
  onResetOrder: () => void;
  defaultOrder: boolean;
  disabled?: boolean;
};

export default function TimelineFilter({
  kinds,
  verdicts,
  hidden,
  onChange,
  groups,
  onReorder,
  onResetOrder,
  defaultOrder,
  disabled,
}: TimelineFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('show');
  const searchOverride = useSearchOverride();
  const pulls = usePulls();
  const banners = kinds.filter((kind) => BANNERS.includes(kind));
  const events = kinds.filter((kind) => !BANNERS.includes(kind));
  const picked = verdicts.filter((verdict) => pulls.has(verdict)).length;
  const hiddenCount = kinds.filter((key) => hidden.has(key)).length + (picked && verdicts.length - picked);

  const label = (key: FilterKey): string => (BANNERS.includes(key) ? t(BANNER_LABELS[key]) : t(`events.kind.${key}`));

  const section = (heading: string, keys: FilterKey[]) => (
    <FilterSection
      heading={heading}
      chips={keys.map((key) => ({ key, label: label(key), shown: !hidden.has(key), tone: `kind-${key}` }))}
      onToggle={(key) => onChange((old) => toggled(old, key))}
      onAll={(shown: boolean) => onChange((old) => withAll(old, keys, !shown))}
    />
  );

  return (
    <>
      <FilterButton
        count={hiddenCount}
        countTitle={t('timeline.filter.hiddenCount', { count: hiddenCount })}
        onClick={() => setOpen(true)}
        disabled={disabled}
        phoneIconOnly
      />
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('timeline.filter.title')}
        action={
          tab === 'show' ? (
            <ResetButton
              onClick={() => {
                onChange(() => new Set());
                savePulls(new Set());
              }}
              disabled={!hiddenCount}
            >
              {t('timeline.filter.showAll')}
            </ResetButton>
          ) : (
            <ResetButton onClick={onResetOrder} disabled={defaultOrder}>
              {t('timeline.filter.defaultOrder')}
            </ResetButton>
          )
        }
      >
        <Segmented
          className={styles.tabs}
          label={t('timeline.filter.tabs')}
          options={(Object.entries(TABS) as [TabKey, LucideIcon][]).map(([key, icon]) => ({
            value: key,
            icon,
            label: t(`timeline.filter.tab.${key}`),
          }))}
          value={tab}
          onChange={setTab}
        />
        {/* Both tabs share one grid cell, the other one invisible and inert: the sheet is as tall as the taller one
            whichever is shown, so switching doesn't resize it. */}
        <div className={styles.panels}>
          <div className={styles.panel} inert={tab !== 'show'}>
            {section(t('timeline.filter.banners'), banners)}
            {section(t('timeline.filter.events'), events)}
            <FilterSection
              heading={t('timeline.filter.pullHeading')}
              chips={[
                { key: PULL_ALL, label: t('filter.all'), shown: !picked, catchAll: true },
                ...verdicts.map((verdict) => ({
                  key: verdict,
                  label: t(verdict === 'none' ? 'timeline.filter.noAdvice' : `pullGuide.verdict.${verdict}`),
                  shown: pulls.has(verdict),
                  tone: `filter-pull-${verdict}`,
                })),
              ]}
              onToggle={(key) =>
                savePulls(key === PULL_ALL ? withAll(getPulls(), verdicts, false) : toggled(getPulls(), key))
              }
              note={t(hidden.has('cards') ? 'timeline.filter.pullOff' : 'timeline.filter.pullNote')}
              off={hidden.has('cards')}
            />
            <FilterGroup heading={t('timeline.filter.searchHeading')}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={searchOverride}
                  onChange={(e) => saveSearchOverride(e.target.checked)}
                />
                {t('timeline.filter.searchOverride')}
              </label>
            </FilterGroup>
          </div>
          <div className={styles.panel} inert={tab !== 'order'}>
            <FilterGroup note={t('timeline.filter.orderNote')}>
              <GroupOrder groups={groups} hidden={hidden} onReorder={onReorder} />
            </FilterGroup>
          </div>
        </div>
      </FilterSheet>
    </>
  );
}
