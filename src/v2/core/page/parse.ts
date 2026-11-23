import {
  isMap,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node,
} from 'yaml';
import {
  KF_SCHEMA,
  type HistoryEvent,
  type PageStatus,
  type PageType,
  type RelationType,
  type RuleCode,
  type SectionName,
} from '../../schema/kf-2.0';
import type {
  Claim,
  EvidenceBlock,
  Frontmatter,
  FrontmatterValue,
  HistoryEntry,
  OpenItem,
  PageLink,
  PageProblem,
  PageSection,
  ParsedPage,
  ScalarValue,
  SourceEntry,
  TitleLine,
} from './model';

const SLUG_RE = /^[\p{Ll}\p{Lo}\p{N}]+(-[\p{Ll}\p{Lo}\p{N}]+)*$/u;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLAIM_ID_RE = /^c([1-9][0-9]*)$/;
const SOURCE_KEY_RE = /^s([1-9][0-9]*)$/;
const SOURCE_LINE_RE = /^- (s[1-9][0-9]*) · `([^`]+)` · sha256:([0-9a-f]{64}) · (.+)$/;
const EVENT_LINE_RE = /^- (\d{4}-\d{2}-\d{2}) · ([a-z]+) · by (.+)$/;

const PAGE_TYPE_SET = new Set<string>(Object.keys(KF_SCHEMA.page_types));
const STATUS_SET = new Set<string>(KF_SCHEMA.statuses);
const RELATION_KEYS = Object.keys(KF_SCHEMA.relations) as RelationType[];
const RELATION_SET = new Set<string>(RELATION_KEYS);
const SECTION_ORDER: readonly SectionName[] = KF_SCHEMA.sections;
const SECTION_INDEX = new Map<string, number>(SECTION_ORDER.map((name, index) => [name, index]));
const HISTORY_EVENT_SET = new Set<string>(KF_SCHEMA.history_events);

const FORMAT_EXTS: Record<(typeof KF_SCHEMA.quote_required_formats)[number], string[]> = {
  pdf: ['.pdf'],
  docx: ['.docx'],
  markdown: ['.md', '.markdown'],
  txt: ['.txt'],
};
const QUOTE_REQUIRED_EXTS = new Set<string>(
  KF_SCHEMA.quote_required_formats.flatMap((format) => FORMAT_EXTS[format]),
);

const KNOWN_FRONTMATTER_KEYS = new Set<string>([
  ...KF_SCHEMA.required_fields,
  ...KF_SCHEMA.optional_fields,
  ...RELATION_KEYS,
]);

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function isValidCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function slugFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.toLowerCase().endsWith('.md') ? base.slice(0, -3) : base;
}

function isScalarValue(value: unknown): value is ScalarValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function extractNodeValue(node: Node | null): { ok: true; value: FrontmatterValue } | { ok: false } {
  if (node === null) return { ok: true, value: null };
  if (isScalar(node)) {
    const val: unknown = node.value;
    if (isScalarValue(val)) return { ok: true, value: val };
    return { ok: false };
  }
  if (isSeq(node)) {
    const items: ScalarValue[] = [];
    for (const item of node.items) {
      if (!isScalar(item)) return { ok: false };
      const val: unknown = item.value;
      if (!isScalarValue(val)) return { ok: false };
      items.push(val);
    }
    return { ok: true, value: items };
  }
  return { ok: false };
}

function parseSourceKeyList(raw: string): string[] | null {
  const parts = raw.split(/,\s*/);
  if (parts.length === 0) return null;
  for (const part of parts) {
    if (!SOURCE_KEY_RE.test(part)) return null;
  }
  return parts;
}

function isExternalTarget(target: string): boolean {
  return /^(?:https?|mailto):/i.test(target);
}

function hasInvalidSourcePath(sourcePath: string): boolean {
  if (sourcePath.startsWith('/')) return true;
  if (sourcePath.includes('\\')) return true;
  if (sourcePath.startsWith('wiki/') || sourcePath === 'wiki') return true;
  if (sourcePath.startsWith('.knowlery/') || sourcePath === '.knowlery') return true;
  const segments = sourcePath.split('/');
  return segments.some((segment) => segment === '..');
}

function needsQuote(sourcePath: string): boolean {
  const lower = sourcePath.toLowerCase();
  for (const ext of QUOTE_REQUIRED_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function scanInlineLinksAndWikilinks(
  lineText: string,
  lineNumber: number,
  links: PageLink[],
  addProblem: (code: RuleCode, line: number, message: string) => void,
): void {
  let i = 0;
  const len = lineText.length;

  while (i < len) {
    if (lineText[i] === '\\' && i + 1 < len) {
      i += 2;
      continue;
    }

    // Inline code span: skip everything up to the matching run of backticks.
    if (lineText[i] === '`') {
      let ticks = 1;
      while (i + ticks < len && lineText[i + ticks] === '`') ticks++;
      const closeIdx = lineText.indexOf('`'.repeat(ticks), i + ticks);
      if (closeIdx !== -1) {
        i = closeIdx + ticks;
        continue;
      }
      i += ticks;
      continue;
    }

    // Obsidian wikilink or embedded wikilink: [[...]] or ![[...]]
    if (
      (lineText[i] === '!' && lineText[i + 1] === '[' && lineText[i + 2] === '[') ||
      (lineText[i] === '[' && lineText[i + 1] === '[')
    ) {
      const isEmbed = lineText[i] === '!';
      const start = i + (isEmbed ? 3 : 2);
      const end = lineText.indexOf(']]', start);
      if (end !== -1 && end > start) {
        const inner = lineText.slice(start, end);
        addProblem(
          'wikilink_found',
          lineNumber,
          `Wikilink "${isEmbed ? '!' : ''}[[${inner}]]" is not allowed; use a Markdown link.`,
        );
        i = end + 2;
        continue;
      }
    }

    // Standard Markdown link or image: [text](target) or ![alt](target)
    if ((lineText[i] === '!' && lineText[i + 1] === '[') || lineText[i] === '[') {
      const isImage = lineText[i] === '!';
      const labelStart = i + (isImage ? 2 : 1);
      const labelEnd = findClosingBracket(lineText, labelStart);
      if (labelEnd !== -1 && lineText[labelEnd + 1] === '(') {
        const targetEnd = findClosingParen(lineText, labelEnd + 2);
        if (targetEnd !== -1) {
          const rawTarget = lineText.slice(labelEnd + 2, targetEnd).trim();
          const target = extractLinkDestination(rawTarget);
          if (target) {
            links.push({
              line: lineNumber,
              target,
              image: isImage,
              external: isExternalTarget(target),
            });
          }
          i = targetEnd + 1;
          continue;
        }
      }
    }

    i++;
  }
}

