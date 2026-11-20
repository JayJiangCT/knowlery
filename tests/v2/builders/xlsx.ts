import JSZip from 'jszip';

export interface XlsxSheetSpec {
  name: string;
  sheetXml: string;
  hidden?: boolean;
  chartSheet?: boolean;
}

export interface XlsxBuildOptions {
  sheets: XlsxSheetSpec[];
  sharedStringsXml?: string;
  stylesXml?: string;
  date1904?: boolean;
  extraFiles?: Record<string, string>;
}

const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const WS_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const CS_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet';

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function buildXlsx(options: XlsxBuildOptions): Promise<Buffer> {
  const zip = new JSZip();

  const sheetTags: string[] = [];
  const relTags: string[] = [];

  options.sheets.forEach((sheet, idx) => {
    const id = idx + 1;
    const rId = `rId${id}`;
    const stateAttr = sheet.hidden ? ' state="hidden"' : '';
    sheetTags.push(`<sheet name="${escapeAttr(sheet.name)}" sheetId="${id}"${stateAttr} r:id="${rId}"/>`);
    const target = sheet.chartSheet ? `chartsheets/sheet${id}.xml` : `worksheets/sheet${id}.xml`;
    const type = sheet.chartSheet ? CS_REL_TYPE : WS_REL_TYPE;
    relTags.push(`<Relationship Id="${rId}" Type="${type}" Target="${target}"/>`);
    zip.file(`xl/${target}`, sheet.sheetXml);
  });

  const workbookPr = options.date1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>';
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<workbook xmlns="${SS_NS}" xmlns:r="${R_NS}">${workbookPr}<sheets>${sheetTags.join('')}</sheets></workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Relationships xmlns="${PKG_REL_NS}">${relTags.join('')}</Relationships>`,
  );

  if (options.sharedStringsXml !== undefined) {
    zip.file(
      'xl/sharedStrings.xml',
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${SS_NS}">${options.sharedStringsXml}</sst>`,
    );
  }

  if (options.stylesXml !== undefined) {
    zip.file(
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${SS_NS}">${options.stylesXml}</styleSheet>`,
    );
  }

  if (options.extraFiles) {
    for (const [path, content] of Object.entries(options.extraFiles)) {
      zip.file(path, content);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

export function worksheetXml(sheetDataInnerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${SS_NS}"><sheetData>${sheetDataInnerXml}</sheetData></worksheet>`;
}
