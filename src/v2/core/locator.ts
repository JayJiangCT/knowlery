import { KnowleryError } from './errors';
import type { Extraction, Unit } from './extract/types';

export type Locator =
  | { kind: 'heading'; path: string }
  | { kind: 'lines' | 'rows' | 'pages'; start: number; end: number }
  | { kind: 'sheet'; sheet: string; range?: { startCol: number; startRow: number; endCol: number; endRow: number } };

function invalid(): never {
  throw new KnowleryError('invalid_selector', 'Invalid locator for this source.', 'Use a locator belonging to the source format with positive, ascending bounds.');
}
function missing(): never {
  throw new KnowleryError('not_found', 'The selected source location does not exist.', 'Choose an existing heading, sheet or range.');
}
function number(text: string): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) invalid();
  return value;
}
function column(text: string): number {
  let value = 0;
  for (const char of text) {
    value = value * 26 + char.charCodeAt(0) - 64;
    if (!Number.isSafeInteger(value)) invalid();
  }
  return value;
}
function letters(value: number): string {
  let text = '';
  while (value > 0) {
    value--;
    text = String.fromCharCode(65 + value % 26) + text;
    value = Math.floor(value / 26);
  }
  return text;
}

export function parseLocator(text: string): Locator {
  const input = text.trim();
  if (input.startsWith('heading ')) {
    const path = input.slice(8).trim();
    if (!path) invalid();
    return { kind: 'heading', path };
  }
  const numeric = /^(line|row|page)(s?) ([0-9]+)(?:-([0-9]+))?$/.exec(input);
  if (numeric) {
    if (Boolean(numeric[2]) !== Boolean(numeric[4])) invalid();
    const start = number(numeric[3]);
    const end = numeric[4] ? number(numeric[4]) : start;
    if (end < start) invalid();
    return { kind: `${numeric[1]}s` as 'lines' | 'rows' | 'pages', start, end };
  }
  if (input.startsWith('sheet ')) {
    const value = input.slice(6).trim();
    if (!value) invalid();
    const bang = value.lastIndexOf('!');
    if (bang === -1) return { kind: 'sheet', sheet: value };
    const sheet = value.slice(0, bang);
    const cells = /^([A-Za-z]+)([0-9]+)(?::([A-Za-z]+)([0-9]+))?$/.exec(value.slice(bang + 1));
    if (!sheet.trim() || !cells) invalid();
    const startCol = column(cells[1].toUpperCase());
    const startRow = number(cells[2]);
    const endCol = cells[3] ? column(cells[3].toUpperCase()) : startCol;
    const endRow = cells[4] ? number(cells[4]) : startRow;
    if (endCol < startCol || endRow < startRow) invalid();
    return { kind: 'sheet', sheet, range: { startCol, startRow, endCol, endRow } };
  }
  return invalid();
}

export function formatLocator(locator: Locator): string {
  switch (locator.kind) {
    case 'heading': return `heading ${locator.path}`;
    case 'sheet': {
      if (!locator.range) return `sheet ${locator.sheet}`;
      const { startCol, startRow, endCol, endRow } = locator.range;
      const start = `${letters(startCol)}${startRow}`;
      const end = `${letters(endCol)}${endRow}`;
      return `sheet ${locator.sheet}!${start}${start === end ? '' : `:${end}`}`;
    }
    default: return locator.start === locator.end ? `${locator.kind.slice(0, -1)} ${locator.start}` : `${locator.kind} ${locator.start}-${locator.end}`;
  }
}

export function resolveLocator(extraction: Extraction, locator: Locator): { locator: string; pieces: Unit[] } {
  const { header, units } = extraction;
  if (!header) invalid();
  let pieces: Unit[];
  let canonical = locator;
  switch (locator.kind) {
    case 'heading': {
      if (header.format !== 'markdown' && header.format !== 'docx') invalid();
      pieces = units.filter((unit) => 'path' in unit && (unit.path === locator.path || unit.path?.startsWith(`${locator.path} > `)));
      if (!pieces.length) missing();
      break;
    }
    case 'sheet': {
      if (header.format !== 'xlsx') invalid();
      const rows = units.filter((unit): unit is Unit & { kind: 'row'; sheet: string; col: number } => unit.kind === 'row' && unit.sheet === locator.sheet && unit.col !== undefined);
      const sheets = header.meta.sheets;
      const hasSheetMeta = Array.isArray(sheets) && sheets.some((entry) =>
        entry === locator.sheet || (typeof entry === 'object' && entry !== null && (entry as { name?: unknown }).name === locator.sheet),
      );
      if (!rows.length && !hasSheetMeta) missing();
      if (!locator.range) { pieces = rows; break; }
      const last = rows.reduce((max, unit) => Math.max(max, unit.row), 0);
      const { startCol, startRow, endCol } = locator.range;
      if (startRow > last) missing();
      const endRow = Math.min(locator.range.endRow, last);
      canonical = { ...locator, range: { ...locator.range, endRow } };
      pieces = [];
      for (const unit of rows) {
        if (unit.row < startRow || unit.row > endRow) continue;
        const cells = unit.text.split('\t');
        const from = Math.max(startCol, unit.col);
        const to = Math.min(endCol, unit.col + cells.length - 1);
        if (from > to) continue;
        const cut = cells.slice(from - unit.col, to - unit.col + 1);
        if (cut.every((cell) => cell === '')) continue;
        pieces.push({ ...unit, col: from, text: cut.join('\t') });
      }
      break;
    }
    default: {
      const format = { lines: 'txt', rows: 'csv', pages: 'pdf' }[locator.kind];
      if (header.format !== format) invalid();
      const count = header.meta[{ lines: 'lines', rows: 'rows', pages: 'pages' }[locator.kind]];
      if (typeof count !== 'number' || locator.start > count) missing();
      const end = Math.min(locator.end, count);
      canonical = { ...locator, end };
      pieces = [];
      for (const unit of units) {
        if (locator.kind === 'lines' && unit.kind === 'lines' && unit.start <= end && unit.end >= locator.start) {
          const start = Math.max(unit.start, locator.start);
          const last = Math.min(unit.end, end);
          pieces.push({ ...unit, start, end: last, text: unit.text.split('\n').slice(start - unit.start, last - unit.start + 1).join('\n') });
        } else if (locator.kind === 'rows' && unit.kind === 'row' && unit.row >= locator.start && unit.row <= end) pieces.push({ ...unit });
        else if (locator.kind === 'pages' && 'page' in unit && unit.page !== undefined && unit.page >= locator.start && unit.page <= end) pieces.push({ ...unit });
      }
    }
  }
  return { locator: formatLocator(canonical), pieces };
}

export function renderPieces(pieces: Unit[]): string {
  return pieces.map((piece, index) => {
    if (!index) return piece.text;
    const before = pieces[index - 1];
    const adjacent = (before.kind === 'row' && piece.kind === 'row') ||
      (before.kind === 'lines' && piece.kind === 'lines' && piece.start === before.end + 1);
    return `${adjacent ? '\n' : '\n\n'}${piece.text}`;
  }).join('');
}