function findClosingBracket(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i++;
      continue;
    }
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function findClosingParen(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i++;
      continue;
    }
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function extractLinkDestination(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('<')) {
    const close = raw.indexOf('>');
    if (close !== -1) return raw.slice(1, close).trim();
  }
  // Drop optional title separated by whitespace.
  const spaceIdx = raw.search(/\s/);
  return spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
}

type RawSection = {
  name: SectionName;
  headingLine: number;
  lines: { line: number; text: string }[];
};

export function parsePage(text: string, fileName: string): ParsedPage {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  // Drop trailing empty line caused by final newline for line-range calculations.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const slug = slugFromFileName(fileName);
  const problems: PageProblem[] = [];
  const addProblem = (code: RuleCode, line: number, message: string): void => {
    problems.push({ code, line, message });
  };

  if (!isValidSlug(slug)) {
    addProblem('slug_invalid', 1, `Invalid page slug "${slug}".`);
  }

  const frontmatter: Frontmatter = {};
  const extra: Record<string, FrontmatterValue> = {};
  let protectedLine = 1;
  let bodyStartIdx = 0;

  // --- Frontmatter ---
  if (lines.length === 0 || lines[0] !== '---') {
    addProblem('frontmatter_invalid', 1, 'Missing YAML frontmatter block.');
  } else {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) {
      addProblem('frontmatter_invalid', 1, 'Unclosed YAML frontmatter block.');
      bodyStartIdx = 1;
    } else {
      bodyStartIdx = endIdx + 1;
      const yamlText = lines.slice(1, endIdx).join('\n');
      const lineCounter = new LineCounter();
      const doc = parseDocument(yamlText, {
        lineCounter,
        schema: 'core',
        strict: false,
      });

      if (doc.errors.length > 0) {
        addProblem('frontmatter_invalid', 1, `Invalid YAML frontmatter: ${doc.errors[0].message}`);
      } else if (!isMap(doc.contents)) {
        addProblem('frontmatter_invalid', 1, 'Frontmatter must be a YAML mapping.');
      } else {
        const seenKeys = new Set<string>();
        const keyLines = new Map<string, number>();

        for (const pair of doc.contents.items) {
          if (!isPair(pair) || !isScalar(pair.key) || typeof pair.key.value !== 'string') {
            addProblem('frontmatter_invalid', 1, 'Frontmatter keys must be strings.');
            continue;
          }
          const key = pair.key.value;
          const keyOffset = pair.key.range ? pair.key.range[0] : 0;
          const keyLine = lineCounter.linePos(keyOffset).line + 1;
          keyLines.set(key, keyLine);

          if (seenKeys.has(key)) {
            addProblem('frontmatter_invalid', keyLine, `Duplicate frontmatter key "${key}".`);
            continue;
          }
          seenKeys.add(key);

          const extracted = extractNodeValue(pair.value);
          if (!extracted.ok) {
            addProblem('frontmatter_invalid', keyLine, `Frontmatter key "${key}" must be a scalar or list of scalars.`);
            continue;
          }
          const val = extracted.value;

          if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
            extra[key] = val;
            continue;
          }

          if (key === 'type') {
            if (typeof val !== 'string' || !PAGE_TYPE_SET.has(val)) {
              addProblem('frontmatter_invalid', keyLine, `Invalid page type "${String(val)}".`);
            } else {
              frontmatter.type = val as PageType;
            }
          } else if (key === 'status') {
            if (typeof val !== 'string' || !STATUS_SET.has(val)) {
              addProblem('frontmatter_invalid', keyLine, `Invalid page status "${String(val)}".`);
            } else {
              frontmatter.status = val as PageStatus;
            }
          } else if (key === 'title' || key === 'description') {
            if (typeof val !== 'string' || val.trim() === '') {
              addProblem('frontmatter_invalid', keyLine, `Frontmatter "${key}" must be a non-empty string.`);
            } else {
              frontmatter[key] = val;
            }
          } else if (key === 'created' || key === 'updated' || key === 'as_of') {
            if (typeof val !== 'string' || !isValidCalendarDate(val)) {
              addProblem('frontmatter_invalid', keyLine, `Frontmatter "${key}" must be a valid YYYY-MM-DD date.`);
            } else {
              frontmatter[key] = val;
            }
          } else if (key === 'aliases' || key === 'tags') {
            if (!Array.isArray(val) || !val.every((item) => typeof item === 'string')) {
              addProblem('frontmatter_invalid', keyLine, `Frontmatter "${key}" must be a list of strings.`);
            } else {
              frontmatter[key] = val;
            }
          } else if (RELATION_SET.has(key)) {
            if (!Array.isArray(val) || !val.every((item) => typeof item === 'string')) {
              addProblem('frontmatter_invalid', keyLine, `Frontmatter "${key}" must be a list of slugs.`);
            } else {
              const relKey = key as RelationType;
              const validTargets: string[] = [];
              for (const target of val) {
                if (!isValidSlug(target)) {
                  addProblem('relation_invalid', keyLine, `Relation "${key}" target "${target}" is not a valid slug.`);
                } else if (target === slug) {
                  addProblem('relation_invalid', keyLine, `Relation "${key}" cannot reference the page itself ("${target}").`);
                } else {
                  validTargets.push(target);
                }
              }
              frontmatter[relKey] = validTargets;
            }
          } else if (key === 'protected') {
            protectedLine = keyLine;
            if (typeof val === 'boolean') {
              frontmatter.protected = val;
            } else if (
              Array.isArray(val) &&
              val.every((item): item is string => typeof item === 'string' && CLAIM_ID_RE.test(item))
            ) {
              frontmatter.protected = val;
            } else {
              addProblem(
                'frontmatter_invalid',
                keyLine,
                'Frontmatter "protected" must be true, false, or a list of claim ids (e.g. c1).',
              );
            }
          }
        }

        for (const required of KF_SCHEMA.required_fields) {
          if (!seenKeys.has(required)) {
            addProblem('frontmatter_invalid', 1, `Missing required frontmatter field "${required}".`);
          }
        }
      }
    }
  }

  // --- Body structure & link scanning ---
  let titleLine: TitleLine | null = null;
  const rawSections: RawSection[] = [];
  const seenSections = new Set<SectionName>();
  let lastSectionIdx = -1;
  let currentSection: RawSection | null = null;
  let skippingSection = false;

  const links: PageLink[] = [];
  let fenceChar: '`' | '~' | null = null;
  let fenceLen = 0;

  for (let i = bodyStartIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];

    // Check fenced code block open/close.
    if (fenceChar !== null) {
      const closeRe = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      if (closeRe.test(rawLine)) {
        fenceChar = null;
        fenceLen = 0;
      }
      if (currentSection && !skippingSection) {
        currentSection.lines.push({ line: lineNum, text: rawLine });
      }
      continue;
    }

    const fenceOpen = /^\s*(`{3,}|~{3,})/.exec(rawLine);
    if (fenceOpen) {
      fenceChar = fenceOpen[1][0] as '`' | '~';
      fenceLen = fenceOpen[1].length;
      if (currentSection === null && !skippingSection) {
        addProblem('section_order', lineNum, 'Unexpected content before the first section.');
      } else if (currentSection && !skippingSection) {
        currentSection.lines.push({ line: lineNum, text: rawLine });
      }
      continue;
    }

    // Outside fenced code blocks: scan inline links and wikilinks across the entire body.
    scanInlineLinksAndWikilinks(rawLine, lineNum, links, addProblem);

    // Check ## section heading.
    if (rawLine.startsWith('## ')) {
      const headingName = rawLine.slice(3).trim();
      const idx = SECTION_INDEX.get(headingName);
      if (idx === undefined) {
        addProblem('section_order', lineNum, `Unknown section "## ${headingName}".`);
        currentSection = null;
        skippingSection = true;
        continue;
      }
      const name = headingName as SectionName;
      if (seenSections.has(name)) {
        addProblem('section_order', lineNum, `Duplicate section "## ${name}".`);
        currentSection = null;
        skippingSection = true;
        continue;
      }
      if (idx < lastSectionIdx) {
        addProblem('section_order', lineNum, `Section "## ${name}" is out of order.`);
        currentSection = null;
        skippingSection = true;
        continue;
      }
      seenSections.add(name);
      lastSectionIdx = idx;
      skippingSection = false;
      currentSection = { name, headingLine: lineNum, lines: [] };
      rawSections.push(currentSection);
      continue;
    }

    if (skippingSection) {
      continue;
    }

    if (currentSection === null) {
      if (rawLine.trim() === '') continue;
      if (rawLine.startsWith('# ') && titleLine === null) {
        titleLine = { text: rawLine.slice(2).trim(), line: lineNum };
      } else {
        addProblem('section_order', lineNum, 'Only blank lines and at most one "# " title line are allowed before the first section.');
      }
      continue;
    }

    currentSection.lines.push({ line: lineNum, text: rawLine });
  }

  // Build PageSection metadata and Evidence block.
  const sections: PageSection[] = [];
  let evidence: EvidenceBlock | null = null;
  const sectionByName = new Map<SectionName, RawSection>();

  for (const sec of rawSections) {
    sectionByName.set(sec.name, sec);
    const firstLine = sec.lines.length > 0 ? sec.lines[0].line : sec.headingLine;
    const lastLine = sec.lines.length > 0 ? sec.lines[sec.lines.length - 1].line : sec.headingLine;
    sections.push({
      name: sec.name,
      heading_line: sec.headingLine,
      first_line: firstLine,
      last_line: lastLine,
    });

    if (sec.name === 'Evidence') {
      const nonEmptyIndices: number[] = [];
      for (let i = 0; i < sec.lines.length; i++) {
        if (sec.lines[i].text.trim() !== '') nonEmptyIndices.push(i);
      }
      if (nonEmptyIndices.length === 0) {
        evidence = { text: '', first_line: sec.headingLine, last_line: sec.headingLine };
      } else {
        const start = nonEmptyIndices[0];
        const end = nonEmptyIndices[nonEmptyIndices.length - 1];
        evidence = {
          text: sec.lines.slice(start, end + 1).map((item) => item.text).join('\n'),
          first_line: sec.lines[start].line,
          last_line: sec.lines[end].line,
        };
      }
    }
  }

  // --- Parse Sources first so cited keys in Current/Open/History can be validated ---
  const sources: SourceEntry[] = [];
  const definedSourceKeys = new Set<string>();
  let maxSourceNum = 0;

  const sourcesSec = sectionByName.get('Sources');
  if (sourcesSec) {
    for (const { line, text: lineText } of sourcesSec.lines) {
      if (lineText.trim() === '') continue;
      if (!lineText.startsWith('- ')) {
        addProblem('source_line_invalid', line, 'Sources section lines must start with "- ".');
        continue;
      }
      const match = SOURCE_LINE_RE.exec(lineText);
      if (!match) {
        addProblem('source_line_invalid', line, 'Malformed Sources line.');
        continue;
      }
      const key = match[1];
      const sourcePath = match[2];
      const sha256 = match[3];
      const rest = match[4];

      const keyNum = Number(key.slice(1));
      if (keyNum > maxSourceNum) maxSourceNum = keyNum;

      if (definedSourceKeys.has(key)) {
        addProblem('source_line_invalid', line, `Duplicate source key "${key}".`);
        continue;
      }

      let locator = rest;
      let quote: string | null = null;
      const quoteSepIdx = rest.indexOf(' · "');
      if (quoteSepIdx !== -1 && rest.endsWith('"')) {
        locator = rest.slice(0, quoteSepIdx);
        quote = rest.slice(quoteSepIdx + 4, -1);
      }

      if (locator.trim() === '') {
        addProblem('source_line_invalid', line, 'Source locator cannot be empty.');
        continue;
      }

      if (quote !== null && quote.length > KF_SCHEMA.quote_max_chars) {
        addProblem(
          'source_line_invalid',
          line,
          `Source quote exceeds ${KF_SCHEMA.quote_max_chars} characters (${quote.length}).`,
        );
      }

      if (hasInvalidSourcePath(sourcePath)) {
        addProblem('source_path_invalid', line, `Invalid source path "${sourcePath}".`);
      }

      if (quote === null && needsQuote(sourcePath)) {
        addProblem('quote_missing', line, `Source "${sourcePath}" requires a verbatim quote.`);
      }

      definedSourceKeys.add(key);
      sources.push({ key, path: sourcePath, sha256, locator, quote, line });
    }
  }

  // --- Parse Current claims ---
  const claims: Claim[] = [];
  const seenClaimIds = new Set<string>();
  const currentClaimIds = new Set<string>();
  let maxClaimNum = 0;

  const currentSec = sectionByName.get('Current');
  if (currentSec) {
    for (const { line, text: lineText } of currentSec.lines) {
      if (lineText.trim() === '') continue;
      if (!lineText.startsWith('- ')) {
        addProblem('claim_invalid', line, 'Current section lines must start with "- ".');
        continue;
      }
      const parsed = parseClaimBody(lineText.slice(2));
      if (!parsed.ok) {
        addProblem('claim_invalid', line, parsed.reason);
        continue;
      }
      const idNum = Number(parsed.id.slice(1));
      if (idNum > maxClaimNum) maxClaimNum = idNum;

      if (seenClaimIds.has(parsed.id)) {
        addProblem('claim_invalid', line, `Duplicate claim id "^${parsed.id}".`);
        continue;
      }
      seenClaimIds.add(parsed.id);
      currentClaimIds.add(parsed.id);

      for (const key of parsed.sources) {
        if (!definedSourceKeys.has(key)) {
          addProblem('source_line_invalid', line, `Cited source key "${key}" is not defined in ## Sources.`);
        }
      }

      claims.push({
        id: parsed.id,
        text: parsed.text,
        sources: parsed.sources,
        disputed: parsed.disputed,
        line,
      });
    }
  }

  // --- Parse Open items ---
  const open: OpenItem[] = [];
  const seenOpenIds = new Set<string>();
  let maxOpenNum = 0;

  const openSec = sectionByName.get('Open');
  if (openSec) {
    for (const { line, text: lineText } of openSec.lines) {
      if (lineText.trim() === '') continue;
      if (!lineText.startsWith('- ')) {
        addProblem('claim_invalid', line, 'Open section lines must start with "- ".');
        continue;
      }
      const parsed = parseOpenBody(lineText.slice(2));
      if (!parsed.ok) {
        addProblem('claim_invalid', line, parsed.reason);
        continue;
      }
      const idNum = Number(parsed.id.slice(1));
      if (idNum > maxOpenNum) maxOpenNum = idNum;

      if (seenOpenIds.has(parsed.id)) {
        addProblem('claim_invalid', line, `Duplicate open item id "^${parsed.id}".`);
        continue;
      }
      seenOpenIds.add(parsed.id);

      for (const key of parsed.sources) {
        if (!definedSourceKeys.has(key)) {
          addProblem('source_line_invalid', line, `Cited source key "${key}" is not defined in ## Sources.`);
        }
      }

      open.push({
        id: parsed.id,
        text: parsed.text,
        about: parsed.about,
        sources: parsed.sources,
        line,
      });
    }
  }

  // --- Parse History ---
  const history: HistoryEntry[] = [];
  const pendingSuccessors: { successor: string; line: number }[] = [];

  const historySec = sectionByName.get('History');
  if (historySec) {
    for (const { line, text: lineText } of historySec.lines) {
      if (lineText.trim() === '') continue;
      if (!lineText.startsWith('- ')) {
        addProblem('history_invalid', line, 'History section lines must start with "- ".');
        continue;
      }

      const eventMatch = EVENT_LINE_RE.exec(lineText);
      if (eventMatch) {
        const date = eventMatch[1];
        const event = eventMatch[2];
        const rest = eventMatch[3];
        if (!isValidCalendarDate(date)) {
          addProblem('history_invalid', line, `Invalid history date "${date}".`);
          continue;
        }
        if (!HISTORY_EVENT_SET.has(event)) {
          addProblem('history_invalid', line, `Unknown history event "${event}".`);
          continue;
        }
        let actor = rest;
        let note: string | null = null;
        const sepIdx = rest.indexOf(' · ');
        if (sepIdx !== -1) {
          actor = rest.slice(0, sepIdx).trim();
          note = rest.slice(sepIdx + 3).trim();
          if (note === '') {
            addProblem('history_invalid', line, 'History event note cannot be empty after separator.');
            continue;
          }
        } else {
          actor = actor.trim();
        }
        if (!actor) {
          addProblem('history_invalid', line, 'History event actor cannot be empty.');
          continue;
        }
        history.push({
          kind: 'event',
          date,
          event: event as HistoryEvent,
          actor,
          note,
          line,
        });
        continue;
      }

      const histClaim = parseHistoryClaim(lineText.slice(2));
      if (!histClaim.ok) {
        addProblem('history_invalid', line, histClaim.reason);
        continue;
      }

      const idNum = Number(histClaim.id.slice(1));
      if (idNum > maxClaimNum) maxClaimNum = idNum;

      if (seenClaimIds.has(histClaim.id)) {
        addProblem('claim_invalid', line, `Duplicate claim id "^${histClaim.id}".`);
        continue;
      }
      seenClaimIds.add(histClaim.id);

      for (const key of histClaim.sources) {
        if (!definedSourceKeys.has(key)) {
          addProblem('source_line_invalid', line, `Cited source key "${key}" is not defined in ## Sources.`);
        }
      }

      if (histClaim.successor !== null) {
        pendingSuccessors.push({ successor: histClaim.successor, line });
      }

      history.push({
        kind: 'claim',
        outcome: histClaim.outcome,
        id: histClaim.id,
        text: histClaim.text,
        sources: histClaim.sources,
        date: histClaim.date,
        successor: histClaim.successor,
        reason: histClaim.reason,
        line,
      });
    }
  }

  // Validate superseded claim successors exist somewhere in the page (Current or History).
  for (const { successor, line } of pendingSuccessors) {
    if (!seenClaimIds.has(successor)) {
      addProblem('history_invalid', line, `Successor claim "^${successor}" does not exist in this page.`);
    }
  }

  // Validate frontmatter.protected claim ids are present in ## Current.
  if (Array.isArray(frontmatter.protected)) {
    for (const claimId of frontmatter.protected) {
      if (!currentClaimIds.has(claimId)) {
        addProblem('protect_invalid', protectedLine, `Protected claim "${claimId}" is not in ## Current.`);
      }
    }
  }

  problems.sort((a, b) => a.line - b.line);

  return {
    slug,
    frontmatter,
    extra,
    title_line: titleLine,
    sections,
    claims,
    open,
    sources,
    history,
    evidence,
    links,
    next: {
      claim: `c${maxClaimNum + 1}`,
      open: `q${maxOpenNum + 1}`,
      source: `s${maxSourceNum + 1}`,
    },
    problems,
  };
}

