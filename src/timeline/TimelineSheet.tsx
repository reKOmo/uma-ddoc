import clsx from 'clsx';
import Sheet from '../ui/Sheet.tsx';
import { loadPullGuide } from '../lib/pullGuide.ts';
import { useAsync } from '../hooks/useAsync.ts';
import type { DateFormats } from '../lib/dates.ts';
import { useRankings } from './useRankings.ts';
import type { Entry } from './entries.ts';
import type { Lookup, ServerKey } from './sheet/types.ts';
import { Header } from './sheet/Header.tsx';
import { FreeScouts, Parts, Relations } from './sheet/Navigation.tsx';
import { Featured, RankNote } from './sheet/Featured.tsx';
import { Races } from './sheet/Races.tsx';
import { Rewards } from './sheet/Rewards.tsx';
import { Schedule } from './sheet/Schedule.tsx';
import { Links, Titles } from './sheet/Links.tsx';
import shared from './sheet/shared.module.css';
import styles from './TimelineSheet.module.css';

type TimelineSheetProps = {
  entry: Entry;
  lookup: Lookup;
  server: ServerKey;
  scenario: string;
  format: DateFormats;
  open: boolean;
  onSelect: (entry: Entry) => void;
  onClose: () => void;
  onClosed?: () => void;
};

export default function TimelineSheet({
  entry,
  lookup,
  server,
  scenario,
  format,
  open,
  onSelect,
  onClose,
  onClosed,
}: TimelineSheetProps) {
  const cardIds = entry.featured.flatMap((item) => (item.card && item.id != null ? [item.id] : []));
  const rankings = useRankings(server, scenario, cardIds);
  // The guide is advice for Global's banners (JP's share their ids, so it would match there too).
  const guide = useAsync(loadPullGuide, []).data;
  const advice = server === 'gl' ? guide?.banners[entry.id] : undefined;
  const nothing =
    !entry.featured.length &&
    !entry.items.length &&
    !entry.titles.length &&
    !entry.phases.length &&
    !entry.races.length &&
    !entry.scouts.length &&
    !entry.parts.length;
  return (
    <Sheet open={open} onClose={onClose} onClosed={onClosed}>
      {entry.art && (
        <img className={clsx(styles.art, entry.art.official && styles.official)} src={entry.art.src} alt="" />
      )}
      <Header entry={entry} format={format} />
      <Relations entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      {/* First: what a player gets for free. */}
      <FreeScouts entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      <Featured entry={entry} rankings={rankings} advice={advice} />
      <Races races={entry.races} predicted={!!entry.prediction} />
      <Rewards items={entry.items} fan={entry.fan} />
      <Schedule entry={entry} format={format} />
      <Titles titles={entry.titles} fan={entry.fan} />
      {/* Its note (a paid scout's "Any ★3") where nothing else is listed; an empty sheet says nothing. */}
      {nothing && entry.note && <p className={shared.empty}>{entry.note}</p>}
      <Parts entry={entry} lookup={lookup} format={format} onSelect={onSelect} />
      {cardIds.length > 0 && <RankNote scenario={scenario} server={server} upcoming={rankings?.upcoming} />}
      <Links news={entry.news} counterpart={entry.counterpart} />
    </Sheet>
  );
}
