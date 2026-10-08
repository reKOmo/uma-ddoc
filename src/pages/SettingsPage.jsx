import { ExternalLink } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import pkg from '../../package.json' with { type: 'json' };
import { SETTING_OPTIONS, localTimeZone, useSettings } from '../settings.jsx';
import './settings.css';

const PULL_GUIDE_URL = 'https://docs.google.com/spreadsheets/d/1zZOBxjcgJEKna7ftYKq0AlZS25Q3hE_occ7kXB-Q6MQ';

// Sites Umaddoc builds on, credited in About (name and description in en.json under settings.credit.<key>).
const CREDITS = [
  ['gametora', 'https://gametora.com/umamusume'],
  ['tierList', 'https://euophrys.github.io/uma-tiers/'],
  ['pullGuide', PULL_GUIDE_URL],
];

// One setting: a heading, a hint, and a segmented toggle over its options (labels by option).
function Setting({ name, title, hint, labels }) {
  const { settings, setSetting } = useSettings();
  return (
    <section className="setting">
      <h2 id={`setting-${name}`}>{title}</h2>
      <p className="setting-hint">{hint}</p>
      <fieldset className="segmented" aria-labelledby={`setting-${name}`}>
        {SETTING_OPTIONS[name].map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={settings[name] === option}
            onClick={() => setSetting(name, option)}
          >
            {labels[option]}
          </button>
        ))}
      </fieldset>
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="page settings-page">
      <Setting
        name="timeZone"
        title={t('settings.timeZone')}
        hint={t('settings.timeZoneHint')}
        labels={{ utc: t('settings.utc'), local: t('settings.local', { zone: localTimeZone() }) }}
      />
      <Setting
        name="scenarioNames"
        title={t('settings.scenarioNames')}
        hint={t('settings.scenarioNamesHint')}
        labels={{ global: t('settings.scenarioNamesGlobal'), jp: t('settings.scenarioNamesJp') }}
      />

      <section className="setting about">
        <h2>{t('settings.about')}</h2>
        <p className="about-app">{t('settings.version', { version: pkg.version })}</p>
        <p className="setting-hint">{t('settings.disclaimer')}</p>
        <p className="setting-hint">
          <Trans
            i18nKey="settings.pullGuideDisclaimer"
            // biome-ignore lint/a11y/useAnchorContent: <Trans> fills the link with the catalog's <a> text.
            components={{ a: <a href={PULL_GUIDE_URL} target="_blank" rel="noreferrer" /> }}
          />
        </p>
        <h3>{t('settings.credits')}</h3>
        <ul className="credits">
          {CREDITS.map(([key, url]) => (
            <li key={key}>
              <a href={url} target="_blank" rel="noreferrer">
                <span>
                  <strong>{t(`settings.credit.${key}.name`)}</strong>
                  <small>{t(`settings.credit.${key}.description`)}</small>
                </span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
