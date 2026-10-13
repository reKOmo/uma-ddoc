// The Timeline toolbar's filter (src/FilterSheet.jsx): a button (with how many things are hidden) that opens a sheet of
// toggles, in sections: banner sections, event kinds (in the calendar's groups' order), and pull-advice verdicts,
// which hide support card banners none of whose cards has a verdict shown ('pull:<verdict>' in `hidden`). Each
// section has All / None, the title "Show all". A second tab, Order, drags the calendar's groups into order
// (GroupOrder.jsx; lanes and chips follow), "Reset order" by the title. Every change applies (and is saved) at once.

import { useState } from 'react';
import { Eye, ListOrdered, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterButton, FilterSection, FilterSheet } from '../FilterSheet.jsx';
import GroupOrder from './GroupOrder.jsx';

const TABS = { show: Eye, order: ListOrdered };

const BANNERS = ['cards', 'characters'];
// A banner section's name, as its lane group's label says it (layout.js' LANE_GROUPS).
const BANNER_LABELS = { characters: 'timeline.characters', cards: 'timeline.supportCards' };
export const pullKey = (verdict) => `pull:${verdict}`;

// `kinds`: the banner sections and event kinds to offer; `verdicts`: the verdicts to offer (none without pull
// advice); `hidden`: a Set of kinds and pullKey()s; `onChange(update)`, `update(old)` → the new Set. `groups`: the
// calendar's lane groups in their order ({ key, label, kinds }); `onReorder(from, to)` (indexes in `groups`), `onResetOrder()`,
// `defaultOrder`: whether the order is the default.
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
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('show');
  const banners = kinds.filter((kind) => BANNERS.includes(kind));
  const events = kinds.filter((kind) => !BANNERS.includes(kind));
  const pulls = verdicts.map(pullKey);
  const hiddenCount = [...kinds, ...pulls].filter((key) => hidden.has(key)).length;

  const toggle = (key) =>
    onChange((old) => {
      const next = new Set(old);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  // Show (or hide) every key of a section.
  const setAll = (keys, shown) =>
    onChange((old) => {
      const next = new Set(old);
      for (const key of keys) shown ? next.delete(key) : next.add(key);
      return next;
    });
  const label = (key) =>
    BANNERS.includes(key)
      ? t(BANNER_LABELS[key])
      : key.startsWith('pull:')
        ? key === pullKey('none')
          ? t('timeline.filter.noAdvice')
          : t(`pullGuide.verdict.${key.slice(5)}`)
        : t(`events.kind.${key}`);
  const tone = (key) => (key.startsWith('pull:') ? `filter-pull-${key.slice(5)}` : `kind-${key}`);

  const section = (heading, keys, props) => (
    <FilterSection
      heading={heading}
      chips={keys.map((key) => ({ key, label: label(key), shown: !hidden.has(key), tone: tone(key) }))}
      onToggle={toggle}
      onAll={(shown) => setAll(keys, shown)}
      {...props}
    />
  );

  return (
    <>
      <FilterButton
        count={hiddenCount}
        countTitle={t('timeline.filter.hiddenCount', { count: hiddenCount })}
        onClick={() => setOpen(true)}
        disabled={disabled}
      />
      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('timeline.filter.title')}
        action={
          tab === 'show' ? (
            <button
              type="button"
              className="reset-filters"
              onClick={() => onChange(() => new Set())}
              disabled={!hiddenCount}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('timeline.filter.showAll')}
            </button>
          ) : (
            <button type="button" className="reset-filters" onClick={onResetOrder} disabled={defaultOrder}>
              <RotateCcw size={14} aria-hidden="true" />
              {t('timeline.filter.defaultOrder')}
            </button>
          )
        }
      >
        <fieldset className="segmented filter-tabs" aria-label={t('timeline.filter.tabs')}>
          {Object.entries(TABS).map(([key, Icon]) => (
            <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
              <Icon size={16} aria-hidden="true" />
              {t(`timeline.filter.tab.${key}`)}
            </button>
          ))}
        </fieldset>
        {/* Both tabs share one grid cell, the other one invisible and inert: the sheet is as tall as the taller one
            whichever is shown, so switching doesn't resize it. */}
        <div className="filter-panels">
          <div className="filter-panel" inert={tab !== 'show'}>
            {section(t('timeline.filter.banners'), banners)}
            {section(t('timeline.filter.events'), events)}
            {section(t('timeline.filter.pullHeading'), pulls, {
              note: t(hidden.has('cards') ? 'timeline.filter.pullOff' : 'timeline.filter.pullNote'),
              off: hidden.has('cards'),
            })}
          </div>
          <div className="filter-panel" inert={tab !== 'order'}>
            <section className="filter-section">
              <p className="filter-note">{t('timeline.filter.orderNote')}</p>
              <GroupOrder groups={groups} hidden={hidden} onReorder={onReorder} />
            </section>
          </div>
        </div>
      </FilterSheet>
    </>
  );
}
