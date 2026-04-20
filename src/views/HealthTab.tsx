import { useState, useEffect, useCallback } from 'react';
import { usePlugin, useSettings } from '../context';
import type { VaultStats, DiagnosisResult, ConfigIntegrity } from '../types';
import { getVaultStats, runDiagnosis, checkConfigIntegrity } from '../core/vault-health';
import {
  IconChevronRight,
  IconChevronDown,
  IconCheckCircle,
  IconAlertCircle,
  IconPlay,
} from './Icons';

/* ------------------------------------------------------------------ */
/*  ExpandableList                                                     */
/* ------------------------------------------------------------------ */

function ExpandableList(props: {
  title: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);

  return (
    <div className="knowlery-health__expandable">
      <div
        className="knowlery-health__expandable-header"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <span className="knowlery-icon-chevron">
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span>
          {props.title} ({props.items.length})
        </span>
      </div>
      {open && (
        <div className="knowlery-health__expandable-list">
          {props.items.length > 0 ? (
            <ul>
              {props.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="knowlery-health__empty">None found</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IntegrityRow                                                       */
/* ------------------------------------------------------------------ */

type IntegrityState = 'ok' | 'fail' | 'warn';

function IntegrityRow(props: {
  state: IntegrityState;
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  const { state, label, detail, onClick } = props;
  const isClickable = state === 'fail' && onClick !== undefined;

  return (
    <div
      className={`knowlery-integrity-row${isClickable ? ' is-clickable' : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }
          : undefined
      }
    >
      <span className={`knowlery-integrity-row__icon is-${state}`} aria-hidden="true">
        {state === 'ok' ? (
          <IconCheckCircle size={16} />
        ) : (
          <IconAlertCircle size={16} />
        )}
      </span>
      <span className="knowlery-integrity-row__label">{label}</span>
      {detail && (
        <span className="knowlery-integrity-row__action">{detail}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HealthTab                                                          */
/* ------------------------------------------------------------------ */

export function HealthTab() {
  const plugin = usePlugin();
  const [settings] = useSettings();

  const [stats, setStats] = useState<VaultStats | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [diagnosisRunning, setDiagnosisRunning] = useState(false);
  const [diagnosisTime, setDiagnosisTime] = useState<Date | null>(null);
  const [integrity, setIntegrity] = useState<ConfigIntegrity | null>(null);

  const loadStats = useCallback(() => {
    const s = getVaultStats(plugin.app);
    setStats(s);
  }, [plugin]);

  const loadIntegrity = useCallback(async () => {
    const result = await checkConfigIntegrity(plugin.app, settings.platform);
    setIntegrity(result);
  }, [plugin, settings.platform]);

  useEffect(() => {
    loadStats();
    loadIntegrity();
    const ref = plugin.events.on('dashboard-refresh', () => {
      loadStats();
      loadIntegrity();
    });
    return () => plugin.events.offref(ref);
  }, [plugin, loadStats, loadIntegrity]);

  const handleRunDiagnosis = async () => {
    setDiagnosisRunning(true);
    try {
      const result = await runDiagnosis(plugin.app);
      setDiagnosis(result);
      setDiagnosisTime(new Date());
    } finally {
      setDiagnosisRunning(false);
    }
  };

  const openSettings = () => {
    // Open Obsidian settings to the Knowlery tab
    (plugin.app as any).setting?.open();
    (plugin.app as any).setting?.openTabById?.(plugin.manifest.id);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="knowlery-health">
      {/* 1. Configuration Integrity — FIRST */}
      <div className="knowlery-section-label">
        <span>Configuration</span>
      </div>
      {integrity && (
        <div className="knowlery-card knowlery-health__integrity-card">
          <IntegrityRow
            state={integrity.knowledgeMdExists ? 'ok' : 'fail'}
            label="KNOWLEDGE.md"
            detail={integrity.knowledgeMdExists ? undefined : 'Missing'}
            onClick={integrity.knowledgeMdExists ? undefined : openSettings}
          />
          <IntegrityRow
            state={integrity.schemaMdExists ? 'ok' : 'fail'}
            label="SCHEMA.md"
            detail={integrity.schemaMdExists ? undefined : 'Missing'}
            onClick={integrity.schemaMdExists ? undefined : openSettings}
          />
          <IntegrityRow
            state={integrity.knowledgeDirsComplete.missing.length === 0 ? 'ok' : 'fail'}
            label="Knowledge directories"
            detail={
              integrity.knowledgeDirsComplete.missing.length === 0
                ? undefined
                : `Missing: ${integrity.knowledgeDirsComplete.missing.join(', ')}`
            }
          />
          <IntegrityRow
            state={integrity.agentConfigExists ? 'ok' : 'fail'}
            label="Agent configuration"
            detail={integrity.agentConfigExists ? undefined : 'Missing'}
            onClick={integrity.agentConfigExists ? undefined : openSettings}
          />
          <IntegrityRow
            state={integrity.rulesConfigured ? 'ok' : 'fail'}
            label="Rules configured"
            detail={integrity.rulesConfigured ? undefined : 'None found'}
          />
          <IntegrityRow
            state={integrity.skillsComplete.missing.length === 0 ? 'ok' : 'fail'}
            label="Skills installed"
            detail={
              integrity.skillsComplete.missing.length === 0
                ? `${integrity.skillsComplete.present.length} installed`
                : `${integrity.skillsComplete.missing.length} missing`
            }
          />
          <IntegrityRow
            state={integrity.obsidianCli ? 'ok' : 'warn'}
            label="Obsidian CLI"
            detail={integrity.obsidianCli ? 'Enabled' : 'Not enabled'}
          />
          <IntegrityRow
            state={integrity.claudeCodeCli ? 'ok' : 'warn'}
            label="Claude Code CLI detected"
            detail={integrity.claudeCodeCli ? 'Found' : 'Not found'}
          />
          <IntegrityRow
            state={integrity.opencodeCli ? 'ok' : 'warn'}
            label="OpenCode CLI detected"
            detail={integrity.opencodeCli ? 'Found' : 'Not found'}
          />
          <IntegrityRow
            state="ok"
            label="Platform"
            detail={settings.platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}
          />
        </div>
      )}

      {/* 2. Content Stats */}
      <div className="knowlery-section-label knowlery-health__section-gap">
        <span>Content</span>
      </div>
      {stats && (
        <div className="knowlery-stat-grid">
          <StatCard label="Notes" value={stats.notesCount} />
          <StatCard label="Wikilinks" value={stats.wikilinksCount} />
          <StatCard label="Entities" value={stats.entitiesCount} />
          <StatCard label="Concepts" value={stats.conceptsCount} />
          <StatCard label="Comparisons" value={stats.comparisonsCount} />
          <StatCard label="Queries" value={stats.queriesCount} />
        </div>
      )}

      {/* 3. Structure */}
      <div className="knowlery-section-label knowlery-health__section-gap">
        <span>Structure</span>
        <button
          className="knowlery-section-label__action"
          aria-label="Run scan"
          onClick={handleRunDiagnosis}
          disabled={diagnosisRunning}
        >
          <IconPlay size={12} />
        </button>
      </div>

      {!diagnosis && !diagnosisRunning && (
        <button
          className="knowlery-btn knowlery-btn--outline is-full-width"
          onClick={handleRunDiagnosis}
        >
          <IconPlay size={14} />
          Run diagnosis
        </button>
      )}

      {diagnosisRunning && (
        <div className="knowlery-loading">Running diagnosis…</div>
      )}

      {diagnosis && (
        <>
          {diagnosisTime && (
            <div className="knowlery-health__diagnosis-time">
              Last run: {formatTime(diagnosisTime)}
            </div>
          )}
          <ExpandableList
            title="Orphan notes"
            items={diagnosis.orphanNotes}
          />
          <ExpandableList
            title="Broken wikilinks"
            items={diagnosis.brokenWikilinks.map(
              (b) => `${b.file} \u2192 [[${b.link}]]`,
            )}
          />
          <ExpandableList
            title="Missing frontmatter"
            items={diagnosis.missingFrontmatter.map(
              (m) => `${m.file}: ${m.missingFields.join(', ')}`,
            )}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="knowlery-stat-card">
      <span className="knowlery-stat-card__number">{props.value}</span>
      <span className="knowlery-stat-card__label">{props.label}</span>
    </div>
  );
}
