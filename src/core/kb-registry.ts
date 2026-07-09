import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KbRegistrySchema, type KbRegistry } from '../types';

/**
 * The KB registry (spec 1.0 f1): a global address book of named knowledge
 * bases — deliberately `name → path` and nothing more. Shared by the CLI, the
 * plugin (desktop-only, plain node fs), and later the MCP server, for which it
 * is the addressing layer.
 */

export const RESERVED_KB_NAMES = new Set(['*', 'all']);
const KB_NAME_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;

/** A corrupt registry is an error, never a silent reset (spec §4.1) — this
 * file is the user's list of their knowledge bases; losing it silently is
 * data loss, unlike vault-local caches that self-heal by regeneration. */
export class KbRegistryError extends Error {}

export function registryDir(): string {
  return process.env.KNOWLERY_CONFIG_DIR ?? join(homedir(), '.config', 'knowlery');
}

export function registryPath(): string {
  return join(registryDir(), 'registry.json');
}

export async function readKbRegistry(): Promise<KbRegistry> {
  const path = registryPath();
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { schemaVersion: 1, kbs: {} };
    }
    throw error;
  }
  let registry: KbRegistry;
  try {
    registry = KbRegistrySchema.parse(JSON.parse(raw));
  } catch {
    throw new KbRegistryError(
      `The KB registry at ${path} is corrupt and was NOT reset (it lists your knowledge bases). `
      + 'Repair or remove the file manually, then retry.',
    );
  }
  // The name invariants hold at the read boundary, not only at addKb — a
  // hand-edited registry with an invalid or reserved key ("Work KB", "*")
  // would otherwise break federation semantics and survive rewrites
  // (maintainer acceptance finding).
  for (const name of Object.keys(registry.kbs)) {
    const invalid = validateKbName(name);
    if (invalid) {
      throw new KbRegistryError(
        `The KB registry at ${path} contains an invalid entry name "${name}" (${invalid}) `
        + 'and was NOT reset. Repair the file manually, then retry.',
      );
    }
  }
  return registry;
}

async function writeKbRegistry(registry: KbRegistry): Promise<void> {
  await mkdir(registryDir(), { recursive: true });
  await writeFile(registryPath(), `${JSON.stringify(registry, null, 2)}\n`);
}

export function validateKbName(name: string): string | null {
  if (RESERVED_KB_NAMES.has(name)) return `"${name}" is reserved (federation). Pick another name.`;
  if (!KB_NAME_RE.test(name)) {
    return `KB names must match [a-z0-9][a-z0-9-_]* (max 64 chars), got: "${name}"`;
  }
  return null;
}

export interface AddKbResult {
  /** Canonicalized absolute path that was stored. */
  path: string;
  /** Names already pointing at the same path (a warning, not an error — spec §4.1). */
  alsoRegisteredAs: string[];
}

export async function addKb(name: string, rawPath: string): Promise<AddKbResult> {
  const invalid = validateKbName(name);
  if (invalid) throw new KbRegistryError(invalid);

  let canonical: string;
  try {
    // Canonicalize-first (the plan's discipline): symlinks resolved before storing.
    canonical = await realpath(rawPath);
  } catch {
    throw new KbRegistryError(`Path does not exist: ${rawPath}`);
  }
  if (!(await stat(canonical)).isDirectory()) {
    throw new KbRegistryError(`Not a directory: ${canonical}`);
  }

  const registry = await readKbRegistry();
  const alsoRegisteredAs = Object.entries(registry.kbs)
    .filter(([existingName, entry]) => entry.path === canonical && existingName !== name)
    .map(([existingName]) => existingName);
  registry.kbs[name] = { path: canonical };
  await writeKbRegistry(registry);
  return { path: canonical, alsoRegisteredAs };
}

/** Registry-only removal — never touches the KB's files (spec §4.1). */
export async function removeKb(name: string): Promise<boolean> {
  const registry = await readKbRegistry();
  if (!(name in registry.kbs)) return false;
  delete registry.kbs[name];
  await writeKbRegistry(registry);
  return true;
}

export type KbState = 'ok' | 'uninitialized' | 'missing';

export interface KbListing {
  name: string;
  path: string;
  state: KbState;
}

export async function listKbs(): Promise<KbListing[]> {
  const registry = await readKbRegistry();
  const listings: KbListing[] = [];
  for (const [name, entry] of Object.entries(registry.kbs)) {
    listings.push({ name, path: entry.path, state: await kbState(entry.path) });
  }
  return listings.sort((a, b) => a.name.localeCompare(b.name));
}

/** Exported since 1.1 f1: register_kb's initialized-check is this exact
 * logic — the MCP tool and `kb list` can never disagree about what
 * "initialized" means. */
export async function kbState(path: string): Promise<KbState> {
  try {
    if (!(await stat(path)).isDirectory()) return 'missing';
  } catch {
    return 'missing';
  }
  const initialized = await exists(join(path, 'KNOWLEDGE.md'))
    || await exists(join(path, '.knowlery', 'manifest.json'));
  return initialized ? 'ok' : 'uninitialized';
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a name to its path, with the not-found error listing what exists. */
export async function resolveKb(name: string): Promise<string> {
  const registry = await readKbRegistry();
  const entry = registry.kbs[name];
  if (!entry) {
    const names = Object.keys(registry.kbs).sort();
    throw new KbRegistryError(
      `No KB registered as "${name}".${names.length > 0 ? ` Registered: ${names.join(', ')}` : ' The registry is empty — `knowlery kb add <name> <path>`.'}`,
    );
  }
  return entry.path;
}

/**
 * Plugin auto-registration with the ownership rule (spec §4.5): create only
 * when the path is unowned, remember exactly the created name, and on
 * unregister remove only that name — a pre-existing user entry is never the
 * caller's to delete.
 */
export async function ensureVaultRegistered(
  vaultPath: string,
  desiredName: string,
  previouslyOwnedName: string | null,
): Promise<{ ownedName: string | null }> {
  const canonical = await realpath(vaultPath);
  const registry = await readKbRegistry();

  // Already own an entry that still points here — nothing to do.
  if (previouslyOwnedName && registry.kbs[previouslyOwnedName]?.path === canonical) {
    return { ownedName: previouslyOwnedName };
  }
  // Path already registered under someone else's name — no ownership taken.
  if (Object.values(registry.kbs).some((entry) => entry.path === canonical)) {
    return { ownedName: null };
  }

  const base = slugifyKbName(desiredName);
  let candidate = base;
  let suffix = 2;
  while (registry.kbs[candidate]) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  registry.kbs[candidate] = { path: canonical };
  await writeKbRegistry(registry);
  return { ownedName: candidate };
}

/** Toggle-off: remove exactly what was created, or nothing (spec §4.5). */
export async function unregisterOwnedVault(vaultPath: string, ownedName: string | null): Promise<void> {
  if (!ownedName) return;
  const canonical = await realpath(vaultPath).catch(() => null);
  const registry = await readKbRegistry();
  const entry = registry.kbs[ownedName];
  if (!entry || (canonical !== null && entry.path !== canonical)) return; // repointed or removed by the user — no-op
  delete registry.kbs[ownedName];
  await writeKbRegistry(registry);
}

function slugifyKbName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/^[-_]+/, '');
  const valid = /^[a-z0-9]/.test(slug) ? slug : `kb-${slug}`;
  return validateKbName(valid) === null ? valid : 'kb';
}
