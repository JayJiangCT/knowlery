import { useState, useCallback, useRef, useEffect } from 'react';
import { setIcon } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { DashboardRefreshPayload, DashboardScreen } from '../types';
import { IconX } from './Icons';
import { isVaultInitialized } from '../core/setup-executor';
import { SetupWizardModal } from '../modals/setup-wizard';
import { DashboardHome } from './DashboardHome';
import { DashboardScreens } from './DashboardScreens';
import { t } from '../i18n';

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t('dashboard.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return t('dashboard.oneMinAgo');
  if (minutes < 60) return t('dashboard.minutesAgo', { minutes });
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  const [screen, setScreen] = useState<DashboardScreen>('home');
  const [screenPayload, setScreenPayload] = useState<unknown>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshRequestId, setRefreshRequestId] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const navigate = useCallback((next: DashboardScreen, payload?: unknown) => {
    setScreenPayload(payload ?? null);
    setScreen(next);
  }, []);

  useEffect(() => {
    void isVaultInitialized(plugin.fs).then(setInitialized);
    const recheck = () => {
      void isVaultInitialized(plugin.fs).then(setInitialized);
    };
    const ref = plugin.events.on('setup-complete', recheck);
    return () => plugin.events.offref(ref);
  }, [plugin]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    const nextRequestId = refreshRequestId + 1;
    setRefreshRequestId(nextRequestId);
    setRefreshing(true);
    plugin.events.trigger('dashboard-refresh', {
      requestId: nextRequestId,
    } satisfies DashboardRefreshPayload);
  }, [plugin, refreshRequestId, refreshing]);

  useEffect(() => {
    const ref = plugin.events.on('dashboard-refresh-complete', (_payload: DashboardRefreshPayload) => {
      setLastRefreshed(new Date());
      setRefreshing(false);
    });
    return () => plugin.events.offref(ref);
  }, [plugin]);

  const autoReqId = useRef(0);
  const autoDebounceTimer = useRef<number | null>(null);

  useEffect(() => {
    const triggerQuietRefresh = () => {
      if (autoDebounceTimer.current !== null) {
        window.clearTimeout(autoDebounceTimer.current);
      }
      autoDebounceTimer.current = window.setTimeout(() => {
        autoDebounceTimer.current = null;
        autoReqId.current += 1;
        plugin.events.trigger('dashboard-refresh', {
          requestId: autoReqId.current,
        } satisfies DashboardRefreshPayload);
      }, 500);
    };

    window.addEventListener('focus', triggerQuietRefresh);
    const leafRef = plugin.app.workspace.on('active-leaf-change', triggerQuietRefresh);

    return () => {
      if (autoDebounceTimer.current !== null) {
        window.clearTimeout(autoDebounceTimer.current);
      }
      window.removeEventListener('focus', triggerQuietRefresh);
      plugin.app.workspace.offref(leafRef);
    };
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
            <span className="knowlery-brand-header__subtitle">{t('dashboard.subtitle')}</span>
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
            <span className="knowlery-brand-header__subtitle">{t('dashboard.subtitle')}</span>
          </div>
        </div>

        <div className="knowlery-setup-prompt">
          <div className="knowlery-setup-prompt__icon">
            <ObsidianIcon icon="package" size={32} />
          </div>
          <h3 className="knowlery-setup-prompt__title">{t('dashboard.setup.title')}</h3>
          <p className="knowlery-setup-prompt__desc">{t('dashboard.setup.desc')}</p>
          <button
            className="mod-cta knowlery-setup-prompt__btn"
            onClick={openSetupWizard}
          >
            {t('dashboard.setup.button')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="knowlery-dashboard">
      <div className="knowlery-brand-header">
        <div className="knowlery-brand-header__icon">
          <ObsidianIcon icon="chef-hat" size={18} />
        </div>
        <div className="knowlery-brand-header__meta">
          <span className="knowlery-brand-header__title">Knowlery</span>
          <span className="knowlery-brand-header__subtitle">{t('dashboard.subtitle')}</span>
        </div>
        {screen === 'home' && (
          <div className="knowlery-brand-header__actions">
            {lastRefreshed && (
              <span className="knowlery-brand-header__timestamp">
                {t('dashboard.checked', { time: formatRelativeTime(lastRefreshed) })}
              </span>
            )}
            <button
              className="knowlery-header-action"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <ObsidianIcon
                icon="refresh-cw"
                size={14}
                className={refreshing ? 'knowlery-spin' : undefined}
              />
              {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
            </button>
          </div>
        )}
      </div>

      <div className="knowlery-tab-content">
        {!settings.onboardingDismissed && (
          <div className="knowlery-banner">
            <div className="knowlery-banner__text">
              <strong>{t('dashboard.welcome.strong')}</strong> {t('dashboard.welcome.body')}
            </div>
            <button
              className="knowlery-banner__close"
              onClick={() => void dismissBanner()}
              aria-label={t('dashboard.welcome.dismiss')}
            >
              <IconX size={14} />
            </button>
          </div>
        )}
        {screen === 'home' && <DashboardHome navigate={navigate} />}
        {screen !== 'home' && (
          <DashboardScreens screen={screen} payload={screenPayload} navigate={navigate} />
        )}
      </div>
    </div>
  );
}
