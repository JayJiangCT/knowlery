import type { Platform } from '../../types';
import type { VaultFs } from '../../core/vault-fs';
import { readManifest } from '../../core/setup-executor';

/** Error whose message goes to stderr and whose code becomes the process exit code. */
export class CliError extends Error {
  constructor(message: string, public exitCode = 1) {
    super(message);
  }
}

/** Prompt callback; null when stdin is not a TTY (scripted use must pass flags). */
export type Prompt = ((question: string) => Promise<string>) | null;

export async function resolvePlatform(fs: VaultFs): Promise<Platform> {
  const manifest = await readManifest(fs);
  return manifest?.platform ?? 'claude-code';
}

export function isPlatform(value: string): value is Platform {
  return value === 'claude-code' || value === 'opencode';
}
