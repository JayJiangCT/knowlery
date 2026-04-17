import { useState, useEffect, useCallback } from 'react';
import { normalizePath, Notice } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { RuleInfo } from '../types';
import { listRules, deleteRule } from '../core/rule-manager';
import { RuleEditorModal } from '../modals/rule-editor';

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
      {/* Files section */}
      <div className="knowlery-config__section">
        <h3 className="knowlery-config__heading">Files</h3>
        <div className="knowlery-config__file-row">
          <span>KNOWLEDGE.md</span>
          <button onClick={() => openFile('KNOWLEDGE.md')}>Open</button>
        </div>
        <div className="knowlery-config__file-row">
          <span>SCHEMA.md</span>
          <button onClick={() => openFile('SCHEMA.md')}>Open</button>
        </div>
      </div>

      {/* Rules section */}
      <div className="knowlery-config__section">
        <h3 className="knowlery-config__heading">Rules</h3>

        {rules.map((rule) => (
          <div key={rule.filename} className="knowlery-config__rule-row">
            <span className="knowlery-config__rule-icon">{'\uD83D\uDCC4'}</span>
            <span className="knowlery-config__rule-name">{rule.name}</span>
            <div className="knowlery-config__rule-actions">
              <button onClick={() => handleView(rule)}>View</button>
              <button onClick={() => handleEdit(rule)}>Edit</button>
              <button onClick={() => handleDelete(rule)}>Delete</button>
            </div>
          </div>
        ))}

        {rules.length === 0 && <p>No rules configured yet.</p>}

        <button className="knowlery-config__add-rule" onClick={handleAdd}>
          + Add rule
        </button>
      </div>
    </div>
  );
}
