import type { VaultFs } from '../../core/vault-fs';
import { checkVaultConfigFiles } from '../../core/vault-config-health';
import { scanVault, AGENT_DIRS } from '../../core/query/scan';
import type { IgnoredDir, IgnoreReason } from '../../core/query/exclusions';
import { CliError, resolvePlatform } from './shared';

export interface HealthOptions {
  /** Vault root on disk, for the knowledge-page scan. */
  root: string;
  json?: boolean;
  log: (line: string) => void;
}

/**
 * What the scanner left out and why (added 1.6.0). Informational: none of it
 * affects `healthy`, because skipping `node_modules/` is the point, not a fault.
 */
export interface SkippedReport {
  /** Directories excluded from indexing, outermost only; hidden directories are not listed. */
  dirs: IgnoredDir[];
  /** Configured reference directories that no longer exist on disk. */
  missingReferenceDirs: string[];
  /** Configured ignored directories that no longer exist on disk. */
  missingIgnoreDirs: string[];
  /** Set when `.knowlery/config.json` is malformed; both directory lists were treated as empty. */
  configError?: string;
}

export interface HealthReport {
  config: Awaited<ReturnType<typeof checkVaultConfigFiles>>;
  knowledgePages: Record<string, number>;
  skipped: SkippedReport;
  healthy: boolean;
}

/** The health report as data — shared by the CLI (which exits 1 on unhealthy)
 * and the MCP tool (for which findings are data, spec 1.0 f2 §4.2). */
export async function buildHealthReport(fs: VaultFs, root: string): Promise<HealthReport> {
  const config = await checkVaultConfigFiles(fs, await resolvePlatform(fs));

  const snapshot = scanVault(root);
  const knowledgePages: Record<string, number> = {};
  for (const dir of AGENT_DIRS) knowledgePages[dir] = 0;
  for (const page of snapshot.pages) {
    if (page.tier !== 'agent') continue;
    const dir = page.path.split('/')[0];
    knowledgePages[dir] = (knowledgePages[dir] ?? 0) + 1;
  }

  const missing = async (dirs: readonly string[]): Promise<string[]> => {
    const gone: string[] = [];
    for (const dir of dirs) if (!(await fs.exists(dir))) gone.push(dir);
    return gone;
  };
  const skipped: SkippedReport = {
    dirs: snapshot.ignoredDirs ?? [],
    missingReferenceDirs: await missing(snapshot.referenceDirs ?? []),
    missingIgnoreDirs: await missing(snapshot.ignoreDirs ?? []),
    ...(snapshot.referenceConfigError ? { configError: snapshot.referenceConfigError } : {}),
  };

  const healthy =
    config.knowledgeMdExists &&
    config.schemaMdExists &&
    config.indexBaseExists &&
    config.queryScriptExists &&
    config.knowledgeDirsComplete.missing.length === 0 &&
    config.agentConfigExists &&
    config.rulesConfigured &&
    config.skillsComplete.missing.length === 0;

  return { config, knowledgePages, skipped, healthy };
}

export async function runHealth(fs: VaultFs, options: HealthOptions): Promise<void> {
  const report = await buildHealthReport(fs, options.root);
  const { healthy } = report;

  if (options.json) {
    options.log(JSON.stringify(report, null, 2));
  } else {
    renderReport(report, options.log);
  }

  if (!healthy) {
    throw new CliError('Workspace health check failed — run `knowlery sync` (or `knowlery init` for a fresh directory).', 1);
  }
}

function renderReport(report: HealthReport, log: (line: string) => void): void {
  const { config } = report;
  const row = (ok: boolean, label: string, detail = '') =>
    log(`  ${ok ? 'ok      ' : 'MISSING '} ${label}${detail ? ` — ${detail}` : ''}`);

  log(`Configuration (platform: ${config.platform}):`);
  row(config.knowledgeMdExists, 'KNOWLEDGE.md');
  row(config.schemaMdExists, 'SCHEMA.md');
  row(config.indexBaseExists, 'INDEX.base');
  row(config.queryScriptExists, 'Retrieval script (.knowlery/bin/query.mjs)');
  row(
    config.knowledgeDirsComplete.missing.length === 0,
    'Knowledge directories',
    config.knowledgeDirsComplete.missing.length > 0
      ? `missing: ${config.knowledgeDirsComplete.missing.join(', ')}`
      : '',
  );
  row(config.agentConfigExists, 'Agent configuration');
  row(config.rulesConfigured, 'Rules configured');
  if (config.knowledgeMdLegacyOperatingRules) {
    log('  WARNING  KNOWLEDGE.md still carries the old Operating Rules / Knowledge Retrieval / Available Skills sections — Knowlery now renders them into AGENTS.md and .claude/CLAUDE.md; run `knowlery sync` to remove them from KNOWLEDGE.md (your own subsections are kept; original saved under .knowlery/backups/)');
  }
  row(
    config.skillsComplete.missing.length === 0,
    'Built-in skills',
    config.skillsComplete.missing.length > 0
      ? `missing: ${config.skillsComplete.missing.join(', ')}`
      : `${config.skillsComplete.present.length} installed`,
  );

  log('Knowledge pages:');
  for (const [dir, count] of Object.entries(report.knowledgePages)) {
    log(`  ${String(count).padStart(4)}  ${dir}/`);
  }

  renderSkipped(report.skipped, log);
}

const REASON_LABEL: Record<IgnoreReason, string> = {
  'builtin': 'always skipped',
  'project-output': 'build output beside a project manifest',
  'config': '.knowlery/config.json ignoreDirs',
};

/**
 * Every non-hidden directory the scanner left out is listed, so a real notes folder
 * that happens to be called `build/` next to a `package.json` is one `knowlery health`
 * away from being noticed rather than silently missing from retrieval.
 */
function renderSkipped(skipped: SkippedReport, log: (line: string) => void): void {
  if (skipped.configError) {
    log(`  WARNING  ${skipped.configError} — reference and ignored directories are treated as empty until it is fixed`);
  }
  if (skipped.dirs.length > 0) {
    log('Skipped directories (not indexed):');
    for (const entry of skipped.dirs) {
      log(`  ${entry.path}/ — ${REASON_LABEL[entry.reason]}`);
    }
  }
  for (const dir of skipped.missingReferenceDirs) {
    log(`  WARNING  reference directory ${dir}/ is configured but does not exist — run \`knowlery reference remove ${dir}\``);
  }
  for (const dir of skipped.missingIgnoreDirs) {
    log(`  WARNING  ignored directory ${dir}/ is configured but does not exist — run \`knowlery ignore remove ${dir}\``);
  }
}
