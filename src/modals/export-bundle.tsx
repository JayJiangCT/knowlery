import { App, Component, MarkdownRenderer, Modal, Notice, normalizePath, setTooltip } from 'obsidian';
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { CompileResult, ExportScopeFile, ReviewStatus, RiskHint } from '../types';
import { buildClosure, readExportScope, writeBundleMeta, type ScopeClosure, type ScopeItem, writeExportScope } from '../core/okf/export-scope';
import { scanRisks } from '../core/okf/risk-scan';
import { compileBundle } from '../core/okf/compile';
import {
  IRREVERSIBILITY_STATEMENT,
  assetUrl,
  buildAudienceStatement,
  buildManualChecklist,
  buildReleaseNotes,
  checkGhReady,
  createPrivateRepo,
  createRelease,
  defaultGhRunner,
  inspectRepo,
  releaseTag,
  releaseTagExists,
  sha256OfFile,
} from '../core/okf/publish';
import type { BundleSource } from '../core/okf/collect';
import { obsidianLinkResolver } from '../platform/obsidian-link-resolver';

function bundleSourceFor(plugin: KnowleryPlugin): BundleSource {
  return {
    fs: plugin.fs,
    resolver: obsidianLinkResolver(plugin.app),
    configDir: plugin.app.vault.configDir,
  };
}
import { zipBundleDirectory } from '../core/okf/zip';
import { DEFAULT_MAX_COMPILED_HOPS, conceptIdFromPath, isKnowledgePath, sanitizeBundleId } from '../core/okf/shared';
import { computeGraphLayout } from './export-graph';
import { IconCheck, IconDownload, IconSearch, IconX } from '../views/Icons';

const GRAPH_WIDTH = 460;
const GRAPH_LABEL_LIMIT = 50;

function graphHeightFor(itemCount: number): number {
  return Math.min(680, Math.max(340, itemCount * 6));
}

const TYPE_LETTER: Record<string, string> = {
  entity: 'E',
  concept: 'C',
  comparison: 'X',
  query: 'Q',
  person: 'P',
};

const RISK_LABEL: Record<RiskHint['kind'], string> = {
  email: 'email address',
  'sensitive-url': 'private tool URL',
  'person-page': 'person page',
  'meeting-like-path': 'meeting note',
  credential: 'credential/secret',
  'private-ip': 'private IP address',
  'phone-number': 'phone number',
  'instruction-like': 'instruction-like content (prompt-injection shape)',
};

interface PickerEntry {
  id: string;
  title?: string;
  seedNames: string[];
  approved: number;
  flagged: number;
  total: number;
}

function pickerEntryFrom(id: string, bundle: ExportScopeFile['bundles'][string]): PickerEntry {
  const statuses = Object.values(bundle.items);
  return {
    id,
    title: bundle.title,
    seedNames: bundle.seeds.map((seed) => seed.split('/').pop() ?? seed),
    approved: statuses.filter((item) => item.status === 'approved').length,
    flagged: statuses.filter((item) => item.status === 'flagged').length,
    total: statuses.length,
  };
}

function pickerMetaLine(entry: PickerEntry): string {
  const seedPart = entry.seedNames.length > 0
    ? `Seeds: ${entry.seedNames.slice(0, 2).join(', ')}${entry.seedNames.length > 2 ? ` +${entry.seedNames.length - 2}` : ''}`
    : 'No seeds yet';
  if (entry.total === 0) return seedPart;
  const flaggedPart = entry.flagged > 0 ? ` · ${entry.flagged} flagged` : '';
  return `${seedPart} · ${entry.approved}/${entry.total} approved${flaggedPart}`;
}

interface FullPathAdapter {
  getFullPath: (path: string) => string | undefined;
}

interface ElectronDialog {
  showOpenDialog: (options: { properties: string[] }) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

export class ExportBundleModal extends Modal {
  private root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private seedConceptId?: string,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle('Share knowledge bundle');
    this.contentEl.addClass('knowlery-modal');
    this.modalEl.addClass('knowlery-export-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <ExportBundleContent seedConceptId={this.seedConceptId} onClose={() => this.close()} />
        </PluginContext.Provider>
      </StrictMode>,
    );
  }

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}

