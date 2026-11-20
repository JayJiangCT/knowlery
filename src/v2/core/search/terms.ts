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
  raw: string;
  variants: string[];
  cjk: boolean;
}

export interface FieldText {
  lower: string;
  counts: Map<string, number>;
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

export function prefixMatches(term: string, token: string): boolean {
  if (term.length < 5 || HAS_CJK.test(term)) return false;
  const required = Math.max(4, term.length - 2);
  if (token.length < required) return false;
  let shared = 0;
  const limit = Math.min(term.length, token.length);
  while (shared < limit && term[shared] === token[shared]) shared += 1;
  return shared >= required;
}

export function tokenize(lowerText: string): string[] {
  return lowerText.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

export function countTokens(lowerText: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(lowerText)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function fieldText(text: string): FieldText {
  const lower = text.toLowerCase();
  return { lower, counts: countTokens(lower) };
}

export function countSubstring(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

export function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let bytes = 0;
  let end = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (bytes + chBytes > maxBytes) break;
    bytes += chBytes;
    end += ch.length;
  }
  return text.slice(0, end);
}
