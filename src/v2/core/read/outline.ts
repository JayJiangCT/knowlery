import { isObject } from '../config';
import type { Extraction, Problem, Unit } from '../extract/types';
import { parseLocator, renderPieces, resolveLocator } from '../locator';

interface SheetMeta {
  name: string;
  rows: number;
  range: string | null;
  hidden: boolean;
}

function problemSummary(problem: Problem): string {
  if (Array.isArray(problem.pages) && problem.pages.length > 0) {
    return problem.pages.map((page) => String(page)).join(',');
  }
  return problem.detail;
}

function sheetInfo(entry: unknown, units: Unit[]): SheetMeta | undefined {
  if (typeof entry === 'string') {
    const rows = units.filter((unit) => unit.kind === 'row' && unit.sheet === entry).length;
    return { name: entry, rows, range: null, hidden: false };
  }
  if (!isObject(entry) || typeof entry.name !== 'string') return undefined;
  const rows = typeof entry.rows === 'number' && Number.isSafeInteger(entry.rows) && entry.rows >= 0
    ? entry.rows
    : units.filter((unit) => unit.kind === 'row' && unit.sheet === entry.name).length;
  const range = typeof entry.range === 'string' && entry.range.length > 0 ? entry.range : null;
  const hidden = entry.hidden === true;
  return { name: entry.name, rows, range, hidden };
}

function entryLine(extraction: Extraction, locator: string, extra: string[] = []): string {
  const pieces = resolveLocator(extraction, parseLocator(locator)).pieces;
  const bytes = Buffer.byteLength(renderPieces(pieces));
  return [locator, String(bytes), ...extra].join('\t');
}

export function buildOutlineLines(extraction: Extraction): string[] {
  const { header, units } = extraction;
  if (!header) return [];
  const { format, state, meta, problems } = header;
  const lines: string[] = [
    `format ${format} · state ${state} · ${header.units} units · ${header.bytes} bytes`,
  ];
  if (typeof meta.title === 'string' && meta.title.length > 0) lines.push(`title: ${meta.title}`);
  if (typeof meta.description === 'string' && meta.description.length > 0) lines.push(`description: ${meta.description}`);
  if (format === 'csv' && Array.isArray(meta.columns)) {
    const columns = meta.columns.filter((value): value is string => typeof value === 'string');
    if (columns.length > 0) lines.push(`columns: ${columns.join('\t')}`);
  }
  for (const problem of problems) lines.push(`problem ${problem.code} ${problemSummary(problem)}`);

  const hasPathUnits = units.some((unit) => unit.kind === 'heading' || (unit.kind === 'block' && unit.path !== undefined));
  const hasLineUnits = units.some((unit) => unit.kind === 'lines');
  const hasCsvRowUnits = units.some((unit) => unit.kind === 'row' && unit.sheet === undefined);
  const hasPageUnits = units.some((unit) => unit.kind === 'block' && unit.page !== undefined);
  const hasSheetUnits = units.some((unit) => unit.kind === 'row' && unit.sheet !== undefined);

  if (hasPathUnits) {
    const topUnits = units.filter((unit) => unit.kind === 'block' && unit.path === '(top)');
    if (topUnits.length > 0) {
      lines.push(`heading (top)\t${Buffer.byteLength(renderPieces(topUnits))}`);
    }
    const seenPaths = new Set<string>();
    for (const unit of units) {
      if (unit.kind === 'heading') {
        if (seenPaths.has(unit.path)) continue;
        seenPaths.add(unit.path);
        lines.push(entryLine(extraction, `heading ${unit.path}`));
      }
    }
  }
  if (hasLineUnits && typeof meta.lines === 'number' && meta.lines >= 1) {
    const locator = `lines 1-${meta.lines}`;
    const bytes = Buffer.byteLength(renderPieces(resolveLocator(extraction, { kind: 'lines', start: 1, end: meta.lines }).pieces));
    lines.push(`${locator}\t${bytes}`);
  }
  if (hasCsvRowUnits && typeof meta.rows === 'number' && meta.rows >= 1) {
    const locator = `rows 1-${meta.rows}`;
    const bytes = Buffer.byteLength(renderPieces(resolveLocator(extraction, { kind: 'rows', start: 1, end: meta.rows }).pieces));
    lines.push(`${locator}\t${bytes}`);
  }
  if (hasPageUnits) {
    const seen = new Set<number>();
    for (const unit of units) {
      if (unit.kind === 'block' && unit.page !== undefined && !seen.has(unit.page)) {
        seen.add(unit.page);
        const pageUnits = units.filter((u) => u.kind === 'block' && u.page === unit.page);
        const bytes = Buffer.byteLength(renderPieces(pageUnits));
        lines.push(`page ${unit.page}\t${bytes}`);
      }
    }
  }
  if ((hasSheetUnits || (format === 'xlsx' && Array.isArray(meta.sheets))) && Array.isArray(meta.sheets)) {
    for (const entry of meta.sheets) {
      const sheet = sheetInfo(entry, units);
      if (!sheet) continue;
      const locator = sheet.range ? `sheet ${sheet.name}!${sheet.range}` : `sheet ${sheet.name}`;
      let pieces: Unit[];
      if (sheet.range) {
        try {
          pieces = resolveLocator(extraction, parseLocator(locator)).pieces;
        } catch {
          pieces = units.filter((unit) => unit.kind === 'row' && unit.sheet === sheet.name);
        }
      } else {
        pieces = units.filter((unit) => unit.kind === 'row' && unit.sheet === sheet.name);
      }
      const bytes = Buffer.byteLength(renderPieces(pieces));
      const fields = [locator, String(bytes), `${sheet.rows} rows`];
      if (sheet.hidden) fields.push('hidden');
      lines.push(fields.join('\t'));
    }
  }

  return lines;
}
