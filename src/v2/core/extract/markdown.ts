import { parse } from 'yaml';
import { decode, textLines } from './decode';
import { type Extractor, type Unit, unreadableEncoding } from './types';

export const markdown: Extractor = {
  id: 'markdown@1',
  extract(bytes) {
    const text = decode(bytes);
    if (text === undefined) return unreadableEncoding();
    const lines = textLines(text);
    const meta: Record<string, unknown> = {};
    if (lines[0] === '---') {
      const end = lines.indexOf('---', 1);
      if (end !== -1) {
        try {
          const value: unknown = parse(lines.slice(1, end).join('\n'));
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const key of ['title', 'description'] as const) {
              const field = (value as Record<string, unknown>)[key];
              if (typeof field === 'string') meta[key] = field;
            }
          }
        } catch { /* Malformed source frontmatter is deliberately ignored. */ }
        lines.splice(0, end + 1);
      }
    }
    const units: Unit[] = [];
    const ancestors: { level: number; text: string }[] = [];
    let path = '(top)';
    let run: string[] = [];
    const flush = () => {
      if (run.length) units.push({ i: units.length, kind: 'block', path, text: run.join('\n') });
      run = [];
    };
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      const fence = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fence) {
        flush();
        const block = [line.trimEnd()];
        const closing = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
        while (++n < lines.length) {
          block.push(lines[n].trimEnd());
          if (closing.test(lines[n])) break;
        }
        units.push({ i: units.length, kind: 'block', path, text: block.join('\n') });
        continue;
      }
      const heading = /^ {0,3}(#{1,6})[ \t]+(.+)$/.exec(line);
      if (heading) {
        flush();
        const level = heading[1].length;
        const title = heading[2].replace(/#+\s*$/, '').trim().replace(/\s+/g, ' ');
        while (ancestors.length && ancestors[ancestors.length - 1].level >= level) ancestors.pop();
        ancestors.push({ level, text: title });
        path = ancestors.map((item) => item.text).join(' > ');
        units.push({ i: units.length, kind: 'heading', level, path, text: line });
      } else if (!line.trim()) flush();
      else run.push(line.trimEnd());
    }
    flush();
    return { state: 'ok', meta, problems: [], units };
  },
};
