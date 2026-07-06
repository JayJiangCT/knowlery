import { App, Modal, Notice, PluginSettingTab, type SettingDefinition, type SettingDefinitionItem } from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from './main';
import type { Platform } from './types';
import { PluginContext } from './context';
import { SettingsAdvanced } from './views/SettingsAdvanced';
import { generatePlatformConfig, migratePlatform } from './core/platform-adapter';
import { detectNode } from './core/node-detect';
import { generateKnowledgeMd } from './assets/templates';
import { executeSetup, isVaultInitialized, writeManifestUpdate } from './core/setup-executor';
import { SetupWizardModal } from './modals/setup-wizard';
import { installActivityLedgerRule } from './core/rule-manager';
import { ACTIVITY_DIR, setActivityLoggingEnabled } from './core/activity-ledger';

class ConfirmModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private title: string,
    private message: string,
    private onConfirm: () => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle(this.title);
    this.contentEl.createEl('p', { text: this.message });

    const btnContainer = this.contentEl.createDiv({ cls: 'modal-button-container' });
    btnContainer
      .createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());
    const confirmBtn = btnContainer.createEl('button', {
      text: 'Confirm',
      cls: 'mod-warning',
    });
    confirmBtn.addEventListener('click', () => {
      this.confirmed = true;
      this.close();
    });
  }

  onClose() {
    if (this.confirmed) void this.onConfirm();
  }
}

/**
 * Declarative settings tab (spec 0.8 f4, §4.3): definitions replace the deprecated
 * imperative `display()`. Simple controls are declarative (and feed Obsidian's
 * settings search); composite rows (text + button) and the React advanced section
 * use the `render` escape hatch with the same Setting builders as before, so the
 * rendered UI is unchanged.
 */
