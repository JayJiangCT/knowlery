/**
 * Query term extraction for the deterministic retrieval engine (spec f2, §5.1 step 2).
 *
 * Latin text: lowercase, split on non-alphanumerics, drop stopwords, then expand each
 * term with light morphological variants (plural/singular, -ed/-ing forms sharing the
 * stem). Chinese text: strip common function words, keep remaining CJK runs as literal
 * chunks matched by substring. No synonym dictionaries and no statistical models —
 * everything here is deterministic and explainable.
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
export const HAS_CJK = /[\u4e00-\u9fff]/;

export interface QueryTerm {
  /** The term as extracted from the question. */
  raw: string;
  /** All token spellings that count as an exact match (latin only; raw included). */
  variants: string[];
  cjk: boolean;
}

export function extractQueryTerms(question: string): QueryTerm[] {
  const lower = question.toLowerCase();
  const latin = [...new Set(
    lower
      .replace(CJK_RUN, ' ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0 && !EN_STOPWORDS.has(token)),
  )];
  const cjk = [...new Set((lower.match(CJK_RUN) ?? []).flatMap(splitCjkRun))];
  return [
    ...latin.map((raw) => ({ raw, variants: [...morphologicalVariants(raw)], cjk: false })),
    ...cjk.map((raw) => ({ raw, variants: [raw], cjk: true })),
  ];
}

function splitCjkRun(run: string): string[] {
  let marked = run;
  for (const word of ZH_STOPWORDS) marked = marked.split(word).join('\u0000');
  return marked.split('\u0000').filter((chunk) => chunk.length > 0);
}

/**
 * Light, rule-based inflection set. Deliberately not a stemmer: we only generate
 * spellings whose relationship to the term is mechanical (label/labels, pick/picked),
 * so a match is always explainable.
 */
function morphologicalVariants(term: string): Set<string> {
  const variants = new Set([term]);
  variants.add(`${term}s`);
  variants.add(`${term}es`);
  if (term.length >= 4 && term.endsWith('s')) variants.add(term.slice(0, -1));
  if (term.length >= 4 && term.endsWith('y')) variants.add(`${term.slice(0, -1)}ies`);
  if (term.length >= 5 && term.endsWith('ies')) variants.add(`${term.slice(0, -3)}y`);
  if (term.endsWith('e')) {
    variants.add(`${term}d`);
    variants.add(`${term.slice(0, -1)}ing`);
  } else {
    variants.add(`${term}ed`);
    variants.add(`${term}ing`);
  }
  if (term.length >= 5 && term.endsWith('ed')) {
    variants.add(term.slice(0, -2));
    variants.add(term.slice(0, -1));
    variants.add(`${term.slice(0, -2)}ing`);
    variants.add(`${term.slice(0, -2)}s`);
  }
  if (term.length >= 6 && term.endsWith('ing')) {
    const stem = term.slice(0, -3);
    variants.add(stem);
    variants.add(`${stem}e`);
    variants.add(`${stem}ed`);
    variants.add(`${stem}s`);
  }
  return variants;
}

/**
 * Conservative abbreviation/typo tolerance for structured fields only (titles, aliases,
 * basenames). A term of length >= 5 matches a token when their common prefix covers at
 * least max(4, term.length - 2) characters and the token is at least as long as the
 * prefix — e.g. the nickname "colld" reaches "collector". Kept deliberately strict so it
 * cannot fire on short or vaguely similar words; matches earn half credit.
 */
export function prefixMatches(term: string, token: string): boolean {
  if (term.length < 5 || HAS_CJK.test(term)) return false;
  const required = Math.max(4, term.length - 2);
  if (token.length < required) return false;
  let shared = 0;
  const limit = Math.min(term.length, token.length);
  while (shared < limit && term[shared] === token[shared]) shared += 1;
  return shared >= required;
}
