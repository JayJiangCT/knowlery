import type { RiskHint } from '../../types';
import type { PageRecord, RawDependency } from './shared';
import { normalizeItemText } from './shared';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /https?:\/\/[^\s)]+/gi;
const SENSITIVE_HOST_RE = /(^|\.)((atlassian\.net)|(slack\.com)|(docs\.google\.com)|(notion\.so)|jira\.)/i;
const MEETING_PATH_RE = /(meeting|1on1|1-1|interview|standup)/i;

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
