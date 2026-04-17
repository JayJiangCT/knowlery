import { useState, useCallback } from 'react';
import { usePlugin, useSettings } from '../context';
import type { DashboardTab } from '../types';
import { SkillsTab } from './SkillsTab';
import { ConfigTab } from './ConfigTab';
import { HealthTab } from './HealthTab';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'skills', label: 'Skills' },
  { id: 'config', label: 'Config' },
  { id: 'health', label: 'Health' },
];

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
    <div className="knowlery-dashboard__root">
      {/* Header */}
      <div className="knowlery-dashboard__header">
        <h2 className="knowlery-dashboard__title">Knowlery</h2>
        <button
          className="knowlery-dashboard__refresh clickable-icon"
          onClick={handleRefresh}
          aria-label="Refresh dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>

      {/* Onboarding banner */}
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
            {'\u2715'}
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="knowlery-dashboard__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`knowlery-dashboard__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="knowlery-dashboard__content">
        <ActiveTabComponent />
      </div>
    </div>
  );
}
