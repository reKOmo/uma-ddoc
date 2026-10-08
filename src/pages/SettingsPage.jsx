import { useTranslation } from 'react-i18next';
import { SETTING_OPTIONS, localTimeZone, useSettings } from '../settings.jsx';
import './settings.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, setSetting } = useSettings();
  const labels = { utc: t('settings.utc'), local: t('settings.local', { zone: localTimeZone() }) };

  return (
    <div className="page settings-page">
      <section className="setting">
        <h2 id="setting-time-zone">{t('settings.timeZone')}</h2>
        <p className="setting-hint">{t('settings.timeZoneHint')}</p>
        <fieldset className="segmented" aria-labelledby="setting-time-zone">
          {SETTING_OPTIONS.timeZone.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={settings.timeZone === option}
              onClick={() => setSetting('timeZone', option)}
            >
              {labels[option]}
            </button>
          ))}
        </fieldset>
      </section>
    </div>
  );
}
