import { describe, expect, it } from 'vitest';
import { convertWikilinks, collectRawBodyUnresolvedLinks, parseWikilink } from '../../src/core/okf/wikilink';
import type { PageRecord, RawDependency, ResolvedLink } from '../../src/core/okf/shared';

function page(body: string, outlinks: ResolvedLink[]): PageRecord {
  return {
    conceptId: 'concepts/source-page',
    sourcePath: 'concepts/source-page.md',
    dir: 'concepts',
    frontmatter: {},
    body,
    outlinks,
    backlinks: [],
    contentHash: 'sha256-x',
  };
}

function link(raw: string, targetPath: string | null, extra: Partial<ResolvedLink> = {}): ResolvedLink {
  return {
    raw,
    targetPath,
    targetConceptId: targetPath && targetPath.startsWith('concepts/') ? targetPath.replace(/\.md$/, '') : null,
    embed: false,
    ...extra,
  };
}

describe('wikilink conversion', () => {
  it('converts plain, aliased, and heading links to bundle-relative markdown links', () => {
    const result = convertWikilinks(
      page(
        'See [[Target Page]] and [[Target Page|the alias]] and [[Target Page#My Heading]].',
        [
          link('Target Page', 'concepts/Target Page.md'),
          link('Target Page|the alias', 'concepts/Target Page.md', { alias: 'the alias' }),
          link('Target Page#My Heading', 'concepts/Target Page.md', { heading: 'My Heading' }),
        ],
      ),
      new Set(['concepts/Target Page']),
      new Set(),
    );

    expect(result.converted).toBe(3);
    // Spaces are URL-encoded so the emitted link is valid (§5.3).
    expect(result.body).toContain('[Target Page](/concepts/Target%20Page.md)');
    expect(result.body).toContain('[the alias](/concepts/Target%20Page.md)');
    expect(result.body).toContain('[Target Page](/concepts/Target%20Page.md#My%20Heading)');
  });

  it('converts embeds of knowledge pages into links and records unresolved targets without failing', () => {
    const result = convertWikilinks(
      page('![[Target Page]] and [[Deleted Note]].', [
        link('Target Page', 'concepts/Target Page.md', { embed: true }),
        link('Deleted Note', null),
      ]),
      new Set(['concepts/Target Page']),
      new Set(),
    );

    expect(result.body).toContain('![Target Page](/concepts/Target%20Page.md)');
    expect(result.body).toContain('[[Deleted Note]]'); // left as-is
    expect(result.unresolved).toEqual([{ from: 'concepts/source-page', raw: 'Deleted Note' }]);
  });

  it('resolves links to approved raw notes into /_sources/ and leaves unapproved raw links unresolved', () => {
    const result = convertWikilinks(
      page('Cites [[Idea/approved note]] and [[Idea/rejected note]].', [
        link('Idea/approved note', 'Idea/approved note.md'),
        link('Idea/rejected note', 'Idea/rejected note.md'),
      ]),
      new Set(),
      new Set(['Idea/approved note.md']),
    );

    expect(result.converted).toBe(1);
    expect(result.body).toContain('[approved note](/_sources/Idea/approved%20note.md)');
    expect(result.body).toContain('[[Idea/rejected note]]');
    expect(result.unresolved).toEqual([{ from: 'concepts/source-page', raw: 'Idea/rejected note' }]);
  });

  it('records wikilinks inside raw bodies as unresolved instead of converting them', () => {
    const raw: RawDependency = {
      path: 'Idea/notes.md',
      title: 'notes',
      body: 'Mentions [[Some Page]] casually.',
      frontmatter: {},
      citedBy: ['concepts/source-page'],
      contentHash: 'sha256-y',
    };
    expect(collectRawBodyUnresolvedLinks(raw)).toEqual([
      { from: '_sources/Idea/notes.md', raw: 'Some Page' },
    ]);
  });

  it('parses target, heading, and alias out of a wikilink', () => {
    expect(parseWikilink('Target#Heading|Alias')).toEqual({
      target: 'Target',
      heading: 'Heading',
      alias: 'Alias',
    });
  });
});
