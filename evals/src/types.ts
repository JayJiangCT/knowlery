export type GoldenCategory =
  | 'entity-lookup'
  | 'concept-lookup'
  | 'synthesis'
  | 'alias'
  | 'bilingual'
  | 'bundle'
  | 'user-note'
  | 'unanswerable';

export const GOLDEN_CATEGORIES: GoldenCategory[] = [
  'entity-lookup',
  'concept-lookup',
  'synthesis',
  'alias',
  'bilingual',
  'bundle',
  'user-note',
  'unanswerable',
];

export interface GoldenCase {
  id: string;
  question: string;
  expected: { must: string[]; nice?: string[] };
  category: GoldenCategory;
  notes?: string;
}

/** agent = the four compiled-knowledge dirs; bundle = matched via agent-index (2e);
 *  user = everything else, including Library/ pages reached only by fallback search (2f). */
export type SourceTier = 'agent' | 'bundle' | 'user';

export interface RankedPage {
  path: string;
  score: number;
  tier: SourceTier;
}

export interface FixturePage {
  path: string;
  title: string;
  type?: string;
  tags: string[];
  aliases: string[];
  status?: string;
  created?: string;
  updated?: string;
  tier: Exclude<SourceTier, 'bundle'>;
  /** Raw frontmatter, used for minimum-core validation. */
  raw: Record<string, unknown>;
  /** Lowercased title + aliases + tags + basename + body. */
  searchText: string;
  /** Whole-word occurrence counts for latin/numeric tokens of searchText. */
  latinCounts: Map<string, number>;
}

export interface BundleIndexEntry {
  /** Vault-relative path: Library/<id>/<concept.path>. */
  path: string;
  title: string;
  searchText: string;
  latinCounts: Map<string, number>;
}

export interface FixtureBundle {
  id: string;
  title: string;
  libraryPath: string;
  entries: BundleIndexEntry[];
}

export interface FixtureVault {
  root: string;
  pages: FixturePage[];
  bundles: FixtureBundle[];
}

export interface Retriever {
  name: string;
  retrieve(question: string, vault: FixtureVault, k: number): RankedPage[];
}

export interface CaseResult {
  id: string;
  category: GoldenCategory;
  question: string;
  top: string[];
  recallAt5: number | null;
  recallAt10: number | null;
  reciprocalRank: number | null;
  unanswerableCorrect: boolean | null;
  missedMust: string[];
}

export interface EvalAggregate {
  cases: number;
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
  unanswerableAccuracy: number | null;
}

export interface EvalReport {
  retriever: string;
  generatedAt: string;
  k: number;
  aggregate: EvalAggregate;
  perCategory: Record<string, EvalAggregate>;
  perQuestion: CaseResult[];
}

export interface BaselineFile extends EvalReport {
  /** Allowed drop in aggregate recall@10 / MRR before --assert-baseline fails. */
  tolerance: number;
}
