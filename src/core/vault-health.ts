import { App, normalizePath, TFile } from 'obsidian';
import type {
  ConfigIntegrity,
  DiagnosisResult,
  Platform,
  VaultStats,
} from '../types';
import { BUILTIN_SKILL_NAMES, KNOWLEDGE_DIRS } from '../types';
import { getRulesDir } from './platform-adapter';
import { detectAgentCli } from './cli-detect';

export function getVaultStats(app: App): VaultStats {
  const mdFiles = app.vault.getMarkdownFiles();
  let wikilinksCount = 0;

  for (const file of mdFiles) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.links) {
      wikilinksCount += cache.links.length;
    }
    if (cache?.embeds) {
      wikilinksCount += cache.embeds.length;
    }
  }

  return {
    notesCount: mdFiles.length,
    wikilinksCount,
    entitiesCount: countFilesInDir(app, 'entities'),
    conceptsCount: countFilesInDir(app, 'concepts'),
    comparisonsCount: countFilesInDir(app, 'comparisons'),
    queriesCount: countFilesInDir(app, 'queries'),
  };
}

function countFilesInDir(app: App, dirName: string): number {
  const folder = app.vault.getFolderByPath(normalizePath(dirName));
  if (!folder) return 0;
  return folder.children.filter(c => c instanceof TFile && c.name.endsWith('.md')).length;
}

export async function runDiagnosis(app: App): Promise<DiagnosisResult> {
  const mdFiles = app.vault.getMarkdownFiles();

  const incomingLinks = new Map<string, number>();
  for (const file of mdFiles) {
    incomingLinks.set(file.path, 0);
  }

  const brokenWikilinks: DiagnosisResult['brokenWikilinks'] = [];

  for (const file of mdFiles) {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.links) continue;

    for (const link of cache.links) {
      const target = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (target) {
        incomingLinks.set(target.path, (incomingLinks.get(target.path) || 0) + 1);
      } else {
        brokenWikilinks.push({ file: file.path, link: link.link });
      }
    }
  }

  const orphanNotes = mdFiles
    .filter(f => (incomingLinks.get(f.path) || 0) === 0)
    .filter(f => !isSystemFile(f.path))
    .map(f => f.path);

  const missingFrontmatter = await checkFrontmatter(app, mdFiles);

  return { orphanNotes, brokenWikilinks, missingFrontmatter };
}

async function checkFrontmatter(
  app: App,
  files: TFile[],
): Promise<DiagnosisResult['missingFrontmatter']> {
  const results: DiagnosisResult['missingFrontmatter'] = [];

  const requiredByType: Record<string, string[]> = {
    entity: ['type', 'created'],
    concept: ['type', 'created'],
    comparison: ['type', 'items', 'created'],
    query: ['type', 'status', 'created'],
  };

  for (const file of files) {
    const dir = file.path.split('/')[0];
    if (!KNOWLEDGE_DIRS.includes(dir as any)) continue;

    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) {
      results.push({ file: file.path, missingFields: ['(no frontmatter)'] });
      continue;
    }

    const type = fm.type as string;
    const required = requiredByType[type] || requiredByType[dirToType(dir)] || [];
    const missing = required.filter(field => !(field in fm));
    if (missing.length > 0) {
      results.push({ file: file.path, missingFields: missing });
    }
  }

  return results;
}

function dirToType(dir: string): string {
  const map: Record<string, string> = {
    entities: 'entity',
    concepts: 'concept',
    comparisons: 'comparison',
    queries: 'query',
  };
  return map[dir] || '';
}

function isSystemFile(path: string): boolean {
  return path.startsWith('.') || path === 'KNOWLEDGE.md' || path === 'SCHEMA.md';
}

export async function checkConfigIntegrity(app: App, platform: Platform): Promise<ConfigIntegrity> {
  const adapter = app.vault.adapter;

  const existingDirs: string[] = [];
  const missingDirs: string[] = [];
  for (const d of KNOWLEDGE_DIRS) {
    if (app.vault.getFolderByPath(normalizePath(d))) {
      existingDirs.push(d);
    } else {
      missingDirs.push(d);
    }
  }

  const rulesDir = getRulesDir(platform);
  const rulesDirPath = normalizePath(rulesDir);
  let rulesConfigured = false;
  if (await adapter.exists(rulesDirPath)) {
    const listing = await adapter.list(rulesDirPath);
    rulesConfigured = listing.files.length > 0;
  }

  const presentSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const name of BUILTIN_SKILL_NAMES) {
    const path = normalizePath(`.agents/skills/${name}/SKILL.md`);
    if (await adapter.exists(path)) {
      presentSkills.push(name);
    } else {
      missingSkills.push(name);
    }
  }

  const agentConfigPath = platform === 'claude-code'
    ? normalizePath('.claude/CLAUDE.md')
    : normalizePath('opencode.json');
  const agentConfigExists = await adapter.exists(agentConfigPath);

  let obsidianCli = false;
  try {
    const electron = (window as any).electron;
    if (electron?.ipcRenderer) {
      obsidianCli = !!electron.ipcRenderer.sendSync('cli', null);
    }
  } catch {
    // Not available on mobile or restricted environments
  }

  const cliDetection = await detectAgentCli();

  return {
    knowledgeMdExists: app.vault.getFileByPath(normalizePath('KNOWLEDGE.md')) !== null,
    schemaMdExists: app.vault.getFileByPath(normalizePath('SCHEMA.md')) !== null,
    knowledgeDirsComplete: {
      exists: existingDirs,
      missing: missingDirs,
    },
    agentConfigExists,
    rulesConfigured,
    skillsComplete: { present: presentSkills, missing: missingSkills },
    obsidianCli,
    claudeCodeCli: cliDetection.claudeCode.installed,
    opencodeCli: cliDetection.opencode.installed,
    platform,
  };
}