function parseClaimBody(
  body: string,
): { ok: true; id: string; text: string; sources: string[]; disputed: boolean } | { ok: false; reason: string } {
  const idMatch = /\s+\^(c[1-9][0-9]*)$/.exec(body);
  if (!idMatch) {
    return { ok: false, reason: 'Claim must end with a valid id "^c<N>".' };
  }
  const id = idMatch[1];
  let rest = body.slice(0, idMatch.index);

  let disputed = false;
  // Check for trailing #tags before ^c<N>.
  const tagRe = /\s+(#[^\s]+)$/;
  let tagMatch = tagRe.exec(rest);
  while (tagMatch) {
    const tag = tagMatch[1];
    if (tag !== '#disputed') {
      return { ok: false, reason: `Unsupported claim tag "${tag}"; only #disputed is allowed.` };
    }
    if (disputed) {
      return { ok: false, reason: 'Duplicate #disputed tag on claim.' };
    }
    disputed = true;
    rest = rest.slice(0, tagMatch.index);
    tagMatch = tagRe.exec(rest);
  }

  const srcMatch = /\s+\(src:\s*([^)]+)\)$/.exec(rest);
  if (!srcMatch) {
    return { ok: false, reason: 'Claim must include a source list "(src: s<N>, ...)".' };
  }
  const sources = parseSourceKeyList(srcMatch[1].trim());
  if (!sources) {
    return { ok: false, reason: `Invalid source key list "${srcMatch[1].trim()}".` };
  }

  const claimText = rest.slice(0, srcMatch.index).trim();
  if (!claimText) {
    return { ok: false, reason: 'Claim text cannot be empty.' };
  }

  return { ok: true, id, text: claimText, sources, disputed };
}

