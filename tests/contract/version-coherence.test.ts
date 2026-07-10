import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_INFO } from '../../src/core/mcp/server';

/**
 * Version-stamp coherence (spec 1.0 f5, §5.3): every place a version is
 * stamped must agree. The two 0.9 release-prep misses (stale knowleryVersion
 * bundle stamp; out-of-sync package-lock) become impossible to ship again.
 */

const root = join(__dirname, '..', '..');
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;

describe('one version everywhere', () => {
  const packageVersion = readJson('package.json').version as string;

  it('package-lock.json agrees', () => {
    expect(readJson('package-lock.json').version).toBe(packageVersion);
  });

  it('manifest.json agrees', () => {
    expect(readJson('manifest.json').version).toBe(packageVersion);
  });

  it('versions.json head entry agrees', () => {
    expect(Object.keys(readJson('versions.json') as object)[0]).toBe(packageVersion);
  });

  it('the MCP server info agrees', () => {
    expect(SERVER_INFO.version).toBe(packageVersion);
  });

  it('the bundle knowleryVersion stamp agrees', () => {
    const compile = readFileSync(join(root, 'src', 'core', 'okf', 'compile.ts'), 'utf8');
    const stamp = compile.match(/knowleryVersion: '([^']+)'/)?.[1];
    expect(stamp).toBe(packageVersion);
  });

  it('the plugin manifests and the marketplace catalog agree (spec 1.1 f3, §5.4)', () => {
    for (const path of [
      'plugin/.claude-plugin/plugin.json',
      'plugin/.codex-plugin/plugin.json',
      'plugin/.cursor-plugin/plugin.json',
    ]) {
      expect((readJson(path) as { version: string }).version, path).toBe(packageVersion);
    }
    const catalog = readJson('.claude-plugin/marketplace.json') as { plugins: Array<{ version: string }> };
    expect(catalog.plugins[0].version).toBe(packageVersion);
  });
});
