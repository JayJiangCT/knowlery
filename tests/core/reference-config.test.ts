import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONFIG_PATH,
  RESERVED_TOP_LEVEL,
  ReferenceDirError,
  addDir,
  addReferenceDir,
  emptyConfig,
  isUnderReferenceDir,
  normalizeReferenceDir,
  parseConfig,
  readConfig,
  removeReferenceDir,
} from '../../src/core/reference-config';
import { AGENT_DIRS, scanVault } from '../../src/core/query/scan';
import { computeStaleness } from '../../src/core/query/staleness';
import { runQuery } from '../../src/core/query/engine';
import { nodeVaultFs } from '../../src/platform/node-fs';

const NOTE = (title: string) => `---\ntitle: ${title}\ntype: project\n---\n\n${title} describes the payout retry policy.\n`;

function makeVault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'knowlery-refdirs-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('reference-config parsing', () => {
  it('a missing or empty file is an empty config', () => {
    expect(parseConfig(null).referenceDirs).toEqual([]);
    expect(parseConfig('').referenceDirs).toEqual([]);
    expect(parseConfig('{}').referenceDirs).toEqual([]);
  });

  it('normalizes and dedupes directories', () => {
    const config = parseConfig(JSON.stringify({ referenceDirs: ['teams/', './teams', 'archive\\old'] }));
    expect(config.referenceDirs).toEqual(['archive/old', 'teams']);
  });

  it('malformed content is loud, not an empty list (silently un-referencing everything is worse)', () => {
    expect(() => parseConfig('{')).toThrow(ReferenceDirError);
    expect(() => parseConfig(JSON.stringify({ referenceDirs: 'teams' }))).toThrow(ReferenceDirError);
  });

  it('carries ignoreDirs alongside referenceDirs, and refuses a directory in both', () => {
    expect(emptyConfig()).toEqual({ schemaVersion: 1, referenceDirs: [], ignoreDirs: [] });
    const config = parseConfig(JSON.stringify({ referenceDirs: ['teams'], ignoreDirs: ['archive/', 'archive'] }));
    expect(config.ignoreDirs).toEqual(['archive']);
    expect(() => parseConfig(JSON.stringify({ ignoreDirs: 'archive' }))).toThrow(ReferenceDirError);
    expect(() => parseConfig(JSON.stringify({ referenceDirs: ['teams'], ignoreDirs: ['teams'] })))
      .toThrow(/cannot be both/);
  });

  it('reserved directories pin to the scanner\'s AGENT_DIRS plus Library and inbox', () => {
    for (const dir of AGENT_DIRS) expect(RESERVED_TOP_LEVEL.has(dir)).toBe(true);
    expect(RESERVED_TOP_LEVEL.has('Library')).toBe(true);
    expect(RESERVED_TOP_LEVEL.has('inbox')).toBe(true);
  });
});

describe('normalizeReferenceDir', () => {
  it('rejects paths that cannot be reference directories', () => {
    for (const bad of ['', '/abs/path', 'C:\\vault\\teams', '../outside', 'a/../b', '.hidden', 'teams/.git', 'entities', 'Library/x', 'inbox']) {
      expect(() => normalizeReferenceDir(bad), bad).toThrow(ReferenceDirError);
    }
  });

  it('accepts nested directories and strips decoration', () => {
    expect(normalizeReferenceDir(' ./teams/team-a-kb/ ')).toBe('teams/team-a-kb');
  });
});

describe('isUnderReferenceDir', () => {
  it('matches by directory boundary, not string prefix', () => {
    expect(isUnderReferenceDir('teams/team-a/x.md', ['teams'])).toBe(true);
    expect(isUnderReferenceDir('teamsters/x.md', ['teams'])).toBe(false);
    expect(isUnderReferenceDir('teams.md', ['teams'])).toBe(false);
  });
});

describe('reference directories end to end', () => {
  it('stay queryable but leave the uncooked list — the Library/ treatment, user-named', () => {
    const root = makeVault({
      'Projects/mine.md': NOTE('My payout note'),
      'teams/team-a-kb/shared.md': NOTE('Team A payout note'),
      [CONFIG_PATH]: JSON.stringify({ schemaVersion: 1, referenceDirs: ['teams'] }),
    });
    try {
      const snapshot = scanVault(root);
      expect(snapshot.referenceDirs).toEqual(['teams']);
      expect(snapshot.pages.map((page) => page.path).sort()).toEqual(['Projects/mine.md', 'teams/team-a-kb/shared.md']);

      const uncooked = computeStaleness(snapshot).uncookedNotes.map((note) => note.path);
      expect(uncooked).toEqual(['Projects/mine.md']);

      const hits = runQuery('payout retry policy', snapshot, 10).candidates.map((candidate) => candidate.path).sort();
      expect(hits).toEqual(['Projects/mine.md', 'teams/team-a-kb/shared.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a malformed config degrades the scan to no reference dirs rather than failing the query', () => {
    const root = makeVault({ 'teams/x.md': NOTE('X'), [CONFIG_PATH]: '{ not json' });
    try {
      const snapshot = scanVault(root);
      expect(snapshot.referenceDirs).toEqual([]);
      expect(snapshot.referenceConfigError).toContain('not valid JSON');
      expect(computeStaleness(snapshot).uncookedNotes.map((note) => note.path)).toEqual(['teams/x.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('add / remove', () => {
  it('writes a sorted, deduplicated list and refuses directories that do not exist', async () => {
    const root = makeVault({ 'teams/a.md': NOTE('A'), 'teams/sub/c.md': NOTE('C'), 'vendors/b.md': NOTE('B') });
    const fs = nodeVaultFs(root);
    try {
      expect((await addReferenceDir(fs, 'vendors/')).added).toBe(true);
      expect((await addReferenceDir(fs, 'teams')).referenceDirs).toEqual(['teams', 'vendors']);
      expect((await addReferenceDir(fs, 'teams')).added).toBe(false);
      // Nested under an existing reference dir: already covered, list stays minimal.
      expect((await addReferenceDir(fs, 'teams/sub')).added).toBe(false);
      await expect(addReferenceDir(fs, 'nope')).rejects.toThrow(ReferenceDirError);

      expect((await removeReferenceDir(fs, 'vendors')).referenceDirs).toEqual(['teams']);
      expect((await removeReferenceDir(fs, 'vendors')).removed).toBe(false);
      expect((await readConfig(fs)).referenceDirs).toEqual(['teams']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the two lists disjoint: a dir in one list (or under it) cannot join the other', async () => {
    const root = makeVault({ 'teams/a.md': NOTE('A'), 'teams/sub/c.md': NOTE('C'), 'archive/b.md': NOTE('B') });
    const fs = nodeVaultFs(root);
    try {
      await addDir(fs, 'referenceDirs', 'teams');
      await expect(addDir(fs, 'ignoreDirs', 'teams')).rejects.toThrow(/already a reference directory/);
      await expect(addDir(fs, 'ignoreDirs', 'teams/sub')).rejects.toThrow(/already a reference directory/);
      expect((await addDir(fs, 'ignoreDirs', 'archive')).dirs).toEqual(['archive']);
      await expect(addDir(fs, 'referenceDirs', 'archive')).rejects.toThrow(/already an ignored directory/);
      expect(await readConfig(fs)).toEqual({ schemaVersion: 1, referenceDirs: ['teams'], ignoreDirs: ['archive'] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
