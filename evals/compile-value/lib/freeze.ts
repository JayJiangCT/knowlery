import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JEV_MODEL } from '../../../src/core/jev/client';
import { TRIAGE_PATH } from '../../../src/core/jev/triage-store';
import { CONFIG_PATH } from '../../../src/core/reference-config';
import { SYSTEM_FILES, scanVault } from '../../../src/core/query/scan';
import { computeStaleness } from '../../../src/core/query/staleness';
import { PROTOCOL, PROTOCOL_REVISION } from './protocol';
import { sha256 } from './rng';

/**
 * Protocol §2: a full, verified copy of everything any policy reads, identified by
 * freezeId = sha256(manifest.json). The copy keeps original mtimes (rounded to whole
 * milliseconds, as the scanner reports them) so the product's own ordering code —
 * mtime order and the 1.6.0 Jev order, which keys triage entries by mtime — runs on
 * the freeze exactly as it ran on the vault.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');

export const FOCUS_PATH = '.knowlery/focus.md';
const EXTRA_FILES = [CONFIG_PATH, TRIAGE_PATH, FOCUS_PATH, ...SYSTEM_FILES];
export const MAX_FREEZE_ATTEMPTS = 3;

export interface FrozenFile {
  path: string;
  size: number;
  /** Whole milliseconds, as `scanVault` reports them. */
  mtimeMs: number;
  sha256: string;
}

export interface FreezeManifest {
  protocol: string;
  protocolRevision: number;
  /** ISO, UTC. */
  frozenAt: string;
  /** IANA zone of the freezing machine; `focus.md` `until:` is read in it (§11). */
  timeZone: string;
  tools: { knowlery: string; jevModel: string; node: string };
  files: FrozenFile[];
}

export interface Freeze {
  dir: string;
  vaultDir: string;
  manifest: FreezeManifest;
  freezeId: string;
  /** Set by `freezeVault`: the source and the copy produced the same queue orders. */
  orderParity?: { queue: number; triage: boolean };
}

export class FreezeError extends Error {
  constructor(message: string, readonly changedPaths: string[] = []) {
    super(message);
  }
}

/** Real data never lands in the public repository's working tree (§12). */
export function assertOutsideRepo(path: string, what: string): void {
  const target = resolve(path);
  if (target === REPO_ROOT || target.startsWith(`${REPO_ROOT}${sep}`)) {
    throw new FreezeError(`${what} must be outside the repository (${REPO_ROOT}); the repository is public. Got: ${target}`);
  }
}

/** Paths the freeze must contain: every page the scanner indexes, plus the files that shape the queue and the focus. */
export function freezePaths(root: string): string[] {
  const paths = new Set(scanVault(root).pages.map((page) => page.path));
  for (const extra of EXTRA_FILES) if (existsSync(join(root, extra))) paths.add(extra);
  return [...paths].sort();
}

function describe(root: string, path: string): FrozenFile | null {
  const file = join(root, path);
  try {
    const content = readFileSync(file);
    const stat = statSync(file);
    return { path, size: content.length, mtimeMs: Math.round(stat.mtimeMs), sha256: sha256(content) };
  } catch {
    return null;
  }
}

function describeAll(root: string): Map<string, FrozenFile> {
  const out = new Map<string, FrozenFile>();
  for (const path of freezePaths(root)) {
    const entry = describe(root, path);
    if (entry) out.set(path, entry);
  }
  return out;
}

function diff(before: Map<string, FrozenFile>, after: Map<string, FrozenFile>): string[] {
  const changed = new Set<string>();
  for (const [path, entry] of before) {
    const now = after.get(path);
    if (!now || now.size !== entry.size || now.mtimeMs !== entry.mtimeMs || now.sha256 !== entry.sha256) changed.add(path);
  }
  for (const path of after.keys()) if (!before.has(path)) changed.add(path);
  return [...changed].sort();
}

export interface QueueOrders {
  /** Uncooked queue in mtime order (B0). */
  mtime: string[];
  /** The same queue with the vault's triage.json applied (B2); null without one. */
  triage: string[] | null;
}

export function queueOrders(root: string): QueueOrders {
  const snapshot = scanVault(root);
  const paths = (notes: { path: string }[]) => notes.map((note) => note.path);
  return {
    mtime: paths(computeStaleness({ ...snapshot, triage: undefined }).uncookedNotes),
    triage: snapshot.triage ? paths(computeStaleness(snapshot).uncookedNotes) : null,
  };
}

/** First disagreement between two queue orders, or null when they match. */
function orderMismatch(name: string, source: string[] | null, copy: string[] | null): string | null {
  if (source === null && copy === null) return null;
  if (source === null || copy === null) return `${name}: triage.json is ${source === null ? 'only in the copy' : 'missing from the copy'}`;
  const length = Math.max(source.length, copy.length);
  for (let i = 0; i < length; i++) {
    if (source[i] !== copy[i]) return `${name} rank ${i + 1}: source ${source[i] ?? '(end)'}, copy ${copy[i] ?? '(end)'}`;
  }
  return null;
}

function packageVersion(): string {
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { version?: unknown };
  return typeof raw.version === 'string' ? raw.version : 'unknown';
}

