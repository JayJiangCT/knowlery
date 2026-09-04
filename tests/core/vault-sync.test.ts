import { describe, expect, it } from 'vitest';
import { createMemoryFs } from '../mocks/memory-fs';
import { compareVersions, runVaultSync } from '../../src/core/vault-sync';

function manifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: '0.1.0',
    platform: 'claude-code',
    kbName: 'KB',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });
}

describe('sync downgrade guard (spec 0.7 f5, §2.5)', () => {
  it('refuses an older tool and writes nothing', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': manifest({ lastSyncedBy: '0.8.0' }),
    });
    const result = await runVaultSync(fs, 'claude-code', '0.7.0');
    expect(result).toEqual({ skipped: 'newer-shell', lastSyncedBy: '0.8.0' });
    expect(fs.writeLog).toEqual([]);
  });

  it('runs for an equal version and records lastSyncedBy on first guarded run', async () => {
    const fs = createMemoryFs({ '.knowlery/manifest.json': manifest() });
    const result = await runVaultSync(fs, 'claude-code', '0.7.0');
    expect(result).toEqual({ skipped: false });
    const written = JSON.parse(fs.files.get('.knowlery/manifest.json')!) as { lastSyncedBy?: string };
    expect(written.lastSyncedBy).toBe('0.7.0');
  });

  it('runs for a newer tool and updates the record', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': manifest({ lastSyncedBy: '0.7.0' }),
    });
    const result = await runVaultSync(fs, 'claude-code', '0.8.0');
    expect(result).toEqual({ skipped: false });
    expect((JSON.parse(fs.files.get('.knowlery/manifest.json')!) as { lastSyncedBy?: string }).lastSyncedBy).toBe('0.8.0');
  });

  it('allows legacy vaults without the field or without a manifest', async () => {
    const withManifest = createMemoryFs({ '.knowlery/manifest.json': manifest() });
    expect(await runVaultSync(withManifest, 'claude-code', '0.7.0')).toEqual({ skipped: false });

    const legacy = createMemoryFs({ 'KNOWLEDGE.md': '# kb' });
    expect(await runVaultSync(legacy, 'claude-code', '0.7.0')).toEqual({ skipped: false });
  });

  it('bypasses the guard for dev builds (no parseable version)', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': manifest({ lastSyncedBy: '99.0.0' }),
    });
    const result = await runVaultSync(fs, 'claude-code', undefined);
    expect(result).toEqual({ skipped: false });
    // Nothing recorded either — dev builds neither honor nor set the record.
    expect((JSON.parse(fs.files.get('.knowlery/manifest.json')!) as { lastSyncedBy?: string }).lastSyncedBy).toBe('99.0.0');
  });

  it('ignores prerelease suffixes when ordering', () => {
    expect(compareVersions('0.7.0-beta.1', '0.7.0')).toBe(0);
    expect(compareVersions('0.7.1', '0.7.0-beta.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0);
  });
});

describe('sync retires the Knowlery-written opencode.json in favour of AGENTS.md', () => {
  it('removes a vault opencode.json that held only Knowlery keys (name + instructions)', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': manifest({ platform: 'opencode' }),
      'KNOWLEDGE.md': '# My KB\n',
      'opencode.json': JSON.stringify({
        name: 'My KB',
        instructions: ['KNOWLEDGE.md', '.agents/rules/*.md'],
      }, null, 2),
    });
    expect(await runVaultSync(fs, 'opencode')).toEqual({ skipped: false });
    expect(fs.files.has('opencode.json')).toBe(false);
    expect(fs.files.get('AGENTS.md')).toContain('# My KB');
  });

  it('keeps user keys and user instructions, dropping only the two Knowlery entries', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': manifest({ platform: 'opencode' }),
      'KNOWLEDGE.md': '# My KB\n',
      'opencode.json': JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        instructions: ['KNOWLEDGE.md', 'docs/team.md', '.agents/rules/*.md'],
      }, null, 2),
    });
    expect(await runVaultSync(fs, 'opencode')).toEqual({ skipped: false });
    const parsed = JSON.parse(fs.files.get('opencode.json')!) as { $schema: string; instructions: string[] };
    expect(parsed.$schema).toBe('https://opencode.ai/config.json');
    expect(parsed.instructions).toEqual(['docs/team.md']);
  });
});
