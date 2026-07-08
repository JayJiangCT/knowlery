import { describe, expect, it } from 'vitest';
import { createMemoryFs } from '../mocks/memory-fs';
import { executeSetup } from '../../src/core/setup-executor';
import {
  ManifestSchema,
  InstalledBundlesFileSchema,
  BundleManifestSchema,
  KbRegistrySchema,
} from '../../src/types';

/**
 * The 1.0 format contract (spec 1.0 f5, §4.2.3): state written by 1.0.0 must
 * parse with every 1.x schema, forever. The fixtures below are literal 1.0.0
 * output — do not update them to match schema changes; fix the schema to keep
 * reading them.
 */

describe('1.0.0 state files parse with the live schemas — forever', () => {
  it('.knowlery/manifest.json', () => {
    expect(() => ManifestSchema.parse({
      version: '0.1.0',
      platform: 'claude-code',
      kbName: 'Contract KB',
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
      lastSyncedBy: '1.0.0',
    })).not.toThrow();
  });

  it('.knowlery/bundles.json (schemaVersion 1)', () => {
    expect(() => InstalledBundlesFileSchema.parse({
      schemaVersion: 1,
      bundles: {
        'creator.topic': {
          version: '1.0.0',
          title: 'Topic',
          source: 'https://example.com/bundle.zip',
          installedAt: '2026-07-08T00:00:00.000Z',
          libraryPath: 'Library/creator.topic',
          manifestContentHash: 'sha256-abc',
          installedContentHash: 'sha256-def',
          fileHashes: { 'index.md': 'sha256-1' },
          conformance: 'passed',
          conformanceErrorCount: 0,
        },
      },
    })).not.toThrow();
  });

  it('knowlery-bundle.json (OKF schemaVersion 1)', () => {
    expect(() => BundleManifestSchema.parse({
      schemaVersion: 1,
      okfVersion: '0.1',
      id: 'creator.topic',
      title: 'Topic',
      version: '1.0.0',
      creator: { name: 'Creator', url: '' },
      releasedAt: '2026-07-08T00:00:00.000Z',
      entrypoint: 'index.md',
      contentHash: 'sha256-abc',
      license: 'personal',
      knowleryVersion: '1.0.0',
      conceptCount: 1,
    })).not.toThrow();
  });

  it('registry.json (schemaVersion 1) and the name grammar', () => {
    expect(() => KbRegistrySchema.parse({
      schemaVersion: 1,
      kbs: { work: { path: '/home/user/kb' }, 'side-project_2': { path: '/home/user/kb2' } },
    })).not.toThrow();
  });
});

describe('the workspace scaffold is 1.0-frozen', () => {
  it('init creates exactly the frozen file-and-directory surface', async () => {
    const fs = createMemoryFs();
    await executeSetup(fs, 'claude-code', 'Contract KB', () => { /* progress unused */ });

    // Top-level surface (spec f5, §4.1.1). Skill payloads under the skill dirs
    // are content, not surface — presence of the dirs is what is frozen.
    const topLevelFiles = [...fs.files.keys()].filter((path) => !path.includes('/')).sort();
    expect(topLevelFiles).toEqual(['INDEX.base', 'KNOWLEDGE.md', 'SCHEMA.md', 'skills-lock.json']);

    for (const dir of ['entities', 'concepts', 'comparisons', 'queries', '.agents/skills', '.claude/skills', '.knowlery']) {
      expect(fs.dirs.has(dir), dir).toBe(true);
    }
    expect(fs.files.has('.knowlery/manifest.json')).toBe(true);
    expect(fs.files.has('.knowlery/bin/query.mjs')).toBe(true);
    expect(fs.files.has('.claude/CLAUDE.md')).toBe(true);
  });
});
