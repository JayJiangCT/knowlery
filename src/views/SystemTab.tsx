import { useState } from 'react';
import { ConfigTab } from './ConfigTab';
import { HealthTab } from './HealthTab';
import { IconWrench } from './Icons';

export function SystemTab() {
  const [configExpanded, setConfigExpanded] = useState(false);

  return (
    <div className="knowlery-system">
      <div className="knowlery-skills__toolbar">
        <div>
          <div className="knowlery-section-label">System</div>
          <div className="knowlery-skills__toolbar-desc">
            Diagnostics first. Configuration and rules stay available as maintenance tools.
          </div>
        </div>
      </div>

      <HealthTab />

      <section className="knowlery-source-disclosure">
        <div className="knowlery-source-disclosure__header">
          <div>
            <div className="knowlery-section-label">Configuration and rules</div>
            <div className="knowlery-skills__toolbar-desc">
              Open the underlying guidance files and agent rules when you need to maintain the system itself.
            </div>
          </div>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => setConfigExpanded((expanded) => !expanded)}
            aria-expanded={configExpanded}
          >
            <IconWrench size={14} />
            <span>{configExpanded ? 'Hide configuration' : 'View configuration'}</span>
          </button>
        </div>

        {configExpanded && <ConfigTab />}
      </section>
    </div>
  );
}
