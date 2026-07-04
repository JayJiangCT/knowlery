import { App, Modal, Notice } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { ConformanceReport } from '../types';
import { readBundleEntries, type BundleSourceEntry } from '../core/okf/zip';
import { previewInstall } from '../core/okf/install-scan';
import { installBundle, InstallBlockedError } from '../core/okf/install';
import { readInstalledBundles, resolveInstallAction } from '../core/okf/registry';

interface ElectronDialog {
  showOpenDialog: (options: { properties: string[] }) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

function getElectronDialog(): ElectronDialog | null {
  const w = window as Window & { require?: (name: string) => unknown };
  try {
    const remote = w.require?.('@electron/remote') as { dialog?: ElectronDialog } | undefined;
    if (remote?.dialog) return remote.dialog;
  } catch { /* not available */ }
  try {
    const electron = w.require?.('electron') as { remote?: { dialog?: ElectronDialog } } | undefined;
    if (electron?.remote?.dialog) return electron.remote.dialog;
  } catch { /* not available */ }
  return null;
}

export class InstallBundleModal extends Modal {
  private root: Root | null = null;

  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle('Install knowledge bundle');
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <InstallBundleContent onClose={() => this.close()} />
        </PluginContext.Provider>
      </StrictMode>,
    );
  }

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'preview'; path: string; entries: BundleSourceEntry[]; manifestId: string; manifestVersion: string; title: string; conformance: ConformanceReport; blockedInstalledVersion: string | null }
  | { kind: 'result'; conformance: 'passed' | 'failed' | 'skipped' };

function InstallBundleContent(props: { onClose: () => void }) {
  const plugin = usePlugin();
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [acknowledgeConformanceIssues, setAcknowledgeConformanceIssues] = useState(false);

  const pickSource = async () => {
    const dialog = getElectronDialog();
    if (!dialog) {
      new Notice('The bundle picker needs the desktop app.');
      return;
    }
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return;
    await loadPreview(result.filePaths[0]);
  };

  const loadPreview = async (path: string) => {
    setError(null);
    setAcknowledgeConformanceIssues(false);
    try {
      const entries = await readBundleEntries(path);
      const { manifest, conformance } = previewInstall(entries);
      const registry = await readInstalledBundles(plugin.fs);
      const action = resolveInstallAction(registry.bundles[manifest.id], manifest.version);
      setStage({
        kind: 'preview',
        path,
        entries,
        manifestId: manifest.id,
        manifestVersion: manifest.version,
        title: manifest.title,
        conformance,
        blockedInstalledVersion: action.kind === 'blocked' ? action.installedVersion : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmInstall = async (force: boolean, skipConformanceGate: boolean) => {
    if (stage.kind !== 'preview') return;
    setInstalling(true);
    setError(null);
    try {
      const result = await installBundle(plugin.fs, stage.entries, {
        source: stage.path,
        force,
        skipConformanceGate,
      });
      plugin.events.trigger('dashboard-refresh');
      setStage({ kind: 'result', conformance: result.conformance });
    } catch (err) {
      if (err instanceof InstallBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setInstalling(false);
    }
  };

  if (stage.kind === 'result') {
    return (
      <div className="knowlery-install">
        <p>
          Installed <b>{stage.conformance === 'skipped' ? 'with conformance issues' : 'successfully'}</b>.
        </p>
        <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={props.onClose}>
          Done
        </button>
      </div>
    );
  }

  if (stage.kind === 'preview') {
    return (
      <div className="knowlery-install">
        <div className="knowlery-install__summary">
          <div className="knowlery-install__title">{stage.title}</div>
          <div className="knowlery-install__meta">
            {stage.manifestId} · v{stage.manifestVersion}
          </div>
        </div>

        {!stage.conformance.conformant && (
          <div className="knowlery-install__warning">
            This bundle has {stage.conformance.errors.length} conformance error(s).
          </div>
        )}
        {!stage.conformance.conformant && (
          <label className="knowlery-install__ack">
            <input
              type="checkbox"
              checked={acknowledgeConformanceIssues}
              onChange={(event) => setAcknowledgeConformanceIssues(event.currentTarget.checked)}
            />
            <span>Install anyway despite these conformance errors</span>
          </label>
        )}
        {stage.blockedInstalledVersion && (
          <div className="knowlery-install__warning">
            v{stage.blockedInstalledVersion} is already installed. Installing v{stage.manifestVersion} will replace it.
          </div>
        )}
        {error && <div className="knowlery-install__error">{error}</div>}

        <div className="knowlery-install__actions">
          <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={() => setStage({ kind: 'pick' })}>
            ← Back
          </button>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--primary"
            disabled={installing || (!stage.conformance.conformant && !acknowledgeConformanceIssues)}
            onClick={() =>
              confirmInstall(stage.blockedInstalledVersion !== null, acknowledgeConformanceIssues)
            }
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="knowlery-install">
      <p>Pick a knowledge bundle (.zip or folder) to install.</p>
      {error && <div className="knowlery-install__error">{error}</div>}
      <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={pickSource}>
        Choose bundle…
      </button>
    </div>
  );
}
