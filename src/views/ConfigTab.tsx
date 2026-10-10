import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizePath, Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { RuleInfo, DashboardRefreshPayload } from '../types';
import { listRules, deleteRule } from '../core/rule-manager';
import { type DirListKind, ReferenceDirError, addDir, emptyConfig, readConfig, removeDir } from '../core/reference-config';
import { RuleEditorModal } from '../modals/rule-editor';
import { VaultDirSuggestModal } from '../modals/dir-suggest';
import { IconFileText, IconFolder, IconPlus, IconArrowRight, IconMoreVertical, IconChevronRight, IconX } from './Icons';
import { t, type TranslationKey } from '../i18n';

/* ------------------------------------------------------------------ */
/*  RuleCard                                                           */
/* ------------------------------------------------------------------ */

function RuleCard(props: {
  rule: RuleInfo;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { rule, onView, onEdit, onDelete } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    const doc = menuRef.current?.doc;
    if (!doc) return;
    doc.addEventListener('mousedown', handleOutside);
    return () => doc.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const firstLine = rule.content
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? '';
  const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setMenuOpen(false);
    setConfirmDelete(false);
    onDelete();
  };

  return (
    <div className="knowlery-config__rule-card">
      <button
        type="button"
        className="knowlery-config__rule-main"
        onClick={onView}
        aria-label={t('config.viewRule', { name: rule.name })}
      >
        <span className="knowlery-config__rule-icon" aria-hidden="true">
          <IconFileText size={16} />
        </span>
        <span className="knowlery-config__rule-body">
          <span className="knowlery-config__rule-name">{rule.name}</span>
          {preview && (
            <span className="knowlery-config__rule-preview">{preview}</span>
          )}
        </span>
        <span className="knowlery-config__rule-chevron" aria-hidden="true">
          <IconChevronRight size={14} />
        </span>
      </button>

      <div ref={menuRef} className="knowlery-config__rule-actions">
        <button
          type="button"
          className="knowlery-config__rule-menu"
          aria-label={t('config.moreOptions', { name: rule.name })}
          onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
        >
          <IconMoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="knowlery-config__rule-dropdown">
            <button onClick={() => { setMenuOpen(false); onView(); }}>
              {t('config.view')}
            </button>
            <button onClick={() => { setMenuOpen(false); onEdit(); }}>
              {t('config.edit')}
            </button>
            <button
              className={confirmDelete ? 'is-danger' : ''}
              onClick={handleDeleteClick}
            >
              {confirmDelete ? t('config.confirmDelete') : t('config.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DirListSection                                                     */
/* ------------------------------------------------------------------ */

/** i18n keys per list, so the two sections share one component and differ only in wording. */
type DirListText = Record<'title' | 'hint' | 'add' | 'choose' | 'remove' | 'empty' | 'added' | 'removed', TranslationKey>;
const DIR_LIST_TEXT: Record<DirListKind, DirListText> = {
  referenceDirs: {
    title: 'config.referenceDirs',
    hint: 'config.referenceDirsHint',
    add: 'config.addReferenceDir',
    choose: 'config.chooseReferenceDir',
    remove: 'config.removeReferenceDir',
    empty: 'config.noReferenceDirs',
    added: 'config.referenceDirAdded',
    removed: 'config.referenceDirRemoved',
  },
  ignoreDirs: {
    title: 'config.ignoreDirs',
    hint: 'config.ignoreDirsHint',
    add: 'config.addIgnoreDir',
    choose: 'config.chooseIgnoreDir',
    remove: 'config.removeIgnoreDir',
    empty: 'config.noIgnoreDirs',
    added: 'config.ignoreDirAdded',
    removed: 'config.ignoreDirRemoved',
  },
};

function notesCountLabel(count: number): string {
  return t(count === 1 ? 'config.referenceDirNote' : 'config.referenceDirNotes', { count });
}

function DirListSection(props: {
  kind: DirListKind;
  dirs: string[];
  /** Folders that cannot be offered by the picker: both lists, since a dir may be in at most one. */
  taken: string[];
}) {
  const plugin = usePlugin();
  const { kind, dirs, taken } = props;
  const text = DIR_LIST_TEXT[kind];

  const notesUnder = (dir: string) =>
    plugin.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${dir}/`)).length;

  const handleAdd = () => {
    new VaultDirSuggestModal(plugin.app, t(text.choose), taken, (path) => {
      void (async () => {
        try {
          const result = await addDir(plugin.fs, kind, path);
          if (result.changed) new Notice(t(text.added, { dir: result.dir }));
          // Also makes the live query snapshot re-read the config (main.ts wires this event).
          plugin.events.trigger('dashboard-refresh');
        } catch (error) {
          new Notice(error instanceof ReferenceDirError ? error.message : String(error));
        }
      })();
    }).open();
  };

  const handleRemove = async (dir: string) => {
    try {
      const result = await removeDir(plugin.fs, kind, dir);
      if (result.changed) new Notice(t(text.removed, { dir: result.dir }));
      plugin.events.trigger('dashboard-refresh');
    } catch (error) {
      new Notice(error instanceof ReferenceDirError ? error.message : String(error));
    }
  };

  return (
    <>
      <div className="knowlery-section-label">
        <span>{t(text.title, { count: dirs.length })}</span>
        <button
          className="knowlery-section-label__action"
          aria-label={t(text.add)}
          onClick={handleAdd}
        >
          <IconPlus size={14} />
        </button>
      </div>

      <p className="knowlery-config__hint">{t(text.hint)}</p>

      <div className="knowlery-config__files">
        {dirs.map((dir) => (
          <div key={dir} className="knowlery-config__file-row knowlery-config__ref-row">
            <span className="knowlery-config__file-row-icon"><IconFolder size={16} /></span>
            <span className="knowlery-config__file-row-label">{dir}/</span>
            <span className="knowlery-config__ref-count">
              {notesCountLabel(notesUnder(dir))}
            </span>
            <button
              type="button"
              className="knowlery-config__ref-remove"
              aria-label={t(text.remove, { dir })}
              onClick={() => void handleRemove(dir)}
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
        {dirs.length === 0 && (
          <p className="knowlery-config__empty">{t(text.empty)}</p>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ConfigTab                                                          */
/* ------------------------------------------------------------------ */

export function ConfigTab() {
  const plugin = usePlugin();
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [config, setConfig] = useState(emptyConfig());
  const [configError, setConfigError] = useState<string | null>(null);

  const refreshRules = useCallback(async (payload?: DashboardRefreshPayload) => {
    const result = await listRules(plugin.fs);
    setRules(result);
    try {
      setConfig(await readConfig(plugin.fs));
      setConfigError(null);
    } catch (error) {
      // Malformed .knowlery/config.json: both lists render empty, so the warning has to
      // stay on screen — "(0)" alone is indistinguishable from "never configured".
      setConfig(emptyConfig());
      setConfigError(error instanceof Error ? error.message : String(error));
    }
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    void refreshRules();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      void refreshRules(payload);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refreshRules]);

  const openFile = (path: string) => {
    const file = plugin.app.vault.getFileByPath(normalizePath(path));
    if (file) {
      void plugin.app.workspace.getLeaf(false).openFile(file);
    } else {
      new Notice(t('config.fileNotFound', { path }));
    }
  };

  const handleView = (rule: RuleInfo) => {
    new RuleEditorModal(plugin.app, plugin, 'view', rule, () => void refreshRules()).open();
  };

  const handleEdit = (rule: RuleInfo) => {
    new RuleEditorModal(plugin.app, plugin, 'edit', rule, () => void refreshRules()).open();
  };

  const handleDelete = async (rule: RuleInfo) => {
    await deleteRule(plugin.fs, rule.filename);
    new Notice(t('config.ruleDeleted', { name: rule.name }));
    void refreshRules();
  };

  const handleAdd = () => {
    new RuleEditorModal(plugin.app, plugin, 'add', null, () => void refreshRules()).open();
  };

  const taken = [...config.referenceDirs, ...config.ignoreDirs];

  return (
    <div className="knowlery-config">
      {/* Schema & Guidance section */}
      <div className="knowlery-section-label">
        <span>{t('config.schemaGuidance')}</span>
      </div>

      <div className="knowlery-config__files">
        <button
          className="knowlery-config__file-row"
          onClick={() => openFile('KNOWLEDGE.md')}
        >
          <span className="knowlery-config__file-row-icon"><IconFileText size={16} /></span>
          <span className="knowlery-config__file-row-label">KNOWLEDGE.md</span>
          <span className="knowlery-config__file-row-arrow"><IconArrowRight size={14} /></span>
        </button>

        <button
          className="knowlery-config__file-row"
          onClick={() => openFile('SCHEMA.md')}
        >
          <span className="knowlery-config__file-row-icon"><IconFileText size={16} /></span>
          <span className="knowlery-config__file-row-label">SCHEMA.md</span>
          <span className="knowlery-config__file-row-arrow"><IconArrowRight size={14} /></span>
        </button>

        <button
          className="knowlery-config__file-row"
          onClick={() => openFile('INDEX.base')}
        >
          <span className="knowlery-config__file-row-icon"><IconFileText size={16} /></span>
          <span className="knowlery-config__file-row-label">INDEX.base</span>
          <span className="knowlery-config__file-row-arrow"><IconArrowRight size={14} /></span>
        </button>
      </div>

      {configError && (
        <p className="knowlery-config__hint knowlery-config__warning">
          {t('home.health.configWarning', { error: configError })}
        </p>
      )}
      <DirListSection kind="referenceDirs" dirs={config.referenceDirs} taken={taken} />
      <DirListSection kind="ignoreDirs" dirs={config.ignoreDirs} taken={taken} />

      {/* Agent Rules section */}
      <div className="knowlery-section-label">
        <span>{t('config.agentRules', { count: rules.length })}</span>
        <button
          className="knowlery-section-label__action"
          aria-label={t('config.addRule')}
          onClick={handleAdd}
        >
          <IconPlus size={14} />
        </button>
      </div>

      <div className="knowlery-config__rule-sections">
        {rules.map((rule) => (
          <RuleCard
            key={rule.filename}
            rule={rule}
            onView={() => handleView(rule)}
            onEdit={() => handleEdit(rule)}
            onDelete={() => void handleDelete(rule)}
          />
        ))}

        {rules.length === 0 && (
          <p className="knowlery-config__empty">{t('config.noRules')}</p>
        )}
      </div>
    </div>
  );
}
