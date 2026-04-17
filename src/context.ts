import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type KnowleryPlugin from './main';

export const PluginContext = createContext<KnowleryPlugin | null>(null);

export const usePlugin = (): KnowleryPlugin => {
  const plugin = useContext(PluginContext);
  if (!plugin) throw new Error('usePlugin must be used inside <PluginContext.Provider>');
  return plugin;
};

export const useApp = () => usePlugin().app;

export function useSettings() {
  const plugin = usePlugin();
  const [settings, setSettings] = useState(plugin.settings);

  useEffect(() => {
    const ref = plugin.events.on('settings-changed', () => {
      setSettings({ ...plugin.settings });
    });
    return () => plugin.events.offref(ref);
  }, [plugin]);

  const update = useCallback(async (patch: Partial<typeof settings>) => {
    Object.assign(plugin.settings, patch);
    await plugin.saveSettings();
    setSettings({ ...plugin.settings });
  }, [plugin]);

  return [settings, update] as const;
}
