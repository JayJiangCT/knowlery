import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { KnowleryError } from '../core/errors';
import { isMissing, resolveRoot } from '../core/paths';

export type RootSource = '--dir' | 'KNOWLERY_DIR' | 'cwd';

export interface ResolvedMcpRoot {
  root: string;
  source: RootSource;
}

export function formatRootSource(source: RootSource): string {
  switch (source) {
    case '--dir': return 'from --dir';
    case 'KNOWLERY_DIR': return 'from KNOWLERY_DIR';
    case 'cwd': return 'from working directory';
  }
}

async function hasConfigFile(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, '.knowlery', 'config.json'))).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function findMcpRoot(
  dirFlag: string | undefined,
  envDir: string | undefined,
  cwd: string,
): Promise<ResolvedMcpRoot> {
  if (dirFlag !== undefined) {
    return { root: await resolveRoot(dirFlag, cwd), source: '--dir' };
  }
  if (envDir !== undefined && envDir !== '') {
    return { root: await resolveRoot(envDir, cwd), source: 'KNOWLERY_DIR' };
  }

  let current = resolve(cwd);
  for (;;) {
    if (await hasConfigFile(current)) {
      return { root: await resolveRoot(current, cwd), source: 'cwd' };
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new KnowleryError(
    'not_found',
    `No knowledge base found: no --dir, no KNOWLERY_DIR, and no .knowlery/config.json in ${cwd} or any folder above it.`,
    'Run knowlery init in the knowledge base folder, or start this server with --dir FOLDER or with KNOWLERY_DIR set.',
  );
}
