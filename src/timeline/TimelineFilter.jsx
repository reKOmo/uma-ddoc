// The Timeline toolbar's filter: a button (with how many things are hidden) that opens a sheet (src/Sheet.jsx) of
// toggles, in sections: banner sections, event kinds (in the calendar's groups' order), and pull-advice verdicts,
// which hide support card banners none of whose cards has a verdict shown ('pull:<verdict>' in `hidden`). Each
// section has All / None, the title "Show all". A second tab, Order, drags the calendar's groups into order
// (GroupOrder.jsx; lanes and chips follow), "Reset order" by the title. Every change applies (and is saved) at once.

import { useState } from 'react';
import { Check, Eye, ListOrdered, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Sheet, { SheetTitle } from '../Sheet.jsx';
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

  const section = (heading, keys, { note, off } = {}) =>
    keys.length > 0 && (
      <section className={clsx('filter-section', off && 'off')}>
        <div className="filter-section-head">
          <h3>{heading}</h3>
          <div className="filter-all">
            <button
              type="button"
              onClick={() => setAll(keys, true)}
              disabled={off || keys.every((k) => !hidden.has(k))}
            >
              {t('timeline.filter.all')}
            </button>
            <button
              type="button"
              onClick={() => setAll(keys, false)}
              disabled={off || keys.every((k) => hidden.has(k))}
            >
              {t('timeline.filter.none')}
            </button>
          </div>
        </div>
        {note && <p className="filter-note">{note}</p>}
        <div className="filter-chips">
          {keys.map((key) => {
            const shown = !hidden.has(key);
            return (
              <button
                type="button"
                key={key}
                className={clsx('filter-chip', tone(key))}
                aria-pressed={shown}
                disabled={off}
                onClick={() => toggle(key)}
              >
                <span className="filter-check" aria-hidden="true">
                  {shown && <Check size={12} strokeWidth={3} />}
                </span>
                {label(key)}
              </button>
            );
          })}
        </div>
      </section>
    );

  return (
    <>
      <button
        type="button"
        className={clsx('filter-button', hiddenCount > 0 && 'active')}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        {t('timeline.filter.button')}
        {hiddenCount > 0 && (
          <span className="filter-count" title={t('timeline.filter.hiddenCount', { count: hiddenCount })}>
            {hiddenCount}
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} className="filter-sheet">
        <div className="filter-head">
          <SheetTitle className="filter-title">{t('timeline.filter.title')}</SheetTitle>
          {tab === 'show' ? (
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
          )}
        </div>
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
      </Sheet>
    </>
  );
}
