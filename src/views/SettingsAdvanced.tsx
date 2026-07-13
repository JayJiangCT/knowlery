import { HealthTab } from './HealthTab';
import { ConfigTab } from './ConfigTab';
import { SkillsLibrary } from './SkillsLibrary';
import { t } from '../i18n';

export function SettingsAdvanced() {
  return (
    <div className="knowlery-settings-advanced">
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>{t('advanced.diagnostics')}</span></div>
        <HealthTab />
      </section>
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>{t('advanced.rulesSchema')}</span></div>
        <ConfigTab />
      </section>
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>{t('advanced.skills')}</span></div>
        <SkillsLibrary />
      </section>
    </div>
  );
}
