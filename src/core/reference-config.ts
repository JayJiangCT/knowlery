import type { VaultFs } from './vault-fs';

/**
 * Per-workspace configuration (`.knowlery/config.json`): user intent about the
 * vault, as opposed to `.knowlery/manifest.json`, which is tool state that sync
 * rewrites. A new optional file under 1.0's frozen workspace format — additive,
 * hence minor.
 *
 * Today it carries one setting, `referenceDirs`: directories whose notes are
 * someone else's knowledge brought into this vault to be read, not compiled.
 * They stay fully queryable (same user tier, same scoring) but never appear in
 * the staleness report's uncooked list — exactly the treatment `Library/`
 * bundles already get, extended to directories the user names.
 */

export const CONFIG_PATH = '.knowlery/config.json';

export interface KnowleryConfig {
  schemaVersion: 1;
  referenceDirs: string[];
}

export class ReferenceDirError extends Error {}

/**
 * Listed literally rather than spread from scan.ts's AGENT_DIRS: scan.ts imports this
 * module to read the config, and a value import back would be a load-order cycle.
 * tests/core/reference-config.test.ts pins the two lists together.
 */
export const RESERVED_TOP_LEVEL = new Set<string>(['entities', 'concepts', 'comparisons', 'queries', 'Library', 'inbox']);

export function emptyConfig(): KnowleryConfig {
  return { schemaVersion: 1, referenceDirs: [] };
}

/**
 * Tolerant parse: a missing or empty file is an empty config; a malformed file
 * throws, because silently ignoring it would un-reference every directory at once.
 */
export function parseConfig(raw: string | null | undefined): KnowleryConfig {
  if (raw === null || raw === undefined || raw.trim() === '') return emptyConfig();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ReferenceDirError(`${CONFIG_PATH} is not valid JSON`);
  }
  if (typeof data !== 'object' || data === null) throw new ReferenceDirError(`${CONFIG_PATH} must be a JSON object`);
  const dirs = (data as { referenceDirs?: unknown }).referenceDirs;
  if (dirs === undefined) return emptyConfig();
  if (!Array.isArray(dirs) || dirs.some((dir) => typeof dir !== 'string')) {
    throw new ReferenceDirError(`${CONFIG_PATH}: referenceDirs must be an array of strings`);
  }
  return { schemaVersion: 1, referenceDirs: dedupe((dirs as string[]).map(normalizeReferenceDir)) };
}

/**
 * Canonical vault-relative directory: forward slashes, no leading `./`, no trailing
 * slash. Rejects anything that cannot be a reference directory — absolute paths,
 * parent traversal, hidden directories, and the directories Knowlery itself owns.
 */
export function normalizeReferenceDir(input: string): string {
  let dir = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (dir.startsWith('./')) dir = dir.slice(2);
  dir = dir.replace(/^\/+|\/+$/g, '');
  if (dir === '') throw new ReferenceDirError('Reference directory must not be empty');
  if (/^[a-zA-Z]:/.test(input) || input.trim().startsWith('/')) {
    throw new ReferenceDirError(`Reference directory must be vault-relative, got: ${input}`);
  }
  const segments = dir.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new ReferenceDirError(`Reference directory must stay inside the vault, got: ${input}`);
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new ReferenceDirError(`Hidden directories are never scanned, so they cannot be reference directories: ${input}`);
  }
  if (RESERVED_TOP_LEVEL.has(segments[0])) {
    throw new ReferenceDirError(`${segments[0]}/ is managed by Knowlery and cannot be a reference directory`);
  }
  return dir;
}

/** True when `path` (vault-relative, `/`-separated) lies under any reference directory. */
export function isUnderReferenceDir(path: string, referenceDirs: readonly string[]): boolean {
  for (const dir of referenceDirs) {
    if (path.startsWith(`${dir}/`)) return true;
  }
  return false;
}

export async function readConfig(fs: VaultFs): Promise<KnowleryConfig> {
  if (!(await fs.exists(CONFIG_PATH))) return emptyConfig();
  return parseConfig(await fs.read(CONFIG_PATH));
}

export async function writeConfig(fs: VaultFs, config: KnowleryConfig): Promise<void> {
  if (!(await fs.exists('.knowlery'))) await fs.mkdir('.knowlery');
  await fs.write(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export async function addReferenceDir(
  fs: VaultFs,
  input: string,
): Promise<{ dir: string; added: boolean; referenceDirs: string[] }> {
  const dir = normalizeReferenceDir(input);
  if (!(await fs.exists(dir))) throw new ReferenceDirError(`Directory not found in vault: ${dir}`);
  const config = await readConfig(fs);
  if (config.referenceDirs.includes(dir)) return { dir, added: false, referenceDirs: config.referenceDirs };
  // A nested dir under an existing reference dir is already covered; keep the list minimal.
  if (isUnderReferenceDir(`${dir}/`, config.referenceDirs)) return { dir, added: false, referenceDirs: config.referenceDirs };
  config.referenceDirs = [...config.referenceDirs, dir].sort();
  await writeConfig(fs, config);
  return { dir, added: true, referenceDirs: config.referenceDirs };
}

export async function removeReferenceDir(
  fs: VaultFs,
  input: string,
): Promise<{ dir: string; removed: boolean; referenceDirs: string[] }> {
  const dir = normalizeReferenceDir(input);
  const config = await readConfig(fs);
  if (!config.referenceDirs.includes(dir)) return { dir, removed: false, referenceDirs: config.referenceDirs };
  config.referenceDirs = config.referenceDirs.filter((entry) => entry !== dir);
  await writeConfig(fs, config);
  return { dir, removed: true, referenceDirs: config.referenceDirs };
}

function dedupe(dirs: string[]): string[] {
  return [...new Set(dirs)].sort();
}
