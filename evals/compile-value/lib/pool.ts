import type { PrivateEntry, PrivateFile } from './private';
import { POOL_DEPTH, PROBE_RANKS } from './protocol';
import type { AvailablePolicy } from './policies';
import { assignIds, deriveSeed, mulberry32, shuffle } from './rng';
import { blankNote, isLabelled, type Sheet } from './sheet';

/**
 * Protocol §5: the operational pool is the union of every available policy's top
 * POOL_DEPTH over the full frozen queue, so Precision@10 and @20 are exact for each.
 * The optional probe draws uniformly from ranks 21–50 of each policy to measure how
 * many cook_next notes sit just below every cut (pooling bias).
 */

export interface PoolOptions {
  seed: number;
  /** Probe draws per policy from PROBE_RANKS; 0 disables the probe. */
  probePerPolicy?: number;
  now?: Date;
}

export interface PoolResult {
  sheet: Sheet;
  privateFile: PrivateFile;
  added: string[];
  warnings: string[];
}

export function buildPool(
  sheet: Sheet,
  privateFile: PrivateFile,
  policies: readonly AvailablePolicy[],
  options: PoolOptions,
): PoolResult {
  if (privateFile.pool) throw new Error('This private file already has a pool; build pools from a fresh sample');
  if (sheet.header.freeze_id !== privateFile.freezeId) throw new Error('Sheet and private file belong to different freezes');
  const probePerPolicy = options.probePerPolicy ?? 0;
  const warnings: string[] = [];

  const byPath = new Map<string, { id: string; entry: PrivateEntry }>();
  for (const [id, entry] of Object.entries(privateFile.entries)) byPath.set(entry.path, { id, entry });
  const membership = new Map<string, { poolPolicies: Set<string>; probes: Array<{ policy: string; rank: number; pi: number }> }>();
  const touch = (path: string) => {
    let record = membership.get(path);
    if (!record) {
      record = { poolPolicies: new Set(), probes: [] };
      membership.set(path, record);
    }
    return record;
  };

  for (const policy of policies) {
    for (const path of policy.order.slice(0, POOL_DEPTH)) touch(path).poolPolicies.add(policy.id);
    if (probePerPolicy > 0) {
      const [from, to] = PROBE_RANKS;
      const band = policy.order.slice(from - 1, to);
      if (band.length === 0) continue;
      const draws = Math.min(probePerPolicy, band.length);
      const picked = shuffle(band.map((path, offset) => ({ path, rank: from + offset })), mulberry32(deriveSeed(options.seed, `probe:${policy.id}`))).slice(0, draws);
      for (const { path, rank } of picked) touch(path).probes.push({ policy: policy.id, rank, pi: draws / band.length });
    }
  }

  const entries: Record<string, PrivateEntry> = { ...privateFile.entries };
  const newPaths: string[] = [];
  for (const [path, record] of [...membership].sort(([a], [b]) => a.localeCompare(b))) {
    const existing = byPath.get(path);
    const sources = new Set(existing?.entry.sources ?? []);
    if (record.poolPolicies.size > 0) sources.add('pool');
    if (record.probes.length > 0) sources.add('probe');
    const entry: PrivateEntry = {
      ...(existing?.entry ?? { path }),
      sources: [...sources],
      ...(record.poolPolicies.size > 0 ? { poolPolicies: [...record.poolPolicies].sort() } : {}),
      ...(record.probes.length > 0 ? { probes: record.probes } : {}),
    };
    if (existing) entries[existing.id] = entry;
    else newPaths.push(path);
    if (!existing) byPath.set(path, { id: '', entry });
  }

  const ids = assignIds(newPaths, privateFile.seed, new Set(Object.keys(entries)));
  for (const path of newPaths) entries[ids.get(path) as string] = { ...(byPath.get(path)?.entry as PrivateEntry) };

  const labellingStarted = sheet.notes.some(isLabelled);
  if (labellingStarted && newPaths.length > 0) {
    warnings.push(`Labelling had already started: ${newPaths.length} pooled note(s) were inserted at random positions, but an annotator who notices new entries learns they came from the pool`);
  }
  const random = mulberry32(deriveSeed(options.seed, 'pool-order'));
  let notes = [...sheet.notes];
  if (labellingStarted) {
    for (const path of newPaths) {
      const at = Math.floor(random() * (notes.length + 1));
      notes.splice(at, 0, blankNote(ids.get(path) as string, path));
    }
  } else {
    notes = shuffle([...notes, ...newPaths.map((path) => blankNote(ids.get(path) as string, path))], random);
  }

  return {
    sheet: { ...sheet, notes },
    privateFile: {
      ...privateFile,
      pool: {
        depth: POOL_DEPTH,
        policies: policies.map((policy) => policy.id),
        probePerPolicy,
        probeRanks: [PROBE_RANKS[0], PROBE_RANKS[1]],
        appendedAfterLabelling: labellingStarted && newPaths.length > 0,
        createdAt: (options.now ?? new Date()).toISOString(),
      },
      entries,
    },
    added: newPaths.map((path) => ids.get(path) as string),
    warnings,
  };
}