function parseOpenBody(
  body: string,
): { ok: true; id: string; text: string; about: string[]; sources: string[] } | { ok: false; reason: string } {
  const idMatch = /\s+\^(q[1-9][0-9]*)$/.exec(body);
  if (!idMatch) {
    return { ok: false, reason: 'Open item must end with a valid id "^q<N>".' };
  }
  const id = idMatch[1];
  let rest = body.slice(0, idMatch.index);

  let sources: string[] = [];
  const srcMatch = /\s+\(src:\s*([^)]+)\)$/.exec(rest);
  if (srcMatch) {
    const parsedSources = parseSourceKeyList(srcMatch[1].trim());
    if (!parsedSources) {
      return { ok: false, reason: `Invalid source key list "${srcMatch[1].trim()}".` };
    }
    sources = parsedSources;
    rest = rest.slice(0, srcMatch.index);
  }

  let about: string[] = [];
  const aboutMatch = /\s+about\s+(\^c[1-9][0-9]*(?:,\s*\^c[1-9][0-9]*)*)$/.exec(rest);
  if (aboutMatch) {
    about = aboutMatch[1].split(/,\s*/).map((token) => token.slice(1));
    rest = rest.slice(0, aboutMatch.index);
  }

  const openText = rest.trim();
  if (!openText) {
    return { ok: false, reason: 'Open item text cannot be empty.' };
  }

  return { ok: true, id, text: openText, about, sources };
}

