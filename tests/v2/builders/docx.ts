import JSZip from 'jszip';

export interface DocxBuildOptions {
  bodyXml: string;
  stylesXml?: string;
  extraFiles?: Record<string, string>;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

export async function buildDocx(options: DocxBuildOptions): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<w:document xmlns:w="${W_NS}" xmlns:mc="${MC_NS}"><w:body>${options.bodyXml}</w:body></w:document>`,
  );
  if (options.stylesXml !== undefined) {
    zip.file(
      'word/styles.xml',
      `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W_NS}">${options.stylesXml}</w:styles>`,
    );
  }
  if (options.extraFiles) {
    for (const [path, content] of Object.entries(options.extraFiles)) {
      zip.file(path, content);
    }
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

export function wPara(innerXml: string, pPrXml = ''): string {
  return `<w:p>${pPrXml ? `<w:pPr>${pPrXml}</w:pPr>` : ''}${innerXml}</w:p>`;
}

export function wRun(text: string): string {
  return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
