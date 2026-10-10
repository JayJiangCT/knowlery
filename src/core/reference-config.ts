import type { VaultFs } from './vault-fs';

/**
 * Per-workspace configuration (`.knowlery/config.json`): user intent about the
 * vault, as opposed to `.knowlery/manifest.json`, which is tool state that sync
 * rewrites. A new optional file under 1.0's frozen workspace format — additive,
 * hence minor.
 *
 * Two directory lists, with deliberately different semantics:
 *
 * - `referenceDirs`: someone else's knowledge brought into this vault to be read,
 *   not compiled. Fully queryable (same user tier, same scoring) but never in the
 *   staleness report's uncooked list — the `Library/` treatment, for directories
 *   the user names.
 * - `ignoreDirs`: not knowledge at all (generated output, archives of junk). Not
 *   scanned, so invisible to retrieval and staleness alike — the user-extensible
 *   half of the built-in exclusions in query/exclusions.ts.
 *
 * A directory can be in at most one list.
 */

export const CONFIG_PATH = '.knowlery/config.json';

export interface KnowleryConfig {
  schemaVersion: 1;
  referenceDirs: string[];
  ignoreDirs: string[];
}

export type DirListKind = 'referenceDirs' | 'ignoreDirs';

export class ReferenceDirError extends Error {}

/**
 * Listed literally rather than spread from scan.ts's AGENT_DIRS: scan.ts imports this
 * module to read the config, and a value import back would be a load-order cycle.
 * tests/core/reference-config.test.ts pins the two lists together.
 */
export const RESERVED_TOP_LEVEL = new Set<string>(['entities', 'concepts', 'comparisons', 'queries', 'Library', 'inbox']);

export function emptyConfig(): KnowleryConfig {
  return { schemaVersion: 1, referenceDirs: [], ignoreDirs: [] };
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
  const record = data as Record<DirListKind, unknown>;
  const config: KnowleryConfig = {
    schemaVersion: 1,
    referenceDirs: parseDirList(record.referenceDirs, 'referenceDirs'),
    ignoreDirs: parseDirList(record.ignoreDirs, 'ignoreDirs'),
  };
  const both = config.referenceDirs.filter((dir) => config.ignoreDirs.includes(dir));
  if (both.length > 0) {
    throw new ReferenceDirError(`${CONFIG_PATH}: ${both.join(', ')} cannot be both a reference and an ignored directory`);
  }
  return config;
}

function parseDirList(value: unknown, kind: DirListKind): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((dir) => typeof dir !== 'string')) {
    throw new ReferenceDirError(`${CONFIG_PATH}: ${kind} must be an array of strings`);
  }
  return dedupe((value as string[]).map(normalizeReferenceDir));
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
  if (dir === '') throw new ReferenceDirError('Directory must not be empty');
  if (/^[a-zA-Z]:/.test(input) || input.trim().startsWith('/')) {
    throw new ReferenceDirError(`Directory must be vault-relative, got: ${input}`);
  }
  const segments = dir.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new ReferenceDirError(`Directory must stay inside the vault, got: ${input}`);
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new ReferenceDirError(`Hidden directories are never scanned, so they need no configuration: ${input}`);
  }
  if (RESERVED_TOP_LEVEL.has(segments[0])) {
    throw new ReferenceDirError(`${segments[0]}/ is managed by Knowlery and cannot be configured here`);
  }
  return dir;
}

/** True when `path` (vault-relative, `/`-separated) lies under any of `dirs`. */
export function isUnderDir(path: string, dirs: readonly string[]): boolean {
  for (const dir of dirs) {
    if (path.startsWith(`${dir}/`)) return true;
  }
  return false;
}

export const isUnderReferenceDir = isUnderDir;

export async function readConfig(fs: VaultFs): Promise<KnowleryConfig> {
  if (!(await fs.exists(CONFIG_PATH))) return emptyConfig();
  return parseConfig(await fs.read(CONFIG_PATH));
}

export async function writeConfig(fs: VaultFs, config: KnowleryConfig): Promise<void> {
  if (!(await fs.exists('.knowlery'))) await fs.mkdir('.knowlery');
  await fs.write(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export interface DirListChange {
  dir: string;
  changed: boolean;
  dirs: string[];
}

const OTHER_LIST: Record<DirListKind, DirListKind> = { referenceDirs: 'ignoreDirs', ignoreDirs: 'referenceDirs' };
const LIST_LABEL: Record<DirListKind, string> = { referenceDirs: 'a reference directory', ignoreDirs: 'an ignored directory' };

export async function addDir(fs: VaultFs, kind: DirListKind, input: string): Promise<DirListChange> {
  const dir = normalizeReferenceDir(input);
  if (!(await fs.exists(dir))) throw new ReferenceDirError(`Directory not found in vault: ${dir}`);
  const config = await readConfig(fs);
  const list = config[kind];
  if (list.includes(dir)) return { dir, changed: false, dirs: list };
  // A nested dir under an existing entry is already covered; keep the list minimal.
  if (isUnderDir(`${dir}/`, list)) return { dir, changed: false, dirs: list };
  const other = OTHER_LIST[kind];
  if (config[other].includes(dir) || isUnderDir(`${dir}/`, config[other])) {
    throw new ReferenceDirError(`${dir}/ is already ${LIST_LABEL[other]}; remove it from that list first`);
  }
  config[kind] = [...list, dir].sort();
  await writeConfig(fs, config);
  return { dir, changed: true, dirs: config[kind] };
}

export async function removeDir(fs: VaultFs, kind: DirListKind, input: string): Promise<DirListChange> {
  const dir = normalizeReferenceDir(input);
  const config = await readConfig(fs);
  if (!config[kind].includes(dir)) return { dir, changed: false, dirs: config[kind] };
  config[kind] = config[kind].filter((entry) => entry !== dir);
  await writeConfig(fs, config);
  return { dir, changed: true, dirs: config[kind] };
}

export async function addReferenceDir(
  fs: VaultFs,
  input: string,
): Promise<{ dir: string; added: boolean; referenceDirs: string[] }> {
  const result = await addDir(fs, 'referenceDirs', input);
  return { dir: result.dir, added: result.changed, referenceDirs: result.dirs };
}

export async function removeReferenceDir(
  fs: VaultFs,
  input: string,
): Promise<{ dir: string; removed: boolean; referenceDirs: string[] }> {
  const result = await removeDir(fs, 'referenceDirs', input);
  return { dir: result.dir, removed: result.changed, referenceDirs: result.dirs };
}

function dedupe(dirs: string[]): string[] {
  return [...new Set(dirs)].sort();
}