function parseHistoryClaim(
  body: string,
):
  | {
      ok: true;
      outcome: 'superseded' | 'retired';
      id: string;
      text: string;
      sources: string[];
      date: string;
      successor: string | null;
      reason: string | null;
    }
  | { ok: false; reason: string } {
  const idMatch = /\s+\^(c[1-9][0-9]*)$/.exec(body);
  if (!idMatch) {
    return { ok: false, reason: 'Unrecognized history line.' };
  }
  const id = idMatch[1];
  const beforeId = body.slice(0, idMatch.index);

  const sepIdx = beforeId.indexOf(' · ');
  if (sepIdx === -1) {
    return { ok: false, reason: 'History claim line missing " · " metadata.' };
  }

  const claimPart = beforeId.slice(0, sepIdx);
  const metaPart = beforeId.slice(sepIdx + 3);

  const srcMatch = /\s+\(src:\s*([^)]+)\)$/.exec(claimPart);
  if (!srcMatch) {
    return { ok: false, reason: 'History claim line missing "(src: ...)" list.' };
  }
  const sources = parseSourceKeyList(srcMatch[1].trim());
  if (!sources) {
    return { ok: false, reason: `Invalid source key list "${srcMatch[1].trim()}".` };
  }
  const claimText = claimPart.slice(0, srcMatch.index).trim();
  if (!claimText) {
    return { ok: false, reason: 'History claim text cannot be empty.' };
  }

  // Superseded: superseded YYYY-MM-DD by ^c<N>[ · <reason>]
  const supMatch = /^superseded (\d{4}-\d{2}-\d{2}) by \^(c[1-9][0-9]*)(?: · (.+))?$/.exec(metaPart);
  if (supMatch) {
    const date = supMatch[1];
    const successor = supMatch[2];
    const reason = supMatch[3] !== undefined ? supMatch[3].trim() : null;
    if (!isValidCalendarDate(date)) {
      return { ok: false, reason: `Invalid superseded date "${date}".` };
    }
    if (reason !== null && reason === '') {
      return { ok: false, reason: 'Superseded reason cannot be empty.' };
    }
    return {
      ok: true,
      outcome: 'superseded',
      id,
      text: claimText,
      sources,
      date,
      successor,
      reason,
    };
  }

  // Retired: retired YYYY-MM-DD · <reason>
  const retMatch = /^retired (\d{4}-\d{2}-\d{2}) · (.+)$/.exec(metaPart);
  if (retMatch) {
    const date = retMatch[1];
    const reason = retMatch[2].trim();
    if (!isValidCalendarDate(date)) {
      return { ok: false, reason: `Invalid retired date "${date}".` };
    }
    if (!reason) {
      return { ok: false, reason: 'Retired claim requires a non-empty reason.' };
    }
    return {
      ok: true,
      outcome: 'retired',
      id,
      text: claimText,
      sources,
      date,
      successor: null,
      reason,
    };
  }

  return { ok: false, reason: 'Unrecognized history claim metadata.' };
}
