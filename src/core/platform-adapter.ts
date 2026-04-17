import { App, normalizePath } from 'obsidian';
import type { Platform } from '../types';
import { generateClaudeMd, generateOpenCodeJson } from '../assets/templates';

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
  const claudeDir = normalizePath('.claude');
  const rulesDir = normalizePath('.claude/rules');

  await ensureDir(app, claudeDir);
  await ensureDir(app, rulesDir);

  const claudeMdPath = normalizePath('.claude/CLAUDE.md');
  const content = generateClaudeMd();

  const existing = app.vault.getFileByPath(claudeMdPath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(claudeMdPath, content);
  }
}

async function generateOpenCodeConfig(app: App, kbName: string): Promise<void> {
  const agentsRulesDir = normalizePath('.agents/rules');
  await ensureDir(app, agentsRulesDir);

  const configPath = normalizePath('opencode.json');
  const content = generateOpenCodeJson(kbName);

  const existing = app.vault.getFileByPath(configPath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(configPath, content);
  }
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

  const fromFolder = app.vault.getFolderByPath(normalizePath(fromRulesDir));
  if (fromFolder) {
    for (const child of fromFolder.children) {
      if (child.name.endsWith('.md')) {
        const content = await app.vault.cachedRead(child as any);
        const destPath = normalizePath(`${toRulesDir}/${child.name}`);
        const destFile = app.vault.getFileByPath(destPath);
        if (destFile) {
          await app.vault.modify(destFile, content);
        } else {
          await app.vault.create(destPath, content);
        }
      }
    }
  }

  await generatePlatformConfig(app, to, kbName);

  if (!keepOldConfig) {
    await cleanupPlatformConfig(app, from);
  }
}

async function cleanupPlatformConfig(app: App, platform: Platform): Promise<void> {
  if (platform === 'claude-code') {
    const claudeMd = app.vault.getFileByPath(normalizePath('.claude/CLAUDE.md'));
    if (claudeMd) await app.vault.trash(claudeMd, true);
  } else {
    const openCodeJson = app.vault.getFileByPath(normalizePath('opencode.json'));
    if (openCodeJson) await app.vault.trash(openCodeJson, true);
  }
}

async function ensureDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!app.vault.getFolderByPath(normalized)) {
    await app.vault.createFolder(normalized);
  }
}
