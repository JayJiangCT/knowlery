import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { isVaultInitialized } from '../../src/core/setup-executor';

function createMockApp(existingPaths: string[]): App {
  const pathSet = new Set(existingPaths);
  return {
    vault: {
      adapter: {
        exists: async (path: string) => pathSet.has(path),
      },
    },
  } as unknown as App;
}

describe('isVaultInitialized', () => {
  it('returns true when only KNOWLEDGE.md exists (legacy vault without manifest)', async () => {
    const app = createMockApp(['KNOWLEDGE.md']);
    expect(await isVaultInitialized(app)).toBe(true);
  });

  it('returns true when only .knowlery/manifest.json exists (new-style vault)', async () => {
    const app = createMockApp(['.knowlery/manifest.json']);
    expect(await isVaultInitialized(app)).toBe(true);
  });

  it('returns false when neither KNOWLEDGE.md nor .knowlery/manifest.json exists', async () => {
    const app = createMockApp([]);
    expect(await isVaultInitialized(app)).toBe(false);
  });
});
