import { realpath } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { z } from 'zod';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listKbs, resolveKb, KbRegistryError } from '../kb-registry';
import { runFederatedQuery } from '../federated-query';
import { scanVault } from '../query/scan';
import { runQuery } from '../query/engine';
import { computeStaleness } from '../query/staleness';
import { readInstalledBundles } from '../okf/registry';
import { InstalledBundleEntrySchema } from '../../types';
import { loggingVaultFs } from '../vault-fs';
import { isVaultInitialized } from '../setup-executor';
import { runVaultSync } from '../vault-sync';
import { runCapture, runInitKb, runRegisterKb } from './write-tools';
import { collectOrientationMap } from '../orientation-source';
import { renderOrientationMap } from '../query/orientation';
import { nodeVaultFs } from '../../platform/node-fs';
import { buildHealthReport } from '../../cli/commands/health';
import { resolvePlatform } from '../../cli/commands/shared';
import { BUNDLED_SKILLS } from '../../assets/skills';

/**
 * The MCP server core (spec 1.0 f2): tool/prompt/resource handlers over the KB
 * registry. The transport is supplied by the shell (stdio in F2; HTTP in F4
 * reuses this verbatim — the established shell-supplies-transport discipline).
 *
 * Semantics (spec §4.2): findings are data — abstention, unhealthy, and
 * stale-heavy reports are successful results; tool errors are reserved for
 * invalid input, unknown kb names, and I/O failures.
 *
 * Tool names, input schemas, and structured-output shapes are 1.0-frozen
 * (ratified by spec 1.0 f5; pinned by tests/contract/): breaking changes
 * require a major version.
 */

/** Exported for the version-coherence contract test (spec 1.0 f5, §5.3). */
export const SERVER_INFO = { name: 'knowlery', version: '1.2.3' };

/** Skills whose content stands without Obsidian (spec 1.0 f2 §4.3, curated
 * set; knowlery-mcp added by spec 1.1 f2 §4.3 — the front-door skill). */
export const MCP_PROMPT_SKILLS = [
  'ask', 'cook', 'explore', 'challenge', 'ideas', 'audit', 'organize',
  'vault-conventions', 'knowlery-cli', 'knowlery-mcp',
] as const;

/** The curated knowledge surface readable over MCP (spec §4.4 — the product
 * boundary that free-form notes stay yours). Query may *surface* user-tier
 * pages; reading their full content is out of bounds. */
const READABLE_PREFIXES = ['entities/', 'concepts/', 'comparisons/', 'queries/', 'Library/'];
const READABLE_FILES = new Set(['KNOWLEDGE.md']);

/**
 * Advertised output shapes, 1.0-frozen (spec 1.0 f5, §4.4a): the schema a
 * client introspects via tools/list carries the frozen keys, and the SDK
 * validates every result against it at runtime — the freeze is
 * self-enforcing, not just tested. health's `config` stays deliberately
 * loose (spec f5 §4.1 not-frozen list): its check fields may be added,
 * renamed, or retired as the health checker evolves.
 */
const QueryCandidateSchema = z.object({
  path: z.string(),
  score: z.number(),
  tier: z.enum(['agent', 'bundle', 'user']),
  type: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  evidence: z.array(z.string()),
  matchedTerms: z.array(z.string()),
  /** Present on federated (`kb: "*"`) results: which KB the candidate came from. */
  kb: z.string().optional(),
});

const StaleFindingSchema = z.object({
  path: z.string(),
  title: z.string(),
  changedSources: z.array(z.object({
    path: z.string(),
    sourceMtimeMs: z.number(),
    pageMtimeMs: z.number(),
  })),
});

const UncookedNoteSchema = z.object({
  path: z.string(),
  title: z.string(),
  mtimeMs: z.number(),
});

/**
 * Which write tools the shell offers (spec 1.0 f4, §4.3). Access is
 * structural: a disallowed write is not registered — absent from tools/list,
 * unknown to tools/call. There is no runtime permission check to get wrong.
 * stdio defaults to everything enabled and unconfined (the local caller owns
 * the machine); the HTTP shell passes exactly what its flags opted into.
 */