export interface FreezeOptions {
  now?: Date;
  timeZone?: string;
  /** Test seam: runs after the copy, before the source is re-scanned. */
  afterCopy?: (attempt: number) => void;
  /** Tests write to temp dirs; the CLI never sets this. */
  allowInsideRepo?: boolean;
}

/**
 * Copies, then re-scans the source and compares it with the manifest; any difference
 * (an edit, a /cook writing a page, a file appearing or vanishing) discards the copy and
 * retries. After MAX_FREEZE_ATTEMPTS it fails, naming the paths, and produces no freezeId.
 */
export function freezeVault(sourceRoot: string, outDir: string, options: FreezeOptions = {}): Freeze {
  const source = resolve(sourceRoot);
  const out = resolve(outDir);
  if (!options.allowInsideRepo) assertOutsideRepo(out, 'The freeze directory');
  if (existsSync(out) && readdirSync(out).length > 0) throw new FreezeError(`Refusing to write into a non-empty directory: ${out}`);
  const vaultDir = join(out, 'vault');
  let lastChanged: string[] = [];

  for (let attempt = 1; attempt <= MAX_FREEZE_ATTEMPTS; attempt++) {
    rmSync(vaultDir, { recursive: true, force: true });
    const before = describeAll(source);
    const changed = new Set<string>();
    for (const entry of before.values()) {
      let content: Buffer;
      try {
        content = readFileSync(join(source, entry.path));
      } catch {
        changed.add(entry.path);
        continue;
      }
      if (sha256(content) !== entry.sha256) {
        changed.add(entry.path);
        continue;
      }
      const target = join(vaultDir, entry.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      utimesSync(target, entry.mtimeMs / 1000, entry.mtimeMs / 1000);
    }
    options.afterCopy?.(attempt);
    for (const path of diff(before, describeAll(source))) changed.add(path);
    if (changed.size === 0) {
      const sourceOrders = queueOrders(source);
      const copyOrders = queueOrders(vaultDir);
      const mismatches = [
        orderMismatch('mtime order', sourceOrders.mtime, copyOrders.mtime),
        orderMismatch('1.6.0 Jev order', sourceOrders.triage, copyOrders.triage),
      ].filter((entry): entry is string => entry !== null);
      if (mismatches.length > 0) {
        const raced = diff(before, describeAll(source));
        if (raced.length > 0) {
          lastChanged = raced;
          continue;
        }
        rmSync(vaultDir, { recursive: true, force: true });
        throw new FreezeError(`The copy does not reproduce the vault's queue order, so it cannot stand in for the vault. No freeze was produced. ${mismatches.join('; ')}`);
      }
      const manifest: FreezeManifest = {
        protocol: PROTOCOL,
        protocolRevision: PROTOCOL_REVISION,
        frozenAt: (options.now ?? new Date()).toISOString(),
        timeZone: options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        tools: { knowlery: packageVersion(), jevModel: JEV_MODEL, node: process.version },
        files: [...before.values()].sort((a, b) => a.path.localeCompare(b.path)),
      };
      const raw = `${JSON.stringify(manifest, null, 2)}\n`;
      writeFileSync(join(out, 'manifest.json'), raw);
      return {
        dir: out, vaultDir, manifest, freezeId: sha256(raw),
        orderParity: { queue: copyOrders.mtime.length, triage: copyOrders.triage !== null },
      };
    }
    lastChanged = [...changed].sort();
  }
  rmSync(vaultDir, { recursive: true, force: true });
  throw new FreezeError(
    `The vault kept changing while it was being frozen (${MAX_FREEZE_ATTEMPTS} attempts). No freeze was produced. Changed: ${lastChanged.join(', ')}`,
    lastChanged,
  );
}

function listFiles(root: string, prefix = ''): string[] {
  if (!existsSync(join(root, prefix))) return [];
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(root, path) : [path];
  });
}

/**
 * Loads a freeze. Verification (on by default) walks the whole copy, hidden files
 * included, and requires exactly the manifest's file set with the same size, mtime and
 * content: the queue order depends on mtimes and on which files exist, so a hash-only
 * check would let one freeze id stand for different queues.
 */
export function loadFreeze(dir: string, options: { verify?: boolean } = {}): Freeze {
  const out = resolve(dir);
  const manifestPath = join(out, 'manifest.json');
  if (!existsSync(manifestPath)) throw new FreezeError(`No manifest.json in ${out}`);
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as FreezeManifest;
  if (manifest.protocol !== PROTOCOL) throw new FreezeError(`Freeze protocol ${manifest.protocol} is not ${PROTOCOL}`);
  const vaultDir = join(out, 'vault');
  if (options.verify ?? true) {
    const actual = new Map<string, FrozenFile>();
    for (const path of listFiles(vaultDir)) {
      const entry = describe(vaultDir, path);
      if (entry) actual.set(path, entry);
    }
    const mismatched = diff(new Map(manifest.files.map((entry) => [entry.path, entry])), actual);
    if (mismatched.length > 0) throw new FreezeError(`Freeze copy differs from its manifest (file set, size, mtime or content): ${mismatched.join(', ')}`, mismatched);
  }
  return { dir: out, vaultDir, manifest, freezeId: sha256(raw) };
}
