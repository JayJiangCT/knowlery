export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Minimal class surface for modules that subclass Obsidian UI types. Tests that
// exercise real UI behavior mock at the App boundary instead (okf-app.ts); these
// exist so importing such modules doesn't explode under vitest.
export class Modal {
  constructor(public app: unknown) {}
  open(): void {}
  close(): void {}
  setTitle(): void {}
  contentEl = undefined as unknown as HTMLElement;
}

export class Notice {
  constructor() {}
}

export class PluginSettingTab {
  containerEl = undefined as unknown as HTMLElement;
  constructor(public app: unknown, public plugin: unknown) {}
}

export class Setting {
  constructor() {}
  setName(): this { return this; }
  setDesc(): this { return this; }
  setHeading(): this { return this; }
  addText(): this { return this; }
  addToggle(): this { return this; }
  addButton(): this { return this; }
}

export const Platform = { isMacOS: false, isWin: false, isLinux: true, isMobile: false };

export function getLanguage(): string {
  return 'en';
}

