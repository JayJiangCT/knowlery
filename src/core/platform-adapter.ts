import { App, normalizePath } from 'obsidian';
import type { Platform } from '../types';
import { generateClaudeMd, generateOpenCodeJson } from '../assets/templates';
import { ensureDir, writeFile } from './vault-io';

export async function generatePlatformConfig(
  app: App,
  platform: Platform,
  kbName: string,
): Promise<void> {
  if (platform === 'claude-code') {
    await generateClaudeCodeConfig(app);
  } else {
    await generateOpenCodeConfig(app, kbName);
  }
}

async function generateClaudeCodeConfig(app: App): Promise<void> {
  await ensureDir(app, '.claude');
  await ensureDir(app, '.claude/rules');
  await writeFile(app, '.claude/CLAUDE.md', generateClaudeMd());
}

async function generateOpenCodeConfig(app: App, kbName: string): Promise<void> {
  await ensureDir(app, '.agents/rules');
  await writeFile(app, 'opencode.json', generateOpenCodeJson(kbName));
}

export function getRulesDir(platform: Platform): string {
  return platform === 'claude-code' ? '.claude/rules' : '.agents/rules';
}

export async function migratePlatform(
  app: App,
  from: Platform,
  to: Platform,
  kbName: string,
  keepOldConfig: boolean,
): Promise<void> {
  const fromRulesDir = getRulesDir(from);
  const toRulesDir = getRulesDir(to);

  await ensureDir(app, normalizePath(toRulesDir));

  const adapter = app.vault.adapter;
  const fromDirPath = normalizePath(fromRulesDir);
  if (await adapter.exists(fromDirPath)) {
    const listing = await adapter.list(fromDirPath);
    for (const filePath of listing.files) {
      if (!filePath.endsWith('.md')) continue;
      const filename = filePath.split('/').pop()!;
      const content = await adapter.read(normalizePath(filePath));
      await writeFile(app, `${toRulesDir}/${filename}`, content);
    }
  }

  await generatePlatformConfig(app, to, kbName);

  if (!keepOldConfig) {
    await cleanupPlatformConfig(app, from);
  }
}

async function cleanupPlatformConfig(app: App, platform: Platform): Promise<void> {
  const adapter = app.vault.adapter;
  if (platform === 'claude-code') {
    const path = normalizePath('.claude/CLAUDE.md');
    if (await adapter.exists(path)) await adapter.remove(path);
  } else {
    const path = normalizePath('opencode.json');
    if (await adapter.exists(path)) await adapter.remove(path);
  }
}

