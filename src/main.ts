import { Events, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type KnowlerySettings } from './types';

export default class KnowleryPlugin extends Plugin {
  settings: KnowlerySettings = DEFAULT_SETTINGS;
  events = new Events();

  async onload() {
    await this.loadSettings();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.events.trigger('settings-changed');
  }
}
