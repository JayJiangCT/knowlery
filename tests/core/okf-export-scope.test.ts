import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { buildClosure, readExportScope, writeExportScope } from '../../src/core/okf/export-scope';
import { createOkfMockApp, okfBundleSource, okfVaultFs } from '../mocks/okf-app';

function knowledgePage(title: string, body: string, extraFrontmatter: string[] = []): string {
  return ['---', 'type: concept', `title: ${title}`, ...extraFrontmatter, '---', '', body].join('\n');
}

// Chain: seed -> hop1 -> hop2 -> hop3; hop1 cites a raw note whose own body
// links onward to another raw note and back to a compiled page.
function chainVault(): Record<string, string> {
  return {
    'concepts/seed.md': knowledgePage('Seed', 'Links to [[hop1]].'),
    'concepts/hop1.md': knowledgePage('Hop1', 'Links to [[hop2]] and cites [[Idea/raw-a.md]].'),
    'concepts/hop2.md': knowledgePage('Hop2', 'Links to [[hop3]].'),
    'concepts/hop3.md': knowledgePage('Hop3', 'End of chain.'),
    'Idea/raw-a.md': 'Raw A links to [[Idea/raw-b.md]] and back to [[seed]].',
    'Idea/raw-b.md': 'Raw B should never be pulled in.',
  };
}

describe('export scope closure', () => {
  it('caps compiled↔compiled traversal at maxCompiledHops', async () => {
    const app = createOkfMockApp(chainVault()) as unknown as App;
    const closure = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 2);
    const ids = closure.items.map((item) => item.id);
    expect(ids).toContain('concepts/seed');
    expect(ids).toContain('concepts/hop1');
    expect(ids).toContain('concepts/hop2');
    expect(ids).not.toContain('concepts/hop3'); // 3 hops away, cap is 2
  });

  it('traverses compiled→raw exactly one hop and never continues from raw bodies', async () => {
    const app = createOkfMockApp(chainVault()) as unknown as App;
    const closure = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 2);
    const ids = closure.items.map((item) => item.id);
    expect(ids).toContain('Idea/raw-a.md'); // cited by hop1
    expect(ids).not.toContain('Idea/raw-b.md'); // raw→raw is never followed
  });

  it('defaults every first-seen item to unreviewed with no review note on first build', async () => {
    const app = createOkfMockApp(chainVault()) as unknown as App;
    const closure = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 2);
    expect(closure.items.every((item) => item.status === 'unreviewed')).toBe(true);
    expect(closure.items.every((item) => item.reviewNote === null)).toBe(true);
  });

  it('reverts approval to unreviewed when content changes after review (hash invalidation)', async () => {
    const files = chainVault();
    const app = createOkfMockApp(files) as unknown as App;
    const first = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 2);
    await writeExportScope(okfVaultFs(app), 'test.bundle', {
      seeds: ['concepts/seed'],
      maxCompiledHops: 2,
      items: first.items.map((item) => ({ id: item.id, status: 'approved' as const, contentHash: item.contentHash })),
    });

    // Edit one page after approval.
    files['concepts/hop1.md'] = knowledgePage('Hop1', 'Edited body. Links to [[hop2]] and cites [[Idea/raw-a.md]].');
    const app2 = createOkfMockApp(files) as unknown as App;
    await writeScopeFrom(app, app2);

    const second = await buildClosure(okfBundleSource(app2), 'test.bundle', ['concepts/seed'], 2);
    const edited = second.items.find((item) => item.id === 'concepts/hop1')!;
    const untouched = second.items.find((item) => item.id === 'concepts/seed')!;
    expect(edited.status).toBe('unreviewed');
    expect(edited.reviewNote).toBe('changed');
    expect(untouched.status).toBe('approved');
  });

  it('marks items entering an existing scope as new', async () => {
    const files = chainVault();
    const app = createOkfMockApp(files) as unknown as App;
    const first = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 1);
    await writeExportScope(okfVaultFs(app), 'test.bundle', {
      seeds: ['concepts/seed'],
      maxCompiledHops: 1,
      items: first.items.map((item) => ({ id: item.id, status: 'approved' as const, contentHash: item.contentHash })),
    });
    const app2 = createOkfMockApp(files) as unknown as App;
    await writeScopeFrom(app, app2);

    // Widening hops pulls hop2 into an existing scope → flagged as 'new'.
    const wider = await buildClosure(okfBundleSource(app2), 'test.bundle', ['concepts/seed'], 2);
    expect(wider.items.find((item) => item.id === 'concepts/hop2')?.reviewNote).toBe('new');
  });

  it('keeps two bundles fully independent in the scope file', async () => {
    const app = createOkfMockApp(chainVault()) as unknown as App;
    const closure = await buildClosure(okfBundleSource(app), 'bundle-a', ['concepts/seed'], 1);
    await writeExportScope(okfVaultFs(app), 'bundle-a', {
      seeds: ['concepts/seed'],
      maxCompiledHops: 1,
      items: closure.items.map((item) => ({ id: item.id, status: 'approved' as const, contentHash: item.contentHash })),
    });

    const other = await buildClosure(okfBundleSource(app), 'bundle-b', ['concepts/seed'], 1);
    expect(other.items.every((item) => item.status === 'unreviewed')).toBe(true);

    const scope = await readExportScope(okfVaultFs(app));
    expect(Object.keys(scope.bundles)).toEqual(['bundle-a']);
  });

  it('keeps flagged decisions durable even when the item leaves the closure', async () => {
    const app = createOkfMockApp(chainVault()) as unknown as App;
    const wide = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 2);
    await writeExportScope(okfVaultFs(app), 'test.bundle', {
      seeds: ['concepts/seed'],
      maxCompiledHops: 2,
      items: wide.items.map((item) => ({
        id: item.id,
        status: item.id === 'concepts/hop2' ? 'flagged' as const : 'approved' as const,
        contentHash: item.contentHash,
      })),
    });

    // Narrow the scope so hop2 falls out, then persist the narrower list.
    const narrow = await buildClosure(okfBundleSource(app), 'test.bundle', ['concepts/seed'], 1);
    await writeExportScope(okfVaultFs(app), 'test.bundle', {
      seeds: ['concepts/seed'],
      maxCompiledHops: 1,
      items: narrow.items.map((item) => ({ id: item.id, status: item.status, contentHash: item.contentHash })),
    });

    const scope = await readExportScope(okfVaultFs(app));
    expect(scope.bundles['test.bundle'].items['concepts/hop2'].status).toBe('flagged');
  });
});

// Copies the persisted scope file from one mock app instance to another so a
// "fresh session" sees the previous session's saved state.
async function writeScopeFrom(from: App, to: App): Promise<void> {
  const scope = await from.vault.adapter.read('.knowlery/export-scope.json');
  await to.vault.adapter.write('.knowlery/export-scope.json', scope);
}
