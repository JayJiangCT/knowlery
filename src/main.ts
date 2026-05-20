import { Events, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, VIEW_TYPE_DASHBOARD, type KnowlerySettings } from './types';
import { DashboardView } from './views/dashboard-view';
import { SetupWizardModal } from './modals/setup-wizard';
import { ReflectionCaptureModal } from './modals/reflection-capture';
import { KnowlerySettingTab } from './settings';
import { isVaultInitialized } from './core/setup-executor';
import { syncClaudeRuleImports } from './core/rule-imports';
import { syncBuiltinSkills, migrateSchemaMd } from './core/migration';

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
      name: 'Run vault diagnosis',
      callback: async () => {
        await this.activateDashboard();
        this.events.trigger('dashboard-refresh');
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
      id: 'switch-platform',
      name: 'Switch platform',
      callback: () => {
        const appWithSettings = this.app as typeof this.app & SettingApp;
        appWithSettings.setting.open();
        appWithSettings.setting.openTabById(this.manifest.id);
      },
    });

    this.addSettingTab(new KnowlerySettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      if (!(await isVaultInitialized(this.app))) {
        new Notice(
          'Knowlery: This vault isn\'t set up for AI yet. Use the command palette to initialize.',
          10000,
        );
      } else {
        if (this.settings.platform === 'claude-code') {
          await syncClaudeRuleImports(this.app);
        }

        const pluginVersion = this.manifest.version;
        if (this.settings.lastSyncedVersion !== pluginVersion) {
          await syncBuiltinSkills(this.app);
          await migrateSchemaMd(this.app);
          this.settings.lastSyncedVersion = pluginVersion;
          await this.saveSettings();
        }
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
}
