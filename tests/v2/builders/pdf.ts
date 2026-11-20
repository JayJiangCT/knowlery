function escapePdfString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Emits a minimal valid PDF 1.4 file with the standard Helvetica font,
 * one content stream per page, and an exact cross-reference table.
 * Each entry in `pages` is an array of lines rendered on that page (empty array = blank page).
 */
export function buildPdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Helvetica font
  const pageObjIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 4 + i * 2;
    pageObjIds.push(pageObjId);
  }

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (let i = 0; i < pages.length; i++) {
    const contentObjId = 5 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );

    const lines = pages[i];
    let stream = '';
    if (lines.length > 0) {
      const ops: string[] = ['BT', '/F1 12 Tf'];
      let y = 750;
      for (const line of lines) {
        ops.push(`1 0 0 1 72 ${y} Tm`);
        ops.push(`(${escapePdfString(line)}) Tj`);
        y -= 16;
      }
      ops.push('ET');
      stream = `${ops.join('\n')}\n`;
    }
    const streamLen = Buffer.byteLength(stream, 'latin1');
    objects.push(`<< /Length ${streamLen} >>\nstream\n${stream}endstream`);
  }

  const chunks: Buffer[] = [];
  const header = Buffer.from('%PDF-1.4\n', 'latin1');
  chunks.push(header);
  let offset = header.length;
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const body = Buffer.from(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`, 'latin1');
    chunks.push(body);
    offset += body.length;
  }

  const xrefOffset = offset;
  const xrefLines: string[] = [`xref`, `0 ${objects.length + 1}`, '0000000000 65535 f '];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `);
  }
  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF\n',
  ].join('\n');
  chunks.push(Buffer.from(trailer, 'latin1'));

  return Buffer.concat(chunks);
}