export interface McpAccess {
  capture?: boolean;
  sync?: boolean;
  /** true = unconfined (stdio); { kbRoot } = confined (remote); false = absent. */
  init?: boolean | { kbRoot: string };
  /** register_kb is local-stdio-only (spec 1.1 f1, §4.4): the registry is
   * machine-global state — a remote caller editing the address book reshapes
   * what every other tool on the machine can reach. The HTTP shell has no
   * flag for this; it normalizes register to false unconditionally. */
  register?: boolean;
}

export interface McpServerOptions {
  /** The running CLI's version, for sync's downgrade guard (spec 0.7 f5, §2.5). */
  toolVersion?: string;
  access?: McpAccess;
}

const STDIO_ACCESS: Required<McpAccess> = { capture: true, sync: true, init: true, register: true };

export function buildMcpServer(options: McpServerOptions = {}): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerTools(server);
  registerWriteTools(server, { ...STDIO_ACCESS, ...options.access }, options);
  registerPrompts(server);
  registerResources(server);
  return server;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
}

function ok(structured: Record<string, unknown>, text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  };
}

/**
 * Typed facade over `server.registerTool`. The SDK's own generic signature
 * routes through zod-v3/v4 compat conditional types whose instantiation is
 * TS2589-deep — inference collapses to `any` and typed lint runs out of
 * memory. Pinning the shape to plain zod v3 (`z.ZodRawShape`) keeps handler
 * args fully typed at a fraction of the checking cost; the runtime call is
 * the SDK's own, unchanged.
 *
 * The input shape is wrapped `.strict()` before it reaches the SDK: handed a
 * raw shape, the SDK would normalize to a default `z.object(...)`, which
 * *strips* unknown keys — spec §4.1 requires them rejected (maintainer P2 at
 * implementation review).
 */
function defineTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: Shape; outputSchema: z.ZodRawShape },
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>,
): void {
  (server.registerTool as unknown as (n: string, c: unknown, cb: unknown) => void)(
    name,
    { ...config, inputSchema: z.object(config.inputSchema).strict() },
    handler,
  );
}

async function resolveKbOrThrow(name: string): Promise<string> {
  try {
    return await resolveKb(name);
  } catch (error) {
    if (error instanceof KbRegistryError) throw new Error(error.message);
    throw error;
  }
}

