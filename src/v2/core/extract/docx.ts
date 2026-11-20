import JSZip from 'jszip';
import type { Extracted, Extractor, Unit } from './types';
import { childElements, firstChild, parseXml, textContent, type XmlElement } from './xml';

interface StyleInfo {
  name?: string;
  basedOn?: string;
  outlineLvl?: number;
}

const SKIP_SUBTREES = new Set([
  'w:del',
  'w:delText',
  'w:instrText',
  'w:drawing',
  'w:pict',
  'mc:AlternateContent',
]);

function parseHeadingName(name: string | undefined): number | undefined {
  if (!name) return undefined;
  const match = /^heading\s+([1-9])$/i.exec(name.trim());
  return match ? Number(match[1]) : undefined;
}

function parseOutlineLvl(pPr: XmlElement | undefined): number | undefined {
  if (!pPr) return undefined;
  const el = firstChild(pPr, 'w:outlineLvl');
  if (!el) return undefined;
  const raw = el.attrs['w:val'];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isInteger(value) && value >= 0 && value <= 8) return value + 1;
  return undefined;
}

function parseStyles(xml: string): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  const root = parseXml(xml);
  for (const styleEl of childElements(root, 'w:style')) {
    const id = styleEl.attrs['w:styleId'];
    if (!id) continue;
    const nameEl = firstChild(styleEl, 'w:name');
    const basedOnEl = firstChild(styleEl, 'w:basedOn');
    const pPr = firstChild(styleEl, 'w:pPr');
    styles.set(id, {
      name: nameEl?.attrs['w:val'],
      basedOn: basedOnEl?.attrs['w:val'],
      outlineLvl: parseOutlineLvl(pPr),
    });
  }
  return styles;
}

function resolveHeadingLevel(p: XmlElement, styles: Map<string, StyleInfo>): number | undefined {
  const pPr = firstChild(p, 'w:pPr');
  const styleId = firstChild(pPr ?? { name: '', attrs: {}, children: [] }, 'w:pStyle')?.attrs['w:val'];

  if (styleId) {
    let currentId: string | undefined = styleId;
    for (let step = 0; step <= 10 && currentId; step++) {
      const style = styles.get(currentId);
      if (!style) break;
      const byName = parseHeadingName(style.name);
      if (byName !== undefined) return byName;
      currentId = style.basedOn;
    }
  }

  const directOutline = parseOutlineLvl(pPr);
  if (directOutline !== undefined) return directOutline;

  if (styleId) {
    let currentId: string | undefined = styleId;
    for (let step = 0; step <= 10 && currentId; step++) {
      const style = styles.get(currentId);
      if (!style) break;
      if (style.outlineLvl !== undefined) return style.outlineLvl;
      currentId = style.basedOn;
    }
  }

  return undefined;
}

function extractParagraphText(node: XmlElement): string {
  let out = '';
  const walk = (el: XmlElement) => {
    for (const child of el.children) {
      if (typeof child === 'string') continue;
      if (SKIP_SUBTREES.has(child.name)) continue;
      switch (child.name) {
        case 'w:t':
          out += textContent(child);
          break;
        case 'w:tab':
          out += '\t';
          break;
        case 'w:br':
        case 'w:cr':
          out += '\n';
          break;
        case 'w:noBreakHyphen':
          out += '-';
          break;
        default:
          walk(child);
          break;
      }
    }
  };
  walk(node);
  return out;
}

function detectSkippedInTree(node: XmlElement, found: Set<string>): void {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.name === 'w:footnoteReference') found.add('footnotes');
    else if (child.name === 'w:endnoteReference') found.add('endnotes');
    else if (child.name === 'w:commentReference' || child.name === 'w:commentRangeStart') found.add('comments');
    else if (child.name === 'w:txbxContent') found.add('text_boxes');
    detectSkippedInTree(child, found);
  }
}

function hasVisibleText(xml: string): boolean {
  try {
    const root = parseXml(xml);
    return extractParagraphText(root).trim().length > 0;
  } catch {
    return false;
  }
}

function parseError(detail: string): Extracted {
  return {
    state: 'unreadable',
    meta: {},
    problems: [{ code: 'parse_error', detail }],
    units: [],
  };
}

