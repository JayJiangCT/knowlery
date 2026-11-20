import JSZip from 'jszip';
import type { Extracted, Extractor, Problem, Unit } from './types';
import { childElementsByLocal, firstChildByLocal, localName, parseXml, textContent, type XmlElement } from './xml';

interface SheetMeta {
  name: string;
  range: string | null;
  rows: number;
  hidden: boolean;
}

interface SheetRef {
  name: string;
  relId: string;
  hidden: boolean;
}

interface RelEntry {
  target: string;
  type: string;
}

const CHART_SHEET_TYPE_FRAGMENT = '/chartsheet';

function isBuiltInDateFmt(id: number): boolean {
  return (id >= 14 && id <= 22)
    || (id >= 27 && id <= 36)
    || (id >= 45 && id <= 47)
    || (id >= 50 && id <= 58);
}

function isCustomDateFormatCode(code: string): boolean {
  // Strip double-quoted literals, backslash-escaped chars, and bracketed sections ([Red], [$-409], etc.).
  let cleaned = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      i++;
      while (i < code.length && code[i] !== '"') i++;
    } else if (ch === '\\') {
      i++;
    } else if (ch === '[') {
      i++;
      while (i < code.length && code[i] !== ']') i++;
    } else {
      cleaned += ch;
    }
  }
  return /[ymdhis]/i.test(cleaned.replace(/i/gi, ''));
}

function parseDateStyleIndices(stylesXml: string): Set<number> {
  const dateStyles = new Set<number>();
  const root = parseXml(stylesXml);
  const customDateFmts = new Set<number>();

  const numFmts = firstChildByLocal(root, 'numFmts');
  if (numFmts) {
    for (const nf of childElementsByLocal(numFmts, 'numFmt')) {
      const id = Number(nf.attrs.numFmtId);
      const code = nf.attrs.formatCode ?? '';
      if (Number.isInteger(id) && isCustomDateFormatCode(code)) {
        customDateFmts.add(id);
      }
    }
  }

  const cellXfs = firstChildByLocal(root, 'cellXfs');
  if (cellXfs) {
    const xfs = childElementsByLocal(cellXfs, 'xf');
    xfs.forEach((xf, index) => {
      const id = Number(xf.attrs.numFmtId);
      if (Number.isInteger(id) && (isBuiltInDateFmt(id) || customDateFmts.has(id))) {
        dateStyles.add(index);
      }
    });
  }

  return dateStyles;
}

function collectTextIgnoringPhonetic(node: XmlElement): string {
  let out = '';
  const walk = (el: XmlElement) => {
    for (const child of el.children) {
      if (typeof child === 'string') continue;
      const local = localName(child.name);
      if (local === 'rPh') continue;
      if (local === 't') {
        out += textContent(child);
      } else {
        walk(child);
      }
    }
  };
  walk(node);
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const root = parseXml(xml);
  const strings: string[] = [];
  for (const si of childElementsByLocal(root, 'si')) {
    strings.push(collectTextIgnoringPhonetic(si));
  }
  return strings;
}

function parseRels(xml: string): Map<string, RelEntry> {
  const map = new Map<string, RelEntry>();
  const root = parseXml(xml);
  for (const rel of childElementsByLocal(root, 'Relationship')) {
    const id = rel.attrs.Id;
    const target = rel.attrs.Target;
    const type = rel.attrs.Type ?? '';
    if (id && target) {
      map.set(id, { target, type });
    }
  }
  return map;
}