export class KnowlerySettingTab extends PluginSettingTab {
  private advancedRoot: Root | null = null;
  /** null until the async vault check lands — both branches hidden meanwhile. */
  private initialized: boolean | null = null;

  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app, plugin);
  }

  hide(): void {
    // The render-item cleanup usually handles this; hide() is the guaranteed hook.
    this.advancedRoot?.unmount();
    this.advancedRoot = null;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    // Vault state is async and this runs on every display — kick a check and
    // re-render only when the answer changes, so the tab self-corrects each open.
    this.refreshInitialized();

    return [
      this.setupBannerItem(),
      this.kbNameItem(),
      this.nodePathItem(),
      {
        type: 'group',
        heading: 'Platform',
        visible: () => this.initialized === true,
        items: [this.platformSwitchItem()],
      },
      {
        type: 'group',
        heading: 'Activity',
        visible: () => this.initialized === true,
        items: [
          {
            name: 'Activity logging',
            desc: `Store private activity summaries in ${ACTIVITY_DIR}. Agents should write summaries only, not full conversations.`,
            control: { type: 'toggle', key: 'activityLoggingEnabled', defaultValue: true },
          },
          this.activityRuleItem(),
        ],
      },
      {
        type: 'group',
        heading: 'Knowledge bundle defaults',
        visible: () => this.initialized === true,
        items: [
          {
            name: 'Creator name',
            desc: 'Used as the default creator in exported knowledge bundle manifests.',
            control: { type: 'text', key: 'bundleCreatorName' },
          },
          {
            name: 'Creator URL',
            desc: 'Optional URL included in exported bundle metadata.',
            control: { type: 'text', key: 'bundleCreatorUrl' },
          },
          {
            name: 'Default license',
            desc: 'Prefilled when sharing a knowledge bundle.',
            control: { type: 'text', key: 'bundleDefaultLicense', defaultValue: 'personal' },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Maintenance',
        visible: () => this.initialized === true,
        items: [this.regenerateConfigItem(), this.reinitializeItem()],
      },
      this.advancedSectionItem(),
    ];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof typeof this.plugin.settings];
  }

  setControlValue(key: string, value: unknown): Promise<void> {
    return this.applyControlValue(key, value);
  }

  private async applyControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;
    switch (key) {
      case 'activityLoggingEnabled': {
        const enabled = value === true;
        settings.activityLoggingEnabled = enabled;
        await this.plugin.saveSettings();
        await setActivityLoggingEnabled(this.plugin.fs, enabled);
        return;
      }
      case 'bundleCreatorName':
        settings.bundleCreatorName = typeof value === 'string' ? value : '';
        break;
      case 'bundleCreatorUrl':
        settings.bundleCreatorUrl = typeof value === 'string' ? value : '';
        break;
      case 'bundleDefaultLicense':
        settings.bundleDefaultLicense = typeof value === 'string' && value ? value : 'personal';
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
  }

  private refreshInitialized(): void {
    void isVaultInitialized(this.plugin.fs).then((value) => {
      if (value !== this.initialized) {
        this.initialized = value;
        this.update();
      }
    });
  }

  private setupBannerItem(): SettingDefinition {
    return {
      name: 'Vault not set up',
      desc: 'This vault hasn\'t been configured for AI yet. Run the setup wizard to create knowledge directories, install skills, and generate agent configuration.',
      visible: () => this.initialized === false,
      searchable: false,
      render: (setting) => {
        setting.settingEl.addClass('knowlery-settings-banner');
        setting.addButton((btn) =>
          btn
            .setButtonText('Initialize vault')
            .setCta()
            .onClick(() => {
              new SetupWizardModal(this.plugin.app, this.plugin, () => {
                this.plugin.onSetupComplete();
                this.refreshInitialized();
              }).open();
            }),
        );
      },
    };
  }

  private kbNameItem(): SettingDefinition {
    return {
      name: 'Knowledge base name',
      desc: 'Updates KNOWLEDGE.md and regenerates agent config when saved.',
      visible: () => this.initialized === true,
      render: (setting) => {
        setting
          .addText((text) =>
            text.setValue(this.plugin.settings.kbName).onChange((value) => {
              this.plugin.settings.kbName = value;
            }),
          )
          .addButton((btn) =>
            btn.setButtonText('Save').onClick(() => {
              void (async () => {
                await this.plugin.saveSettings();
                await this.updateKbName();
                new Notice('Knowledge base name updated');
              })();
            }),
          );
      },
    };
  }

  private nodePathItem(): SettingDefinition {
    return {
      name: 'Node.js path',
      desc: 'Path to Node.js. Usually leave blank. Only needed if node is in a non-standard location (enter absolute path, e.g. /usr/local/bin/node).',
      aliases: ['node'],
      render: (setting) => {
        setting.addText((text) =>
          text
            .setPlaceholder('/usr/local/bin/node')
            .setValue(this.plugin.settings.nodePath)
            .onChange((value) => {
              this.plugin.settings.nodePath = value;
              void this.plugin.saveSettings();
            }),
        );
        const messageEl = setting.settingEl.parentElement?.createDiv({
          cls: 'knowlery-settings__node-message',
        }) ?? null;
        setting.addButton((btn) =>
          btn.setButtonText('Auto-detect').onClick(() => {
            btn.setButtonText('Detecting…').setDisabled(true);
            const report = (message: string) => {
              if (messageEl) messageEl.setText(message);
              new Notice(message);
            };
            void (async () => {
              try {
                const result = await detectNode();
                if (result.detected && result.path) {
                  this.plugin.settings.nodePath = result.path;
                  await this.plugin.saveSettings();
                  report(`Detected Node.js ${result.version ?? ''} at ${result.path}`.trim());
                  this.update();
                } else {
                  report('Node.js not found. Install Node.js or enter the path manually.');
                }
              } catch (error) {
                report(`Could not detect Node.js: ${formatSettingError(error)}`);
              } finally {
                btn.setButtonText('Auto-detect').setDisabled(false);
              }
            })();
          }),
        );
        return () => messageEl?.remove();
      },
    };
  }

  private platformSwitchItem(): SettingDefinition {
    const currentLabel =
      this.plugin.settings.platform === 'claude-code' ? 'Claude Code' : 'OpenCode';
    const otherPlatform: Platform =
      this.plugin.settings.platform === 'claude-code' ? 'opencode' : 'claude-code';
    const otherLabel = otherPlatform === 'claude-code' ? 'Claude Code' : 'OpenCode';

    return {
      name: 'Current platform',
      desc: currentLabel,
      aliases: ['claude code', 'opencode'],
      render: (setting) => {
        setting.addButton((btn) =>
          btn.setButtonText(`Switch to ${otherLabel}`).onClick(() => {
            new ConfirmModal(
              this.plugin.app,
              'Switch platform',
              `Switch to ${otherLabel}? New config files will be generated. Existing config files are kept as backup.`,
              async () => {
                await migratePlatform(
                  this.plugin.fs,
                  this.plugin.settings.platform,
                  otherPlatform,
                  this.plugin.settings.kbName,
                  true,
                );
                this.plugin.settings.platform = otherPlatform;
                await this.plugin.saveSettings();
                new Notice(`Switched to ${otherLabel}`);
                this.update();
              },
            ).open();
          }),
        );
      },
    };
  }

  private activityRuleItem(): SettingDefinition {
    return {
      name: 'Activity ledger rule',
      desc: 'Install or refresh the agent rule that asks agents to leave private session receipts.',
      render: (setting) => {
        setting.addButton((button) =>
          button.setButtonText('Refresh rule').onClick(() => {
            void (async () => {
              await installActivityLedgerRule(this.plugin.fs, this.plugin.settings.platform);
              new Notice('Activity ledger rule refreshed.');
            })();
          }),
        );
      },
    };
  }

  private regenerateConfigItem(): SettingDefinition {
    return {
      name: 'Regenerate agent config',
      desc:
        this.plugin.settings.platform === 'claude-code'
          ? 'Recreate .claude/CLAUDE.md from current settings.'
          : 'Recreate opencode.json from current settings.',
      render: (setting) => {
        setting.addButton((btn) =>
          btn.setButtonText('Regenerate').onClick(() => {
            void (async () => {
              await generatePlatformConfig(
                this.plugin.fs,
                this.plugin.settings.platform,
                this.plugin.settings.kbName,
              );
              new Notice('Agent config regenerated');
            })();
          }),
        );
      },
    };
  }

  private reinitializeItem(): SettingDefinition {
    return {
      name: 'Re-initialize vault',
      desc: 'Re-run the full setup. Overwrites built-in skills and agent config. Custom skills are preserved.',
      render: (setting) => {
        setting.addButton((btn) =>
          btn
            .setButtonText('Re-initialize')
            .setCta()
            .onClick(() => {
              new ConfirmModal(
                this.plugin.app,
                'Re-initialize vault',
                'This will overwrite all built-in skills and regenerate agent config. Custom skills and your knowledge files are preserved. Continue?',
                async () => {
                  await executeSetup(
                    this.plugin.fs,
                    this.plugin.settings.platform,
                    this.plugin.settings.kbName,
                    () => {},
                  );
                  new Notice('Vault re-initialized');
                },
              ).open();
            }),
        );
      },
    };
  }

  private advancedSectionItem(): SettingDefinition {
    return {
      name: 'Advanced',
      searchable: false,
      visible: () => this.initialized === true,
      render: (setting) => {
        setting.settingEl.empty();
        const mount = setting.settingEl.createDiv({ cls: 'knowlery-settings-advanced-mount' });
        this.advancedRoot?.unmount();
        this.advancedRoot = createRoot(mount);
        this.advancedRoot.render(
          <StrictMode>
            <PluginContext.Provider value={this.plugin}>
              <SettingsAdvanced />
            </PluginContext.Provider>
          </StrictMode>,
        );
        return () => {
          this.advancedRoot?.unmount();
          this.advancedRoot = null;
        };
      },
    };
  }

  private async updateKbName(): Promise<void> {
    const knowledgeMd = this.plugin.app.vault.getFileByPath('KNOWLEDGE.md');
    if (knowledgeMd) {
      await this.plugin.app.vault.modify(
        knowledgeMd,
        generateKnowledgeMd(this.plugin.settings.kbName),
      );
    }

    await generatePlatformConfig(
      this.plugin.fs,
      this.plugin.settings.platform,
      this.plugin.settings.kbName,
    );

    await writeManifestUpdate(this.plugin.fs, {
      kbName: this.plugin.settings.kbName,
    });
  }
}

function formatSettingError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
