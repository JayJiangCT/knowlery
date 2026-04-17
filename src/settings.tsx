import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type KnowleryPlugin from './main';
import type { Platform } from './types';
import { generatePlatformConfig, migratePlatform } from './core/platform-adapter';
import { detectNode } from './core/node-detect';
import { generateKnowledgeMd } from './assets/templates';
import { executeSetup, readManifest } from './core/setup-executor';

export class KnowlerySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: KnowleryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    /* ---- General ---- */
    new Setting(containerEl).setName('General').setHeading();

    new Setting(containerEl)
      .setName('KB name')
      .setDesc('Changing this will update KNOWLEDGE.md and regenerate agent config.')
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
          new Notice('KB name updated');
        }),
      );

    /* ---- Platform ---- */
    new Setting(containerEl).setName('Platform').setHeading();

    const otherPlatform: Platform =
      this.plugin.settings.platform === 'claude-code' ? 'opencode' : 'claude-code';
    const otherLabel =
      otherPlatform === 'claude-code' ? 'Claude Code' : 'OpenCode';

    new Setting(containerEl)
      .setName('Current platform')
      .setDesc(
        this.plugin.settings.platform === 'claude-code' ? 'Claude Code' : 'OpenCode',
      )
      .addButton((btn) =>
        btn.setButtonText(`Switch to ${otherLabel}`).onClick(async () => {
          const confirmed = confirm(
            `Switch to ${otherLabel}? This generates new config files.`,
          );
          if (!confirmed) return;

          const keepOld = confirm('Keep old platform config files?');
          await migratePlatform(
            this.plugin.app,
            this.plugin.settings.platform,
            otherPlatform,
            this.plugin.settings.kbName,
            keepOld,
          );

          this.plugin.settings.platform = otherPlatform;
          await this.plugin.saveSettings();
          new Notice(`Switched to ${otherLabel}`);
          this.display();
        }),
      );

    /* ---- Node.js ---- */
    new Setting(containerEl).setName('Node.js').setHeading();

    new Setting(containerEl)
      .setName('Node.js path')
      .setDesc('Required for browsing and installing third-party skills.')
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
          const result = await detectNode();
          if (result.detected && result.path) {
            this.plugin.settings.nodePath = result.path;
            await this.plugin.saveSettings();
            new Notice(`Detected Node.js ${result.version} at ${result.path}`);
            this.display();
          } else {
            new Notice('Node.js not detected');
          }
        }),
      );

    /* ---- Advanced ---- */
    new Setting(containerEl).setName('Advanced').setHeading();

    new Setting(containerEl)
      .setName('Re-initialize vault')
      .setDesc('Re-run setup. Overwrites built-in skills and agent config.')
      .addButton((btn) =>
        btn
          .setButtonText('Re-initialize')
          .setWarning()
          .onClick(async () => {
            if (!confirm('Re-initialize vault?')) return;
            await executeSetup(
              this.plugin.app,
              this.plugin.settings.platform,
              this.plugin.settings.kbName,
              () => {},
            );
            new Notice('Vault re-initialized');
          }),
      );

    new Setting(containerEl)
      .setName('Regenerate agent config')
      .setDesc('Regenerate CLAUDE.md or opencode.json.')
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

    const manifestFile = this.plugin.app.vault.getFileByPath('.byoao/manifest.json');
    if (manifestFile) {
      const manifest = await readManifest(this.plugin.app);
      if (manifest) {
        manifest.kbName = this.plugin.settings.kbName;
        manifest.updatedAt = new Date().toISOString();
        await this.plugin.app.vault.modify(
          manifestFile,
          JSON.stringify(manifest, null, 2),
        );
      }
    }
  }
}
