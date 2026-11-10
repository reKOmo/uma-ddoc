import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import pkg from '../../package.json' with { type: 'json' };
import Dropdown from '../Dropdown.tsx';
import { OptionCards } from '../ui/OptionCards.tsx';
import { SETTING_OPTIONS, localTimeZone, useSettings } from '../settings.tsx';
import type { Settings, SettingName } from '../settingsStore.ts';
import styles from './SettingsPage.module.css';

const PULL_GUIDE_URL = 'https://docs.google.com/spreadsheets/d/1zZOBxjcgJEKna7ftYKq0AlZS25Q3hE_occ7kXB-Q6MQ';

// Credited in About; names and descriptions are in en.json under settings.credit.<key>.
const CREDITS: readonly (readonly [string, string])[] = [
  ['gametora', 'https://gametora.com/umamusume'],
  ['tierList', 'https://euophrys.github.io/uma-tiers/'],
  ['pullGuide', PULL_GUIDE_URL],
  ['umapyoi', 'https://umapyoi.net/'],
  ['umatl', 'https://github.com/UmaTL/hachimi-tl-en'],
];

type ToggleProps<K extends SettingName> = {
  name: K;
  options: readonly Settings[K][];
  labels: Record<Settings[K], string>;
  details: Record<Settings[K], string>;
};
type SettingProps<K extends SettingName> = ToggleProps<K> & { title: string; hint: string };

// A setting of its own: a heading, a hint, its options.
function Setting<K extends SettingName>({ title, hint, ...toggle }: SettingProps<K>) {
  const headingId = `setting-${toggle.name}`;
  return (
    <section className={styles.setting}>
      <h2 id={headingId}>{title}</h2>
      <p className={styles.hint}>{hint}</p>
      <Toggle {...toggle} labelledBy={headingId} />
    </section>
  );
}

// One of a section's settings: its own label, then its options.
function SubSetting<K extends SettingName>({ label, ...toggle }: ToggleProps<K> & { label: string }) {
  const labelId = `setting-${toggle.name}`;
  return (
    <div className={styles.subSetting}>
      <span id={labelId} className={styles.subLabel}>
        {label}
      </span>
      <Toggle {...toggle} labelledBy={labelId} />
    </div>
  );
}

// A choice of how a server's names read, as a dropdown (its options' details beside them in the list).
function NamesDropdown({ name, label }: { name: 'fanTlGlobal' | 'jpNames'; label: string }) {
  const { t } = useTranslation();
  const { settings, setSetting } = useSettings();
  const options = SETTING_OPTIONS[name];
  const key = { jp: 'namesJp', official: 'namesOfficial', all: 'namesAll' } as const;
  return (
    <Dropdown
      roomy
      label={label}
      value={settings[name]}
      options={options.map((option) => ({
        value: option,
        label: t(`settings.${key[option]}`),
        note: t(`settings.${key[option]}Detail`),
      }))}
      onChange={(value) => {
        const option = options.find((o) => o === value);
        if (option) setSetting(name, option);
      }}
    />
  );
}

// The choices side by side as cards.
function Toggle<K extends SettingName>({
  name,
  options,
  labels,
  details,
  labelledBy,
}: ToggleProps<K> & { labelledBy: string }) {
  const { settings, setSetting } = useSettings();
  return (
    <OptionCards<Settings[K]>
      labelledBy={labelledBy}
      options={options.map((option) => ({ value: option, label: labels[option], detail: details[option] }))}
      value={settings[name]}
      onChange={(value) => setSetting(name, value)}
    />
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className={clsx('page', styles.settingsPage)}>
      <Setting
        name="theme"
        options={SETTING_OPTIONS.theme}
        title={t('settings.theme')}
        hint={t('settings.themeHint')}
        labels={{ system: t('settings.themeSystem'), light: t('settings.themeLight'), dark: t('settings.themeDark') }}
        details={{ system: t('settings.themeSystemDetail'), light: '', dark: '' }}
      />
      <section className={styles.setting}>
        <h2>{t('settings.times')}</h2>
        <p className={styles.hint}>{t('settings.timesHint')}</p>
        <SubSetting
          name="timeZone"
          options={SETTING_OPTIONS.timeZone}
          label={t('settings.timeZone')}
          labels={{ utc: t('settings.utc'), local: t('settings.local') }}
          details={{ utc: t('settings.utcDetail'), local: t('settings.localDetail', { zone: localTimeZone() }) }}
        />
        <SubSetting
          name="clock"
          options={SETTING_OPTIONS.clock}
          label={t('settings.clock')}
          labels={{ '12h': t('settings.clock12'), '24h': t('settings.clock24') }}
          details={{ '12h': '10:00 PM', '24h': '22:00' }}
        />
      </section>
      <Setting
        name="scenarioNames"
        options={SETTING_OPTIONS.scenarioNames}
        title={t('settings.scenarioNames')}
        hint={t('settings.scenarioNamesHint')}
        labels={{ global: t('settings.scenarioNamesGlobal'), jp: t('settings.scenarioNamesJp') }}
        details={{ global: t('settings.scenarioNamesGlobalDetail'), jp: t('settings.scenarioNamesJpDetail') }}
      />
      <section className={styles.setting}>
        <h2>{t('settings.language')}</h2>
        <p className={styles.hint}>{t('settings.languageHint')}</p>
        <div className={styles.dropdowns}>
          <NamesDropdown name="fanTlGlobal" label={t('settings.fanTlGlobal')} />
          <NamesDropdown name="jpNames" label={t('settings.jpNames')} />
        </div>
      </section>
      <Setting
        name="jpNewsLanguage"
        options={SETTING_OPTIONS.jpNewsLanguage}
        title={t('settings.jpNewsLanguage')}
        hint={t('settings.jpNewsLanguageHint')}
        labels={{ jp: t('settings.jpNewsLanguageJp'), en: t('settings.jpNewsLanguageEn') }}
        details={{ jp: t('settings.jpNewsLanguageJpDetail'), en: t('settings.jpNewsLanguageEnDetail') }}
      />

      <section className={styles.about}>
        <h2>{t('settings.about')}</h2>
        <p className={styles.aboutApp}>{t('settings.version', { version: pkg.version })}</p>
        <p className={styles.aboutText}>{t('settings.disclaimer')}</p>
        <p className={styles.aboutText}>
          <Trans
            i18nKey="settings.pullGuideDisclaimer"
            // biome-ignore lint/a11y/useAnchorContent: <Trans> fills the link with the catalog's <a> text.
            components={{ a: <a href={PULL_GUIDE_URL} target="_blank" rel="noreferrer" /> }}
          />
        </p>
        <h3>{t('settings.credits')}</h3>
        <ul className={styles.credits}>
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
