import type { FixtureVault, RankedPage, Retriever, SourceTier } from './types';

/**
 * Deterministic emulation of the current /ask skill's Step 2 candidate-location waterfall
 * (src/assets/skills.ts, sub-steps 2a-2f), with no LLM involvement.
 *
 * Documented approximations (spec f1, §5.3 and risk R1):
 * - `obsidian search` is approximated by case-insensitive whole-term matching over
 *   title + aliases + tags + basename + body, per-term hit counts summed. Obsidian's
 *   in-app search may rank and fuzz differently; this baseline is a stable reference
 *   point, not a fidelity claim.
 * - Query term extraction is naive by design: lowercase, split on non-alphanumerics,
 *   drop a small stopword list. No synonym or alias expansion — the current skill gives
 *   an agent no deterministic mechanism for either, and that gap is what the eval
 *   should expose for F2.
 * - Chinese text is segmented only by stripping common function words; remaining CJK
 *   runs are matched as literal substrings.
 * - Ranking follows the priority order the skill prose implies (/ask Step 3):
 *   agent pages > bundle-index matches > everything else; then `status: reviewed`
 *   first, then term-hit score, then `updated` recency, then path (stable output).
 */

const EN_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'done', 'have', 'has', 'had',
  'we', 'our', 'ours', 'us', 'i', 'my', 'you', 'your', 'he', 'she', 'it', 'its', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'whose', 'why', 'how', 'when', 'where',
  'and', 'or', 'not', 'no', 'nor', 'but', 'if', 'then', 'than', 'so',
  'of', 'for', 'in', 'on', 'at', 'to', 'by', 'with', 'from', 'about', 'into', 'over', 'under', 'between', 'out', 'up', 'down',
  'this', 'that', 'these', 'those', 'there', 'here',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
  'any', 'some', 'all', 'each', 'much', 'many', 'more', 'most', 'other',
  'as', 'also', 'just', 'only', 'very', 'too', 'own', 'same', 's', 't',
]);

const ZH_STOPWORDS = [
  '我们的', '我们', '你们', '他们', '什么时候', '什么', '怎么样', '怎么', '如何', '为什么', '哪些', '哪种', '哪个',
  '的', '了', '是', '在', '和', '与', '或', '吗', '呢', '吧', '啊', '里', '中', '对', '把', '被', '着', '过',
  '应该', '可以', '需要', '有没有', '没有', '还是', '以及', '因为', '所以', '如果', '这个', '那个', '这些', '那些',
];

const CJK_RUN = /[\u4e00-\u9fff]+/g;
const HAS_CJK = /[\u4e00-\u9fff]/;

export function extractQueryTerms(question: string): string[] {
  const lower = question.toLowerCase();
  const latin = lower
    .replace(CJK_RUN, ' ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !EN_STOPWORDS.has(token));
  const cjk = (lower.match(CJK_RUN) ?? []).flatMap(splitCjkRun);
  return [...new Set([...latin, ...cjk])];
}

function splitCjkRun(run: string): string[] {
  let marked = run;
  for (const word of ZH_STOPWORDS) marked = marked.split(word).join('\u0000');
  return marked.split('\u0000').filter((chunk) => chunk.length > 0);
}

interface Candidate extends RankedPage {
  reviewed: boolean;
  updated: string;
}

const TIER_RANK: Record<SourceTier, number> = { agent: 0, bundle: 1, user: 2 };

export const baselineRetriever: Retriever = {
  name: 'baseline-ask-step2',

  retrieve(question: string, vault: FixtureVault, k: number): RankedPage[] {
    const terms = extractQueryTerms(question);
    const byPath = new Map<string, Candidate>();

    // 2a/2b + 2d + 2f — agent pages and user notes share one lexical pass; the tier field
    // preserves the waterfall's priority (agent dirs enumerated first, broad fallback last).
    for (const page of vault.pages) {
      const score = scoreText(terms, page.searchText, page.latinCounts);
      if (score < 1) continue; // score floor: at least one query-term hit
      byPath.set(page.path, {
        path: page.path,
        score,
        tier: page.tier,
        reviewed: page.status === 'reviewed',
        updated: page.updated ?? '',
      });
    }

    // 2e — bundles: only bundles whose title/id matches a query term get their
    // agent-index read, mirroring "do not read every bundle blindly".
    for (const bundle of vault.bundles) {
      const bundleLabel = `${bundle.title} ${bundle.id}`.toLowerCase();
      const relevant = scoreText(terms, bundleLabel, countTokens(bundleLabel)) >= 1;
      if (!relevant) continue;
      for (const entry of bundle.entries) {
        const score = scoreText(terms, entry.searchText, entry.latinCounts);
        if (score < 1) continue;
        const existing = byPath.get(entry.path);
        // A bundle-index match outranks the same file found via fallback search.
        if (!existing || TIER_RANK.bundle < TIER_RANK[existing.tier]) {
          byPath.set(entry.path, {
            path: entry.path,
            score: Math.max(score, existing?.score ?? 0),
            tier: 'bundle',
            reviewed: false,
            updated: '',
          });
        }
      }
    }

    return [...byPath.values()].sort(compareCandidates).slice(0, k);
  },
};

function compareCandidates(a: Candidate, b: Candidate): number {
  if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
  if (a.reviewed !== b.reviewed) return a.reviewed ? -1 : 1;
  if (a.score !== b.score) return b.score - a.score;
  if (a.updated !== b.updated) return b.updated.localeCompare(a.updated);
  return a.path.localeCompare(b.path);
}

function scoreText(terms: string[], lowerText: string, latinCounts: Map<string, number>): number {
  let score = 0;
  for (const term of terms) {
    if (HAS_CJK.test(term)) {
      score += countSubstring(lowerText, term);
    } else {
      score += latinCounts.get(term) ?? 0;
    }
  }
  return score;
}

function countSubstring(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function countTokens(lowerText: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of lowerText.split(/[^a-z0-9]+/)) {
    if (!token) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}