function registerTools(server: McpServer): void {
  defineTool(server, 'list_kbs', {
    title: 'List knowledge bases',
    description: 'List every registered knowledge base with its path and live state '
      + '(ok / uninitialized / missing). The registry is the address book all other tools resolve kb names through.',
    inputSchema: {},
    outputSchema: {
      kbs: z.array(z.object({ name: z.string(), path: z.string(), state: z.string() })),
    },
  }, async () => {
    const kbs = await listKbs();
    const text = kbs.length === 0
      ? 'No knowledge bases registered.'
      : kbs.map((kb) => `${kb.name}  ${kb.path}${kb.state === 'ok' ? '' : `  [${kb.state}]`}`).join('\n');
    return ok({ kbs }, text);
  });

  defineTool(server, 'query', {
    title: 'Query a knowledge base',
    description: 'Deterministic retrieval over compiled knowledge. kb is a registered name, or "*" to search '
      + 'every registered KB with per-KB attribution. An abstention (verdict: no-confident-match) is an answer, '
      + 'not a failure: it means the knowledge base has no confident match — relay it, do not retry or guess.',
    inputSchema: {
      kb: z.string().describe('Registered KB name, or "*" for all'),
      question: z.string().min(1),
      k: z.number().int().min(1).max(50).optional(),
    },
    outputSchema: {
      verdict: z.string().optional(),
      verdictByKb: z.record(z.string()).optional(),
      candidates: z.array(QueryCandidateSchema),
    },
  }, async ({ kb, question, k }) => {
    const limit = k ?? 12;
    if (kb === '*') {
      const result = await runFederatedQuery(question, limit);
      const text = result.candidates.length === 0
        ? `No confident matches in any registered KB (consulted: ${Object.keys(result.verdictByKb).join(', ')}).`
        : result.candidates.map((c) => `${c.score.toFixed(2)}  ${c.kb}: ${c.path} — ${c.title}`).join('\n');
      return ok({ verdictByKb: result.verdictByKb, candidates: result.candidates }, text);
    }
    const root = await resolveKbOrThrow(kb);
    const result = runQuery(question, scanVault(root), limit);
    const text = result.verdict === 'no-confident-match'
      ? `No confident matches in ${kb} for: ${result.terms.join(', ')}`
      : result.candidates.map((c) => `${c.score.toFixed(2)}  ${c.path} — ${c.title}`).join('\n');
    return ok({ verdict: result.verdict, candidates: result.candidates }, text);
  });

  defineTool(server, 'stale', {
    title: 'Staleness report',
    description: 'Compiled pages older than their sources, plus user notes never compiled. '
      + 'This is a work list for re-cooking, not an alarm — a long list is a finding, not a failure.',
    inputSchema: { kb: z.string() },
    outputSchema: {
      stalePages: z.array(StaleFindingSchema),
      uncookedNotes: z.array(UncookedNoteSchema),
    },
  }, async ({ kb }) => {
    const root = await resolveKbOrThrow(kb);
    const report = computeStaleness(scanVault(root));
    const text = `${report.stalePages.length} stale page(s), ${report.uncookedNotes.length} uncooked note(s) in ${kb}.`;
    return ok({ stalePages: report.stalePages, uncookedNotes: report.uncookedNotes }, text);
  });

  defineTool(server, 'health', {
    title: 'Workspace health',
    description: 'Workspace integrity check. An unhealthy result is a finding carried in the data '
      + '(healthy: false) — report it and suggest `knowlery sync`; it is not a tool failure.',
    inputSchema: { kb: z.string() },
    outputSchema: {
      healthy: z.boolean(),
      config: z.object({}).passthrough(),
      knowledgePages: z.record(z.number()),
    },
  }, async ({ kb }) => {
    const root = await resolveKbOrThrow(kb);
    const report = await buildHealthReport(nodeVaultFs(root), root);
    return ok(
      { healthy: report.healthy, config: report.config, knowledgePages: report.knowledgePages },
      `${kb}: ${report.healthy ? 'healthy' : 'unhealthy — run `knowlery sync --kb ' + kb + '`'}`,
    );
  });

  defineTool(server, 'list_bundles', {
    title: 'Installed bundles',
    description: 'Knowledge bundles installed in a KB, with version and source provenance.',
    inputSchema: { kb: z.string() },
    outputSchema: { bundles: z.record(InstalledBundleEntrySchema) },
  }, async ({ kb }) => {
    const root = await resolveKbOrThrow(kb);
    const registry = await readInstalledBundles(nodeVaultFs(root));
    const entries = Object.entries(registry.bundles);
    const text = entries.length === 0
      ? `No bundles installed in ${kb}.`
      : entries.map(([id, entry]) => `${id} v${entry.version} — "${entry.title}"`).join('\n');
    return ok({ bundles: registry.bundles }, text);
  });
}

/**
 * The write path (spec 1.0 f3): exactly three writes, each structurally
 * bounded. Conduct lives in the descriptions — write tools act on the user's
 * words, not the agent's initiative.
 */
function registerWriteTools(server: McpServer, access: Required<McpAccess>, options: McpServerOptions): void {
  if (access.init !== false) registerInitKb(server, access.init === true ? undefined : access.init.kbRoot);
  if (access.capture) registerCapture(server);
  if (access.sync) registerSync(server, options);
  if (access.register) registerRegisterKb(server);
}

function registerRegisterKb(server: McpServer): void {
  defineTool(server, 'register_kb', {
    title: 'Register an existing knowledge base',
    description: 'Add an already-initialized Knowlery workspace to the registry under a name, so every tool can '
      + 'address it. Writes the registry file only — never touches files inside the KB. '
      + 'Only call on the user\'s explicit request, and restate the resolved path in conversation before calling. '
      + 'A taken name is a hard error — surface the conflict, do not pick another name.',
    inputSchema: {
      name: z.string().describe('Registry name ([a-z0-9][a-z0-9-_]*)'),
      path: z.string().describe('Path to an initialized Knowlery workspace (absolute or ~-relative)'),
    },
    outputSchema: {
      name: z.string(),
      path: z.string(),
      alsoRegisteredAs: z.array(z.string()),
    },
  }, async ({ name, path }) => {
    const result = await runRegisterKbOrThrow(name, path);
    const alias = result.alsoRegisteredAs.length > 0
      ? ` (this path is also registered as: ${result.alsoRegisteredAs.join(', ')})`
      : '';
    return ok(
      { name: result.name, path: result.path, alsoRegisteredAs: result.alsoRegisteredAs },
      `Registered "${result.name}" → ${result.path}${alias}. It is immediately queryable by name.`,
    );
  });
}

