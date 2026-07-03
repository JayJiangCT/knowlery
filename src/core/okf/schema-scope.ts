// The vault's SCHEMA.md describes the ENTIRE vault's taxonomy, so shipping it
// verbatim in a bundle would leak domains and tags unrelated to the exported
// pages. This projects a bundle-scoped copy instead: taxonomy tables filtered
// to what the bundle's pages actually use, generic convention sections kept
// verbatim, and unrecognized custom sections dropped (fail closed — when in
// doubt, leave it out of the bundle).

// Sections from the canonical template (templates.ts generateSchemaMd /
// migration.ts SCHEMA_SECTIONS) that carry no vault-specific data.
const GENERIC_SECTIONS = new Set([
  'Agent Page Conventions',
  'Frontmatter Schema',
  'Page Thresholds',
  'Custom Fields',
]);

const EMPTY_TABLE_NOTE = '_No entries from this taxonomy are used by this bundle._';

interface SchemaSection {
  name: string;
  lines: string[];
}

export function scopeSchemaToBundle(
  schemaMd: string,
  usedTags: string[],
  usedDomains: string[],
): string {
  const { preamble, sections } = splitSections(schemaMd);
  const tagKeys = new Set(usedTags.map(normalizeKey));
  const domainKeys = new Set(usedDomains.map(normalizeKey));

  const out: string[] = [
    titleLine(preamble),
    '',
    "Taxonomy and conventions scoped to this bundle's pages.",
    '',
  ];

  for (const section of sections) {
    if (section.name === 'Knowledge Domains') {
      out.push(`## ${section.name}`, '', ...domainListLines(usedDomains), '');
    } else if (section.name === 'Tag Taxonomy') {
      out.push(`## ${section.name}`, ...filterTables(section.lines, tagKeys), '');
    } else if (section.name === 'Domain Taxonomy') {
      out.push(`## ${section.name}`, ...filterTables(section.lines, domainKeys), '');
    } else if (GENERIC_SECTIONS.has(section.name)) {
      out.push(`## ${section.name}`, ...section.lines, '');
    }
    // Anything else is a vault-specific custom section: drop it.
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function splitSections(md: string): { preamble: string[]; sections: SchemaSection[] } {
  const lines = md.split('\n');
  const preamble: string[] = [];
  const sections: SchemaSection[] = [];
  let current: SchemaSection | null = null;

  for (const line of lines) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      current = { name: heading[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  for (const section of sections) trimBlankEdges(section.lines);
  return { preamble, sections };
}

function titleLine(preamble: string[]): string {
  const title = preamble.find((line) => /^# /.test(line));
  return title ?? '# Knowledge Schema';
}

function domainListLines(usedDomains: string[]): string[] {
  if (usedDomains.length === 0) {
    return ['_No domains are declared by the pages in this bundle._'];
  }
  return [...usedDomains].sort((a, b) => a.localeCompare(b)).map((domain) => `- ${domain}`);
}

// Keeps non-table lines as-is; inside markdown tables, keeps the header and
// separator rows and only the data rows whose first cell is in the allowed set.
function filterTables(lines: string[], allowed: Set<string>): string[] {
  const out: string[] = [];
  let rowIndexInTable = -1; // -1 = not in a table; 0 = header; 1 = separator; 2+ = data
  let dataRowsSeen = 0;
  let dataRowsKept = 0;

  const closeTable = () => {
    if (rowIndexInTable >= 2 && dataRowsSeen > 0 && dataRowsKept === 0) {
      out.push(EMPTY_TABLE_NOTE);
    }
    rowIndexInTable = -1;
    dataRowsSeen = 0;
    dataRowsKept = 0;
  };

  for (const line of lines) {
    if (!isTableRow(line)) {
      closeTable();
      out.push(line);
      continue;
    }

    rowIndexInTable = rowIndexInTable === -1 ? 0 : rowIndexInTable + 1;
    if (rowIndexInTable <= 1) {
      out.push(line);
      continue;
    }

    dataRowsSeen++;
    if (allowed.has(normalizeKey(firstCell(line)))) {
      dataRowsKept++;
      out.push(line);
    }
  }
  closeTable();

  return out;
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function firstCell(line: string): string {
  return line.trim().replace(/^\|/, '').split('|')[0] ?? '';
}

function normalizeKey(value: string): string {
  return value.replace(/[`*]/g, '').trim().replace(/^#/, '').toLowerCase();
}

function trimBlankEdges(lines: string[]): void {
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
}
