import { describe, expect, it, vi } from 'vitest';
import { KnowlerySettingTab } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/types';
import { ACTIVITY_DISABLED_PATH } from '../../src/core/activity-ledger';
import { createMemoryFs } from '../mocks/memory-fs';

/**
 * Spec 0.8 f4, §4.3 (as amended): the control persistence contract behind both
 * renderers. getControlValue/setControlValue are the single read/write path the
 * declarative framework (1.13+) and the fallback interpreter (1.12.x) share —
 * holding them in CI covers the persistence half of the §6 manual checklist.
 */

function makeTab() {
  const fs = createMemoryFs({});
  const plugin = {
    fs,
    settings: { ...DEFAULT_SETTINGS },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    app: {},
  };
  const tab = new KnowlerySettingTab({} as never, plugin as never);
  return { tab, plugin, fs };
}

describe('settings control persistence (spec 0.8 f4, §4.3)', () => {
  it('getControlValue reads live plugin settings', () => {
    const { tab, plugin } = makeTab();
    plugin.settings.bundleCreatorName = 'Jay';
    expect(tab.getControlValue('bundleCreatorName')).toBe('Jay');
    expect(tab.getControlValue('activityLoggingEnabled')).toBe(DEFAULT_SETTINGS.activityLoggingEnabled);
  });

  it('bundle default fields persist through setControlValue', async () => {
    const { tab, plugin } = makeTab();
    await tab.setControlValue('bundleCreatorName', 'Jay');
    await tab.setControlValue('bundleCreatorUrl', 'https://example.com');
    await tab.setControlValue('bundleDefaultLicense', 'CC-BY');
    expect(plugin.settings.bundleCreatorName).toBe('Jay');
    expect(plugin.settings.bundleCreatorUrl).toBe('https://example.com');
    expect(plugin.settings.bundleDefaultLicense).toBe('CC-BY');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(3);
  });

  it('empty license falls back to personal (pre-migration behavior preserved)', async () => {
    const { tab, plugin } = makeTab();
    await tab.setControlValue('bundleDefaultLicense', '');
    expect(plugin.settings.bundleDefaultLicense).toBe('personal');
  });

  it('activity toggle persists and syncs the vault marker both ways', async () => {
    const { tab, plugin, fs } = makeTab();

    await tab.setControlValue('activityLoggingEnabled', false);
    expect(plugin.settings.activityLoggingEnabled).toBe(false);
    expect(await fs.exists(ACTIVITY_DISABLED_PATH)).toBe(true);

    await tab.setControlValue('activityLoggingEnabled', true);
    expect(plugin.settings.activityLoggingEnabled).toBe(true);
    expect(await fs.exists(ACTIVITY_DISABLED_PATH)).toBe(false);
  });

  it('unknown keys are ignored without writing', async () => {
    const { tab, plugin } = makeTab();
    await tab.setControlValue('nonexistent', 'x');
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });
});
