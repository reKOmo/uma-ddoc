import { useTranslation } from 'react-i18next';
import { FanTl } from '../../ui/FanTl.tsx';
import { formatNumber } from '../../i18n/index.ts';
import { itemList } from '../events.ts';
import type { EventItem } from '../../../shared/schemas/event.ts';
import shared from './shared.module.css';
import styles from './Rewards.module.css';

// JP's items use Global's names where Global has them (the ones it doesn't stay Japanese).
export function Rewards({ items, fan }: { items: EventItem[]; fan: Set<string> }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const count = (value: NonNullable<EventItem['count']>) =>
    typeof value === 'number'
      ? formatNumber(value)
      : t('timeline.range', { min: formatNumber(value.min), max: formatNumber(value.max) });
  return (
    <>
      <h3 className={shared.heading}>{t('timeline.items')}</h3>
      <ul className={styles.rewards}>
        {itemList(items).map((item) => (
          <li key={item.name}>
            <FanTl fan={fan.has(item.name)}>
              {item.count == null ? item.name : t('timeline.itemCount', { name: item.name, count: count(item.count) })}
            </FanTl>
          </li>
        ))}
      </ul>
    </>
  );
}
