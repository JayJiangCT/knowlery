import type { VaultFs } from '../../core/vault-fs';
import { checkVaultConfigFiles } from '../../core/vault-config-health';
import { scanVault, AGENT_DIRS } from '../../core/query/scan';
import { CliError, resolvePlatform } from './shared';

export interface HealthOptions {
  /** Vault root on disk, for the knowledge-page scan. */
  root: string;
  json?: boolean;
  log: (line: string) => void;
}

export interface HealthReport {
  config: Awaited<ReturnType<typeof checkVaultConfigFiles>>;
  knowledgePages: Record<string, number>;
  healthy: boolean;
}

/** The health report as data — shared by the CLI (which exits 1 on unhealthy)
 * and the MCP tool (for which findings are data, spec 1.0 f2 §4.2). */
export async function buildHealthReport(fs: VaultFs, root: string): Promise<HealthReport> {
  const config = await checkVaultConfigFiles(fs, await resolvePlatform(fs));

  const knowledgePages: Record<string, number> = {};
  for (const dir of AGENT_DIRS) knowledgePages[dir] = 0;
  for (const page of scanVault(root).pages) {
    if (page.tier !== 'agent') continue;
    const dir = page.path.split('/')[0];
    knowledgePages[dir] = (knowledgePages[dir] ?? 0) + 1;
  }

  const healthy =
    config.knowledgeMdExists &&
    config.schemaMdExists &&
    config.indexBaseExists &&
    config.queryScriptExists &&
    config.knowledgeDirsComplete.missing.length === 0 &&
    config.agentConfigExists &&
    config.rulesConfigured &&
    config.skillsComplete.missing.length === 0;

  return { config, knowledgePages, healthy };
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
}
