/**
 * Synthetic vault generator (spec 1.3 f4, §4.1): a pure function from
 * (seed, tier) to a file map. Deterministic — same seed, byte-identical
 * vault. Shape calibrated against the maintainer's real vaults (~20%
 * compiled / ~80% user-tier), with both graphs the engine actually walks:
 * body wikilinks AND frontmatter `sources:` edges (the
 * applySourceGraphBoost precondition).
 */

export type Tier = 'small' | 'medium' | 'large';

export const TIER_PAGES: Record<Tier, number> = { small: 100, medium: 1000, large: 5000 };

/** Compiled share of total pages — a parameter, not a constant of nature (§4.1). */
export const COMPILED_SHARE = 0.2;

const COMPILED_DIRS = ['entities', 'concepts', 'comparisons', 'queries'] as const;
const DIR_TYPE: Record<(typeof COMPILED_DIRS)[number], string> = {
  entities: 'Entity',
  concepts: 'Concept',
  comparisons: 'Comparison',
  queries: 'Query',
};
const USER_DIRS = ['Idea', 'Projects', 'inbox'] as const;

const DOMAINS = ['logistics', 'infra', 'research', 'product', 'ops'];

// Topic words seed titles and bodies so the runner's fixed questions have
// real matches (§4.2: a benchmark that measures failed queries measures
// nothing). en and zh banks are both load-bearing — CJK bigram behavior is
// part of query cost.
const EN_TOPICS = [
  'battery', 'routing', 'scheduler', 'telemetry', 'failover',
  'throughput', 'checkpoint', 'quorum', 'backpressure', 'retry',
];
const ZH_TOPICS = ['电池', '路由', '调度', '遥测', '容灾', '吞吐', '检查点', '仲裁', '背压', '重试'];

// Sentence templates carry {t} (topic) and {w} (procedural word) slots. The
// {w} slots exist because vocabulary diversity is a measured cost: real
// pages average ~282 unique ASCII tokens; a fixed sentence bank alone
// averaged 51, making parsing unrealistically cheap (acceptance round 2).
const EN_SENTENCES = [
  'The {t} subsystem run {w} degrades gracefully under sustained load once {w} exceeds the {w} watermark.',
  'We compared {t} strategies across {w} and {w} deployments and kept {w}.',
  'A {t} regression in {w} traced back to an unbounded {w} queue near {w}.',
  'Field notes from {w} suggest {t} tuning matters less than {w} placement against {w}.',
  'The design doc pins {t} behavior to the {w} contract; see {w} and the {w} appendix.',
  'Rollout {w} moved the {t} floor by half, with {w} flagged for the {w} review.',
  // Dense log-line shape: real notes carry identifier-heavy lines (run ids,
  // hostnames, ticket refs) that dominate unique-token counts.
  'Run log {w}: {w} {w} {w} {w} ({t} via {w}, cf {w} and {w}).',
];
const ZH_SENTENCES = [
  '关于{t}的取舍记录在设计笔记里,倾向最简单的方案。',
  '{t}在高负载下的表现比预期稳定,但需要持续观察。',
  '上次事故的根因与{t}配置有关,已经写入复盘。',
  '团队对{t}的长期方向还有分歧,先按现状运行。',
];

/**
 * Share of zh sentences in bodies. Calibrated at acceptance round 2: bytes
 * and characters are different work — real pages average ~7.2k chars for
 * ~7.7 KiB (mostly ASCII, bytes/chars ≈ 1.07); a CJK-heavy filler hit the
 * same bytes with ~5k chars. ~8% zh sentences lands the ratio near real.
 */
const ZH_SENTENCE_SHARE = 0.08;

/**
 * Non-markdown tree density (acceptance round 2): the real 1,129-page
 * workspace's visible tree holds 30,892 non-markdown entries (~27 per md
 * page) — attachments, exports, assets. scanVault stats every entry it
 * walks, so traversal is a real cost the synthetic tree must carry. The
 * files are empty: only their tree entries matter.
 */
export const NON_MD_PER_PAGE = 27;
const ASSET_EXTS = ['png', 'jpg', 'pdf', 'xlsx', 'webp', 'svg'];

