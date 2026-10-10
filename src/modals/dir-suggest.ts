import { type App, FuzzySuggestModal, type TFolder } from 'obsidian';
import { RESERVED_TOP_LEVEL, isUnderDir } from '../core/reference-config';

/**
 * Folder picker for the configured directory lists (reference, ignored). A picker
 * rather than a text field so the stored path is always a real, canonical vault
 * folder — no typos, trailing slashes, or paths that only exist on one machine.
 * Offers only folders that can legally be configured: Knowlery's own directories,
 * hidden folders, and anything already covered by either list are left out.
 */
export class VaultDirSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    placeholder: string,
    private excluded: readonly string[],
    private onChoose: (path: string) => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllFolders(false)
      .filter((folder) => {
        const segments = folder.path.split('/');
        if (RESERVED_TOP_LEVEL.has(segments[0])) return false;
        if (segments.some((segment) => segment.startsWith('.'))) return false;
        if (this.excluded.includes(folder.path)) return false;
        return !isUnderDir(`${folder.path}/`, this.excluded);
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder.path);
  }
}
