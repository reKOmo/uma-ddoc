import { FoldVertical, Globe, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VERDICTS } from '../../lib/pullGuide.ts';
import { ToolbarButton } from '../../ui/ToolbarButton.tsx';
import type { Mark } from '../data.ts';
import { type Timeline, ZOOMS } from '../layout.ts';
import type { Term } from '../search.ts';
import TimelineFilter from '../TimelineFilter.tsx';
import TimelineSearch from '../TimelineSearch.tsx';
import { endOfToday } from '../useCenterOn.ts';
import type { useTimelineFilters } from '../useTimelineFilters.ts';
import styles from './TimelineToolbar.module.css';

const MARK_ICONS: Record<string, LucideIcon> = { global: Globe };

export default function TimelineToolbar({
  filters,
  chips,
  onChips,
  marks,
  timeline,
  scrollToDay,
  compact,
  onToggleCompact,
  zoom,
  onZoom,
}: {
  filters: ReturnType<typeof useTimelineFilters>;
  chips: Term[];
  onChips: (chips: Term[]) => void;
  marks: Mark[];
  timeline: Timeline | null;
  scrollToDay: (day: number) => void;
  compact: boolean;
  onToggleCompact: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      {/* Always open: under the buttons on phones, before them on desktop (CSS order). */}
      <div className={styles.searchSlot}>
        <TimelineSearch terms={filters.terms} chips={chips} onChange={onChips} />
      </div>
      {marks.map((mark) => (
        <ToolbarButton
          key={mark.key}
          icon={MARK_ICONS[mark.key]}
          label={t(`timeline.mark.${mark.key}.button`)}
          title={t(`timeline.mark.${mark.key}.title`)}
          phoneIconOnly
          onClick={() => timeline && scrollToDay(timeline.at(mark.at))}
        />
      ))}
      <TimelineFilter
        kinds={filters.kinds}
        verdicts={filters.verdictsOf ? VERDICTS : []}
        hidden={filters.hidden}
        onChange={filters.changeHidden}
        groups={filters.presentGroups}
        onReorder={filters.reorder}
        onResetOrder={filters.resetOrder}
        defaultOrder={filters.defaultOrder}
        disabled={!timeline}
      />
      <ToolbarButton
        icon={LocateFixed}
        label={t('timeline.today')}
        phoneIconOnly
        onClick={() => timeline && scrollToDay(endOfToday(timeline))}
        disabled={!timeline}
      />
      <ToolbarButton
        icon={FoldVertical}
        label={t('timeline.compact')}
        title={t('timeline.compactTitle')}
        onClick={onToggleCompact}
        disabled={!timeline}
        pressed={compact}
        iconOnly
      />
      {/* Not a Segmented: the buttons aren't a choice (no pressed one) and each disables at its own end. */}
      <fieldset className={styles.zoom} aria-label={t('timeline.zoom')}>
        <button
          type="button"
          onClick={() => onZoom(zoom - 1)}
          disabled={!timeline || zoom === 0}
          aria-label={t('timeline.zoomOut')}
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onZoom(zoom + 1)}
          disabled={!timeline || zoom === ZOOMS.length - 1}
          aria-label={t('timeline.zoomIn')}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
      </fieldset>
    </div>
  );
}
