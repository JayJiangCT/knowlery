import { decode, textLines } from './decode';
import { type Extractor, type Unit, unreadableEncoding } from './types';

export const txt: Extractor = {
  id: 'txt@1',
  extract(bytes) {
    const text = decode(bytes);
    if (text === undefined) return unreadableEncoding();
    const lines = textLines(text);
    const units: Unit[] = [];
    let run: string[] = [];
    let start = 1;
    let size = 0;
    const flush = () => {
      if (run.length) units.push({ i: units.length, kind: 'lines', text: run.join('\n'), start, end: start + run.length - 1 });
      run = [];
      size = 0;
    };
    lines.forEach((line, index) => {
      if (!line.trim()) { flush(); return; }
      const bytes = Buffer.byteLength(line);
      if (run.length && size + 1 + bytes > 2048) flush();
      if (!run.length) start = index + 1;
      size += (run.length ? 1 : 0) + bytes;
      run.push(line);
    });
    flush();
    return { state: 'ok', meta: { lines: lines.length }, problems: [], units };
  },
};
