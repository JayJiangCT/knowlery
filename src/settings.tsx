import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import type KnowleryPlugin from './main';
import type { Platform } from './types';
import { generatePlatformConfig, migratePlatform } from './core/platform-adapter';
import { detectNode } from './core/node-detect';
import { generateKnowledgeMd } from './assets/templates';
import { executeSetup, isVaultInitialized, writeManifestUpdate } from './core/setup-executor';
import { SetupWizardModal } from './modals/setup-wizard';

class ConfirmModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private title: string,
    private message: string,
    private onConfirm: () => void,
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
    if (this.confirmed) this.onConfirm();
  }
}

export class KnowlerySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app, plugin);
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    const initialized = await isVaultInitialized(this.plugin.app);

    if (!initialized) {
      this.renderUninitializedState(containerEl);
    } else {
      this.renderInitializedState(containerEl);
    }
  }

  private renderUninitializedState(containerEl: HTMLElement): void {
    const banner = containerEl.createDiv({ cls: 'knowlery-settings-banner' });
    banner.createEl('h3', { text: 'Vault not set up' });
    banner.createEl('p', {
      text: 'This vault hasn\'t been configured for AI yet. Run the setup wizard to create knowledge directories, install skills, and generate agent configuration.',
    });
    const bannerBtn = banner.createEl('button', {
      text: 'Initialize vault',
      cls: 'mod-cta',
    });
    bannerBtn.addEventListener('click', () => {
      new SetupWizardModal(this.plugin.app, this.plugin, () => {
        this.plugin.onSetupComplete();
        this.display();
      }).open();
    });

    this.renderNodeSetting(containerEl);
  }

  private renderInitializedState(containerEl: HTMLElement): void {
    this.renderGeneralSection(containerEl);
    this.renderPlatformSection(containerEl);
    this.renderMaintenanceSection(containerEl);
  }

  private renderGeneralSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('General').setHeading();

    new Setting(containerEl)
      .setName('Knowledge base name')
      .setDesc('Updates KNOWLEDGE.md and regenerates agent config when saved.')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.kbName)
          .onChange(async (value) => {
            this.plugin.settings.kbName = value;
          }),
      )
      .addButton((btn) =>
        btn.setButtonText('Save').onClick(async () => {
          await this.plugin.saveSettings();
          await this.updateKbName();
          new Notice('Knowledge base name updated');
        }),
      );

    this.renderNodeSetting(containerEl);
  }

  private renderPlatformSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Platform').setHeading();

    const currentLabel =
      this.plugin.settings.platform === 'claude-code' ? 'Claude Code' : 'OpenCode';
    const otherPlatform: Platform =
      this.plugin.settings.platform === 'claude-code' ? 'opencode' : 'claude-code';
    const otherLabel =
      otherPlatform === 'claude-code' ? 'Claude Code' : 'OpenCode';

    new Setting(containerEl)
      .setName('Current platform')
      .setDesc(currentLabel)
      .addButton((btn) =>
        btn.setButtonText(`Switch to ${otherLabel}`).onClick(() => {
          new ConfirmModal(
            this.plugin.app,
            'Switch platform',
            `Switch to ${otherLabel}? New config files will be generated. Existing config files are kept as backup.`,
            async () => {
              await migratePlatform(
                this.plugin.app,
                this.plugin.settings.platform,
                otherPlatform,
                this.plugin.settings.kbName,
                true,
              );
              this.plugin.settings.platform = otherPlatform;
              await this.plugin.saveSettings();
              new Notice(`Switched to ${otherLabel}`);
              this.display();
            },
          ).open();
        }),
      );
  }

  private renderNodeSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Node.js path')
      .setDesc('Path to Node.js. Usually leave blank. Only needed if node is in a non-standard location (enter absolute path, e.g. /usr/local/bin/node).')
      .addText((text) =>
        text
          .setPlaceholder('/usr/local/bin/node')
          .setValue(this.plugin.settings.nodePath)
          .onChange(async (value) => {
            this.plugin.settings.nodePath = value;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText('Auto-detect').onClick(async () => {
          btn.setButtonText('Detecting…');
          btn.setDisabled(true);
          try {
            const result = await detectNode();
            if (result.detected && result.path) {
              this.plugin.settings.nodePath = result.path;
              await this.plugin.saveSettings();
              new Notice(`Detected Node.js ${result.version} at ${result.path}`);
            } else {
              new Notice('Node.js not found. Install Node.js or enter the path manually.');
            }
          } finally {
            btn.setButtonText('Auto-detect');
            btn.setDisabled(false);
            this.display();
          }
        }),
      );
  }

  private renderMaintenanceSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Maintenance').setHeading();

    new Setting(containerEl)
      .setName('Regenerate agent config')
      .setDesc(
        this.plugin.settings.platform === 'claude-code'
          ? 'Recreate .claude/CLAUDE.md from current settings.'
          : 'Recreate opencode.json from current settings.',
      )
      .addButton((btn) =>
        btn.setButtonText('Regenerate').onClick(async () => {
          await generatePlatformConfig(
            this.plugin.app,
            this.plugin.settings.platform,
            this.plugin.settings.kbName,
          );
          new Notice('Agent config regenerated');
        }),
      );

    new Setting(containerEl)
      .setName('Re-initialize vault')
      .setDesc('Re-run the full setup. Overwrites built-in skills and agent config. Custom skills are preserved.')
      .addButton((btn) =>
        btn
          .setButtonText('Re-initialize')
          .setWarning()
          .onClick(() => {
            new ConfirmModal(
              this.plugin.app,
              'Re-initialize vault',
              'This will overwrite all built-in skills and regenerate agent config. Custom skills and your knowledge files are preserved. Continue?',
              async () => {
                await executeSetup(
                  this.plugin.app,
                  this.plugin.settings.platform,
                  this.plugin.settings.kbName,
                  () => {},
                );
                new Notice('Vault re-initialized');
              },
            ).open();
          }),
      );
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
      this.plugin.app,
      this.plugin.settings.platform,
      this.plugin.settings.kbName,
    );

    await writeManifestUpdate(this.plugin.app, {
      kbName: this.plugin.settings.kbName,
    });
  }
}
