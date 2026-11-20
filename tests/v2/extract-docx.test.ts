import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getExtraction } from '../../src/v2/core/extract';
import { cacheName } from '../../src/v2/core/extract/cache';
import { docx } from '../../src/v2/core/extract/docx';
import { registry } from '../../src/v2/core/extract/registry';
import { parseLocator, renderPieces, resolveLocator } from '../../src/v2/core/locator';
import { buildDocx, wPara, wRun } from './builders/docx';
import { fileState, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('v2 docx extractor', () => {
  it('resolves headings by style name, Chinese style id 2 -> heading 2, basedOn chain, and outlineLvl, with 3-level paths and (top)', async () => {
    const stylesXml = [
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="CustomH3"><w:name w:val="My Sub"/><w:basedOn w:val="Heading3Base"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="Heading3Base"><w:name w:val="Heading 3"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="OutlineOnly"><w:name w:val="Section"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>',
    ].join('');

    const bodyXml = [
      wPara(wRun('Lead paragraph before heading')),
      wPara(wRun('   ')), // empty paragraph skipped
      wPara(wRun('A'), '<w:pStyle w:val="Heading1"/>'),
      wPara(wRun('Intro A')),
      wPara(wRun('B'), '<w:pStyle w:val="2"/>'),
      wPara(wRun('Body B')),
      wPara(wRun('C'), '<w:pStyle w:val="CustomH3"/>'),
      wPara(wRun('Body C')),
      wPara(wRun('D'), '<w:outlineLvl w:val="0"/>'),
      wPara(wRun('E'), '<w:pStyle w:val="OutlineOnly"/>'),
      wPara(wRun('Body E')),
    ].join('');

    const bytes = await buildDocx({ bodyXml, stylesXml });
    const extracted = await docx.extract(bytes);
    expect(extracted.state).toBe('ok');
    expect(extracted.problems).toEqual([]);
    expect(extracted.units).toEqual([
      { i: 0, kind: 'block', path: '(top)', text: 'Lead paragraph before heading' },
      { i: 1, kind: 'heading', level: 1, path: 'A', text: 'A' },
      { i: 2, kind: 'block', path: 'A', text: 'Intro A' },
      { i: 3, kind: 'heading', level: 2, path: 'A > B', text: 'B' },
      { i: 4, kind: 'block', path: 'A > B', text: 'Body B' },
      { i: 5, kind: 'heading', level: 3, path: 'A > B > C', text: 'C' },
      { i: 6, kind: 'block', path: 'A > B > C', text: 'Body C' },
      { i: 7, kind: 'heading', level: 1, path: 'D', text: 'D' },
      { i: 8, kind: 'heading', level: 2, path: 'D > E', text: 'E' },
      { i: 9, kind: 'block', path: 'D > E', text: 'Body E' },
    ]);

    await writeFile(join(root, 'doc.docx'), bytes);
    const ex = await getExtraction(root, 'doc.docx');
    const resolved = resolveLocator(ex, parseLocator('heading A > B'));
    expect(renderPieces(resolved.pieces)).toBe('B\n\nBody B\n\nC\n\nBody C');
  });

  it('handles tabs, breaks, hyphens, tracked changes, field codes, tables, sdt, and skipped_parts', async () => {
    const bodyXml = [
      wPara(
        '<w:r><w:t>col1</w:t><w:tab/><w:t>col2</w:t><w:br/><w:t>line2</w:t><w:noBreakHyphen/><w:t>end</w:t></w:r>' +
          '<w:del><w:r><w:delText>removed</w:delText></w:r></w:del>' +
          '<w:ins><w:r><w:t> added</w:t></w:r></w:ins>' +
          '<w:r><w:instrText>HYPERLINK "x"</w:instrText></w:r>' +
          '<w:r><w:footnoteReference w:id="1"/></w:r>',
      ),
      '<w:sdt><w:sdtContent>' +
        '<w:tbl>' +
          '<w:tr>' +
            `<w:tc>${wPara(wRun('H1'))}</w:tc>` +
            `<w:tc>${wPara(wRun('H2a'))}${wPara(wRun('H2b'))}</w:tc>` +
          '</w:tr>' +
          '<w:tr>' +
            `<w:tc>${wPara(wRun('V1'))}</w:tc>` +
            `<w:tc>${wPara(wRun('V2'))}</w:tc>` +
          '</w:tr>' +
        '</w:tbl>' +
      '</w:sdtContent></w:sdt>',
    ].join('');

    const headerXml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Confidential Header</w:t></w:r></w:p></w:hdr>';

    const bytes = await buildDocx({ bodyXml, extraFiles: { 'word/header1.xml': headerXml } });
    const extracted = await docx.extract(bytes);
    expect(extracted.state).toBe('ok');
    expect(extracted.units).toEqual([
      { i: 0, kind: 'block', path: '(top)', text: 'col1\tcol2\nline2-end added' },
      { i: 1, kind: 'block', path: '(top)', text: 'H1\tH2a H2b' },
      { i: 2, kind: 'block', path: '(top)', text: 'V1\tV2' },
    ]);
    expect(extracted.meta.skipped_parts).toEqual(['footnotes', 'headers_footers']);
  });

  it('returns unreadable parse_error for non-zip bytes and caches deterministically offline', async () => {
    const bad = await docx.extract(Buffer.from('not a zip file'));
    expect(bad.state).toBe('unreadable');
    expect(bad.units).toEqual([]);
    expect(bad.problems[0].code).toBe('parse_error');

    const bytes = await buildDocx({ bodyXml: wPara(wRun('Offline check')) });
    await writeFile(join(root, 'offline.docx'), bytes);
    const before = await fileState(root);

    // Transition: unavailable before -> extracted now with full registry
    const withoutDocx = { ...registry };
    delete withoutDocx.docx;
    expect(await getExtraction(root, 'offline.docx', { registry: withoutDocx })).toMatchObject({ state: 'unavailable', units: [] });

    const origFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('network forbidden'); }) as typeof fetch;
    try {
      const first = await getExtraction(root, 'offline.docx');
      expect(first.cached).toBe(false);
      expect(first.state).toBe('ok');
      const cachePath = join(root, '.knowlery/cache/text', cacheName(first.sha256!, 'docx@1'));
      const firstCache = await readFile(cachePath);

      const second = await getExtraction(root, 'offline.docx');
      expect(second.cached).toBe(true);

      await rm(join(root, '.knowlery/cache'), { recursive: true });
      const rebuilt = await getExtraction(root, 'offline.docx');
      expect(rebuilt.cached).toBe(false);
      expect(await readFile(cachePath)).toEqual(firstCache);
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(await fileState(root)).toEqual(before);
  });
});
