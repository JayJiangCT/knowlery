/**
 * Directory exclusions shared by every transport (fs scanner, Obsidian live snapshot,
 * the vault-side query.mjs). Excluded directories are not scanned at all, so their
 * notes are invisible to retrieval and to the staleness report alike — which is why
 * the rules are layered from "certainly not knowledge" outward, and why every
 * exclusion is reported (knowlery health, Diagnostics) rather than silent:
 *
 * 1. Hidden directories (`.obsidian`, `.knowlery`, `.git`, …): Obsidian's own
 *    convention; skipped silently.
 * 2. Names that are never notes anywhere: `node_modules`, `__pycache__`.
 * 3. Conventional build-output names, but only when the directory sits inside a
 *    code project — i.e. its parent holds a project manifest (`package.json`,
 *    `Cargo.toml`, …). A plain `build/` or `target/` folder of notes is untouched.
 * 4. `ignoreDirs` from `.knowlery/config.json`: whatever the user names.
 *
 * Observed motivation: 871 of 4,108 "uncooked notes" in one vault were READMEs and
 * changelogs under node_modules of projects cloned into the vault.
 */

/** Never notes, in any vault, regardless of surroundings. */
export const ALWAYS_IGNORED_DIRS: ReadonlySet<string> = new Set(['node_modules', '__pycache__']);

/** Build-output names that are only ignored next to a project manifest. */
export const PROJECT_OUTPUT_DIRS: ReadonlySet<string> = new Set([
  'dist', 'build', 'target', 'outputs', 'coverage', 'vendor',
]);

/** Files whose presence marks a directory as a code project root. */
export const PROJECT_MARKERS: ReadonlySet<string> = new Set([
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'composer.json',
  'Gemfile',
  'mix.exs',
  'CMakeLists.txt',
  'Makefile',
]);

export type IgnoreReason = 'builtin' | 'project-output' | 'config';

export interface IgnoredDir {
  /** Vault-relative directory path, `/`-separated, no trailing slash. */
  path: string;
  reason: IgnoreReason;
}

export interface ExclusionContext {
  /** Vault-relative directories containing a PROJECT_MARKERS file; '' is the vault root. */
  projectRoots: ReadonlySet<string>;
  /** `ignoreDirs` from `.knowlery/config.json`, normalized. */
  ignoreDirs: readonly string[];
}

export const NO_EXCLUSIONS: ExclusionContext = { projectRoots: new Set(), ignoreDirs: [] };

export function isHiddenName(name: string): boolean {
  return name.startsWith('.');
}

/** Why a (non-hidden) vault-relative directory is excluded, or null when it is scanned. */
export function ignoreReasonForDir(dirPath: string, context: ExclusionContext): IgnoreReason | null {
  const slash = dirPath.lastIndexOf('/');
  const name = slash === -1 ? dirPath : dirPath.slice(slash + 1);
  const parent = slash === -1 ? '' : dirPath.slice(0, slash);
  if (ALWAYS_IGNORED_DIRS.has(name)) return 'builtin';
  if (PROJECT_OUTPUT_DIRS.has(name) && context.projectRoots.has(parent)) return 'project-output';
  if (context.ignoreDirs.includes(dirPath)) return 'config';
  return null;
}

/** True when any ancestor directory of a vault-relative file path is hidden or excluded. */
export function isIgnoredPath(filePath: string, context: ExclusionContext): boolean {
  const segments = filePath.split('/');
  let dir = '';
  for (let i = 0; i < segments.length - 1; i++) {
    if (isHiddenName(segments[i])) return true;
    dir = dir === '' ? segments[i] : `${dir}/${segments[i]}`;
    if (ignoreReasonForDir(dir, context) !== null) return true;
  }
  return false;
}

/**
 * Project roots derived from a flat list of vault-relative file paths (the Obsidian
 * transport, which has every file in memory). The fs scanner derives the same set
 * while walking, from each directory's own listing.
 */
export function projectRootsFromFiles(filePaths: Iterable<string>): Set<string> {
  const roots = new Set<string>();
  for (const path of filePaths) {
    const slash = path.lastIndexOf('/');
    const name = slash === -1 ? path : path.slice(slash + 1);
    if (PROJECT_MARKERS.has(name)) roots.add(slash === -1 ? '' : path.slice(0, slash));
  }
  return roots;
}

/**
 * The outermost excluded directories among `dirPaths` (vault-relative, no trailing
 * slash), each with its reason — the list health surfaces. Nested directories under an
 * excluded or hidden ancestor are not listed separately.
 */
export function listIgnoredDirs(dirPaths: Iterable<string>, context: ExclusionContext): IgnoredDir[] {
  const found: IgnoredDir[] = [];
  for (const dirPath of dirPaths) {
    if (dirPath === '') continue;
    const segments = dirPath.split('/');
    if (segments.some(isHiddenName)) continue;
    const parent = segments.slice(0, -1).join('/');
    if (parent !== '' && isIgnoredPath(`${parent}/x`, context)) continue;
    const reason = ignoreReasonForDir(dirPath, context);
    if (reason) found.push({ path: dirPath, reason });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}
