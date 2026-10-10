import { type App, FuzzySuggestModal, type TFolder } from 'obsidian';
import { RESERVED_TOP_LEVEL, isUnderReferenceDir } from '../core/reference-config';
import { t } from '../i18n';

/**
 * Folder picker for reference directories. A picker rather than a text field so the
 * stored path is always a real, canonical vault folder — no typos, trailing slashes,
 * or paths that only exist on one machine. Offers only folders that can legally be
 * reference dirs: Knowlery's own directories and anything already covered are left out.
 */
export class ReferenceDirSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private current: readonly string[],
    private onChoose: (path: string) => void,
  ) {
    super(app);
    this.setPlaceholder(t('config.chooseReferenceDir'));
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllFolders(false)
      .filter((folder) => {
        const top = folder.path.split('/')[0];
        if (RESERVED_TOP_LEVEL.has(top)) return false;
        if (this.current.includes(folder.path)) return false;
        return !isUnderReferenceDir(`${folder.path}/`, this.current);
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
