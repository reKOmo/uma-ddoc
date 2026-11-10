import { useTranslation } from 'react-i18next';
import Pill from './Pill.tsx';

// The pull guide's "Should pull?" pill: "whale++" → "If Whale++" (`asked`: "Pull? If Whale++", standing alone).
export default function ShouldPullChip({
  pill,
  asked = false,
  className,
}: {
  pill: string;
  asked?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [, kind, plus] = pill.match(/^(\w+)(\+*)$/) ?? [];
  const verdict = t(`pullGuide.verdict.${kind}`) + plus;
  return (
    <Pill variant="verdict" tone={kind} className={className}>
      {asked ? t('pullGuide.pullChip', { verdict }) : verdict}
    </Pill>
  );
}
