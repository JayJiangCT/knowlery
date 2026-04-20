import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizePath, Notice } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { RuleInfo } from '../types';
import { listRules, deleteRule } from '../core/rule-manager';
import { RuleEditorModal } from '../modals/rule-editor';
import { IconFileText, IconPlus, IconArrowRight, IconMoreHorizontal } from './Icons';

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
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
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
    <div className="knowlery-card">
      <div className="knowlery-config__rule-card-inner">
        <span className="knowlery-config__rule-card-icon" aria-hidden="true">
          <IconFileText size={16} />
        </span>
        <div className="knowlery-config__rule-card-body">
          <div className="knowlery-config__rule-name">{rule.name}</div>
          {preview && (
            <div className="knowlery-config__rule-preview">{preview}</div>
          )}
        </div>
        <div className="knowlery-config__rule-overflow" ref={menuRef}>
          <button
            className="knowlery-btn knowlery-btn--ghost"
            aria-label="More options"
            onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
          >
            <IconMoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="knowlery-config__rule-menu">
              <button
                className="knowlery-btn knowlery-btn--ghost"
                onClick={() => { setMenuOpen(false); onView(); }}
              >
                View
              </button>
              <button
                className="knowlery-btn knowlery-btn--ghost"
                onClick={() => { setMenuOpen(false); onEdit(); }}
              >
                Edit
              </button>
              <button
                className={`knowlery-btn knowlery-btn--ghost knowlery-btn--danger${confirmDelete ? ' is-confirming' : ''}`}
                onClick={handleDeleteClick}
              >
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConfigTab                                                          */
/* ------------------------------------------------------------------ */

export function ConfigTab() {
  const plugin = usePlugin();
  const [settings] = useSettings();
  const [rules, setRules] = useState<RuleInfo[]>([]);

  const refreshRules = useCallback(async () => {
    const result = await listRules(plugin.app, settings.platform);
    setRules(result);
  }, [plugin, settings.platform]);

  useEffect(() => {
    refreshRules();
    const ref = plugin.events.on('dashboard-refresh', refreshRules);
    return () => plugin.events.offref(ref);
  }, [plugin, refreshRules]);

  const openFile = (path: string) => {
    const file = plugin.app.vault.getFileByPath(normalizePath(path));
    if (file) {
      plugin.app.workspace.getLeaf(false).openFile(file);
    } else {
      new Notice(`File not found: ${path}`);
    }
  };

  const handleView = (rule: RuleInfo) => {
    new RuleEditorModal(plugin.app, plugin, 'view', rule, refreshRules).open();
  };

  const handleEdit = (rule: RuleInfo) => {
    new RuleEditorModal(plugin.app, plugin, 'edit', rule, refreshRules).open();
  };

  const handleDelete = async (rule: RuleInfo) => {
    await deleteRule(plugin.app, settings.platform, rule.filename);
    new Notice(`Deleted rule "${rule.name}"`);
    refreshRules();
  };

  const handleAdd = () => {
    new RuleEditorModal(plugin.app, plugin, 'add', null, refreshRules).open();
  };

  return (
    <div className="knowlery-config">
      {/* Schema & Guidance section */}
      <div className="knowlery-section-label">
        <span>Schema &amp; Guidance</span>
      </div>

      <div className="knowlery-config__files">
        <button
          className="knowlery-card knowlery-config__file-row"
          onClick={() => openFile('KNOWLEDGE.md')}
        >
          <IconFileText size={16} aria-hidden="true" />
          <span className="knowlery-config__file-row__label">KNOWLEDGE.md</span>
          <IconArrowRight size={14} aria-hidden="true" />
        </button>

        <button
          className="knowlery-card knowlery-config__file-row"
          onClick={() => openFile('SCHEMA.md')}
        >
          <IconFileText size={16} aria-hidden="true" />
          <span className="knowlery-config__file-row__label">SCHEMA.md</span>
          <IconArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Agent Rules section */}
      <div className="knowlery-section-label">
        <span>Agent Rules ({rules.length})</span>
        <button
          className="knowlery-section-label__action"
          aria-label="Add rule"
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
            onDelete={() => handleDelete(rule)}
          />
        ))}

        {rules.length === 0 && (
          <p className="knowlery-config__empty">No rules configured yet.</p>
        )}
      </div>
    </div>
  );
}