async function runRegisterKbOrThrow(name: string, path: string) {
  try {
    return await runRegisterKb(name, path);
  } catch (error) {
    if (error instanceof KbRegistryError) throw new Error(error.message);
    throw error;
  }
}

function registerInitKb(server: McpServer, kbRoot: string | undefined): void {
  defineTool(server, 'init_kb', {
    title: 'Initialize a knowledge base',
    description: 'Create a new Knowlery knowledge base at a path and register it under a name — cold start '
      + 'from a conversation. Creates at most one new directory; a non-empty target is refused. '
      + 'Only call on the user\'s explicit request, and restate the resolved path in conversation before calling — '
      + 'creating a directory is the user\'s decision.',
    inputSchema: {
      name: z.string().describe('Registry name for the new KB ([a-z0-9][a-z0-9-_]*)'),
      path: z.string().describe('Directory to create (absolute or ~-relative); its parent must exist'),
      platform: z.enum(['claude-code', 'opencode']).optional(),
    },
    outputSchema: { name: z.string(), path: z.string(), platform: z.string() },
  }, async ({ name, path, platform }) => {
    const result = await runInitKb(name, path, platform ?? 'claude-code', kbRoot);
    return ok(
      { name: result.name, path: result.path, platform: result.platform },
      `Initialized and registered "${result.name}" at ${result.path} (${result.platform}). `
      + 'Feed it with capture, then compile with /cook.',
    );
  });
}

function registerCapture(server: McpServer): void {
  defineTool(server, 'capture', {
    title: 'Capture a note',
    description: 'Save content from this conversation as a new note in the KB\'s inbox/ — "remember this". '
      + 'Appends only; never overwrites, never touches compiled knowledge (that is /cook\'s reviewed job). '
      + 'Only capture what the user asked to save (or offered and they accepted), and echo back the written path. '
      + 'Never capture silently in the background.',
    inputSchema: {
      kb: z.string().describe('Registered KB name (writes take exactly one KB — no "*")'),
      content: z.string().min(1),
      title: z.string().optional(),
    },
    outputSchema: { path: z.string(), title: z.string() },
  }, async ({ kb, content, title }) => {
    if (kb === '*') {
      throw new Error('capture writes to exactly one KB — "*" is not valid here.');
    }
    const result = await runCaptureOrThrow(kb, content, title);
    return ok(
      { path: result.path, title: result.title },
      `Captured "${result.title}" to ${result.path}. It is uncooked until /cook compiles it.`,
    );
  });
}

function registerSync(server: McpServer, options: McpServerOptions): void {
  defineTool(server, 'sync', {
    title: 'Sync workspace files',
    description: 'Refresh the KB\'s built-in skills and instruction files to this Knowlery version. Idempotent; '
      + 'the caller supplies no content — everything written is determined by the installed binary. '
      + 'Run when the user asks, or after they accept a suggestion (e.g. health reported missing skills); '
      + 'report the updated-file list.',
    inputSchema: { kb: z.string() },
    outputSchema: { updated: z.array(z.string()) },
  }, async ({ kb }) => {
    const root = await resolveKbOrThrow(kb);
    const fs = nodeVaultFs(root);
    if (!(await isVaultInitialized(fs))) {
      throw new Error(`"${kb}" is not an initialized Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json).`);
    }
    const { fs: logged, writes } = loggingVaultFs(fs);
    const result = await runVaultSync(logged, await resolvePlatform(fs), options.toolVersion);
    if (result.skipped === 'newer-shell') {
      // The downgrade guard is a tool error, not a finding (spec §4.4): the
      // tool's point is the write it refused to make.
      throw new Error(
        `This workspace was last synced by a newer Knowlery (${result.lastSyncedBy ?? 'unknown'}); syncing would downgrade it. Update first: npm i -g knowlery@latest`,
      );
    }
    const text = writes.length === 0
      ? `No changes — ${kb} is already up to date.`
      : `Updated ${writes.length} file(s) in ${kb}:\n${writes.map((path) => `  ${path}`).join('\n')}`;
    return ok({ updated: writes }, text);
  });
}

