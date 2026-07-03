import { describe, expect, it } from 'vitest';
import { createOkfMockApp } from '../mocks/okf-app';
import { forkPageFromBundle } from '../../src/core/okf/fork';

describe('forkPageFromBundle', () => {
  it('copies the page into the target path with provenance frontmatter', async () => {
    const app = createOkfMockApp({
      'Library/jay.drone-delivery/concepts/foo.md': '---\ntype: Concept\ntitle: Foo\n---\n\nFoo body.',
    });

    await forkPageFromBundle(
      app as never,
      {
        libraryPath: 'Library/jay.drone-delivery/',
        sourcePath: 'concepts/foo.md',
        targetPath: 'concepts/foo.md',
        bundleId: 'jay.drone-delivery',
      },
      new Date('2026-07-02T00:00:00.000Z'),
    );

    const written = app.writes['concepts/foo.md'];
    expect(written).toContain('title: Foo');
    expect(written).toContain('forked_from_bundle: jay.drone-delivery');
    expect(written).toContain('forked_from_path: concepts/foo.md');
    expect(written).toContain('forked_at:');
    expect(written).toContain('Foo body.');
  });

  it('refuses to overwrite an existing page at the target path', async () => {
    const app = createOkfMockApp({
      'Library/jay.drone-delivery/concepts/foo.md': '---\ntype: Concept\n---\n\nBody.',
      'concepts/foo.md': '---\ntype: Concept\n---\n\nAlready here.',
    });

    await expect(
      forkPageFromBundle(app as never, {
        libraryPath: 'Library/jay.drone-delivery/',
        sourcePath: 'concepts/foo.md',
        targetPath: 'concepts/foo.md',
        bundleId: 'jay.drone-delivery',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('throws when the source page does not exist in the bundle', async () => {
    const app = createOkfMockApp({});
    await expect(
      forkPageFromBundle(app as never, {
        libraryPath: 'Library/jay.drone-delivery/',
        sourcePath: 'concepts/missing.md',
        targetPath: 'concepts/missing.md',
        bundleId: 'jay.drone-delivery',
      }),
    ).rejects.toThrow(/not found/i);
  });
});
