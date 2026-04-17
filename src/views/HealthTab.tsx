import { useState, useEffect, useCallback } from 'react';
import { usePlugin, useSettings } from '../context';
import type { VaultStats, DiagnosisResult, ConfigIntegrity } from '../types';
import { getVaultStats, runDiagnosis, checkConfigIntegrity } from '../core/vault-health';
import { detectNode } from '../core/node-detect';

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
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(!open);
        }}
      >
        <span>{open ? '\u25BC' : '\u25B6'}</span>
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
/*  HealthTab                                                          */
/* ------------------------------------------------------------------ */

export function HealthTab() {
  const plugin = usePlugin();
  const [settings] = useSettings();

  const [stats, setStats] = useState<VaultStats | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [diagnosisRunning, setDiagnosisRunning] = useState(false);
  const [integrity, setIntegrity] = useState<ConfigIntegrity | null>(null);
  const [nodeVersion, setNodeVersion] = useState<string | null>(null);
  const [nodeDetected, setNodeDetected] = useState(false);

  const loadStats = useCallback(() => {
    const s = getVaultStats(plugin.app);
    setStats(s);
  }, [plugin]);

  const loadIntegrity = useCallback(async () => {
    const result = checkConfigIntegrity(plugin.app, settings.platform);
    setIntegrity(result);

    const nodeResult = await detectNode(
      settings.nodePath || undefined,
    );
    setNodeDetected(nodeResult.detected);
    setNodeVersion(nodeResult.version);
  }, [plugin, settings.platform, settings.nodePath]);

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
    } finally {
      setDiagnosisRunning(false);
    }
  };

  return (
    <div className="knowlery-health">
      {/* Content Statistics */}
      <div className="knowlery-health__section">
        <h3 className="knowlery-health__heading">Content Statistics</h3>
        {stats && (
          <div className="knowlery-health__grid">
            <Stat label="Notes" value={stats.notesCount} />
            <Stat label="Wikilinks" value={stats.wikilinksCount} />
            <Stat label="Entities" value={stats.entitiesCount} />
            <Stat label="Concepts" value={stats.conceptsCount} />
            <Stat label="Comparisons" value={stats.comparisonsCount} />
            <Stat label="Queries" value={stats.queriesCount} />
          </div>
        )}
      </div>

      {/* Structural Health */}
      <div className="knowlery-health__section">
        <h3 className="knowlery-health__heading">Structural Health</h3>
        {!diagnosis && (
          <button onClick={handleRunDiagnosis} disabled={diagnosisRunning}>
            {diagnosisRunning ? 'Running...' : 'Run diagnosis'}
          </button>
        )}
        {diagnosis && (
          <>
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

      {/* Configuration Integrity */}
      <div className="knowlery-health__section">
        <h3 className="knowlery-health__heading">Configuration Integrity</h3>
        {integrity && (
          <div className="knowlery-health__checks">
            <Check
              ok={integrity.knowledgeMdExists}
              label="KNOWLEDGE.md"
              detail={integrity.knowledgeMdExists ? 'Found' : 'Missing'}
            />
            <Check
              ok={integrity.schemaMdExists}
              label="SCHEMA.md"
              detail={integrity.schemaMdExists ? 'Found' : 'Missing'}
            />
            <Check
              ok={integrity.knowledgeDirsComplete.missing.length === 0}
              label="Knowledge directories"
              detail={
                integrity.knowledgeDirsComplete.missing.length === 0
                  ? 'All present'
                  : `Missing: ${integrity.knowledgeDirsComplete.missing.join(', ')}`
              }
            />
            <Check
              ok={integrity.agentConfigExists}
              label="Agent configuration"
              detail={integrity.agentConfigExists ? 'Found' : 'Missing'}
            />
            <Check
              ok={integrity.rulesConfigured}
              label="Rules configured"
              detail={integrity.rulesConfigured ? 'Yes' : 'No'}
            />
            <Check
              ok={integrity.skillsComplete.missing.length === 0}
              label="Skills installed"
              detail={
                integrity.skillsComplete.missing.length === 0
                  ? `All ${integrity.skillsComplete.present.length} present`
                  : `Missing: ${integrity.skillsComplete.missing.length}`
              }
            />
            <Check
              ok={nodeDetected}
              label="Node.js"
              detail={
                nodeDetected
                  ? `Detected (${nodeVersion})`
                  : 'Not detected'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function Stat(props: { label: string; value: number }) {
  return (
    <div className="knowlery-health__stat">
      <span className="knowlery-health__stat-value">{props.value}</span>
      <span className="knowlery-health__stat-label">{props.label}</span>
    </div>
  );
}

function Check(props: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="knowlery-health__check">
      <span className="knowlery-health__check-icon">
        {props.ok ? '\u2713' : '\u2717'}
      </span>
      <span>{props.label}</span>
      <span className="knowlery-health__check-detail">{props.detail}</span>
    </div>
  );
}
