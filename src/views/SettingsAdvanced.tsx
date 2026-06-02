import { HealthTab } from './HealthTab';
import { ConfigTab } from './ConfigTab';
import { SkillsLibrary } from './SkillsLibrary';

export function SettingsAdvanced() {
  return (
    <div className="knowlery-settings-advanced">
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>Diagnostics</span></div>
        <HealthTab />
      </section>
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>Rules &amp; schema</span></div>
        <ConfigTab />
      </section>
      <section className="knowlery-settings-advanced__section">
        <div className="knowlery-section-label"><span>Skills</span></div>
        <SkillsLibrary />
      </section>
    </div>
  );
}
