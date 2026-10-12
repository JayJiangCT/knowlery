import { readFileSync, writeFileSync } from 'node:fs';
import { PROTOCOL } from './protocol';

/**
 * The private harness file (protocol §3): provenance of every sheet entry — tier,
 * stratum, inclusion probability, seeded nomination, pool membership. The annotator
 * never opens it; the sheet never carries any of it.
 */

export type EntrySource = 'diagnostic' | 'seeded' | 'pool' | 'probe';

export interface PrivateEntry {
  path: string;
  sources: EntrySource[];
  /** Diagnostic stratum and inclusion probability (present only when sampled). */
  stratum?: string;
  pi?: number;
  /** Policies whose top POOL_DEPTH contained this note. */
  poolPolicies?: string[];
  /** Random-probe draws (§5), one per policy that drew it. */
  probes?: Array<{ policy: string; rank: number; pi: number }>;
}

export interface StratumRecord {
  key: string;
  population: number;
  allocated: number;
}

export interface PrivateFile {
  kind: 'cv-eval-private';
  protocol: string;
  protocolRevision: number;
  freezeId: string;
  seed: number;
  createdAt: string;
  sample: {
    size: number;
    floor: number;
    usedJevStrata: boolean;
    strata: StratumRecord[];
    /** Older snapshots beyond the per-document cap: not eligible, so outside the estimation population. */
    ineligible: string[];
  };
  pool: null | {
    depth: number;
    policies: string[];
    probePerPolicy: number;
    probeRanks: [number, number];
    /** True when entries were added after labelling began (weaker blindness for that block). */
    appendedAfterLabelling: boolean;
    createdAt: string;
  };
  /** Keyed by sheet id. */
  entries: Record<string, PrivateEntry>;
}

export function readPrivate(path: string): PrivateFile {
  const data = JSON.parse(readFileSync(path, 'utf8')) as PrivateFile;
  if (data.kind !== 'cv-eval-private' || data.protocol !== PROTOCOL) throw new Error(`${path} is not a ${PROTOCOL} private harness file`);
  return data;
}

export function writePrivate(path: string, file: PrivateFile): void {
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
