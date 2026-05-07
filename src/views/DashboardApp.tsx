import { useState, useCallback, useRef, useEffect } from 'react';
import { setIcon } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { DashboardTab, DashboardRefreshPayload } from '../types';
import { TodayTab } from './TodayTab';
import { ThisNoteTab } from './ThisNoteTab';
import { BakeTab } from './BakeTab';
import { SkillsTab } from './SkillsTab';
import { SystemTab } from './SystemTab';
import { IconX } from './Icons';
import { isVaultInitialized } from '../core/setup-executor';
import { SetupWizardModal } from '../modals/setup-wizard';

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'chef-hat' },
  { id: 'note', label: 'This note', icon: 'file-text' },
  { id: 'bake', label: 'Weekly Review', icon: 'book-open' },
  { id: 'recipes', label: 'Review Menu', icon: 'list-checks' },
  { id: 'system', label: 'System', icon: 'settings' },
];

const BRAND_SUBTITLE = 'Personal knowledge review space';

function ObsidianIcon({ icon, size = 16, className }: { icon: string; size?: number; className?: string }) {
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
  return <span ref={ref} className={className} aria-hidden="true" />;
}

export function DashboardApp() {
  const plugin = usePlugin();
  const [settings, updateSettings] = useSettings();
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [refreshingTab, setRefreshingTab] = useState<DashboardTab | null>(null);
  const [refreshRequestId, setRefreshRequestId] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Record<DashboardTab, Date | null>>({
    today: null,
    note: null,
    bake: null,
    recipes: null,
    system: null,
  });

  useEffect(() => {
    isVaultInitialized(plugin.app).then(setInitialized);
    const recheck = () => {
      isVaultInitialized(plugin.app).then(setInitialized);
    };
    plugin.events.on('setup-complete', recheck);
    return () => {
      plugin.events.off('setup-complete', recheck);
    };
  }, [plugin]);

  const handleRefresh = useCallback(() => {
    if (refreshingTab) return;
    const nextRequestId = refreshRequestId + 1;
    setRefreshRequestId(nextRequestId);
    setRefreshingTab(activeTab);
    plugin.events.trigger('dashboard-refresh', {
      tab: activeTab,
      requestId: nextRequestId,
    } satisfies DashboardRefreshPayload);
  }, [plugin, activeTab, refreshRequestId, refreshingTab]);

  useEffect(() => {
    const ref = plugin.events.on('dashboard-refresh-complete', (payload: DashboardRefreshPayload) => {
      if (payload.tab !== refreshingTab) return;
      setLastRefreshed((prev) => ({ ...prev, [payload.tab]: new Date() }));
      setRefreshingTab(null);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refreshingTab]);

  useEffect(() => {
    const ref = plugin.events.on('dashboard-open-tab', (tab: DashboardTab) => {
      setActiveTab(tab);
    });
    return () => plugin.events.offref(ref);
  }, [plugin]);

  const dismissBanner = useCallback(async () => {
    await updateSettings({ onboardingDismissed: true });
  }, [updateSettings]);

  const openSetupWizard = useCallback(() => {
    new SetupWizardModal(plugin.app, plugin, () => plugin.onSetupComplete()).open();
  }, [plugin]);

  if (initialized === null) {
    return (
      <div className="knowlery-dashboard">
        <div className="knowlery-brand-header">
          <div className="knowlery-brand-header__icon">
            <ObsidianIcon icon="chef-hat" size={18} />
          </div>
          <div className="knowlery-brand-header__meta">
            <span className="knowlery-brand-header__title">Knowlery</span>
            <span className="knowlery-brand-header__subtitle">{BRAND_SUBTITLE}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="knowlery-dashboard">
        <div className="knowlery-brand-header">
          <div className="knowlery-brand-header__icon">
            <ObsidianIcon icon="chef-hat" size={18} />
          </div>
          <div className="knowlery-brand-header__meta">
            <span className="knowlery-brand-header__title">Knowlery</span>
            <span className="knowlery-brand-header__subtitle">{BRAND_SUBTITLE}</span>
          </div>
        </div>

        <div className="knowlery-setup-prompt">
          <div className="knowlery-setup-prompt__icon">
            <ObsidianIcon icon="package" size={32} />
          </div>
          <h3 className="knowlery-setup-prompt__title">Vault not set up</h3>
          <p className="knowlery-setup-prompt__desc">
            This vault has not been prepared for Knowlery yet. Run the setup
            wizard to create knowledge directories, install review recipes, and prepare
            agent configuration.
          </p>
          <button
            className="mod-cta knowlery-setup-prompt__btn"
            onClick={openSetupWizard}
          >
            Initialize vault
          </button>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = activeTab === 'today'
    ? TodayTab
    : activeTab === 'note'
      ? ThisNoteTab
      : activeTab === 'bake'
        ? BakeTab
        : activeTab === 'recipes'
          ? SkillsTab
          : SystemTab;

  return (
    <div className="knowlery-dashboard">
      <div className="knowlery-brand-header">
        <div className="knowlery-brand-header__icon">
          <ObsidianIcon icon="chef-hat" size={18} />
        </div>
        <div className="knowlery-brand-header__meta">
          <span className="knowlery-brand-header__title">Knowlery</span>
          <span className="knowlery-brand-header__subtitle">{BRAND_SUBTITLE}</span>
        </div>
        <div className="knowlery-brand-header__actions">
          {lastRefreshed[activeTab] && (
            <span className="knowlery-brand-header__timestamp">
              Checked {formatRelativeTime(lastRefreshed[activeTab]!)}
            </span>
          )}
          <button
            className="knowlery-header-action"
            onClick={handleRefresh}
            disabled={refreshingTab !== null}
          >
            <ObsidianIcon
              icon="refresh-cw"
              size={14}
              className={refreshingTab === activeTab ? 'knowlery-spin' : undefined}
            />
            {refreshingTab === activeTab ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <nav className="knowlery-tab-nav" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`knowlery-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <ObsidianIcon icon={tab.icon} size={16} className="knowlery-tab-btn__icon" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="knowlery-tab-content" role="tabpanel">
        {!settings.onboardingDismissed && (
          <div className="knowlery-banner">
            <div className="knowlery-banner__text">
              <strong>Welcome to Knowlery!</strong> Your vault is ready for
              personal knowledge review.
            </div>
            <button
              className="knowlery-banner__close"
              onClick={dismissBanner}
              aria-label="Dismiss"
            >
              <IconX size={14} />
            </button>
          </div>
        )}
        <ActiveTabComponent />
      </div>
    </div>
  );
}
