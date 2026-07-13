import { Events, Notice, Plugin, TFile, WorkspaceLeaf, getLanguage } from 'obsidian';
import { DEFAULT_SETTINGS, KNOWLEDGE_DIRS, VIEW_TYPE_DASHBOARD, type KnowlerySettings } from './types';
import { DashboardView } from './views/dashboard-view';
import { ensureVaultRegistered, unregisterOwnedVault } from './core/kb-registry';
import { SetupWizardModal } from './modals/setup-wizard';
import { ReflectionCaptureModal } from './modals/reflection-capture';
import { ReleaseNotesModal } from './modals/release-notes-modal';
import { ExportBundleModal } from './modals/export-bundle';
import { InstallBundleModal } from './modals/install-bundle';
import { KnowlerySettingTab } from './settings';
import { isVaultInitialized } from './core/setup-executor';
import { syncClaudeRuleImports } from './core/rule-imports';
import { runVaultSync } from './core/vault-sync';
import type { VaultFs } from './core/vault-fs';
import { obsidianVaultFs } from './platform/obsidian-fs';
import { LiveQuerySnapshot } from './core/query/live-snapshot';
import {
  QUERY_CLI_COMMAND,
  QUERY_CLI_DESCRIPTION,
  QUERY_CLI_FLAGS,
  STALE_CLI_COMMAND,
  STALE_CLI_DESCRIPTION,
  STALE_CLI_FLAGS,
  handleQueryCli,
  handleStaleCli,
} from './core/query/cli-handler';
import { getReleaseNote } from './assets/release-notes';
import { conceptIdFromPath, isKnowledgePath } from './core/okf/shared';
import { forkPageFromBundle, parseLibraryPath } from './core/okf/fork';
import { resolveLocale, setLocale, t } from './i18n';

interface SettingApp {
  setting: {
    open: () => void;
    openTabById: (id: string) => void;
  };
}

interface CollapsibleWorkspace {
  rightSplit?: {
    collapsed?: boolean;
    expand: () => void;
  };
}

export default class KnowleryPlugin extends Plugin {
  settings: KnowlerySettings = DEFAULT_SETTINGS;
  events = new Events();
  liveSnapshot: LiveQuerySnapshot | null = null;
  /** Obsidian-shell VaultFs, shared with core lifecycle modules (spec 0.7 f1). */
  fs: VaultFs = obsidianVaultFs(this.app);

