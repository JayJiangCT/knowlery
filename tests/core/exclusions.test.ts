import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  ALWAYS_IGNORED_DIRS,
  NO_EXCLUSIONS,
  PROJECT_MARKERS,
  PROJECT_OUTPUT_DIRS,
  ignoreReasonForDir,
  isIgnoredPath,
  listIgnoredDirs,
  projectRootsFromFiles,
  type ExclusionContext,
} from '../../src/core/query/exclusions';
import { CONFIG_PATH } from '../../src/core/reference-config';
import { scanVault } from '../../src/core/query/scan';
import { computeStaleness } from '../../src/core/query/staleness';

const NOTE = (title: string) => `---\ntitle: ${title}\n---\n\n${title}.\n`;

function makeVault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'knowlery-excl-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('ignoreReasonForDir', () => {
  const ctx: ExclusionContext = { projectRoots: new Set(['projects/app']), ignoreDirs: ['archive/2019'] };

  it('always ignores names that are never notes, wherever they sit', () => {
    for (const name of ALWAYS_IGNORED_DIRS) {
      expect(ignoreReasonForDir(name, NO_EXCLUSIONS)).toBe('builtin');
      expect(ignoreReasonForDir(`deep/er/${name}`, NO_EXCLUSIONS)).toBe('builtin');
    }
  });

  it('ignores build-output names only when the parent holds a project manifest', () => {
    for (const name of PROJECT_OUTPUT_DIRS) {
      expect(ignoreReasonForDir(`projects/app/${name}`, ctx)).toBe('project-output');
      // The same name as a plain notes folder, or inside a project but not at its root, is scanned.
      expect(ignoreReasonForDir(name, ctx)).toBeNull();
      expect(ignoreReasonForDir(`projects/app/src/${name}`, ctx)).toBeNull();
    }
  });

  it('ignores exactly the configured directories', () => {
    expect(ignoreReasonForDir('archive/2019', ctx)).toBe('config');
    expect(ignoreReasonForDir('archive', ctx)).toBeNull();
    expect(ignoreReasonForDir('archive/2020', ctx)).toBeNull();
  });
});

describe('isIgnoredPath', () => {
  const ctx: ExclusionContext = { projectRoots: new Set(['']), ignoreDirs: ['archive'] };

  it('excludes files under hidden, built-in, project-output, or configured ancestors', () => {
    expect(isIgnoredPath('.obsidian/plugins/x/README.md', ctx)).toBe(true);
    expect(isIgnoredPath('a/node_modules/b/README.md', ctx)).toBe(true);
    expect(isIgnoredPath('dist/index.md', ctx)).toBe(true); // vault root is a project root here
    expect(isIgnoredPath('archive/old/note.md', ctx)).toBe(true);
  });

  it('keeps everything else, including files whose own name matches an excluded directory name', () => {
    expect(isIgnoredPath('notes/dist.md', ctx)).toBe(false);
    expect(isIgnoredPath('src/dist/readme.md', ctx)).toBe(false); // src/ holds no manifest
    expect(isIgnoredPath('archived/note.md', ctx)).toBe(false);
  });
});

describe('projectRootsFromFiles', () => {
  it('maps every manifest file to its directory, with the vault root as the empty string', () => {
    const roots = projectRootsFromFiles(['package.json', 'projects/app/Cargo.toml', 'projects/app/src/main.rs', 'notes/Makefile.md']);
    expect([...roots].sort()).toEqual(['', 'projects/app']);
    for (const marker of PROJECT_MARKERS) expect(projectRootsFromFiles([`x/${marker}`]).has('x')).toBe(true);
  });
});

describe('listIgnoredDirs', () => {
  it('reports outermost excluded directories only, sorted, never hidden ones', () => {
    const ctx: ExclusionContext = { projectRoots: new Set(['projects/app']), ignoreDirs: ['archive'] };
    const dirs = [
      '.obsidian', '.obsidian/plugins', 'archive', 'archive/2019', 'projects', 'projects/app',
      'projects/app/dist', 'projects/app/dist/assets', 'projects/app/node_modules',
      'projects/app/node_modules/dep', 'projects/app/node_modules/dep/dist', 'notes', 'notes/build',
    ];
    expect(listIgnoredDirs(dirs, ctx)).toEqual([
      { path: 'archive', reason: 'config' },
      { path: 'projects/app/dist', reason: 'project-output' },
      { path: 'projects/app/node_modules', reason: 'builtin' },
    ]);
  });
});

describe('scanVault exclusions end to end', () => {
  it('skips junk, keeps same-named notes folders, honors ignoreDirs, and reports every skip', () => {
    const root = makeVault({
      'Daily/note.md': NOTE('Daily'),
      'build/plan.md': NOTE('Build plan'),
      'projects/app/package.json': '{}',
      'projects/app/README.md': NOTE('App readme'),
      'projects/app/dist/README.md': NOTE('Built'),
      'projects/app/node_modules/dep/README.md': NOTE('Dep'),
      'projects/app/node_modules/dep/CHANGELOG.md': NOTE('Dep changelog'),
      'projects/lib/__pycache__/x.md': NOTE('Cache'),
      'projects/lib/src/notes.md': NOTE('Lib notes'),
      'archive/old.md': NOTE('Old'),
      [CONFIG_PATH]: JSON.stringify({ schemaVersion: 1, ignoreDirs: ['archive'] }),
    });
    try {
      const snapshot = scanVault(root);
      expect(snapshot.pages.map((page) => page.path).sort()).toEqual([
        'Daily/note.md',
        'build/plan.md',
        'projects/app/README.md',
        'projects/lib/src/notes.md',
      ]);
      expect(snapshot.ignoreDirs).toEqual(['archive']);
      expect(snapshot.ignoredDirs).toEqual([
        { path: 'archive', reason: 'config' },
        { path: 'projects/app/dist', reason: 'project-output' },
        { path: 'projects/app/node_modules', reason: 'builtin' },
        { path: 'projects/lib/__pycache__', reason: 'builtin' },
      ]);
      // Not scanned means not uncooked either — the 871-READMEs problem.
      expect(computeStaleness(snapshot).uncookedNotes.map((note) => note.path).sort()).toEqual([
        'Daily/note.md',
        'build/plan.md',
        'projects/app/README.md',
        'projects/lib/src/notes.md',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a malformed config drops ignoreDirs too, loudly', () => {
    const root = makeVault({ 'archive/old.md': NOTE('Old'), [CONFIG_PATH]: '{ not json' });
    try {
      const snapshot = scanVault(root);
      expect(snapshot.ignoreDirs).toEqual([]);
      expect(snapshot.ignoredDirs).toEqual([]);
      expect(snapshot.pages.map((page) => page.path)).toEqual(['archive/old.md']);
      expect(snapshot.referenceConfigError).toContain('not valid JSON');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
