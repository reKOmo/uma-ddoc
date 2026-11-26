import { useTranslation } from 'react-i18next';
import Pill, { type PillSize, type PillStatus } from './Pill.tsx';

export type StatusBadgeProps = { status: PillStatus; size?: PillSize };

export default function StatusBadge({ status, size }: StatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Pill variant="status" status={status} size={size}>
      {t(`timeline.status.${status}`)}
    </Pill>
  );
}