  async onload() {
    await this.loadSettings();
    // Locale must be resolved before any command/ribbon registration below.
    setLocale(resolveLocale(this.settings.language, getLanguage()));

    this.fs = obsidianVaultFs(this.app);
    this.liveSnapshot = new LiveQuerySnapshot(this.app);
    this.registerQueryCliHandler();
    void this.syncKbRegistration();

    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

    this.addRibbonIcon('chef-hat', t('main.ribbon.openDashboard'), () => {
      void this.activateDashboard();
    });

    this.addCommand({
      id: 'open-dashboard',
      name: t('main.command.openDashboard'),
      callback: () => this.activateDashboard(),
    });

    this.addCommand({
      id: 'initialize-vault',
      name: t('main.command.initializeVault'),
      callback: () => {
        new SetupWizardModal(this.app, this, () => this.onSetupComplete()).open();
      },
    });

    this.addCommand({
      id: 'run-vault-diagnosis',
      name: t('main.command.openDiagnostics'),
      callback: () => {
        const appWithSettings = this.app as typeof this.app & SettingApp;
        appWithSettings.setting.open();
        appWithSettings.setting.openTabById(this.manifest.id);
      },
    });

    this.addCommand({
      id: 'add-reflection',
      name: t('main.command.addReflection'),
      callback: () => {
        new ReflectionCaptureModal(
          this.app,
          this,
          () => this.events.trigger('dashboard-refresh'),
        ).open();
      },
    });

    this.addCommand({
      id: 'share-knowledge-bundle',
      name: t('main.command.shareBundle'),
      callback: () => {
        new ExportBundleModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'install-knowledge-bundle',
      name: t('main.command.installBundle'),
      callback: () => {
        new InstallBundleModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'switch-platform',
      name: t('main.command.switchPlatform'),
      callback: () => {
        const appWithSettings = this.app as typeof this.app & SettingApp;
        appWithSettings.setting.open();
        appWithSettings.setting.openTabById(this.manifest.id);
      },
    });

    this.addSettingTab(new KnowlerySettingTab(this.app, this));

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== 'md' || !isKnowledgePath(file.path)) return;
      menu.addItem((item) => {
        item
          .setTitle(t('main.menu.shareTopic'))
          .setIcon('share-2')
          .onClick(() => {
            new ExportBundleModal(this.app, this, conceptIdFromPath(file.path)).open();
          });
      });
    }));

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || file.extension !== 'md') return;
      const parsed = parseLibraryPath(file.path);
      if (!parsed) return;
      const topSegment = parsed.relativePath.split('/')[0];
      if (!(KNOWLEDGE_DIRS as readonly string[]).includes(topSegment)) return;
      menu.addItem((item) => {
        item
          .setTitle(t('main.menu.forkToKnowledge'))
          .setIcon('git-fork')
          .onClick(async () => {
            try {
              await forkPageFromBundle(this.app, {
                libraryPath: `Library/${parsed.bundleId}/`,
                sourcePath: parsed.relativePath,
                targetPath: parsed.relativePath,
                bundleId: parsed.bundleId,
              });
              new Notice(t('main.notice.forked', { path: parsed.relativePath }));
              this.events.trigger('dashboard-refresh');
            } catch (error) {
              new Notice(error instanceof Error ? error.message : String(error));
            }
          });
      });
    }));

    this.app.workspace.onLayoutReady(async () => {
      if (!(await isVaultInitialized(this.fs))) {
        new Notice(t('main.notice.notSetUp'), 10000);
      } else {
        const pluginVersion = this.manifest.version;
        const previousSyncedVersion = this.settings.lastSyncedVersion;

        if (this.settings.platform === 'claude-code') {
          await syncClaudeRuleImports(this.fs);
        }

        if (this.settings.lastSyncedVersion !== pluginVersion) {
          const syncResult = await runVaultSync(this.fs, this.settings.platform, pluginVersion);
          if (syncResult.skipped === 'newer-shell') {
            new Notice(t('main.notice.newerShell', { version: syncResult.lastSyncedBy ?? '' }), 10000);
          } else {
            this.settings.lastSyncedVersion = pluginVersion;
            await this.saveSettings();
          }
        }

        await this.maybeShowReleaseNotes(pluginVersion, previousSyncedVersion !== '');
      }

      let refreshTimer: number | null = null;
      const throttledRefresh = () => {
        if (refreshTimer) return;
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          this.events.trigger('dashboard-refresh');
        }, 5000);
      };
      this.registerEvent(this.app.vault.on('create', throttledRefresh));
      this.registerEvent(this.app.vault.on('delete', throttledRefresh));
      this.registerEvent(this.app.vault.on('rename', throttledRefresh));
      this.registerEvent(this.app.vault.on('modify', throttledRefresh));

      // Live snapshot for the knowlery:query CLI transport (spec f5, §5.2): full build
      // in the background, then incremental per-file updates from the event stream.
      const snapshot = this.liveSnapshot;
      if (snapshot) {
        void snapshot.build();
        this.registerEvent(this.app.vault.on('create', (file) => snapshot.scheduleRefresh(file.path)));
        this.registerEvent(this.app.vault.on('modify', (file) => snapshot.scheduleRefresh(file.path)));
        this.registerEvent(this.app.vault.on('delete', (file) => snapshot.handleDelete(file.path)));
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => snapshot.handleRename(oldPath, file.path)));
        // Bundle registry files are hidden, so vault events never fire for them; the
        // dashboard-refresh event fires after bundle install/uninstall.
        this.events.on('dashboard-refresh', () => void snapshot.refreshBundles());
      }
    });
  }

  /**
   * Registers `obsidian knowlery:query` (spec f5, §5.3). Feature-detected: on Obsidian
   * builds without registerCliHandler (< 1.12.2) the plugin loads without the CLI
   * transport and everything else works unchanged. Registration failures never break
   * plugin load.
   */
  private registerQueryCliHandler(): void {
    // Belt-and-suspenders: minAppVersion is 1.12.2 (the registerCliHandler API's
    // version), but a missing or failing CLI host must never break plugin load.
    if (typeof this.registerCliHandler !== 'function') return;
    try {
      this.registerCliHandler(
        QUERY_CLI_COMMAND,
        QUERY_CLI_DESCRIPTION,
        QUERY_CLI_FLAGS,
        (params) => handleQueryCli(params, this.liveSnapshot?.snapshot() ?? null),
      );
      this.registerCliHandler(
        STALE_CLI_COMMAND,
        STALE_CLI_DESCRIPTION,
        STALE_CLI_FLAGS,
        (params) => handleStaleCli(params, this.liveSnapshot?.snapshot() ?? null),
      );
    } catch {
      // Older or changed CLI hosts — the headless query.mjs transport remains available.
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<KnowlerySettings> | null);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.events.trigger('settings-changed');
  }

  async activateDashboard() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf!.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
    }
    if (leaf) {
      const rightSplit = (workspace as typeof workspace & CollapsibleWorkspace).rightSplit;
      if (rightSplit?.collapsed) {
        rightSplit.expand();
      }
      await workspace.revealLeaf(leaf);
    }
  }

  onSetupComplete() {
    this.events.trigger('setup-complete');
    void this.syncKbRegistration();
    void this.activateDashboard();
  }

  /**
   * KB registry integration (spec 1.0 f1, §4.5): register on setup/load, under
   * the ownership rule — the plugin remembers exactly the name it created and
   * only ever removes that; a pre-existing user entry is never touched.
   */
  async syncKbRegistration(): Promise<void> {
    const adapter = this.app.vault.adapter as { getBasePath?: () => string };
    const basePath = adapter.getBasePath?.();
    if (!basePath) return; // desktop-only concern

    try {
      if (!this.settings.registerVaultGlobally) {
        await unregisterOwnedVault(basePath, this.settings.registryOwnedName);
        if (this.settings.registryOwnedName !== null) {
          this.settings.registryOwnedName = null;
          await this.saveSettings();
        }
        return;
      }
      if (!(await isVaultInitialized(this.fs))) return;
      const { ownedName } = await ensureVaultRegistered(basePath, this.settings.kbName, this.settings.registryOwnedName);
      if (ownedName !== this.settings.registryOwnedName) {
        this.settings.registryOwnedName = ownedName;
        await this.saveSettings();
      }
    } catch (error) {
      console.warn('knowlery: KB registry sync failed', error);
    }
  }

  private async maybeShowReleaseNotes(
    pluginVersion: string,
    hasSeenPreviousVersion: boolean,
  ): Promise<void> {
    const note = getReleaseNote(pluginVersion);
    if (!note) {
      this.settings.lastSeenReleaseVersion = pluginVersion;
      await this.saveSettings();
      return;
    }

    if (!this.settings.lastSeenReleaseVersion && !hasSeenPreviousVersion) {
      this.settings.lastSeenReleaseVersion = pluginVersion;
      await this.saveSettings();
      return;
    }

    if (this.settings.lastSeenReleaseVersion === pluginVersion) {
      return;
    }

    new ReleaseNotesModal(this.app, this, {
      note,
      onClose: () => {
        this.settings.lastSeenReleaseVersion = pluginVersion;
        void this.saveSettings();
      },
      onOpenDashboard: () => {
        void this.activateDashboard();
      },
    }).open();
  }
}
