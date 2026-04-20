import { useState, useCallback, useRef, useEffect } from 'react';
import { setIcon } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { DashboardTab } from '../types';
import { SkillsTab } from './SkillsTab';
import { ConfigTab } from './ConfigTab';
import { HealthTab } from './HealthTab';
import { IconX } from './Icons';

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'skills', label: 'Skills', icon: 'puzzle' },
  { id: 'config', label: 'Config', icon: 'settings' },
  { id: 'health', label: 'Health', icon: 'activity' },
];

function ObsidianIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      setIcon(ref.current, icon);
      const svg = ref.current.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
      }
    }
  }, [icon, size]);
  return <span ref={ref} aria-hidden="true" />;
}

export function DashboardApp() {
  const plugin = usePlugin();
  const [settings, updateSettings] = useSettings();
  const [activeTab, setActiveTab] = useState<DashboardTab>('skills');

  const handleRefresh = useCallback(() => {
    plugin.events.trigger('dashboard-refresh');
  }, [plugin]);

  const dismissBanner = useCallback(async () => {
    await updateSettings({ onboardingDismissed: true });
  }, [updateSettings]);

  const ActiveTabComponent = activeTab === 'skills'
    ? SkillsTab
    : activeTab === 'config'
      ? ConfigTab
      : HealthTab;

  return (
    <div className="knowlery-dashboard">
      <div className="knowlery-brand-header">
        <div className="knowlery-brand-header__icon">
          <ObsidianIcon icon="chef-hat" size={16} />
        </div>
        <div className="knowlery-brand-header__meta">
          <p className="knowlery-brand-header__title">Knowlery</p>
          <p className="knowlery-brand-header__subtitle">Precision Dashboard</p>
        </div>
      </div>

      <nav className="knowlery-tabs--vertical" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`knowlery-tabs__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <ObsidianIcon icon={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="knowlery-dashboard__content" role="tabpanel">
        {!settings.onboardingDismissed && (
          <div className="knowlery-banner">
            <div className="knowlery-banner__content">
              <strong>Welcome to Knowlery!</strong> Your vault has been set up as
              an AI-powered knowledge base. Use the tabs below to manage skills,
              review configuration, and check vault health.
            </div>
            <button
              className="knowlery-banner__dismiss clickable-icon"
              onClick={dismissBanner}
              aria-label="Dismiss banner"
            >
              <IconX size={16} />
            </button>
          </div>
        )}
        <ActiveTabComponent />
      </div>

      <div className="knowlery-dashboard__footer">
        <button
          className="knowlery-btn knowlery-btn--primary is-full-width"
          onClick={handleRefresh}
        >
          <ObsidianIcon icon="refresh-cw" size={16} /> Refresh Health
        </button>
        {/* TODO: link to external documentation site once available (post-v1) */}
        <button
          className="knowlery-btn knowlery-btn--ghost"
          onClick={() => {/* no-op */}}
        >
          <ObsidianIcon icon="book-open" size={16} /> Documentation
        </button>
      </div>
    </div>
  );
}
