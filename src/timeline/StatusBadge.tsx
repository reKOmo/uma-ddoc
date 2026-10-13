// @ts-nocheck
import { useTranslation } from 'react-i18next';

// Where a banner or event stands (live, upcoming, predicted…; bannerStatus() in ./entries.js), as a pill: the
// Timeline's sheet and the card page. Styles: .badge in App.css.
export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  return <span className={`badge ${status}`}>{t(`timeline.status.${status}`)}</span>;
}
