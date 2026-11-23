import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import type { Extracted, Extractor, Problem, Unit } from './types';

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let cachedPdfjs: Promise<PdfjsModule> | undefined;
let cachedPaths: { cMapUrl: string; standardFontDataUrl: string } | undefined;

function getPdfjsPaths(): { cMapUrl: string; standardFontDataUrl: string } {
  if (!cachedPaths) {
    const req = createRequire(import.meta.url);
    const pkgPath = req.resolve('pdfjs-dist/package.json');
    const pkgDir = dirname(pkgPath);
    cachedPaths = {
      cMapUrl: join(pkgDir, 'cmaps') + sep,
      standardFontDataUrl: join(pkgDir, 'standard_fonts') + sep,
    };
  }
  return cachedPaths;
}

export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!cachedPdfjs) {
    cachedPdfjs = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return cachedPdfjs;
}

const CONSOLE_METHODS = ['log', 'warn', 'error', 'info', 'debug'] as const;

async function silenceConsole<T>(fn: () => Promise<T>): Promise<T> {
  const target = console as unknown as Record<string, (...args: unknown[]) => void>;
  const saved: Record<string, (...args: unknown[]) => void> = {};
  const noop = () => {};
  for (const method of CONSOLE_METHODS) {
    saved[method] = target[method];
    target[method] = noop;
  }
  try {
    return await fn();
  } finally {
    for (const method of CONSOLE_METHODS) {
      target[method] = saved[method];
    }
  }
}

export function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? String(start) : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? String(start) : `${start}-${end}`);
  return ranges.join(', ');
}

function pageItemsToLines(items: PdfTextItem[]): string[] {
  let raw = '';
  for (const item of items) {
    if (typeof item.str === 'string') {
      raw += item.str;
    }
    if (item.hasEOL) {
      raw += '\n';
    }
  }
  return raw
    .split('\n')
    .map((line) => line.replace(/ +/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function groupPageLines(lines: string[], page: number, units: Unit[]): void {
  let run: string[] = [];
  let size = 0;
  const flush = () => {
    if (run.length > 0) {
      units.push({ i: units.length, kind: 'block', page, text: run.join('\n') });
    }
    run = [];
    size = 0;
  };
  for (const line of lines) {
    const lineBytes = Buffer.byteLength(line);
    if (run.length > 0 && size + 1 + lineBytes > 2048) flush();
    size += (run.length > 0 ? 1 : 0) + lineBytes;
    run.push(line);
  }
  flush();
}

function isPasswordError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  return name === 'PasswordException';
}

export const pdf: Extractor = {
  id: 'pdf@1',
  async extract(bytes: Uint8Array): Promise<Extracted> {
    return silenceConsole(async () => {
      let pdfjs: PdfjsModule;
      try {
        pdfjs = await loadPdfjs();
      } catch (error) {
        return {
          state: 'unreadable',
          meta: {},
          problems: [{ code: 'parse_error', detail: error instanceof Error ? error.message : String(error) }],
          units: [],
        };
      }

      const { cMapUrl, standardFontDataUrl } = getPdfjsPaths();
      // Copy bytes so pdfjs-dist cannot detach or mutate the caller's Uint8Array.
      const data = new Uint8Array(bytes.byteLength);
      data.set(bytes);

      type PdfDoc = Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;
      let task: ReturnType<PdfjsModule['getDocument']> | undefined;
      let doc: PdfDoc | undefined;
      try {
        task = pdfjs.getDocument({
          data,
          isEvalSupported: false,
          disableFontFace: true,
          useSystemFonts: false,
          verbosity: pdfjs.VerbosityLevel.ERRORS,
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
        });
        doc = await task.promise;
      } catch (error) {
        if (task) {
          try { await task.destroy(); } catch { /* ignore cleanup errors */ }
        }
        if (isPasswordError(error)) {
          return {
            state: 'unreadable',
            meta: {},
            problems: [{ code: 'encrypted', detail: 'PDF document is password-protected.' }],
            units: [],
          };
        }
        const message = error instanceof Error ? error.message : String(error);
        return {
          state: 'unreadable',
          meta: {},
          problems: [{ code: 'parse_error', detail: message || 'Unable to parse PDF document.' }],
          units: [],
        };
      }

      const numPages = doc.numPages;
      const units: Unit[] = [];
      const noTextPages: number[] = [];
      const errorPages: number[] = [];

      try {
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          let page: Awaited<ReturnType<PdfDoc['getPage']>> | undefined;
          try {
            page = await doc.getPage(pageNum);
            const content = await page.getTextContent();
            const lines = pageItemsToLines(content.items as PdfTextItem[]);
            if (lines.length === 0) {
              noTextPages.push(pageNum);
            } else {
              groupPageLines(lines, pageNum, units);
            }
          } catch {
            errorPages.push(pageNum);
          } finally {
            if (page?.cleanup) {
              try { page.cleanup(); } catch { /* ignore */ }
            }
          }
        }
      } finally {
        try { await doc.destroy(); } catch { /* ignore cleanup errors */ }
      }

      const problems: Problem[] = [];
      if (noTextPages.length > 0) {
        const rangeText = formatPageRanges(noTextPages);
        problems.push({ code: 'no_text', pages: rangeText, detail: `pages ${rangeText}` });
      }
      if (errorPages.length > 0) {
        const rangeText = formatPageRanges(errorPages);
        problems.push({ code: 'page_error', pages: rangeText, detail: `pages ${rangeText}` });
      }

      const meta: Record<string, unknown> = { pages: numPages };
      if (units.length === 0) {
        return { state: 'unreadable', meta, problems, units: [] };
      }
      if (problems.length > 0) {
        return { state: 'partial', meta, problems, units };
      }
      return { state: 'ok', meta, problems: [], units };
    });
  },
};
