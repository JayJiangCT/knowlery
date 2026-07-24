/**
 * The measurement harness and the pairing seam (spec 1.3 f4, §4.2/§4.3):
 * entry points are dynamically imported from a --src root so CI can run
 * head's runner against base's core with identical methodology. Missing
 * entry points are a failure, not a skip — head missing always fails; base
 * missing fails unless --allow-missing-base explicitly downgrades it (the
 * bootstrap exception for the F4 landing PR only).
 */

import { existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import type { PathStats } from './budgets';

export interface EntryPoints {
  scanVault: (root: string) => unknown;
  runQuery: (question: string, snapshot: unknown, k: number) => { candidates: unknown[] };
  collectOrientationMap: (root: string, generatedAt: string) => Promise<unknown>;
  runFederatedQuery: (question: string, k: number) => Promise<{ candidates: unknown[] }>;
}

export class MissingEntryPointError extends Error {
  constructor(public readonly modulePath: string, public readonly exportName: string, cause: string) {
    super(`Benchmark entry point missing: ${exportName} from ${modulePath} (${cause})`);
  }
}

const ENTRY_MODULES: Array<{ module: string; exportName: keyof EntryPoints }> = [
  { module: 'src/core/query/scan.ts', exportName: 'scanVault' },
  { module: 'src/core/query/engine.ts', exportName: 'runQuery' },
  { module: 'src/core/orientation-source.ts', exportName: 'collectOrientationMap' },
  { module: 'src/core/federated-query.ts', exportName: 'runFederatedQuery' },
];

/**
 * Loads the four entry points from a source tree.
 * role 'head' (the runner's own tree): a missing entry point always throws.
 * role 'base' (a --src tree): throws unless allowMissingBase, which
 * downgrades to a loudly logged 'skipped'.
 */
export async function loadEntryPoints(
  srcRoot: string,
  role: 'head' | 'base',
  allowMissingBase = false,
  log: (line: string) => void = () => {},
): Promise<EntryPoints | { skipped: true; reason: string }> {
  ensureNodeModules(srcRoot, log);
  const loaded: Partial<EntryPoints> = {};
  for (const { module, exportName } of ENTRY_MODULES) {
    const modulePath = join(srcRoot, module);
    try {
      const imported = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
      const fn = imported[exportName];
      if (typeof fn !== 'function') throw new MissingEntryPointError(module, exportName, 'export not found');
      (loaded as Record<string, unknown>)[exportName] = fn;
    } catch (error) {
      const missing = error instanceof MissingEntryPointError
        ? error
        : new MissingEntryPointError(module, exportName, error instanceof Error ? error.message : String(error));
      if (role === 'base' && allowMissingBase) {
        log(`WARNING: pairing SKIPPED — base tree at ${srcRoot} is missing ${exportName} (${module}).`);
        log('         --allow-missing-base is the F4-landing bootstrap exception; it must not persist in the workflow.');
        return { skipped: true, reason: missing.message };
      }
      throw missing;
    }
  }
  return loaded as EntryPoints;
}

/**
 * A --src worktree has no node_modules of its own; the runner and its deps
 * come from head — only src/ is read from base (spec §4.3 implementation
 * notes). Symlinking head's node_modules makes the base tree's package
 * imports resolve.
 */
function ensureNodeModules(srcRoot: string, log: (line: string) => void): void {
  const target = join(srcRoot, 'node_modules');
  const own = join(process.cwd(), 'node_modules');
  if (existsSync(target) || !existsSync(own) || srcRoot === process.cwd()) return;
  try {
    symlinkSync(own, target, 'dir');
    log(`Linked head node_modules into ${srcRoot} (base src resolves head's deps).`);
  } catch { /* races or permissions: the import attempt will report properly */ }
}

export const WARMUP_RUNS = 2;
export const MEASURED_RUNS = 5;

/** 2 warmup + 5 measured, median reported (§4.2). Sequential, no parallel noise. */
export async function measure(fn: () => unknown | Promise<unknown>): Promise<PathStats> {
  for (let i = 0; i < WARMUP_RUNS; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    samples,
  };
}