async function runCaptureOrThrow(kb: string, content: string, title?: string) {
  try {
    return await runCapture(kb, content, title);
  } catch (error) {
    if (error instanceof KbRegistryError) throw new Error(error.message);
    throw error;
  }
}

function registerPrompts(server: McpServer): void {
  for (const name of MCP_PROMPT_SKILLS) {
    const skill = BUNDLED_SKILLS.find((entry) => entry.name === name);
    if (!skill) continue;
    server.registerPrompt(name, {
      title: name,
      description: skill.description,
    }, () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: skill.content },
      }],
    }));
  }
}

function registerResources(server: McpServer): void {
  // Concrete entry points: one per registered KB (resources/list — spec §4.4,
  // kept separate from the template per the MCP protocol split).
  server.registerResource('knowledge-entrypoints', new ResourceTemplate('knowlery://{kb}/{+path}', {
    list: async () => {
      const kbs = await listKbs();
      // Two bounded entries per KB (spec 1.2 f1, §4.3): the operating guide
      // and the live orientation map.
      return {
        resources: kbs
          .filter((kb) => kb.state === 'ok')
          .flatMap((kb) => [
            {
              uri: `knowlery://${kb.name}/KNOWLEDGE.md`,
              name: `${kb.name} — KNOWLEDGE.md`,
              description: `Entry point of the "${kb.name}" knowledge base`,
              mimeType: 'text/markdown',
            },
            {
              uri: `knowlery://${kb.name}/index`,
              name: `${kb.name} — orientation map`,
              description: `What the "${kb.name}" knowledge base contains — a live view, computed on read`,
              mimeType: 'text/markdown',
            },
          ]),
      };
    },
  }), {
    title: 'Knowledge pages',
    description: 'Pages of the curated knowledge surface: KNOWLEDGE.md, the compiled dirs '
      + '(entities/, concepts/, comparisons/, queries/), and installed-bundle pages under Library/. '
      + 'Free-form notes are not readable over MCP — they are surfaced by query as metadata only.',
  }, async (uri, variables) => {
    const kb = String(variables.kb ?? '');
    const rawPath = String(variables.path ?? '');
    // The virtual orientation map routes before the allowlisted file-read
    // path and matches only the exact path `index` — no `.md`, so a real
    // root-level index.md is a user-tier note and stays refused (spec 1.2
    // f1, §4.3: the frozen boundary does not move).
    if (rawPath === 'index') {
      const root = await resolveKbOrThrow(kb);
      const map = await collectOrientationMap(root, new Date().toISOString());
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: renderOrientationMap(map, { markdown: true }) }] };
    }
    const content = await readKnowledgePage(kb, rawPath);
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: content }] };
  });
}

async function readKnowledgePage(kb: string, rawPath: string): Promise<string> {
  const root = await resolveKbOrThrow(kb);
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');

  const allowed = READABLE_FILES.has(normalized)
    || READABLE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!allowed || !normalized.endsWith('.md')) {
    throw new Error(
      `"${normalized}" is outside the readable knowledge surface (KNOWLEDGE.md, entities/, concepts/, `
      + 'comparisons/, queries/, Library/). Free-form notes stay private to the vault owner — '
      + 'content enters the readable layer by being compiled with /cook.',
    );
  }

  // Canonicalize-first (the init_kb discipline applied to reads): the resolved
  // real path must stay under the KB root — no traversal, no symlink escape.
  const rootReal = await realpath(root);
  let target: string;
  try {
    target = await realpath(join(rootReal, normalized));
  } catch {
    throw new Error(`No such page in ${kb}: ${normalized}`);
  }
  if (target !== rootReal && !target.startsWith(rootReal + sep)) {
    throw new Error(`"${rawPath}" escapes the knowledge base root — refused.`);
  }
  return readFile(target, 'utf8');
}
