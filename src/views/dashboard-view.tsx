import { ItemView, WorkspaceLeaf } from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext } from '../context';
import { DashboardApp } from './DashboardApp';
import { VIEW_TYPE_DASHBOARD } from '../types';

export class DashboardView extends ItemView {
  root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: KnowleryPlugin) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText() {
    return 'Knowlery';
  }

  getIcon() {
    return 'chef-hat';
  }

  async onOpen() {
    this.contentEl.addClass('knowlery-dashboard');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <DashboardApp />
        </PluginContext.Provider>
      </StrictMode>,
    );
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }
}
