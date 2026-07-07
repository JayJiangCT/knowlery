import { execFile } from 'node:child_process';

/**
 * Resolve a working `gh` binary (spec 0.9 — maintainer acceptance finding).
 *
 * GUI apps don't inherit the user's shell PATH (the same problem node-detect.ts
 * solves for node): inside Obsidian's Electron process, spawning bare `gh`
 * ENOENTs even when gh is installed via Homebrew. Every default gh runner
 * (remote install fallback, publish, upstream checks) resolves through this —
 * bare `gh` first (terminals), then the common install locations.
 */

const DEFAULT_CANDIDATES = [
  'gh',
  '/opt/homebrew/bin/gh',
  '/usr/local/bin/gh',
  ...(process.env.ProgramFiles ? [`${process.env.ProgramFiles}\\GitHub CLI\\gh.exe`] : []),
];

let cached: string | null | undefined;

export async function resolveGhBinary(candidates: string[] = DEFAULT_CANDIDATES): Promise<string | null> {
  if (candidates === DEFAULT_CANDIDATES && cached !== undefined) return cached;
  for (const candidate of candidates) {
    if (await probeGh(candidate)) {
      if (candidates === DEFAULT_CANDIDATES) cached = candidate;
      return candidate;
    }
  }
  if (candidates === DEFAULT_CANDIDATES) cached = null;
  return null;
}

/** Test hook: the cache would otherwise leak across test files. */
export function resetGhBinaryCache(): void {
  cached = undefined;
}

function probeGh(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(binary, ['--version'], { timeout: 10_000 }, (error) => resolve(!error));
  });
}
