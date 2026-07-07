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
