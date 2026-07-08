import { access, lstat, mkdir, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { addKb, listKbs, readKbRegistry, registryDir, validateKbName, resolveKb } from '../kb-registry';
import { executeSetup } from '../setup-executor';
import { nodeVaultFs } from '../../platform/node-fs';
import type { Platform } from '../../types';

/**
 * The write path (spec 1.0 f3): the three writes, each with a structural
 * safety argument — init_kb creates at most one new leaf directory, capture
 * appends only to inbox/, sync writes only binary-determined content. The
 * compiled layer is reachable only through /cook's reviewed pipeline.
 */

// ---------------------------------------------------------------------------
// capture (spec §4.2) — append-only, path-sealed

export interface CaptureResult {
  path: string;
  title: string;
}

/** Reduce a title to [a-z0-9-]; separators cannot survive, so the filename is
 * constructed, never caller-supplied — escape is structurally impossible. */
function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return slug === '' ? 'note' : slug;
}

function captureTimestamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export async function runCapture(kb: string, content: string, title?: string): Promise<CaptureResult> {
  if (content.trim() === '') {
    throw new Error('capture content must not be empty.');
  }
  const root = await resolveKb(kb);
  const noteTitle = title?.trim() || 'Captured note';
  const stamp = captureTimestamp(new Date());
  const slug = slugify(noteTitle);

  // inbox/ must be a real directory under the KB root — a symlinked inbox
  // (-> concepts/, -> outside the KB) would break capture's core promise of
  // appending only to the inbox (maintainer P1 at implementation review;
  // `mkdir recursive` alone would silently follow an existing symlink).
  const inboxDir = join(root, 'inbox');
  let inboxStat: Awaited<ReturnType<typeof lstat>> | null = null;
  try {
    inboxStat = await lstat(inboxDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (inboxStat === null) {
    await mkdir(inboxDir);
  } else if (inboxStat.isSymbolicLink()) {
    throw new Error(`inbox/ in "${kb}" is a symlink (${inboxDir}) — capture refuses to follow it. Replace it with a real directory.`);
  } else if (!inboxStat.isDirectory()) {
    throw new Error(`inbox/ in "${kb}" exists but is not a directory (${inboxDir}).`);
  }

  // Collision (same second, same slug): numeric suffix — capture never overwrites.
  let relPath = `inbox/${stamp}-${slug}.md`;
  for (let n = 2; await exists(join(root, relPath)); n += 1) {
    relPath = `inbox/${stamp}-${slug}-${n}.md`;
  }

  const body = [
    '---',
    `title: ${JSON.stringify(noteTitle)}`,
    `captured: ${new Date().toISOString()}`,
    'source: conversation',
    '---',
    '',
    content,
    '',
  ].join('\n');
  await writeFile(join(root, relPath), body, { flag: 'wx' });
  return { path: relPath, title: noteTitle };
}

// ---------------------------------------------------------------------------
// init_kb (spec §4.3) — the plan-frozen path contract

export interface InitKbResult {
  name: string;
  path: string;
  platform: Platform;
}

function expandPath(rawPath: string): string {
  if (rawPath === '~' || rawPath.startsWith('~/')) {
    return join(homedir(), rawPath.slice(1));
  }
  return isAbsolute(rawPath) ? rawPath : resolve(rawPath);
}

function isInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

export async function runInitKb(
  name: string,
  rawPath: string,
  platform: Platform,
  /** Remote confinement (spec 1.0 f4, §4.4): when set, the canonical
   * candidate must lie under this root. Composes with — never replaces —
   * the F3 path contract. The caller canonicalizes at startup. */
  kbRoot?: string,
): Promise<InitKbResult> {
  // 1. Name validity + duplicate check — before any write, no auto-suffix
  //    (a conversation can ask; spec decision point).
  const invalid = validateKbName(name);
  if (invalid) throw new Error(invalid);
  const registry = await readKbRegistry();
  if (name in registry.kbs) {
    const names = Object.keys(registry.kbs).sort().join(', ');
    throw new Error(`A KB named "${name}" is already registered (registered: ${names}). Pick another name or use the existing KB.`);
  }

  // 2. Canonicalization, defined for a leaf that may not exist yet (maintainer
  //    P1 at spec review): realpath the parent, form the canonical candidate.
  const expanded = expandPath(rawPath);
  const parent = dirname(expanded);
  let parentReal: string;
  try {
    parentReal = await realpath(parent);
  } catch {
    throw new Error(`Parent directory does not exist: ${parent}. init_kb creates at most one new directory — create the parent first.`);
  }

  // 3. Parent must be a user-writable directory.
  if (!(await stat(parentReal)).isDirectory()) {
    throw new Error(`Parent is not a directory: ${parentReal}`);
  }
  try {
    await access(parentReal, constants.W_OK);
  } catch {
    throw new Error(`Parent directory is not writable: ${parentReal}`);
  }

  const candidate = join(parentReal, basename(expanded));

  if (kbRoot !== undefined && !isInside(candidate, kbRoot)) {
    throw new Error(`Target ${candidate} lies outside the configured --kb-root (${kbRoot}) — remote init_kb is confined to it.`);
  }

  // 4. Target must not exist, or be an empty directory that is not itself a symlink.
  let targetExisted = false;
  try {
    const targetStat = await stat(candidate);
    targetExisted = true;
    if (!targetStat.isDirectory()) {
      throw new Error(`Target exists and is not a directory: ${candidate}`);
    }
    if ((await readdir(candidate)).length > 0) {
      throw new Error(`Target directory is not empty: ${candidate} — init_kb refuses non-empty targets (no force over MCP).`);
    }
    if ((await realpath(candidate)) !== candidate) {
      throw new Error(`Target is a symlink: ${candidate} — refused.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  // 5. Never inside a registered KB, never inside Knowlery-internal paths.
  for (const kb of await listKbs()) {
    const kbReal = await realpath(kb.path).catch(() => kb.path);
    if (isInside(candidate, kbReal)) {
      throw new Error(`Target lies inside the registered KB "${kb.name}" (${kbReal}) — refused.`);
    }
  }
  const configReal = await realpath(registryDir()).catch(() => registryDir());
  if (isInside(candidate, configReal)) {
    throw new Error(`Target lies inside Knowlery's config directory (${configReal}) — refused.`);
  }

  // 6. Scaffold, then register; 7. cleanup distinguishes newly-created from
  //    pre-existing empty (the F1-review distinction).
  if (!targetExisted) await mkdir(candidate);
  try {
    await executeSetup(nodeVaultFs(candidate), platform, name, () => { /* progress not surfaced over MCP */ });
    await addKb(name, candidate);
  } catch (error) {
    if (targetExisted) {
      // Pre-existing empty dir: roll back only this run's written contents.
      for (const entry of await readdir(candidate).catch(() => [] as string[])) {
        await rm(join(candidate, entry), { recursive: true, force: true });
      }
    } else {
      await rm(candidate, { recursive: true, force: true });
    }
    throw error;
  }

  return { name, path: candidate, platform };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
