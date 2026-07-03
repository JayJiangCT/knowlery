import { Events, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, KNOWLEDGE_DIRS, VIEW_TYPE_DASHBOARD, type KnowlerySettings } from './types';
import { DashboardView } from './views/dashboard-view';
import { SetupWizardModal } from './modals/setup-wizard';
import { ReflectionCaptureModal } from './modals/reflection-capture';
import { ReleaseNotesModal } from './modals/release-notes-modal';
import { ExportBundleModal } from './modals/export-bundle';
import { InstallBundleModal } from './modals/install-bundle';
import { KnowlerySettingTab } from './settings';
import { isVaultInitialized } from './core/setup-executor';
import { syncClaudeRuleImports } from './core/rule-imports';
import { syncBuiltinSkills, migrateSchemaMd } from './core/migration';
import { getReleaseNote } from './assets/release-notes';
import { conceptIdFromPath, isKnowledgePath } from './core/okf/shared';
import { forkPageFromBundle, parseLibraryPath } from './core/okf/fork';

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

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

    this.addRibbonIcon('chef-hat', 'Open knowlery dashboard', () => {
      void this.activateDashboard();
    });

    this.addCommand({
      id: 'open-dashboard',
      name: 'Open dashboard',
      callback: () => this.activateDashboard(),
    });

    this.addCommand({
      id: 'initialize-vault',
      name: 'Initialize vault',
      callback: () => {
        new SetupWizardModal(this.app, this, () => this.onSetupComplete()).open();
      },
    });

    this.addCommand({
      id: 'run-vault-diagnosis',
      name: 'Open diagnostics (settings)',
      callback: () => {
        const appWithSettings = this.app as typeof this.app & SettingApp;
        appWithSettings.setting.open();
        appWithSettings.setting.openTabById(this.manifest.id);
      },
    });

    this.addCommand({
      id: 'add-reflection',
      name: 'Add reflection',
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
      name: 'Share knowledge bundle...',
      callback: () => {
        new ExportBundleModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'install-knowledge-bundle',
      name: 'Install knowledge bundle...',
      callback: () => {
        new InstallBundleModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'switch-platform',
      name: 'Switch platform',
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
          .setTitle('Share this topic...')
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
          .setTitle('Fork to my knowledge...')
          .setIcon('git-fork')
          .onClick(async () => {
            try {
              await forkPageFromBundle(this.app, {
                libraryPath: `Library/${parsed.bundleId}/`,
                sourcePath: parsed.relativePath,
                targetPath: parsed.relativePath,
                bundleId: parsed.bundleId,
              });
              new Notice(`Forked to ${parsed.relativePath}`);
              this.events.trigger('dashboard-refresh');
            } catch (error) {
              new Notice(error instanceof Error ? error.message : String(error));
            }
          });
      });
    }));

    this.app.workspace.onLayoutReady(async () => {
      if (!(await isVaultInitialized(this.app))) {
        new Notice(
          'Knowlery: This vault isn\'t set up for AI yet. Use the command palette to initialize.',
          10000,
        );
      } else {
        const pluginVersion = this.manifest.version;
        const previousSyncedVersion = this.settings.lastSyncedVersion;

        if (this.settings.platform === 'claude-code') {
          await syncClaudeRuleImports(this.app);
        }

        if (this.settings.lastSyncedVersion !== pluginVersion) {
          await syncBuiltinSkills(this.app);
          await migrateSchemaMd(this.app);
          this.settings.lastSyncedVersion = pluginVersion;
          await this.saveSettings();
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
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
    void this.activateDashboard();
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
