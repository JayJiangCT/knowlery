import { App, Modal, Notice, PluginSettingTab, Setting, getLanguage, type SettingDefinition, type SettingDefinitionItem } from 'obsidian';
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
import { resolveLocale, setLocale, t, type LanguageSetting } from './i18n';

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
      .createEl('button', { text: t('common.cancel') })
      .addEventListener('click', () => this.close());
    const confirmBtn = btnContainer.createEl('button', {
      text: t('common.confirm'),
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
 * Declarative settings tab (spec 0.8 f4, §4.3, amended at acceptance): one
 * definitions array, two renderers. On Obsidian >= 1.13 the framework renders
 * `getSettingDefinitions()` declaratively (and feeds settings search); on public
 * releases (1.12.x — 1.13 is Catalyst-only as of 0.8.0) the framework calls the
 * legacy `display()`, which renders the *same* definitions through a small
 * imperative interpreter below. Single source, so the two paths cannot drift.
 */
export class KnowlerySettingTab extends PluginSettingTab {
  private advancedRoot: Root | null = null;
  /** null until the async vault check lands — both branches hidden meanwhile. */
  private initialized: boolean | null = null;
  /** Fallback-path bookkeeping: true while the pre-1.13 imperative render is showing. */
  private tabOpen = false;

  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app, plugin);
  }

  hide(): void {
    this.tabOpen = false;
    // The render-item cleanup usually handles this; hide() is the guaranteed hook.
    this.advancedRoot?.unmount();
    this.advancedRoot = null;
  }

  /**
   * Legacy entry point, called by Obsidian < 1.13 only (1.13+ renders the
   * definitions itself and never calls this — exactly the fallback arrangement
   * the API docs prescribe for plugins supporting older versions).
   */
  display(): void {
    this.renderFallback();
  }

  /** Re-render whichever path is active after state the definitions read has changed. */
  private requestRender(): void {
    // Capability detection, not a version check: SettingTab.update() exists on
    // >= 1.13 (the declarative renderer); on public 1.12.x we re-run the
    // imperative fallback ourselves. Accessed structurally so the code carries
    // no hard dependency on the 1.13 API surface (minAppVersion stays 1.12.2).
    const declarativeUpdate = (this as { update?: () => void }).update;
    if (typeof declarativeUpdate === 'function') {
      declarativeUpdate.call(this);
    } else if (this.tabOpen) {
      this.renderFallback();
    }
  }

  private renderFallback(): void {
    this.tabOpen = true;
    this.advancedRoot?.unmount();
    this.advancedRoot = null;
    const { containerEl } = this;
    containerEl.empty();
    this.renderDefinitionsInto(containerEl, this.getSettingDefinitions());
  }

  private renderDefinitionsInto(containerEl: HTMLElement, items: SettingDefinitionItem[]): void {
    const hidden = (visible?: boolean | (() => boolean)) =>
      visible === false || (typeof visible === 'function' && !visible());

    for (const item of items) {
      if ('type' in item && (item.type === 'group' || item.type === 'list')) {
        if (hidden(item.visible)) continue;
        if (item.heading) new Setting(containerEl).setName(item.heading).setHeading();
        this.renderDefinitionsInto(containerEl, item.items ?? []);
        continue;
      }
      if ('type' in item) continue; // 'page' — not used by this tab
      const definition = item;
      if (hidden(definition.visible)) continue;

      const setting = new Setting(containerEl).setName(definition.name);
      if (definition.desc) setting.setDesc(definition.desc);

      if (definition.render) {
        // Our render callbacks ignore the 1.13 SettingGroup parameter.
        (definition.render as (setting: Setting) => void | (() => void))(setting);
        continue;
      }
      const control = definition.control;
      if (!control) continue;
      const current = this.getControlValue(control.key) ?? control.defaultValue;
      if (control.type === 'toggle') {
        setting.addToggle((toggle) =>
          toggle.setValue(current === true).onChange((value) => {
            void this.setControlValue(control.key, value);
          }),
        );
      } else if (control.type === 'text') {
        setting.addText((text) => {
          if (control.placeholder) text.setPlaceholder(control.placeholder);
          text.setValue(typeof current === 'string' ? current : '').onChange((value) => {
            void this.setControlValue(control.key, value);
          });
        });
      }
    }
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    // Vault state is async and this runs on every display — kick a check and
    // re-render only when the answer changes, so the tab self-corrects each open.
    this.refreshInitialized();

    return [
      this.setupBannerItem(),
      this.kbNameItem(),
      this.languageItem(),
      this.nodePathItem(),
      {
        name: t('settings.registerVault.name'),
        desc: t('settings.registerVault.desc'),
        visible: () => this.initialized === true,
        control: { type: 'toggle', key: 'registerVaultGlobally', defaultValue: true },
      },
      {
        type: 'group',
        heading: t('settings.heading.platform'),
        visible: () => this.initialized === true,
        items: [this.platformSwitchItem()],
      },
      {
        type: 'group',
        heading: t('settings.heading.activity'),
        visible: () => this.initialized === true,
        items: [
          {
            name: t('settings.activityLogging.name'),
            desc: t('settings.activityLogging.desc', { dir: ACTIVITY_DIR }),
            control: { type: 'toggle', key: 'activityLoggingEnabled', defaultValue: true },
          },
          this.activityRuleItem(),
        ],
      },
      {
        type: 'group',
        heading: t('settings.heading.bundleDefaults'),
        visible: () => this.initialized === true,
        items: [
          {
            name: t('settings.creatorName.name'),
            desc: t('settings.creatorName.desc'),
            control: { type: 'text', key: 'bundleCreatorName' },
          },
          {
            name: t('settings.creatorUrl.name'),
            desc: t('settings.creatorUrl.desc'),
            control: { type: 'text', key: 'bundleCreatorUrl' },
          },
          {
            name: t('settings.defaultLicense.name'),
            desc: t('settings.defaultLicense.desc'),
            control: { type: 'text', key: 'bundleDefaultLicense', defaultValue: 'personal' },
          },
        ],
      },
      {
        type: 'group',
        heading: t('settings.heading.maintenance'),
        visible: () => this.initialized === true,
        items: [this.regenerateConfigItem(), this.reinitializeItem()],
      },
      this.advancedSectionItem(),
    ];
  }

  private languageItem(): SettingDefinition {
    return {
      name: t('settings.language.name'),
      desc: t('settings.language.desc'),
      aliases: ['language', '语言', 'locale', 'chinese', '中文'],
      render: (setting) => {
        setting.addDropdown((dropdown) =>
          dropdown
            .addOption('auto', t('settings.language.auto'))
            .addOption('en', 'English')
            .addOption('zh', '中文')
            .setValue(this.plugin.settings.language)
            .onChange((value) => {
              void (async () => {
                this.plugin.settings.language = value as LanguageSetting;
                setLocale(resolveLocale(this.plugin.settings.language, getLanguage()));
                await this.plugin.saveSettings();
                // Rebuild dashboard models so today/moves copy re-renders in
                // the new language; the settings tab re-renders itself.
                this.plugin.events.trigger('dashboard-refresh');
                this.requestRender();
              })();
            }),
        );
      },
    };
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
      case 'registerVaultGlobally': {
        settings.registerVaultGlobally = value === true;
        await this.plugin.saveSettings();
        await this.plugin.syncKbRegistration();
        return;
      }
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
        this.requestRender();
      }
    });
  }

  private setupBannerItem(): SettingDefinition {
    return {
      name: t('settings.banner.name'),
      desc: t('settings.banner.desc'),
      visible: () => this.initialized === false,
      searchable: false,
      render: (setting) => {
        setting.settingEl.addClass('knowlery-settings-banner');
        setting.addButton((btn) =>
          btn
            .setButtonText(t('settings.banner.initialize'))
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
      name: t('settings.kbName.name'),
      desc: t('settings.kbName.desc'),
      visible: () => this.initialized === true,
      render: (setting) => {
        setting
          .addText((text) =>
            text.setValue(this.plugin.settings.kbName).onChange((value) => {
              this.plugin.settings.kbName = value;
            }),
          )
          .addButton((btn) =>
            btn.setButtonText(t('settings.kbName.save')).onClick(() => {
              void (async () => {
                await this.plugin.saveSettings();
                await this.updateKbName();
                new Notice(t('settings.kbName.updated'));
              })();
            }),
          );
      },
    };
  }

  private nodePathItem(): SettingDefinition {
    return {
      name: t('settings.nodePath.name'),
      desc: t('settings.nodePath.desc'),
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
          btn.setButtonText(t('settings.nodePath.autoDetect')).onClick(() => {
            btn.setButtonText(t('settings.nodePath.detecting')).setDisabled(true);
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
                  report(t('settings.nodePath.detected', { version: result.version ?? '', path: result.path }).trim());
                } else {
                  report(t('settings.nodePath.notFound'));
                }
              } catch (error) {
                report(t('settings.nodePath.detectFailed', { error: formatSettingError(error) }));
              } finally {
                btn.setButtonText(t('settings.nodePath.autoDetect')).setDisabled(false);
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
      name: t('settings.platform.current'),
      desc: currentLabel,
      aliases: ['claude code', 'opencode'],
      render: (setting) => {
        setting.addButton((btn) =>
          btn.setButtonText(t('settings.platform.switchTo', { platform: otherLabel })).onClick(() => {
            new ConfirmModal(
              this.plugin.app,
              t('settings.platform.confirmTitle'),
              t('settings.platform.confirmMessage', { platform: otherLabel }),
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
                new Notice(t('settings.platform.switched', { platform: otherLabel }));
                this.requestRender();
              },
            ).open();
          }),
        );
      },
    };
  }

  private activityRuleItem(): SettingDefinition {
    return {
      name: t('settings.activityRule.name'),
      desc: t('settings.activityRule.desc'),
      render: (setting) => {
        setting.addButton((button) =>
          button.setButtonText(t('settings.activityRule.refresh')).onClick(() => {
            void (async () => {
              await installActivityLedgerRule(this.plugin.fs, this.plugin.settings.platform);
              new Notice(t('settings.activityRule.refreshed'));
            })();
          }),
        );
      },
    };
  }

  private regenerateConfigItem(): SettingDefinition {
    return {
      name: t('settings.regenerate.name'),
      desc:
        this.plugin.settings.platform === 'claude-code'
          ? t('settings.regenerate.descClaude')
          : t('settings.regenerate.descOpencode'),
      render: (setting) => {
        setting.addButton((btn) =>
          btn.setButtonText(t('settings.regenerate.button')).onClick(() => {
            void (async () => {
              await generatePlatformConfig(
                this.plugin.fs,
                this.plugin.settings.platform,
                this.plugin.settings.kbName,
              );
              new Notice(t('settings.regenerate.done'));
            })();
          }),
        );
      },
    };
  }

  private reinitializeItem(): SettingDefinition {
    return {
      name: t('settings.reinitialize.name'),
      desc: t('settings.reinitialize.desc'),
      render: (setting) => {
        setting.addButton((btn) =>
          btn
            .setButtonText(t('settings.reinitialize.button'))
            .setCta()
            .onClick(() => {
              new ConfirmModal(
                this.plugin.app,
                t('settings.reinitialize.name'),
                t('settings.reinitialize.confirmMessage'),
                async () => {
                  await executeSetup(
                    this.plugin.fs,
                    this.plugin.settings.platform,
                    this.plugin.settings.kbName,
                    () => {},
                  );
                  new Notice(t('settings.reinitialize.done'));
                },
              ).open();
            }),
        );
      },
    };
  }

  private advancedSectionItem(): SettingDefinition {
    return {
      name: t('settings.heading.advanced'),
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
