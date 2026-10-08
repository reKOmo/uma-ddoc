import { useTranslation } from 'react-i18next';
import { bannerStatus } from './bannerData.js';

// A banner's status pill (Live, Upcoming, Predicted…), as on the Timeline's banner sheet and the card
// page. Styles: .badge in App.css.
export default function StatusBadge({ banner }) {
  const { t } = useTranslation();
  const state = bannerStatus(banner);
  return <span className={`badge ${state}`}>{t(`banners.status.${state}`)}</span>;
}
