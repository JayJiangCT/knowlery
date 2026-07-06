import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { buildClosure } from '../../src/core/okf/export-scope';
import { buildHeadlessLinkResolver } from '../../src/core/okf/link-resolver';
import { createOkfMockApp, okfBundleSource, okfVaultFs } from '../mocks/okf-app';

/**
 * Spec 0.8 f1, §5.4: on the eval fixture vault, the closure computed with the
 * headless LinkResolver equals the closure computed with a mock metadata cache —
 * same pages, same edges. This pins the headless resolution semantics (exact path,
 * then unique basename) to the Obsidian-cache behavior on realistic content.
 */

const FIXTURE_VAULT = join(__dirname, '..', '..', 'evals', 'fixtures', 'vault');

function loadFixtureFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files[relative(FIXTURE_VAULT, full).split(sep).join('/')] = readFileSync(full, 'utf8');
    }
  };
  walk(FIXTURE_VAULT);
  return files;
}

describe('headless LinkResolver parity (spec 0.8 f1, §5.4)', () => {
  it('computes the same closure as the mock metadata cache on the eval fixture vault', async () => {
    const files = loadFixtureFiles();
    const app = createOkfMockApp(files);
    const seeds = Object.keys(files)
      .filter((path) => path.startsWith('concepts/') && path.endsWith('.md'))
      .map((path) => path.replace(/\.md$/, ''));
    expect(seeds.length).toBeGreaterThan(3);

    const modalClosure = await buildClosure(okfBundleSource(app), 'parity.test', seeds, 2);

    const fs = okfVaultFs(app);
    const headlessClosure = await buildClosure(
      { fs, resolver: await buildHeadlessLinkResolver(fs) },
      'parity.test',
      seeds,
      2,
    );

    const pageIds = (closure: typeof modalClosure) => closure.pages.map((page) => page.conceptId).sort();
    const edgeKeys = (closure: typeof modalClosure) =>
      closure.edges.map((edge) => `${edge.from}->${edge.to}:${edge.kind}`).sort();
    const itemIds = (closure: typeof modalClosure) => closure.items.map((item) => item.id).sort();
    const outlinkTargets = (closure: typeof modalClosure) =>
      closure.pages
        .flatMap((page) => page.outlinks.map((link) => `${page.conceptId}:${link.raw}->${link.targetPath ?? 'null'}`))
        .sort();

    expect(headlessClosure.items.length).toBeGreaterThan(0);
    expect(pageIds(headlessClosure)).toEqual(pageIds(modalClosure));
    expect(edgeKeys(headlessClosure)).toEqual(edgeKeys(modalClosure));
    expect(itemIds(headlessClosure)).toEqual(itemIds(modalClosure));
    expect(outlinkTargets(headlessClosure)).toEqual(outlinkTargets(modalClosure));
  });
});