export const docx: Extractor = {
  id: 'docx@1',
  async extract(bytes: Uint8Array): Promise<Extracted> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (error) {
      return parseError(`Unable to open docx archive: ${error instanceof Error ? error.message : String(error)}`);
    }

    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      return parseError('Missing word/document.xml in docx archive.');
    }

    let docRoot: XmlElement;
    try {
      docRoot = parseXml(await docFile.async('string'));
    } catch (error) {
      return parseError(`Invalid word/document.xml: ${error instanceof Error ? error.message : String(error)}`);
    }

    const body = firstChild(docRoot, 'w:body');
    if (!body) {
      return parseError('Missing w:body in word/document.xml.');
    }

    let styles = new Map<string, StyleInfo>();
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      try {
        styles = parseStyles(await stylesFile.async('string'));
      } catch {
        // Malformed optional styles.xml falls back to outline levels / plain paragraphs.
      }
    }

    const units: Unit[] = [];
    const ancestors: { level: number; text: string }[] = [];
    let currentPath = '(top)';

    const handleParagraph = (p: XmlElement) => {
      const text = extractParagraphText(p);
      if (!text.trim()) return;
      const level = resolveHeadingLevel(p, styles);
      if (level !== undefined) {
        const title = text.trim().replace(/\s+/g, ' ');
        while (ancestors.length && ancestors[ancestors.length - 1].level >= level) {
          ancestors.pop();
        }
        ancestors.push({ level, text: title });
        currentPath = ancestors.map((item) => item.text).join(' > ');
        units.push({ i: units.length, kind: 'heading', level, path: currentPath, text: title });
      } else {
        units.push({ i: units.length, kind: 'block', path: currentPath, text });
      }
    };

    const collectCellParagraphs = (container: XmlElement, out: string[]) => {
      for (const child of container.children) {
        if (typeof child === 'string') continue;
        if (child.name === 'w:p') {
          const text = extractParagraphText(child).replace(/[\t\r\n]+/g, ' ').trim();
          if (text) out.push(text);
        } else if (child.name === 'w:sdt') {
          const content = firstChild(child, 'w:sdtContent');
          if (content) collectCellParagraphs(content, out);
        } else if (child.name === 'w:tbl') {
          for (const tr of childElements(child, 'w:tr')) {
            for (const tc of childElements(tr, 'w:tc')) {
              collectCellParagraphs(tc, out);
            }
          }
        }
      }
    };

    const handleTable = (tbl: XmlElement) => {
      for (const tr of childElements(tbl, 'w:tr')) {
        const cellTexts: string[] = [];
        for (const tc of childElements(tr, 'w:tc')) {
          const parts: string[] = [];
          collectCellParagraphs(tc, parts);
          cellTexts.push(parts.join(' '));
        }
        if (cellTexts.some((cell) => cell.length > 0)) {
          units.push({ i: units.length, kind: 'block', path: currentPath, text: cellTexts.join('\t') });
        }
      }
    };

    const walkBody = (container: XmlElement) => {
      for (const child of container.children) {
        if (typeof child === 'string') continue;
        if (child.name === 'w:p') {
          handleParagraph(child);
        } else if (child.name === 'w:tbl') {
          handleTable(child);
        } else if (child.name === 'w:sdt') {
          const content = firstChild(child, 'w:sdtContent');
          if (content) walkBody(content);
        }
      }
    };

    walkBody(body);

    const skippedSet = new Set<string>();
    detectSkippedInTree(docRoot, skippedSet);

    const headerFooterFiles = zip.file(/^word\/(header|footer)\d*\.xml$/);
    for (const file of headerFooterFiles) {
      if (hasVisibleText(await file.async('string'))) {
        skippedSet.add('headers_footers');
        break;
      }
    }

    const order = ['footnotes', 'endnotes', 'comments', 'text_boxes', 'headers_footers'];
    const skippedParts = order.filter((part) => skippedSet.has(part));
    const meta: Record<string, unknown> = {};
    if (skippedParts.length > 0) meta.skipped_parts = skippedParts;

    return { state: 'ok', meta, problems: [], units };
  },
};
