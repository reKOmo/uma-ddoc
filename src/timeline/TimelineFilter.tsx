import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eye, ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterButton, FilterGroup, FilterSection, FilterSheet, ResetButton } from '../ui/FilterSheet.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import GroupOrder, { type LaneGroup } from './GroupOrder.tsx';
import styles from './TimelineFilter.module.css';
import type { Verdict } from '../lib/pullGuide.ts';
import { saveSearchOverride, useSearchOverrideStore } from './searchOverride.ts';

type TabKey = 'show' | 'order';
const TABS: Record<TabKey, LucideIcon> = { show: Eye, order: ListOrdered };

const BANNERS = ['cards', 'characters'];
const BANNER_LABELS: Record<string, string> = { characters: 'timeline.characters', cards: 'timeline.supportCards' };
// Pull advice picks rather than hides: none picked shows every banner, else only those with a picked verdict. The picks
// share the hidden set under their own prefix (`pull:` once meant hidden; those stale keys are ignored).
export const pullKey = (verdict: string): string => `pullOnly:${verdict}`;
export const isPullKey = (key: string): boolean => key.startsWith('pullOnly:');
// The All chip of pull advice: ticked while nothing is picked, it unpicks everything.
const PULL_ALL = 'pullAll';
const verdictOf = (key: string): string => key.slice(key.indexOf(':') + 1);

type FilterKey = string;
type HiddenUpdate = (old: Set<FilterKey>) => Set<FilterKey>;

export type TimelineFilterProps = {
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
  const searchOverride = useSearchOverrideStore((state) => state.override);
  const banners = kinds.filter((kind) => BANNERS.includes(kind));
  const events = kinds.filter((kind) => !BANNERS.includes(kind));
  const pulls = verdicts.map(pullKey);
  const picked = pulls.filter((key) => hidden.has(key));
  const hiddenCount = kinds.filter((key) => hidden.has(key)).length + (picked.length && pulls.length - picked.length);

  const toggle = (key: FilterKey) =>
    onChange((old) => {
      const next = new Set(old);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const setAll = (keys: FilterKey[], shown: boolean) =>
    onChange((old) => {
      const next = new Set(old);
      for (const key of keys) shown ? next.delete(key) : next.add(key);
      return next;
    });
  const label = (key: FilterKey): string =>
    BANNERS.includes(key)
      ? t(BANNER_LABELS[key])
      : isPullKey(key)
        ? key === pullKey('none')
          ? t('timeline.filter.noAdvice')
          : t(`pullGuide.verdict.${verdictOf(key)}`)
        : t(`events.kind.${key}`);
  const tone = (key: FilterKey): string => (isPullKey(key) ? `filter-pull-${verdictOf(key)}` : `kind-${key}`);

  const section = (heading: string, keys: FilterKey[]) => (
    <FilterSection
      heading={heading}
      chips={keys.map((key) => ({ key, label: label(key), shown: !hidden.has(key), tone: tone(key) }))}
      onToggle={toggle}
      onAll={(shown: boolean) => setAll(keys, shown)}
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
            <ResetButton onClick={() => onChange(() => new Set())} disabled={!hiddenCount}>
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
                { key: PULL_ALL, label: t('filter.all'), shown: !picked.length, catchAll: true },
                ...pulls.map((key) => ({ key, label: label(key), shown: hidden.has(key), tone: tone(key) })),
              ]}
              onToggle={(key) => (key === PULL_ALL ? setAll(pulls, true) : toggle(key))}
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