// Procedural vocabulary: syllable-composed words from the seeded PRNG give
// each page its own vocabulary pool without a shipped word list.
const SYLLABLES = [
  'ka', 'ro', 'mi', 'ten', 'sol', 'var', 'dex', 'lum', 'tri', 'qua',
  'zen', 'fol', 'gar', 'nim', 'pex', 'rud', 'sib', 'tor', 'ul', 'vek',
];
function proceduralWord(rand: () => number): string {
  const parts = 2 + Math.floor(rand() * 3);
  let word = '';
  for (let i = 0; i < parts; i++) word += SYLLABLES[Math.floor(rand() * SYLLABLES.length)];
  return word;
}

/** mulberry32 — tiny, dependency-free, deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from the seeded PRNG. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Page-size sampler, calibrated at acceptance (spec 1.3 f4, findings §6):
 * real scannable content averages ~7.7 KiB/page (Jay WorkSpace, 1,129
 * pages) vs the uncalibrated generator's 667 B — an 11.5× gap that made
 * the first envelope numbers unrepresentative by ~9×. Log-normal:
 * median ~5 KiB, mean ~7.7 KiB, capped at 64 KiB — many short notes, a
 * few long ones, like a real vault.
 */
const PAGE_BYTES_MU = 8.54;
const PAGE_BYTES_SIGMA = 0.9;
const PAGE_BYTES_CAP = 65536;
function targetPageBytes(rand: () => number): number {
  return Math.min(PAGE_BYTES_CAP, Math.round(Math.exp(PAGE_BYTES_MU + PAGE_BYTES_SIGMA * gaussian(rand))));
}

