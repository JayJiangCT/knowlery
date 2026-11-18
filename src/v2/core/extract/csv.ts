import { decode } from './decode';
import { type Extractor, type Unit, unreadableEncoding } from './types';

export const csv: Extractor = {
  id: 'csv@1',
  extract(bytes) {
    const text = decode(bytes);
    if (text === undefined) return unreadableEncoding();
    const records: string[][] = [];
    let cells: string[] = [];
    let cell = '';
    let quoted = false;
    let active = false;
    const finish = () => {
      if (active) records.push([...cells, cell]);
      cells = []; cell = ''; active = false;
    };
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += char;
      } else if (char === '"' && !cell) { quoted = true; active = true; }
      else if (char === ',') { cells.push(cell); cell = ''; active = true; }
      else if (char === '\n') finish();
      else { cell += char; active = true; }
    }
    if (!quoted) finish();
    const columns = records.shift() ?? [];
    const units: Unit[] = records.map((record, i) => ({ i, kind: 'row', row: i + 1, text: record.map((value) => value.replace(/[\t\n\r]/g, ' ')).join('\t') }));
    const problems = quoted ? [{ code: 'unterminated_quote', detail: `Unterminated quote in record ${records.length + (columns.length ? 2 : 1)}.` }] : [];
    return { state: quoted ? (units.length ? 'partial' : 'unreadable') : 'ok', meta: { columns, rows: units.length }, problems, units };
  },
};
