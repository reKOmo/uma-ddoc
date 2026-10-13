// Where a banner or event stands (live, upcoming, predicted…; bannerStatus() in ./entries.ts), as a pill: the
// Timeline's sheet and the card page. A <Pill variant="status">; its colours are in ../ui/Pill.module.css.
import { useTranslation } from 'react-i18next';
import Pill, { type PillStatus } from '../ui/Pill.tsx';

export type StatusBadgeProps = { status: PillStatus };

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Pill variant="status" status={status}>
      {t(`timeline.status.${status}`)}
    </Pill>
  );
}