/** Zipf-ish index sampler: rank r is weighted 1/(r+1), so hubs exist. */
function zipfIndex(rand: () => number, size: number): number {
  if (size <= 0) return 0;
  let total = 0;
  for (let i = 0; i < size; i++) total += 1 / (i + 1);
  let target = rand() * total;
  for (let i = 0; i < size; i++) {
    target -= 1 / (i + 1);
    if (target <= 0) return i;
  }
  return size - 1;
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function sentence(rand: () => number, topic: string, zhTopic: string, pool: string[]): string {
  if (rand() < ZH_SENTENCE_SHARE) return pick(rand, ZH_SENTENCES).replace('{t}', zhTopic);
  // Half the word slots mint a fresh word rather than reusing the page pool:
  // pool-only draws saturate on repeats and undershoot the real ~282 unique
  // tokens per page; all-fresh overshoots and defeats term reuse. The mix
  // is pinned by the vocabulary-diversity assertion.
  return pick(rand, EN_SENTENCES)
    .replace('{t}', topic)
    .replace(/\{w\}/g, () => (rand() < 0.5 ? proceduralWord(rand) : pool[Math.floor(rand() * pool.length)]));
}

/**
 * Appends sentence paragraphs until the page reaches its sampled byte
 * size, drawing {w} words from a per-page procedural pool sized to the
 * page (≈ bytes/30) — bigger pages carry more vocabulary, like real notes.
 */
function fillToTarget(rand: () => number, lines: string[], targetBytes: number): string {
  const poolSize = Math.min(800, Math.max(40, Math.round(targetBytes / 18)));
  const pool: string[] = [];
  for (let i = 0; i < poolSize; i++) pool.push(proceduralWord(rand));

  let content = lines.join('\n');
  let bytes = Buffer.byteLength(content, 'utf8');
  while (bytes < targetBytes) {
    const t = zipfIndex(rand, EN_TOPICS.length);
    const paragraph = `\n${sentence(rand, EN_TOPICS[t], ZH_TOPICS[t], pool)}\n`;
    content += paragraph;
    bytes += Buffer.byteLength(paragraph, 'utf8');
  }
  return content;
}

export interface GeneratedVault {
  /** Relative path → file content. Deterministic iteration order. */
  files: Map<string, string>;
  compiledPaths: string[];
  userPaths: string[];
  /** Frontmatter sources: edges as [compiledPath, userPath] pairs. */
  sourceEdges: Array<[string, string]>;
}

export function generateVault(seed: number, tier: Tier): GeneratedVault {
  const rand = mulberry32(seed);
  const total = TIER_PAGES[tier];
  const compiledCount = Math.round(total * COMPILED_SHARE);
  const userCount = total - compiledCount;

  const files = new Map<string, string>();
  const compiledPaths: string[] = [];
  const userPaths: string[] = [];
  const compiledTitles: string[] = [];
  const sourceEdges: Array<[string, string]> = [];

  // User-tier notes first: sources: edges need existing targets.
  for (let i = 0; i < userCount; i++) {
    const dir = USER_DIRS[i % USER_DIRS.length];
    const topicIdx = zipfIndex(rand, EN_TOPICS.length);
    const path = `${dir}/note-${i}.md`;
    const lines: string[] = [];
    if (rand() < 0.5) {
      lines.push('---', `title: Note ${i} on ${EN_TOPICS[topicIdx]}`, '---', '');
    }
    lines.push(`# Note ${i}`, '');
    files.set(path, fillToTarget(rand, lines, targetPageBytes(rand)));
    userPaths.push(path);
  }

  for (let i = 0; i < compiledCount; i++) {
    const dir = COMPILED_DIRS[i % COMPILED_DIRS.length];
    const topicIdx = zipfIndex(rand, EN_TOPICS.length);
    const topic = EN_TOPICS[topicIdx];
    const zhTopic = ZH_TOPICS[topicIdx];
    // Bilingual titles, mirroring real cooked pages — and giving the zh
    // question the title-field hits the confidence gate needs (a benchmark
    // that measures abstentions measures nothing).
    const title = `${topic} ${zhTopic} ${dir.slice(0, -1)} ${i}`;
    const path = `${dir}/${topic}-${dir.slice(0, -1)}-${i}.md`;

    // sources: edges — Zipf-drawn so hub notes are cited by many pages,
    // mirroring real cook behavior. These are the edges the engine's
    // source-graph boost resolves; without them the benchmark would skip
    // the main graph computation (§4.1).
    const sourceCount = 1 + Math.floor(rand() * 3);
    const sources = new Set<string>();
    for (let s = 0; s < sourceCount; s++) sources.add(userPaths[zipfIndex(rand, userPaths.length)]);
    for (const source of sources) sourceEdges.push([path, source]);

    const outlinkCount = 2 + Math.floor(rand() * 5);
    const outlinks = new Set<string>();
    for (let o = 0; o < outlinkCount && compiledTitles.length > 0; o++) {
      outlinks.add(compiledTitles[zipfIndex(rand, compiledTitles.length)]);
    }

    const bodyLines = [`# ${title}`, ''];
    if (outlinks.size > 0) {
      bodyLines.push(`Related: ${[...outlinks].map((l) => `[[${l}]]`).join(', ')}`, '');
    }

    const frontmatter = [
      '---',
      `type: ${DIR_TYPE[dir]}`,
      `title: ${title}`,
      `description: How ${topic} behaves in the ${pick(rand, DOMAINS)} context (${zhTopic})`,
      `domain: ${pick(rand, DOMAINS)}`,
      `created: 2026-0${1 + (i % 6)}-1${i % 9}`,
      'sources:',
      ...[...sources].map((source) => `  - ${source}`),
      '---',
      '',
    ];
    const skeleton = `${frontmatter.join('\n')}${bodyLines.join('\n')}`;
    files.set(path, fillToTarget(rand, [skeleton], targetPageBytes(rand)));
    compiledPaths.push(path);
    compiledTitles.push(title);
  }

  files.set('KNOWLEDGE.md', '# Synthetic KB\n\nGenerated by evals/perf (seeded, deterministic).\n');

  // The non-markdown tree (empty files; the walk stats every entry). 80%
  // under attachment subdirectories, 20% scattered next to the notes —
  // roughly how real vaults accumulate assets.
  const nonMdCount = total * NON_MD_PER_PAGE;
  for (let i = 0; i < nonMdCount; i++) {
    const ext = ASSET_EXTS[i % ASSET_EXTS.length];
    const path = i % 5 === 4
      ? `${USER_DIRS[i % USER_DIRS.length]}/asset-${i}.${ext}`
      : `attachments/d${i % 50}/asset-${i}.${ext}`;
    files.set(path, '');
  }

  return { files, compiledPaths, userPaths, sourceEdges };
}

/**
 * The runner's fixed questions (§4.2) — drawn from the topic banks so
 * matches exist. Each is its own measured series with its own median.
 */
export const QUERY_QUESTIONS = {
  en: 'how does the scheduler handle backpressure under load',
  // Contiguous zh, kept short: long zh sentences shed noise bigrams that
  // dilute term coverage below the abstention gate even when strong
  // matches exist — a benchmark that measures abstentions measures nothing.
  zh: '背压的复盘与取舍',
  mixed: 'battery checkpoint 容灾 复盘',
} as const;
