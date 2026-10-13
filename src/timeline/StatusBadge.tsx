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
