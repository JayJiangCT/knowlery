import { describe, expect, it } from 'vitest';
import { childElements, firstChild, parseXml, textContent } from '../../src/v2/core/extract/xml';

describe('v2 xml reader', () => {
  it('parses nested elements, attributes, named entities, numeric refs, CDATA, and skips comments, PIs, and doctype', () => {
    const source = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE root [<!ENTITY ignored "nope">]>',
      '<!-- top comment -->',
      '<w:doc attr="a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;">',
      '  <?custom-pi data="1"?>',
      '  <!-- inner comment -->',
      '  <w:p id=\'1\'>',
      '    <w:t>Hello &#65; &#x42; &#x4E2D;</w:t>',
      '    <w:t><![CDATA[raw <tag> &amp; text]]></w:t>',
      '    <w:empty flag="yes"/>',
      '  </w:p>',
      '</w:doc>',
    ].join('\n');

    const root = parseXml(source);
    expect(root.name).toBe('w:doc');
    expect(root.attrs).toEqual({ attr: `a & b <c> "d" 'e'` });

    const p = firstChild(root, 'w:p');
    expect(p).toBeDefined();
    expect(p!.attrs).toEqual({ id: '1' });

    const ts = childElements(p!, 'w:t');
    expect(ts).toHaveLength(2);
    expect(textContent(ts[0])).toBe('Hello A B 中');
    expect(textContent(ts[1])).toBe('raw <tag> &amp; text');

    const empty = firstChild(p!, 'w:empty');
    expect(empty).toEqual({ name: 'w:empty', attrs: { flag: 'yes' }, children: [] });
  });

  it('rejects malformed XML', () => {
    expect(() => parseXml('')).toThrow();
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseXml('<a>unclosed')).toThrow();
  });
});
