export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: (XmlElement | string)[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(raw: string): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z_][A-Za-z0-9._-]*);/g, (match, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X'
        ? Number.parseInt(ref.slice(2), 16)
        : Number.parseInt(ref.slice(1), 10);
      if (Number.isInteger(code) && code >= 0 && code <= 0x10ffff) {
        try { return String.fromCodePoint(code); } catch { return match; }
      }
      return match;
    }
    return NAMED_ENTITIES[ref] ?? match;
  });
}

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function isNameChar(code: number): boolean {
  return !isSpace(code) && code !== 0x3e && code !== 0x2f && code !== 0x3d && code !== 0x3c;
}

export function parseXml(source: string): XmlElement {
  const input = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const len = input.length;
  let pos = 0;

  const skipSpaces = () => {
    while (pos < len && isSpace(input.charCodeAt(pos))) pos++;
  };

  const readName = (): string => {
    const start = pos;
    while (pos < len && isNameChar(input.charCodeAt(pos))) pos++;
    if (pos === start) throw new Error(`Expected XML name at offset ${pos}`);
    return input.slice(start, pos);
  };

  const skipDoctype = () => {
    pos += 9; // <!DOCTYPE
    let depth = 1;
    let quote = 0;
    while (pos < len && depth > 0) {
      const code = input.charCodeAt(pos);
      if (quote) {
        if (code === quote) quote = 0;
      } else if (code === 0x22 || code === 0x27) {
        quote = code;
      } else if (code === 0x3c) {
        depth++;
      } else if (code === 0x3e) {
        depth--;
      }
      pos++;
    }
    if (depth !== 0) throw new Error('Unterminated DOCTYPE');
  };

  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;

  while (pos < len) {
    const lt = input.indexOf('<', pos);
    if (lt === -1) {
      const tail = input.slice(pos);
      if (stack.length) {
        stack[stack.length - 1].children.push(decodeEntities(tail));
      } else if (tail.trim()) {
        throw new Error('Unexpected text outside root element');
      }
      break;
    }

    if (lt > pos) {
      const chunk = input.slice(pos, lt);
      if (stack.length) {
        stack[stack.length - 1].children.push(decodeEntities(chunk));
      } else if (chunk.trim()) {
        throw new Error('Unexpected text outside root element');
      }
    }
    pos = lt;

    if (input.startsWith('<!--', pos)) {
      const end = input.indexOf('-->', pos + 4);
      if (end === -1) throw new Error('Unterminated XML comment');
      pos = end + 3;
      continue;
    }

    if (input.startsWith('<![CDATA[', pos)) {
      const end = input.indexOf(']]>', pos + 9);
      if (end === -1) throw new Error('Unterminated CDATA section');
      if (stack.length) stack[stack.length - 1].children.push(input.slice(pos + 9, end));
      pos = end + 3;
      continue;
    }

    if (input.startsWith('<?', pos)) {
      const end = input.indexOf('?>', pos + 2);
      if (end === -1) throw new Error('Unterminated processing instruction');
      pos = end + 2;
      continue;
    }

    if (input.startsWith('<!DOCTYPE', pos)) {
      skipDoctype();
      continue;
    }

    if (input.startsWith('</', pos)) {
      pos += 2;
      const name = readName();
      skipSpaces();
      if (pos >= len || input.charCodeAt(pos) !== 0x3e) {
        throw new Error(`Expected '>' in closing tag </${name}>`);
      }
      pos++;
      const top = stack.pop();
      if (!top || top.name !== name) {
        throw new Error(`Mismatched closing tag </${name}>`);
      }
      continue;
    }

    // Opening tag
    pos++; // skip '<'
    const name = readName();
    const attrs: Record<string, string> = {};
    let selfClosing = false;

    while (pos < len) {
      skipSpaces();
      if (pos >= len) throw new Error(`Unterminated tag <${name}>`);
      const code = input.charCodeAt(pos);
      if (code === 0x3e) {
        pos++;
        break;
      }
      if (code === 0x2f) {
        if (input.charCodeAt(pos + 1) !== 0x3e) throw new Error(`Expected '/>' in <${name}>`);
        pos += 2;
        selfClosing = true;
        break;
      }
      const attrName = readName();
      skipSpaces();
      if (input.charCodeAt(pos) !== 0x3d) throw new Error(`Expected '=' after attribute ${attrName}`);
      pos++;
      skipSpaces();
      const quote = input.charCodeAt(pos);
      if (quote !== 0x22 && quote !== 0x27) throw new Error(`Expected quoted value for attribute ${attrName}`);
      pos++;
      const quoteChar = quote === 0x22 ? '"' : "'";
      const endQuote = input.indexOf(quoteChar, pos);
      if (endQuote === -1) throw new Error(`Unterminated attribute value for ${attrName}`);
      attrs[attrName] = decodeEntities(input.slice(pos, endQuote));
      pos = endQuote + 1;
    }

    const element: XmlElement = { name, attrs, children: [] };
    if (stack.length) {
      stack[stack.length - 1].children.push(element);
    } else if (root) {
      throw new Error('Multiple root elements');
    } else {
      root = element;
    }
    if (!selfClosing) stack.push(element);
  }

  if (stack.length) throw new Error(`Unclosed tag <${stack[stack.length - 1].name}>`);
  if (!root) throw new Error('Empty XML document');
  return root;
}

export function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon === -1 ? name : name.slice(colon + 1);
}

export function childElements(node: XmlElement, name?: string): XmlElement[] {
  const result: XmlElement[] = [];
  for (const child of node.children) {
    if (typeof child !== 'string' && (name === undefined || child.name === name)) {
      result.push(child);
    }
  }
  return result;
}

export function childElementsByLocal(node: XmlElement, local: string): XmlElement[] {
  const result: XmlElement[] = [];
  for (const child of node.children) {
    if (typeof child !== 'string' && localName(child.name) === local) {
      result.push(child);
    }
  }
  return result;
}

export function firstChild(node: XmlElement, name: string): XmlElement | undefined {
  for (const child of node.children) {
    if (typeof child !== 'string' && child.name === name) return child;
  }
  return undefined;
}

export function firstChildByLocal(node: XmlElement, local: string): XmlElement | undefined {
  for (const child of node.children) {
    if (typeof child !== 'string' && localName(child.name) === local) return child;
  }
  return undefined;
}

export function textContent(node: XmlElement): string {
  let out = '';
  for (const child of node.children) {
    out += typeof child === 'string' ? child : textContent(child);
  }
  return out;
}
