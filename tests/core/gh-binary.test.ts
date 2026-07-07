import { describe, expect, it } from 'vitest';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveGhBinary } from '../../src/core/okf/gh-binary';

/**
 * Spec 0.9 f3 acceptance finding: GUI apps don't inherit the shell PATH, so all
 * default gh runners resolve the binary through candidate locations instead of
 * assuming bare `gh` works.
 */
describe('resolveGhBinary', () => {
  it('finds the first working candidate even when bare gh is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'knowlery-ghbin-'));
    const stub = join(dir, 'gh');
    await writeFile(stub, '#!/usr/bin/env node\nprocess.exit(0);\n');
    await chmod(stub, 0o755);
    try {
      expect(await resolveGhBinary(['/nonexistent/gh', stub])).toBe(stub);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns null when no candidate works', async () => {
    expect(await resolveGhBinary(['/nonexistent/a', '/nonexistent/b'])).toBeNull();
  });
});
