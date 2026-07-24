import type { RiskHint } from '../../types';
import type { PageRecord, RawDependency } from './shared';
import { normalizeItemText } from './shared';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /https?:\/\/[^\s)]+/gi;
const SENSITIVE_HOST_RE = /(^|\.)((atlassian\.net)|(slack\.com)|(docs\.google\.com)|(notion\.so)|jira\.)/i;
const MEETING_PATH_RE = /(meeting|1on1|1-1|interview|standup)/i;

/**
 * Highest-cost-if-public patterns (spec 0.9 f2, §4.4). Deliberately conservative:
 * a missed secret is bad, but training users to ignore warnings is worse.
 */
const CREDENTIAL_RES: RegExp[] = [
  /\bghp_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[bpars]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const PRIVATE_IP_RE = /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/;
// CN mobile shape only — generic international patterns false-positive too
// aggressively (spec: recorded limitation over guessed coverage).
const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/;

/**
 * Indirect-prompt-injection shapes (spec 1.3 f3, §4.2). Every hit is a hint
 * for a human, never an automated block, so noise is survivable — but each
 * pattern still targets the *imperative use* of a redirection, not prose
 * about one. False-positive stance per boundary: creator-side this inherits
 * the credential scan's conservatism (same channel, same alert-fatigue
 * economics); consumer-side (bundle install) the same list is acceptable
 * even when noisy, because an install is a rare, deliberate act of importing
 * someone else's text and a false positive costs one glance at an evidence
 * line — a deliberate fork, both tolerances justified here.
 */
const INSTRUCTION_LIKE_RES: RegExp[] = [
  // The classic injection preamble: an imperative to drop prior instructions.
  /\b(ignore|disregard|forget)\s+(all\s+|any\s+)?(your\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|directives?)/i,
  // Role reassignment scaffolding — text claiming authority to redefine the agent.
  /\byou\s+are\s+now\s+(a|an|the|in|no\s+longer)\b/i,
  // System-prompt exfiltration: an imperative to reveal hidden instructions.
  /\b(reveal|show|print|output|repeat|display)\b[^.\n]{0,40}\b(system\s+prompt|initial\s+instructions|hidden\s+instructions)/i,
  // Concealment directive — the tell of an instruction meant for the agent, not the reader.
  /\bdo\s+not\s+(tell|inform|alert|notify|warn)\s+the\s+user\b/i,
  // zh redirection imperative (mirror of the first pattern).
  /(无视|忽略|忘记|忘掉)(之前|以上|上述|先前|所有)[^。\n]{0,10}(指令|提示|规则|设定|要求)/,
  // zh concealment directive.
  /不要(告诉|通知|提醒|警告)用户/,
];

/**
 * Mention-vs-use heuristic (spec 1.3 f3, §5.1): a match inside an inline code
 * span or quotation marks on the same line is *prose about* an injection —
 * the standard convention for quoting an attack in a security note — and must
 * not fire. Deterministic and documented; an attacker who quotes their own
 * payload has at least made it legible as a quotation.
 */
const QUOTED_SPAN_RES = [/`[^`]*`/g, /"[^"]*"/g, /\u201C[^\u201D]*\u201D/g, /「[^」]*」/g];

/**
 * Shared text-level primitive for the `instruction-like` risk kind — both
 * trust boundaries (export review and bundle install) run this identical
 * scan. Returns one evidence line per matched line, first match per line.
 */
export function scanInstructionLike(text: string): string[] {
  const evidence: string[] = [];
  for (const line of text.split('\n')) {
    const quotedRanges: Array<[number, number]> = [];
    for (const quotedRe of QUOTED_SPAN_RES) {
      for (const span of line.matchAll(quotedRe)) {
        quotedRanges.push([span.index, span.index + span[0].length]);
      }
    }
    for (const instructionRe of INSTRUCTION_LIKE_RES) {
      const match = line.match(instructionRe);
      if (!match || match.index === undefined) continue;
      const inQuote = quotedRanges.some(([start, end]) => match.index! >= start && match.index! < end);
      if (inQuote) continue;
      evidence.push(truncateEvidence(line.trim()));
      break;
    }
  }
  return evidence;
}

function truncateEvidence(line: string): string {
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

export function scanRisks(input: { pages: PageRecord[]; rawDependencies: RawDependency[] }): RiskHint[] {
  const hints: RiskHint[] = [];

  for (const page of input.pages) {
    const text = `${normalizeItemText(page.frontmatter)}\n${page.body}`;
    addTextRisks(hints, page.conceptId, text);
    if (normalizeItemText(page.frontmatter.type).toLowerCase() === 'person') {
      hints.push({ itemId: page.conceptId, kind: 'person-page', evidence: 'type: person' });
    }
  }

  for (const raw of input.rawDependencies) {
    const text = `${normalizeItemText(raw.frontmatter)}\n${raw.body}`;
    addTextRisks(hints, raw.path, text);
    if (MEETING_PATH_RE.test(raw.path)) {
      hints.push({ itemId: raw.path, kind: 'meeting-like-path', evidence: raw.path });
    }
  }

  return dedupeHints(hints);
}

function addTextRisks(hints: RiskHint[], itemId: string, text: string): void {
  const email = text.match(EMAIL_RE)?.[0];
  if (email) hints.push({ itemId, kind: 'email', evidence: email });

  const urls = text.match(URL_RE) ?? [];
  const sensitive = urls.find((url) => {
    try {
      return SENSITIVE_HOST_RE.test(new URL(url).hostname);
    } catch {
      return false;
    }
  });
  if (sensitive) hints.push({ itemId, kind: 'sensitive-url', evidence: sensitive });

  for (const credentialRe of CREDENTIAL_RES) {
    const credential = text.match(credentialRe)?.[0];
    if (credential) {
      hints.push({ itemId, kind: 'credential', evidence: redactEvidence(credential) });
      break;
    }
  }

  const privateIp = text.match(PRIVATE_IP_RE)?.[0];
  if (privateIp) hints.push({ itemId, kind: 'private-ip', evidence: privateIp });

  const phone = text.match(PHONE_RE)?.[0];
  if (phone) hints.push({ itemId, kind: 'phone-number', evidence: `${phone.slice(0, 3)}****${phone.slice(7)}` });

  for (const evidence of scanInstructionLike(text)) {
    hints.push({ itemId, kind: 'instruction-like', evidence });
  }
}

/** The hint must prove the finding without repeating the secret in full. */
function redactEvidence(secret: string): string {
  if (secret.startsWith('-----BEGIN')) return secret;
  return `${secret.slice(0, 8)}…${secret.slice(-4)} (${secret.length} chars)`;
}

function dedupeHints(hints: RiskHint[]): RiskHint[] {
  const seen = new Set<string>();
  return hints.filter((hint) => {
    const key = `${hint.itemId}:${hint.kind}:${hint.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
