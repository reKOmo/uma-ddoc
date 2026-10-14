import { useTranslation } from 'react-i18next';
import Pill from './Pill.tsx';

// The pull guide's "Should pull?" pill: "whale++" → "If Whale++".
export default function ShouldPullChip({ pill, className }: { pill: string; className?: string }) {
  const { t } = useTranslation();
  const [, kind, plus] = pill.match(/^(\w+)(\+*)$/) ?? [];
  return (
    <Pill variant="verdict" tone={kind} className={className}>
      {t(`pullGuide.verdict.${kind}`) + plus}
    </Pill>
  );
}