function ExportBundleContent(props: { seedConceptId?: string; onClose: () => void }) {
  const plugin = usePlugin();
  // D17: the default MUST vary per topic, not just per vault. Two unrelated
  // exports from the same vault (e.g. "Drone Delivery" vs "Parallel Search")
  // previously collided on the same creator+kbName id and silently clobbered
  // each other's saved scope. Seeding from the entry-point concept keeps
  // distinct topics distinct by default; the picker phase below covers the
  // no-seed entry points (dashboard card, command palette).
  const defaultBundleId = useMemo(() => {
    if (props.seedConceptId) {
      const slug = props.seedConceptId.split('/').pop() ?? props.seedConceptId;
      return sanitizeBundleId(plugin.settings.bundleCreatorName, slug);
    }
    return sanitizeBundleId(plugin.settings.bundleCreatorName, plugin.settings.kbName);
  }, [plugin.settings, props.seedConceptId]);

  const [phase, setPhase] = useState<'pick' | 'scope' | 'confirm' | 'result'>(props.seedConceptId ? 'scope' : 'pick');
  const [bundleId, setBundleId] = useState(defaultBundleId);
  const [existingBundles, setExistingBundles] = useState<PickerEntry[]>([]);
  const [newBundleName, setNewBundleName] = useState('');
  const [title, setTitle] = useState(() => {
    if (!props.seedConceptId) return plugin.settings.kbName;
    return props.seedConceptId.split('/').pop() ?? props.seedConceptId;
  });
  const [version, setVersion] = useState('0.1.0');
  const [license, setLicense] = useState(plugin.settings.bundleDefaultLicense);
  const [creatorName, setCreatorName] = useState(plugin.settings.bundleCreatorName);
  const [creatorUrl, setCreatorUrl] = useState(plugin.settings.bundleCreatorUrl);
  const [targetDir, setTargetDir] = useState(`.knowlery/exports/${defaultBundleId}-0.1.0`);
  const [includeSchema, setIncludeSchema] = useState(true);
  const [includeFullLog, setIncludeFullLog] = useState(false);
  const [includeSources, setIncludeSources] = useState(false);
  const [maxCompiledHops, setMaxCompiledHops] = useState(DEFAULT_MAX_COMPILED_HOPS);
  const [seeds, setSeeds] = useState<string[]>(props.seedConceptId ? [props.seedConceptId] : []);
  const [closure, setClosure] = useState<ScopeClosure | null>(null);
  const [items, setItems] = useState<ScopeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(props.seedConceptId ?? null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);

  const seedOptions = useMemo(() => plugin.app.vault.getMarkdownFiles()
    .filter((file) => isKnowledgePath(file.path))
    .map((file) => ({ id: conceptIdFromPath(file.path), title: file.basename }))
    .sort((a, b) => a.title.localeCompare(b.title)), [plugin.app.vault]);

  // Restore the saved scope on open (§13.6 resumability): seeds and link
  // depth come back from export-scope.json; per-item statuses are restored
  // by buildClosure itself.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void readExportScope(plugin.fs).then((scope) => {
      if (cancelled) return;
      setExistingBundles(Object.entries(scope.bundles).map(([id, bundle]) => pickerEntryFrom(id, bundle)));
      const saved = scope.bundles[bundleId];
      if (saved) {
        setSeeds((current) => [...new Set([...saved.seeds, ...current])]);
        setMaxCompiledHops(saved.maxCompiledHops);
        if (saved.title) setTitle(saved.title);
      }
      setRestored(true);
    });
    return () => { cancelled = true; };
  }, [plugin.app, bundleId]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    if (seeds.length === 0) {
      setClosure(null);
      setItems([]);
      return;
    }
    setLoading(true);
    buildClosure(bundleSourceFor(plugin), bundleId, seeds, maxCompiledHops)
      .then((nextClosure) => {
        if (cancelled) return;
        setClosure(nextClosure);
        setItems(nextClosure.items);
        setSelectedId((current) => (current && nextClosure.items.some((item) => item.id === current)
          ? current
          : nextClosure.items[0]?.id ?? null));
      })
      .catch((error) => new Notice(formatError(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [plugin.app, bundleId, seeds, maxCompiledHops, restored]);

  // Review state persists on every change (debounced) — closing the modal
  // must never lose progress (§13.6).
  const persistTimer = useRef<number | null>(null);
  const latestScope = useRef<{ bundleId: string; title: string; seeds: string[]; maxCompiledHops: number; items: ScopeItem[] } | null>(null);
  latestScope.current = closure && seeds.length > 0 ? { bundleId, title, seeds, maxCompiledHops, items } : null;

  const persistScope = (payload: NonNullable<typeof latestScope.current>) =>
    writeExportScope(plugin.fs, payload.bundleId, {
      title: payload.title,
      seeds: payload.seeds,
      maxCompiledHops: payload.maxCompiledHops,
      items: payload.items.map((item) => ({ id: item.id, status: item.status, contentHash: item.contentHash })),
    }).then(() => plugin.events.trigger('dashboard-refresh'));

  useEffect(() => {
    if (!latestScope.current) return;
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      if (latestScope.current) void persistScope(latestScope.current).catch((error) => new Notice(formatError(error)));
    }, 400);
    return () => {
      if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    };
  }, [plugin, bundleId, seeds, maxCompiledHops, items, closure]);

  // Flush any pending (debounced) write when the modal unmounts.
  useEffect(() => () => {
    if (latestScope.current) void persistScope(latestScope.current).catch(() => { /* modal is gone */ });
  }, []);

  const risksByItem = useMemo(() => {
    const map = new Map<string, RiskHint[]>();
    if (!closure) return map;
    for (const risk of scanRisks({ pages: closure.pages, rawDependencies: closure.rawDependencies })) {
      const current = map.get(risk.itemId) ?? [];
      current.push(risk);
      map.set(risk.itemId, current);
    }
    return map;
  }, [closure]);

  const counts = countStatuses(items);
  const newCount = items.filter((item) => item.reviewNote === 'new').length;
  const changedCount = items.filter((item) => item.reviewNote === 'changed').length;
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const setStatus = (id: string, status: ReviewStatus) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const resumeBundle = (entry: PickerEntry) => {
    setBundleId(entry.id);
    if (entry.title) setTitle(entry.title);
    setPhase('scope');
  };

  const startNewBundle = () => {
    const name = newBundleName.trim();
    if (!name) return;
    const id = sanitizeBundleId(creatorName, name);
    setBundleId(id);
    setTitle(name);
    setTargetDir(`.knowlery/exports/${id}-${version}`);
    setPhase('scope');
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const compileResult = await compileBundle(bundleSourceFor(plugin), {
        targetDir,
        bundleId,
        title,
        version,
        license,
        creator: { name: creatorName, url: creatorUrl },
        includeSchema,
        includeFullLog,
        includeSources,
        approvedConceptIds: items.filter((item) => item.kind === 'concept' && item.status === 'approved').map((item) => item.id),
        approvedRawPaths: items.filter((item) => item.kind === 'raw' && item.status === 'approved').map((item) => item.id),
        overwrite: true,
      });
      setResult(compileResult);
      await writeBundleMeta(plugin.fs, bundleId, { lastVersion: version });
      setPhase('result');
      plugin.events.trigger('dashboard-refresh');
    } catch (error) {
      new Notice(formatError(error));
    } finally {
      setExporting(false);
    }
  };

  const saveZip = async () => {
    if (!result) return;
    const fullPath = resolveFullPath(plugin, result.targetDir);
    if (!fullPath) {
      new Notice('Zip export needs the desktop app.');
      return;
    }
    try {
      const written = await zipBundleDirectory(fullPath);
      setZipPath(written);
      new Notice(`Zip saved: ${written}`);
    } catch (error) {
      new Notice(formatError(error));
    }
  };

  if (phase === 'pick') {
    return (
      <div className="knowlery-export">
        <div className="knowlery-export__pick-intro">
          A bundle is a shareable slice of your knowledge base, built around a topic.
          Each one keeps its own seeds and review progress.
        </div>

        <div className="knowlery-export__col-label">Start a new bundle</div>
        <div className="knowlery-export__pick-new">
          <input
            placeholder='Topic name — e.g. "Book Notes"'
            value={newBundleName}
            onChange={(event) => setNewBundleName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startNewBundle();
            }}
          />
          <button
            type="button"
            className="knowlery-btn knowlery-btn--primary"
            disabled={!newBundleName.trim()}
            onClick={startNewBundle}
          >
            Start
          </button>
        </div>

        {existingBundles.length > 0 && (
          <>
            <div className="knowlery-export__col-label">Or resume</div>
            <div className="knowlery-export__pick-list">
              {existingBundles.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="knowlery-export__pick-item"
                  onClick={() => resumeBundle(entry)}
                >
                  <span className="knowlery-export__pick-body">
                    <span className="knowlery-export__pick-title">{entry.title ?? entry.id}</span>
                    <span className="knowlery-export__pick-meta">{pickerMetaLine(entry)}</span>
                  </span>
                  <span className="knowlery-export__pick-chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="knowlery-export">
        <PhaseHeader phase={2} />
        <ResultReport
          result={result}
          counts={counts}
          riskyApprovedCount={items.filter((item) => item.status === 'approved' && risksByItem.has(item.id)).length}
          includeFullLog={includeFullLog}
          includeSources={includeSources}
          zipPath={zipPath}
          onOpen={() => openFolder(plugin, result.targetDir)}
          onZip={() => void saveZip()}
          onClose={props.onClose}
        />
        <PublishPanel
          bundleId={bundleId}
          title={title}
          version={version}
          conceptCount={result.conceptCount}
          targetDir={result.targetDir}
          riskyItems={items
            .filter((item) => item.status === 'approved' && risksByItem.has(item.id))
            .map((item) => ({ id: item.id, title: item.title, hints: risksByItem.get(item.id) ?? [] }))}
        />
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="knowlery-export">
        <PhaseHeader phase={2} />
        <section className="knowlery-export__confirm">
          <div className="knowlery-export__confirm-cols">
            <div className="knowlery-export__confirm-col">
              <div className="knowlery-export__col-label">Bundle metadata (prefilled)</div>
              <TextField label="Title" value={title} onChange={setTitle} />
              <TextField label="Bundle id" value={bundleId} onChange={setBundleId} />
              <div className="knowlery-export__field-row">
                <TextField label="Version" value={version} onChange={(next) => {
                  setVersion(next);
                  setTargetDir(`.knowlery/exports/${bundleId}-${next}`);
                }} />
                <TextField label="License" value={license} onChange={setLicense} />
              </div>
              <TextField label="Creator" value={creatorName} onChange={setCreatorName} />
              <TextField label="Creator URL" value={creatorUrl} onChange={setCreatorUrl} />
              <label className="knowlery-export__field">
                <span>Target folder</span>
                <div className="knowlery-export__path-field">
                  <input value={targetDir} onChange={(event) => setTargetDir(event.currentTarget.value)} />
                  <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={() => void chooseTargetFolder(setTargetDir)}>
                    Choose folder…
                  </button>
                </div>
              </label>
            </div>

            <div className="knowlery-export__confirm-col">
              <div className="knowlery-export__col-label">Options (share-safe by default)</div>
              <OptionToggle
                checked={includeSchema}
                onChange={setIncludeSchema}
                label="Include SCHEMA.md"
                hint="Ships a Reference page with schema conventions, scoped to the tags and domains this bundle's pages use."
              />
              <OptionToggle
                checked={includeFullLog}
                onChange={setIncludeFullLog}
                label="Include full activity log"
                hint="Off by default: your activity history is marked private and describes your work, not the knowledge."
              />
              <OptionToggle
                checked={includeSources}
                onChange={setIncludeSources}
                label="Keep sources metadata"
                hint="Off by default: source lists reveal your vault structure and private tool links."
              />
            </div>
          </div>

          <div className="knowlery-export__safety">
            <div className="knowlery-export__safety-label">Safety summary</div>
            Will include <b>{counts.approvedConcepts} approved pages</b> + <b>{counts.approvedRaw} approved raw notes</b>.
            {' '}Excluded: {counts.unreviewed} unreviewed, {counts.flagged} flagged.
            {' '}Sources metadata: <b>{includeSources ? 'kept (opt-in)' : 'stripped'}</b>.
            {' '}Activity log: <b>{includeFullLog ? 'full (opt-in)' : 'minimal'}</b>.
          </div>

          <div className="knowlery-export__footer">
            <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={() => setPhase('scope')}>← Back to review</button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--primary"
              disabled={exporting || counts.approved === 0}
              onClick={() => void runExport()}
            >
              {exporting ? 'Exporting…' : 'Export bundle'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="knowlery-export">
      <PhaseHeader phase={1} />

      <section className="knowlery-export__seedbar">
        {seeds.map((seed) => {
          const option = seedOptions.find((entry) => entry.id === seed);
          return (
            <span key={seed} className="knowlery-export__chip">
              <span className="knowlery-export__chip-dot" />
              {option?.title ?? seed}
              <button type="button" aria-label={`Remove seed ${seed}`} onClick={() => setSeeds(seeds.filter((item) => item !== seed))}>
                <IconX size={11} />
              </button>
            </span>
          );
        })}
        <SeedSearch
          options={seedOptions.filter((option) => !seeds.includes(option.id))}
          placeholder={seeds.length === 0 ? 'Add a seed page to start…' : 'Add seed…'}
          onPick={(id) => setSeeds([...seeds, id])}
        />
        <label className="knowlery-export__hops">
          Link depth
          <select value={maxCompiledHops} onChange={(event) => setMaxCompiledHops(Number(event.currentTarget.value))}>
            <option value={1}>1 hop</option>
            <option value={2}>2 hops</option>
            <option value={3}>3 hops</option>
          </select>
        </label>
      </section>

      {(newCount > 0 || changedCount > 0) && (
        <div className="knowlery-export__callout">
          Since last review: {newCount > 0 && <b>{newCount} new item{newCount === 1 ? '' : 's'}</b>}
          {newCount > 0 && changedCount > 0 && ', '}
          {changedCount > 0 && <b>{changedCount} approval{changedCount === 1 ? '' : 's'} invalidated by edits</b>}
          {' '}— they are back to "needs review".
        </div>
      )}

      {seeds.length === 0 ? (
        <div className="knowlery-export__empty knowlery-export__empty--tall">
          Nothing is included by default. Add a seed page — its linked pages (up to the link depth)
          and their raw sources will be pulled in for review.
        </div>
      ) : (
        <>
          <section className="knowlery-export__statusline">
            <span>
              <b>{counts.approved}/{items.length} approved</b>
              {' '}· {counts.unreviewed} need review · {counts.flagged} flagged
              {' '}· {items.filter((item) => item.kind === 'raw').length} raw dependencies
            </span>
            <div className="knowlery-export__switch">
              <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>List</button>
              <button type="button" className={viewMode === 'graph' ? 'is-active' : ''} onClick={() => setViewMode('graph')}>Graph</button>
            </div>
          </section>
          <div className="knowlery-export__progress">
            <div style={{ inlineSize: `${items.length ? Math.round((counts.approved / items.length) * 100) : 0}%` }} />
          </div>

          <section className="knowlery-export__workspace">
            <div className="knowlery-export__main">
              {loading ? (
                <div className="knowlery-export__empty">Computing closure…</div>
              ) : viewMode === 'list' ? (
                <ListView
                  items={items}
                  risksByItem={risksByItem}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  onStatus={setStatus}
                />
              ) : (
                <GraphView
                  items={items}
                  edges={closure?.edges ?? []}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                />
              )}
            </div>
            <DetailPanel
              item={selected}
              risks={selected ? risksByItem.get(selected.id) ?? [] : []}
              onStatus={setStatus}
            />
          </section>

          <div className="knowlery-export__footer">
            <span className="knowlery-export__footer-note">
              Progress is saved automatically — you can close and come back. Unreviewed and flagged items simply won't ship.
            </span>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--primary"
              disabled={loading || counts.approved === 0}
              onClick={() => setPhase('confirm')}
            >
              Continue — export {counts.approved} item{counts.approved === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PhaseHeader(props: { phase: 1 | 2 }) {
  return (
    <div className="knowlery-export__phases">
      <span className={props.phase === 1 ? 'is-active' : ''}>1 · Scope &amp; review</span>
      <span className="knowlery-export__phase-sep">→</span>
      <span className={props.phase === 2 ? 'is-active' : ''}>2 · Confirm &amp; export</span>
    </div>
  );
}

/** Obsidian-native hover tooltip for elements whose text may be truncated. */
function TruncatableText(props: { text: string; tooltip?: string; className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (ref.current) setTooltip(ref.current, props.tooltip ?? props.text, { placement: 'top', delay: 300 });
  }, [props.text, props.tooltip]);
  return (
    <span ref={ref} className={props.className}>
      {props.text}
      {props.children}
    </span>
  );
}

function SeedSearch(props: {
  options: Array<{ id: string; title: string }>;
  placeholder: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = query
    ? props.options.filter((option) => option.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  return (
    <span className="knowlery-export__seed-search">
      <IconSearch size={13} />
      <input
        value={query}
        placeholder={props.placeholder}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {matches.length > 0 && (
        <div className="knowlery-export__seed-dropdown">
          {matches.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                props.onPick(option.id);
                setQuery('');
              }}
            >
              <TruncatableText text={option.title} tooltip={option.id} />
              <small>{option.id.split('/')[0]}</small>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function ListView(props: {
  items: ScopeItem[];
  risksByItem: Map<string, RiskHint[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: ReviewStatus) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');

  const filtered = props.items
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query.toLowerCase()));
  const riskFirst = (a: ScopeItem, b: ScopeItem) =>
    Number(props.risksByItem.has(b.id)) - Number(props.risksByItem.has(a.id)) || a.title.localeCompare(b.title);
  const compiled = filtered.filter((item) => item.kind === 'concept').sort(riskFirst);
  const raw = filtered.filter((item) => item.kind === 'raw').sort(riskFirst);

  return (
    <div className="knowlery-export__list">
      <div className="knowlery-export__filters">
        <label className="knowlery-export__search">
          <IconSearch size={13} />
          <input value={query} placeholder="Search by title…" onChange={(event) => setQuery(event.currentTarget.value)} />
        </label>
        {(['all', 'unreviewed', 'approved', 'flagged'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`knowlery-export__filter-chip${statusFilter === filter ? ' is-active' : ''}`}
            onClick={() => setStatusFilter(filter)}
          >
            {filter === 'all' ? 'All' : filter === 'unreviewed' ? 'Needs review' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {compiled.length > 0 && <div className="knowlery-export__section-label">Included pages</div>}
      {compiled.map((item) => (
        <Row key={item.id} item={item} risks={props.risksByItem.get(item.id)} selected={props.selectedId === item.id} onSelect={props.onSelect} onStatus={props.onStatus} />
      ))}

      {raw.length > 0 && <div className="knowlery-export__section-label">Raw dependencies</div>}
      {raw.map((item) => (
        <Row key={item.id} item={item} risks={props.risksByItem.get(item.id)} selected={props.selectedId === item.id} onSelect={props.onSelect} onStatus={props.onStatus} />
      ))}

      {filtered.length === 0 && <div className="knowlery-export__empty">No items match this filter.</div>}
    </div>
  );
}

function Row(props: {
  item: ScopeItem;
  risks: RiskHint[] | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: ReviewStatus) => void;
}) {
  const { item } = props;
  const typeLetter = item.kind === 'raw'
    ? 'R'
    : TYPE_LETTER[frontmatterText(item.frontmatter.type, '').toLowerCase()] ?? 'C';

  return (
    <div
      className={`knowlery-export__row${props.selected ? ' is-selected' : ''}`}
      onClick={() => props.onSelect(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') props.onSelect(item.id);
      }}
    >
      <span
        className={`knowlery-export__row-icon${item.kind === 'raw' ? ' is-raw' : ''}`}
        title={item.kind === 'raw' ? 'raw note (uncurated source)' : frontmatterText(item.frontmatter.type, 'knowledge page')}
      >
        {typeLetter}
      </span>
      <span className="knowlery-export__row-body">
        <TruncatableText text={item.title} tooltip={item.path} className="knowlery-export__row-title">
          {item.isSeed && <em className="knowlery-export__tag is-seed">seed</em>}
          {item.kind === 'raw' && <em className="knowlery-export__tag is-raw">raw</em>}
          {item.reviewNote === 'changed' && <em className="knowlery-export__tag is-changed">changed</em>}
          {item.reviewNote === 'new' && <em className="knowlery-export__tag is-new">new</em>}
        </TruncatableText>
        <span className="knowlery-export__row-meta">
          {item.kind === 'raw' ? item.path : frontmatterText(item.frontmatter.domain, item.path)}
          {props.risks?.map((risk) => (
            <em key={`${risk.kind}-${risk.evidence}`} className="knowlery-export__risk" title={risk.evidence}>
              ⚠ {RISK_LABEL[risk.kind]}
            </em>
          ))}
        </span>
      </span>
      <span className="knowlery-export__row-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={`is-approve${item.status === 'approved' ? ' is-active' : ''}`}
          onClick={() => props.onStatus(item.id, item.status === 'approved' ? 'unreviewed' : 'approved')}
        >
          Approve
        </button>
        <button
          type="button"
          className={`is-flag${item.status === 'flagged' ? ' is-active' : ''}`}
          onClick={() => props.onStatus(item.id, item.status === 'flagged' ? 'unreviewed' : 'flagged')}
        >
          Flag
        </button>
      </span>
      <span
        className={`knowlery-export__dot is-${item.status}`}
        aria-label={item.status === 'unreviewed' ? 'needs review' : item.status}
        title={item.status === 'unreviewed' ? 'needs review' : item.status}
      />
    </div>
  );
}

function GraphView(props: {
  items: ScopeItem[];
  edges: ScopeClosure['edges'];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const itemIds = useMemo(() => new Set(props.items.map((item) => item.id)), [props.items]);
  const edges = useMemo(
    () => props.edges.filter((edge) => itemIds.has(edge.from) && itemIds.has(edge.to)),
    [props.edges, itemIds],
  );

  const height = graphHeightFor(props.items.length);
  const showAllLabels = props.items.length <= GRAPH_LABEL_LIMIT;

  // Re-layout only when the node SET changes — never on a status change, so
  // approving a node doesn't make it jump (§14.1).
  const itemKey = props.items.map((item) => item.id).sort().join(',');
  const positions = useMemo(
    () => computeGraphLayout(props.items, edges.map((edge) => ({ from: edge.from, to: edge.to })), {
      width: GRAPH_WIDTH,
      height,
      iterations: props.items.length > 60 ? 320 : 220,
    }),
    [itemKey],
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useEffect(() => setHoveredId(null), [itemKey]);

  // Zoom (wheel, around the cursor) + pan (drag) + reset (double-click),
  // implemented as viewBox manipulation.
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: GRAPH_WIDTH, h: height });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  useEffect(() => setViewBox({ x: 0, y: 0, w: GRAPH_WIDTH, h: height }), [itemKey, height]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Native listener: React's wheel handlers are passive, preventDefault
    // would be ignored and the modal would scroll instead of zooming.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      setViewBox((current) => {
        const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18;
        const w = Math.min(GRAPH_WIDTH * 3, Math.max(GRAPH_WIDTH * 0.15, current.w * factor));
        const h = w * (height / GRAPH_WIDTH);
        const px = current.x + ((event.clientX - rect.left) / rect.width) * current.w;
        const py = current.y + ((event.clientY - rect.top) / rect.height) * current.h;
        return {
          x: px - ((px - current.x) * w) / current.w,
          y: py - ((py - current.y) * h) / current.h,
          w,
          h,
        };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [height]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: viewBox.x,
      viewY: viewBox.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    setViewBox((current) => ({
      ...current,
      x: pan.viewX - (event.clientX - pan.startX) * scaleX,
      y: pan.viewY - (event.clientY - pan.startY) * scaleY,
    }));
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  // Center the view on the selected node (keeping the zoom level) so
  // "select in list → switch to graph" always lands on the node.
  useEffect(() => {
    if (!props.selectedId) return;
    const position = positions.get(props.selectedId);
    if (!position) return;
    setViewBox((current) => ({
      ...current,
      x: position.x - current.w / 2,
      y: position.y - current.h / 2,
    }));
  }, [props.selectedId, itemKey]);

  const neighborIds = useMemo(() => {
    const activeId = hoveredId ?? props.selectedId;
    if (!activeId) return null;
    const set = new Set([activeId]);
    for (const edge of edges) {
      if (edge.from === activeId) set.add(edge.to);
      if (edge.to === activeId) set.add(edge.from);
    }
    return set;
  }, [hoveredId, props.selectedId, edges]);

  return (
    <div className="knowlery-export__graph">
      <div className="knowlery-export__graph-hint">
        Scroll to zoom · drag to pan · double-click to reset.
        {!showAllLabels && ` Large scope (${props.items.length} items) — labels show on hover; tighten the link depth for a readable graph.`}
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="knowlery-export__graph-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setViewBox({ x: 0, y: 0, w: GRAPH_WIDTH, h: height })}
      >
        {edges.map((edge, index) => {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          if (!a || !b) return null;
          const dim = neighborIds ? !(neighborIds.has(edge.from) && neighborIds.has(edge.to)) : false;
          return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={dim ? 'is-dim' : ''} />;
        })}
        {props.items.map((item) => {
          const position = positions.get(item.id);
          if (!position) return null;
          const radius = item.isSeed ? 13 : item.kind === 'raw' ? 6 : 10;
          const dim = neighborIds ? !neighborIds.has(item.id) : false;
          const active = hoveredId === item.id || props.selectedId === item.id;
          // Seeds always keep their label — they are the anchor the user
          // navigates the closure from.
          const showLabel = showAllLabels || active || item.isSeed;
          const label = item.title.length > 18 ? `${item.title.slice(0, 17)}…` : item.title;
          return (
            <g
              key={item.id}
              transform={`translate(${position.x}, ${position.y})`}
              className={`knowlery-export__node is-${item.status}${dim ? ' is-dim' : ''}${props.selectedId === item.id ? ' is-selected' : ''}${item.isSeed ? ' is-seed' : ''}`}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => props.onSelect(item.id)}
            >
              {item.isSeed && <circle className="knowlery-export__seed-ring" r={radius + 4.5} />}
              <circle r={radius} strokeDasharray={item.kind === 'raw' ? '3 2' : undefined} />
              {showLabel && <text y={radius + (item.isSeed ? 16 : 11)} textAnchor="middle">{label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="knowlery-export__legend">
        <span><i className="is-seed" /> seed</span>
        <span><i className="is-unreviewed" /> needs review</span>
        <span><i className="is-approved" /> approved</span>
        <span><i className="is-flagged" /> flagged</span>
        <span><i className="is-raw" /> raw note (dashed)</span>
        <span>edges = real links only, no tags</span>
      </div>
    </div>
  );
}

function DetailPanel(props: {
  item: ScopeItem | null;
  risks: RiskHint[];
  onStatus: (id: string, status: ReviewStatus) => void;
}) {
  if (!props.item) {
    return (
      <aside className="knowlery-export__detail">
        <div className="knowlery-export__empty">
          Select an item to review it.
          <small>The decision is "is this safe to share" — the content is always in view here.</small>
        </div>
      </aside>
    );
  }

  const { item } = props;
  return (
    <aside className="knowlery-export__detail">
      <div className="knowlery-export__detail-title">{item.title}</div>
      <div className="knowlery-export__detail-meta">
        {item.kind === 'raw' ? `raw note · ${item.path}` : item.path}
        {item.citedBy.length > 0 && ` · cited by ${item.citedBy.length} page(s)`}
      </div>

      {item.reviewNote === 'changed' && (
        <div className="knowlery-export__invalidated">
          Content changed since your last approval — review again before it can ship.
        </div>
      )}

      <div className="knowlery-export__detail-status">
        <span className={`knowlery-export__badge is-${item.status}`}>
          {item.status === 'unreviewed' ? 'needs review' : item.status}
        </span>
        <span className="knowlery-export__row-actions">
          <button
            type="button"
            className={`is-approve${item.status === 'approved' ? ' is-active' : ''}`}
            onClick={() => props.onStatus(item.id, item.status === 'approved' ? 'unreviewed' : 'approved')}
          >
            <IconCheck size={12} />
            <span>Approve</span>
          </button>
          <button
            type="button"
            className={`is-flag${item.status === 'flagged' ? ' is-active' : ''}`}
            onClick={() => props.onStatus(item.id, item.status === 'flagged' ? 'unreviewed' : 'flagged')}
          >
            <IconX size={12} />
            <span>Flag</span>
          </button>
        </span>
      </div>

      {props.risks.length > 0 && (
        <div className="knowlery-export__detail-risks">
          {props.risks.map((risk) => (
            <em key={`${risk.kind}-${risk.evidence}`} className="knowlery-export__risk">
              ⚠ {RISK_LABEL[risk.kind]} · {risk.evidence}
            </em>
          ))}
        </div>
      )}

      <div className="knowlery-export__detail-label">Content preview</div>
      <MarkdownPreview markdown={item.body} sourcePath={item.path} />
    </aside>
  );
}

const PREVIEW_CHAR_CAP = 12000;

/**
 * The preview's job is "read the text", never "execute the page": neutralize
 * fenced code-block languages so third-party processors (dataview, charts,
 * excalidraw, …) don't run — and error-toast — inside the review modal, turn
 * embeds into plain links, and cap very long bodies.
 */
function sanitizeForPreview(markdown: string): string {
  let text = markdown;
  if (text.length > PREVIEW_CHAR_CAP) {
    text = `${text.slice(0, PREVIEW_CHAR_CAP)}\n\n---\n\n*Preview truncated — open the note for the full content.*`;
  }
  text = text.replace(/^(```|~~~)[^\n]+$/gm, '$1');
  text = text.replace(/!\[\[/g, '[[');
  return text;
}

function frontmatterText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function MarkdownPreview(props: { markdown: string; sourcePath: string }) {
  const plugin = usePlugin();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.empty();
    let cancelled = false;
    const component = new Component();
    component.load();
    MarkdownRenderer.render(plugin.app, sanitizeForPreview(props.markdown), el, props.sourcePath, component)
      .catch(() => {
        // Rendering must never take the review flow down — fall back to text.
        if (cancelled) return;
        el.empty();
        el.createEl('pre', { text: props.markdown.slice(0, 4000) });
      });
    return () => {
      cancelled = true;
      component.unload();
      el.empty();
    };
  }, [plugin, props.markdown, props.sourcePath]);

  return <div ref={ref} className="knowlery-export__preview markdown-rendered" />;
}

function OptionToggle(props: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="knowlery-export__toggle">
      <input type="checkbox" checked={props.checked} onChange={(event) => props.onChange(event.currentTarget.checked)} />
      <span>
        <b>{props.label}</b>
        <em>{props.hint}</em>
      </span>
    </label>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="knowlery-export__field">
      <span>{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} />
    </label>
  );
}

function ResultReport(props: {
  result: CompileResult;
  counts: ReturnType<typeof countStatuses>;
  riskyApprovedCount: number;
  includeFullLog: boolean;
  includeSources: boolean;
  zipPath: string | null;
  onOpen: () => void;
  onZip: () => void;
  onClose: () => void;
}) {
  const { result } = props;
  const quality = result.conformance.fieldQuality;
  const worklist: string[] = [
    ...quality.missingDescription.pages.map((page) => `${page} — missing description (renders as a bare link in the index)`),
    ...quality.missingTimestamp.pages.map((page) => `${page.path} — missing timestamp${page.nearMissKey ? ` (found \`${page.nearMissKey}\`, not interpreted)` : ''}`),
    ...quality.missingDomain.pages.map((page) => `${page} — missing domain (falls out of by-domain grouping)`),
    ...quality.typeMismatch.pages.map((page) => `${page} — frontmatter type contradicts its directory`),
  ];

  return (
    <section className="knowlery-export__result">
      <div className="knowlery-export__report-safety">
        <div className="knowlery-export__report-title">
          <IconCheck size={15} />
          Exported — nothing left without your approval
        </div>
        <ul>
          <li><b>{result.conceptCount} pages + {result.rawSourceCount} raw notes</b> included — every one explicitly approved by you.</li>
          <li><b>Excluded:</b> {props.counts.unreviewed} unreviewed, {props.counts.flagged} flagged.</li>
          <li><b>Sources metadata:</b> {props.includeSources ? 'kept verbatim (opt-in)' : 'stripped'}.</li>
          <li><b>Activity log:</b> {props.includeFullLog ? 'full history (opt-in)' : 'minimal (one Initialization entry)'}.</li>
          {props.riskyApprovedCount > 0 && (
            <li className="is-warn">⚠ {props.riskyApprovedCount} approved item(s) carried risk hints — you approved them knowingly.</li>
          )}
        </ul>
      </div>

      <div className="knowlery-export__counts">
        <div><b>{result.wikilinksConverted}</b><span>links converted</span></div>
        <div><b>{result.unresolvedLinks.length}</b><span>unresolved links</span></div>
        <div><b>{result.staleCount}</b><span>stale pages</span></div>
        <div><b>{result.conformance.warnings.length}</b><span>warnings</span></div>
      </div>

      {worklist.length > 0 && (
        <div className="knowlery-export__worklist">
          <div className="knowlery-export__col-label">Quality worklist — fix in the vault, then re-export</div>
          {worklist.map((line) => <div key={line} className="knowlery-export__worklist-row">{line}</div>)}
          <div className="knowlery-export__worklist-hint">Tip: run /audit to align these pages with SCHEMA.md.</div>
        </div>
      )}

      <div className="knowlery-export__tech">
        {result.conformance.conformant ? 'Conforms to OKF v0.1' : 'Conformance errors present — inspect and re-export'}
        {' '}· written to <code>{result.targetDir}</code> · includes README.md for the recipient.
      </div>

      <div className="knowlery-export__footer">
        <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={props.onOpen}>Open bundle folder</button>
        <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={props.onZip}>
          <IconDownload size={14} />
          <span>{props.zipPath ? 'Zip saved' : 'Save as .zip'}</span>
        </button>
        <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={props.onClose}>Done</button>
      </div>
    </section>
  );
}

/**
 * Publish to GitHub (spec 0.9 f2, §4.6): the modal face of the same publish core
 * the CLI uses — same config, same gh, same second gate. Private is preselected;
 * a public destination requires acknowledging every risk-hinted approved item.
 */
function PublishPanel(props: {
  bundleId: string;
  title: string;
  version: string;
  conceptCount: number;
  targetDir: string;
  riskyItems: Array<{ id: string; title: string; hints: RiskHint[] }>;
}) {
  const plugin = usePlugin();
  const [repo, setRepo] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [createIfMissing, setCreateIfMissing] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string[] | null>(null);

  useEffect(() => {
    void readExportScope(plugin.fs).then((scope) => {
      const config = scope.bundles[props.bundleId]?.publish;
      if (config) {
        setRepo(config.repo);
        setVisibility(config.visibility);
      }
    });
  }, [plugin.fs, props.bundleId]);

  const publish = async () => {
    setMessage(null);
    setOutcome(null);
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo.trim())) {
      setMessage('Enter the target repo as owner/name.');
      return;
    }
    if (visibility === 'public' && props.riskyItems.length > 0 && !acknowledged) {
      setMessage('Publishing publicly: acknowledge the risk-hinted items below first.');
      return;
    }
    setPublishing(true);
    try {
      const fullPath = resolveFullPath(plugin, props.targetDir);
      if (!fullPath) {
        setMessage('Publishing needs the desktop app.');
        return;
      }
      const zip = await zipBundleDirectory(fullPath);
      const sha256 = await sha256OfFile(zip);
      const tag = releaseTag(props.bundleId, props.version);
      const target = repo.trim();

      const ready = await checkGhReady(defaultGhRunner);
      if (!ready.ready) {
        setOutcome(buildManualChecklist({
          reason: ready.reason ?? 'gh-not-installed',
          zipPath: zip,
          repo: target,
          repoExists: false,
          tag,
          sha256,
        }).split('\n'));
        return;
      }

      let info = await inspectRepo(defaultGhRunner, target);
      if (!info) {
        if (!createIfMissing) {
          setMessage(`${target} does not exist. Check "create as private repo" to create it.`);
          return;
        }
        await createPrivateRepo(defaultGhRunner, target);
        info = (await inspectRepo(defaultGhRunner, target)) ?? { exists: true, visibility: 'private', ownerType: 'user' };
      }

      if (await releaseTagExists(defaultGhRunner, target, tag)) {
        setMessage(`${tag} is already published to ${target} — bump the version and re-export first.`);
        return;
      }

      const fileName = zip.split('/').pop() ?? 'bundle.zip';
      const url = assetUrl(target, tag, fileName);
      await createRelease(defaultGhRunner, {
        repo: target,
        tag,
        title: `${props.title} v${props.version}`,
        notes: buildReleaseNotes({ title: props.title, version: props.version, conceptCount: props.conceptCount, sha256, url }),
        assetPath: zip,
        replaceExisting: false,
      });
      await writeBundleMeta(plugin.fs, props.bundleId, { publish: { repo: target, visibility: info.visibility } });
      setOutcome([
        `Published ${props.bundleId} v${props.version} to ${target} (${info.visibility}).`,
        ...buildAudienceStatement(target, info),
        `Share: knowlery bundle install ${url} --verify sha256-${sha256}`,
      ]);
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="knowlery-export__publish">
      <div className="knowlery-export__col-label">Publish to GitHub</div>
      <div className="knowlery-export__publish-row">
        <input
          placeholder="owner/kb-bundles"
          value={repo}
          disabled={publishing}
          onChange={(event) => setRepo(event.currentTarget.value)}
        />
        <label className="knowlery-export__publish-choice">
          <input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
          <span>Private</span>
        </label>
        <label className="knowlery-export__publish-choice">
          <input type="radio" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
          <span>Public</span>
        </label>
        <button
          type="button"
          className="knowlery-btn knowlery-btn--primary"
          disabled={publishing || !repo.trim()}
          onClick={() => void publish()}
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      <label className="knowlery-export__publish-choice">
        <input type="checkbox" checked={createIfMissing} onChange={(event) => setCreateIfMissing(event.currentTarget.checked)} />
        <span>Create as a private repo if it doesn't exist</span>
      </label>

      {visibility === 'public' && (
        <div className="knowlery-export__publish-gate">
          <div className="is-warn">{IRREVERSIBILITY_STATEMENT}</div>
          {props.riskyItems.length > 0 && (
            <>
              <div>These approved items carry risk hints and would become permanently public:</div>
              <ul>
                {props.riskyItems.map((item) => (
                  <li key={item.id}>
                    <b>{item.id}</b> — {item.hints.map((hint) => `${RISK_LABEL[hint.kind]}: ${hint.evidence}`).join('; ')}
                  </li>
                ))}
              </ul>
              <label className="knowlery-export__publish-choice">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
                <span>I reviewed these items and consent to exposing them publicly</span>
              </label>
            </>
          )}
        </div>
      )}

      {message && <div className="knowlery-export__publish-message">{message}</div>}
      {outcome && (
        <div className="knowlery-export__publish-outcome">
          {outcome.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </section>
  );
}

function countStatuses(items: ScopeItem[]) {
  return items.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      counts.approvedConcepts += item.status === 'approved' && item.kind === 'concept' ? 1 : 0;
      counts.approvedRaw += item.status === 'approved' && item.kind === 'raw' ? 1 : 0;
      return counts;
    },
    { approved: 0, unreviewed: 0, flagged: 0, approvedConcepts: 0, approvedRaw: 0 },
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveFullPath(plugin: KnowleryPlugin, targetDir: string): string | null {
  if (targetDir.startsWith('/')) return targetDir;
  const adapter = plugin.app.vault.adapter as typeof plugin.app.vault.adapter & FullPathAdapter;
  return adapter.getFullPath?.(normalizePath(targetDir)) ?? null;
}

function openFolder(plugin: KnowleryPlugin, targetDir: string): void {
  const fullPath = resolveFullPath(plugin, targetDir);
  if (!fullPath) {
    new Notice(`Bundle exported to ${targetDir}`);
    return;
  }
  try {
    const { shell } = (window as Window & { require: (name: string) => { shell: { openPath: (path: string) => Promise<string> } } }).require('electron');
    void shell.openPath(fullPath);
  } catch {
    new Notice(`Bundle exported to ${fullPath}`);
  }
}

function getElectronDialog(): ElectronDialog | null {
  const w = window as Window & { require?: (name: string) => unknown };
  try {
    const remote = w.require?.('@electron/remote') as { dialog?: ElectronDialog } | undefined;
    if (remote?.dialog) return remote.dialog;
  } catch { /* not available */ }
  try {
    const electron = w.require?.('electron') as { remote?: { dialog?: ElectronDialog } } | undefined;
    if (electron?.remote?.dialog) return electron.remote.dialog;
  } catch { /* not available */ }
  return null;
}

async function chooseTargetFolder(setTargetDir: (value: string) => void): Promise<void> {
  const dialog = getElectronDialog();
  if (!dialog) {
    new Notice('Folder picker is not available here — type a path instead.');
    return;
  }
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (!result.canceled && result.filePaths[0]) setTargetDir(result.filePaths[0]);
}