function resolveWorkbookTarget(target: string): string {
  const normalized = target.replace(/\\/g, '/');
  const raw = normalized.startsWith('/') ? normalized.slice(1) : `xl/${normalized}`;
  const parts: string[] = [];
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function colLettersToNumber(letters: string): number {
  let value = 0;
  for (let i = 0; i < letters.length; i++) {
    value = value * 26 + (letters.charCodeAt(i) - 64);
  }
  return value;
}

function colNumberToLetters(value: number): string {
  let col = value;
  let out = '';
  while (col > 0) {
    col--;
    out = String.fromCharCode(65 + (col % 26)) + out;
    col = Math.floor(col / 26);
  }
  return out;
}

function parseCellRef(ref: string): { col: number; row: number } | undefined {
  const match = /^([A-Za-z]+)([0-9]+)$/.exec(ref);
  if (!match) return undefined;
  const col = colLettersToNumber(match[1].toUpperCase());
  const row = Number(match[2]);
  if (!Number.isSafeInteger(col) || col < 1 || !Number.isSafeInteger(row) || row < 1) return undefined;
  return { col, row };
}

function formatNumber(raw: string): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  if (Object.is(num, -0)) return '0';
  const prec = num.toPrecision(15);
  if (prec.includes('e') || prec.includes('E')) {
    const [mantissa, exp] = prec.split(/[eE]/);
    const trimmed = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa;
    return `${trimmed}e${exp}`;
  }
  return prec.includes('.') ? prec.replace(/\.?0+$/, '') : prec;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatExcelDate(serial: number, date1904: boolean): string {
  if (serial < 0) return formatNumber(String(serial));

  const wholeDays = Math.floor(serial);
  const fraction = serial - wholeDays;
  const totalSeconds = Math.round(fraction * 86400);
  const carryDays = Math.floor(totalSeconds / 86400);
  const daySeconds = totalSeconds % 86400;

  const hh = Math.floor(daySeconds / 3600);
  const mm = Math.floor((daySeconds % 3600) / 60);
  const ss = daySeconds % 60;
  const timeStr = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;

  if (serial < 1 && carryDays === 0) {
    return timeStr;
  }

  let baseUtcMs: number;
  if (date1904) {
    baseUtcMs = Date.UTC(1904, 0, 1);
  } else if (serial < 60) {
    baseUtcMs = Date.UTC(1899, 11, 31);
  } else {
    baseUtcMs = Date.UTC(1899, 11, 30);
  }

  const date = new Date(baseUtcMs + (wholeDays + carryDays) * 86400000);
  const yyyy = date.getUTCFullYear();
  const mon = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const dateStr = `${yyyy}-${mon}-${dd}`;

  if (fraction === 0) return dateStr;
  return `${dateStr} ${timeStr}`;
}

function sanitizeCell(text: string): string {
  return text.replace(/[\t\r\n]/g, ' ');
}

function parseError(detail: string): Extracted {
  return {
    state: 'unreadable',
    meta: {},
    problems: [{ code: 'parse_error', detail }],
    units: [],
  };
}

export const xlsx: Extractor = {
  id: 'xlsx@1',
  async extract(bytes: Uint8Array): Promise<Extracted> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (error) {
      return parseError(`Unable to open xlsx archive: ${error instanceof Error ? error.message : String(error)}`);
    }

    const workbookFile = zip.file('xl/workbook.xml');
    if (!workbookFile) {
      return parseError('Missing xl/workbook.xml in xlsx archive.');
    }

    let workbookRoot: XmlElement;
    try {
      workbookRoot = parseXml(await workbookFile.async('string'));
    } catch (error) {
      return parseError(`Invalid xl/workbook.xml: ${error instanceof Error ? error.message : String(error)}`);
    }

    const workbookPr = firstChildByLocal(workbookRoot, 'workbookPr');
    const date1904Attr = workbookPr?.attrs.date1904;
    const date1904 = date1904Attr === '1' || date1904Attr === 'true';

    const sheetsContainer = firstChildByLocal(workbookRoot, 'sheets');
    const sheetRefs: SheetRef[] = [];
    if (sheetsContainer) {
      for (const sheetEl of childElementsByLocal(sheetsContainer, 'sheet')) {
        const name = sheetEl.attrs.name;
        const relId = sheetEl.attrs['r:id'] ?? sheetEl.attrs.id ?? '';
        const state = sheetEl.attrs.state;
        const hidden = state === 'hidden' || state === 'veryHidden';
        if (name) sheetRefs.push({ name, relId, hidden });
      }
    }

    let rels = new Map<string, RelEntry>();
    const relsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (relsFile) {
      try {
        rels = parseRels(await relsFile.async('string'));
      } catch {
        // Missing or invalid rels will trigger sheet_error per unresolved sheet.
      }
    }

    let sharedStrings: string[] = [];
    const ssFile = zip.file('xl/sharedStrings.xml');
    if (ssFile) {
      try {
        sharedStrings = parseSharedStrings(await ssFile.async('string'));
      } catch {
        // Fallback to empty shared string table.
      }
    }

    let dateStyles = new Set<number>();
    const stylesFile = zip.file('xl/styles.xml');
    if (stylesFile) {
      try {
        dateStyles = parseDateStyleIndices(await stylesFile.async('string'));
      } catch {
        // Fallback to no date styles.
      }
    }

    const units: Unit[] = [];
    const sheetMetas: SheetMeta[] = [];
    const skippedParts: string[] = [];
    const problems: Problem[] = [];
    const formulaMissingBySheet: { sheet: string; count: number }[] = [];

    for (const sheet of sheetRefs) {
      const rel = rels.get(sheet.relId);
      if (rel && rel.type.toLowerCase().includes(CHART_SHEET_TYPE_FRAGMENT)) {
        skippedParts.push(sheet.name);
        continue;
      }

      const targetPath = rel ? resolveWorkbookTarget(rel.target) : undefined;
      const wsFile = targetPath ? zip.file(targetPath) : null;
      if (!wsFile) {
        problems.push({ code: 'sheet_error', detail: `Missing worksheet for sheet ${sheet.name}.`, sheet: sheet.name });
        sheetMetas.push({ name: sheet.name, range: null, rows: 0, hidden: sheet.hidden });
        continue;
      }

      let wsRoot: XmlElement;
      try {
        wsRoot = parseXml(await wsFile.async('string'));
      } catch (error) {
        problems.push({
          code: 'sheet_error',
          detail: `Unable to parse worksheet ${sheet.name}: ${error instanceof Error ? error.message : String(error)}`,
          sheet: sheet.name,
        });
        sheetMetas.push({ name: sheet.name, range: null, rows: 0, hidden: sheet.hidden });
        continue;
      }

      if (localName(wsRoot.name) === 'chartsheet') {
        skippedParts.push(sheet.name);
        continue;
      }

      const sheetData = firstChildByLocal(wsRoot, 'sheetData');
      let minRow = Infinity;
      let maxRow = 0;
      let minCol = Infinity;
      let maxCol = 0;
      let sheetRowCount = 0;
      let formulaMissingCount = 0;
      let prevRowNum = 0;

      if (sheetData) {
        for (const rowEl of childElementsByLocal(sheetData, 'row')) {
          const rowAttr = rowEl.attrs.r;
          const rowNum = rowAttr ? Number(rowAttr) : prevRowNum + 1;
          if (!Number.isSafeInteger(rowNum) || rowNum < 1) continue;
          prevRowNum = rowNum;

          const rowCells = new Map<number, string>();
          let prevColNum = 0;

          for (const cellEl of childElementsByLocal(rowEl, 'c')) {
            let colNum: number;
            if (cellEl.attrs.r) {
              const parsed = parseCellRef(cellEl.attrs.r);
              colNum = parsed ? parsed.col : prevColNum + 1;
            } else {
              colNum = prevColNum + 1;
            }
            prevColNum = colNum;

            const type = cellEl.attrs.t;
            const fEl = firstChildByLocal(cellEl, 'f');
            const vEl = firstChildByLocal(cellEl, 'v');
            const isEl = firstChildByLocal(cellEl, 'is');

            let value = '';
            if (type === 's') {
              if (vEl) {
                const idx = Number(textContent(vEl).trim());
                if (Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length) {
                  value = sharedStrings[idx];
                }
              }
            } else if (type === 'inlineStr') {
              if (isEl) value = collectTextIgnoringPhonetic(isEl);
            } else if (type === 'str') {
              if (vEl) value = textContent(vEl);
              else if (fEl) formulaMissingCount++;
            } else if (type === 'b') {
              if (vEl) {
                const raw = textContent(vEl).trim();
                value = raw === '1' || raw.toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
              } else if (fEl) {
                formulaMissingCount++;
              }
            } else if (type === 'e' || type === 'd') {
              if (vEl) value = textContent(vEl);
              else if (fEl) formulaMissingCount++;
            } else {
              // Number (t omitted or t === 'n')
              if (vEl) {
                const raw = textContent(vEl).trim();
                if (raw !== '') {
                  const styleIdx = cellEl.attrs.s !== undefined ? Number(cellEl.attrs.s) : -1;
                  const num = Number(raw);
                  if (Number.isFinite(num) && dateStyles.has(styleIdx)) {
                    value = formatExcelDate(num, date1904);
                  } else {
                    value = formatNumber(raw);
                  }
                } else if (fEl) {
                  formulaMissingCount++;
                }
              } else if (fEl) {
                formulaMissingCount++;
              }
            }

            if (value !== '') {
              rowCells.set(colNum, sanitizeCell(value));
            }
          }

          if (rowCells.size === 0) continue;

          const cols = Array.from(rowCells.keys());
          const firstCol = Math.min(...cols);
          const lastCol = Math.max(...cols);
          const cells: string[] = [];
          for (let c = firstCol; c <= lastCol; c++) {
            cells.push(rowCells.get(c) ?? '');
          }

          units.push({
            i: units.length,
            kind: 'row',
            sheet: sheet.name,
            row: rowNum,
            col: firstCol,
            text: cells.join('\t'),
          });

          sheetRowCount++;
          if (rowNum < minRow) minRow = rowNum;
          if (rowNum > maxRow) maxRow = rowNum;
          if (firstCol < minCol) minCol = firstCol;
          if (lastCol > maxCol) maxCol = lastCol;
        }
      }

      if (formulaMissingCount > 0) {
        formulaMissingBySheet.push({ sheet: sheet.name, count: formulaMissingCount });
      }

      const range = sheetRowCount > 0
        ? `${colNumberToLetters(minCol)}${minRow}:${colNumberToLetters(maxCol)}${maxRow}`
        : null;
      sheetMetas.push({ name: sheet.name, range, rows: sheetRowCount, hidden: sheet.hidden });
    }

    if (formulaMissingBySheet.length > 0) {
      const detail = formulaMissingBySheet.map(({ sheet, count }) => `${sheet}: ${count}`).join(', ');
      problems.push({ code: 'formula_without_value', detail });
    }

    const meta: Record<string, unknown> = { sheets: sheetMetas };
    if (skippedParts.length > 0) meta.skipped_parts = skippedParts;

    const state = problems.length > 0 ? 'partial' : 'ok';
    return { state, meta, problems, units };
  },
};
