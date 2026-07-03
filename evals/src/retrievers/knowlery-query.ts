import { scanVault, type VaultSnapshot } from '../../../src/core/query/scan';
import { runQuery } from '../../../src/core/query/engine';
import type { FixtureVault, RankedPage, Retriever } from '../types';

/**
 * Adapter running the real F2 engine (src/core/query/) against the eval fixture —
 * the exact code path the shipped query.mjs uses, so eval numbers describe production
 * behavior. An abstention verdict maps to an empty result list, which is how the
 * harness scores unanswerable cases.
 */

const snapshotCache = new Map<string, VaultSnapshot>();

export const knowleryQueryRetriever: Retriever = {
  name: 'knowlery-query',

  retrieve(question: string, vault: FixtureVault, k: number): RankedPage[] {
    let snapshot = snapshotCache.get(vault.root);
    if (!snapshot) {
      snapshot = scanVault(vault.root);
      snapshotCache.set(vault.root, snapshot);
    }
    const result = runQuery(question, snapshot, k);
    if (result.verdict === 'no-confident-match') return [];
    return result.candidates.map((candidate) => ({
      path: candidate.path,
      score: candidate.score,
      tier: candidate.tier,
    }));
  },
};
