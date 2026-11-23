import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { KF_VERSION } from '../version';
import { readConfig } from './config';
import { renderConventions } from './conventions';
import { KnowleryError } from './errors';
import { listPages } from './page/files';
import type { ParsedPage } from './page/model';
import { parsePage } from './page/parse';
import { isMissing } from './paths';
import { renderWikiIndex } from './wiki-index';

export const AGENTS_LINES: readonly string[] = [
  'This folder is a Knowlery knowledge base. Raw sources stay untouched; compiled pages are in wiki/.',
  'Before reading or editing anything under wiki/, read wiki/CONVENTIONS.md and follow it.',
  'Use the knowlery command to search, read, list stale sources and validate. Never edit .knowlery/.',
];

const V1_MARKERS = ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base'] as const;

const DEFAULT_CONFIG_TEXT = `${JSON.stringify({ kf: KF_VERSION, ignore: [], mcp: { raw: true } }, null, 2)}\n`;

const INITIAL_LOG_TEXT = [
  '# Log',
  '',
  'Append-only log of wiki edits, one line per batch: `- YYYY-MM-DD · <what> · by <actor>`.',
  '',
].join('\n');

export interface InitResult {
  created: string[];
  kept: string[];
  agents_md: 'written' | 'kept';
  agents_lines: string[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function initKb(root: string): Promise<InitResult> {
  for (const marker of V1_MARKERS) {
    if (await pathExists(join(root, marker))) {
      throw new KnowleryError(
        'unsupported_schema',
        `Found ${marker}: this looks like a Knowlery 1.x vault or another tool's folder.`,
        'Knowlery 2.0 does not convert 1.x vaults; start from a folder of raw files.',
      );
    }
  }

  let hasAcceptedConfig = false;
  try {
    await readConfig(root);
    hasAcceptedConfig = true;
  } catch (error) {
    if (error instanceof KnowleryError && error.code === 'not_found') {
      hasAcceptedConfig = false;
    } else if (error instanceof KnowleryError && (error.code === 'invalid_config' || error.code === 'unsupported_schema')) {
      throw new KnowleryError(
        'unsupported_schema',
        'Found .knowlery/config.json that is not a Knowlery 2.0 config: this looks like a Knowlery 1.x vault or another tool\'s folder.',
        'Knowlery 2.0 does not convert 1.x vaults; start from a folder of raw files.',
      );
    } else {
      throw error;
    }
  }

  if (!hasAcceptedConfig && await pathExists(join(root, '.knowlery'))) {
    throw new KnowleryError(
      'unsupported_schema',
      'Found .knowlery/ without a valid Knowlery 2.0 config.json: this looks like a Knowlery 1.x vault or another tool\'s folder.',
      'Knowlery 2.0 does not convert 1.x vaults; start from a folder of raw files.',
    );
  }

  if (!hasAcceptedConfig && await pathExists(join(root, 'wiki'))) {
    throw new KnowleryError(
      'unsupported_schema',
      'Found wiki/ without a Knowlery 2.0 config: wiki/ was not created by Knowlery 2.0.',
      'Rename wiki/ or choose another root.',
    );
  }

  const created: string[] = [];
  const kept: string[] = [];

  // 1. .knowlery/config.json
  const configPath = join(root, '.knowlery/config.json');
  if (hasAcceptedConfig) {
    kept.push('.knowlery/config.json');
  } else {
    await mkdir(join(root, '.knowlery'), { recursive: true });
    await writeFile(configPath, DEFAULT_CONFIG_TEXT, { encoding: 'utf8', flag: 'wx' });
    created.push('.knowlery/config.json');
  }

  // 2. wiki/ directory
  const wikiDir = join(root, 'wiki');
  if (await pathExists(wikiDir)) {
    const info = await lstat(wikiDir);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new KnowleryError(
        'unsupported_schema',
        'wiki/ is not a regular directory.',
        'Rename wiki/ or choose another root.',
      );
    }
  } else {
    await mkdir(wikiDir, { recursive: false });
    created.push('wiki/');
  }

  // 3. wiki/CONVENTIONS.md
  const conventionsPath = join(wikiDir, 'CONVENTIONS.md');
  if (await pathExists(conventionsPath)) {
    kept.push('wiki/CONVENTIONS.md');
  } else {
    await writeFile(conventionsPath, renderConventions(), { encoding: 'utf8', flag: 'wx' });
    created.push('wiki/CONVENTIONS.md');
  }

  // 4. wiki/index.md
  const indexPath = join(wikiDir, 'index.md');
  if (await pathExists(indexPath)) {
    kept.push('wiki/index.md');
  } else {
    const pagePaths = await listPages(root);
    const pages: ParsedPage[] = [];
    for (const pagePath of pagePaths) {
      const text = await readFile(join(root, pagePath), 'utf8');
      pages.push(parsePage(text, basename(pagePath)));
    }
    await writeFile(indexPath, renderWikiIndex(pages), { encoding: 'utf8', flag: 'wx' });
    created.push('wiki/index.md');
  }

  // 5. wiki/log.md
  const logPath = join(wikiDir, 'log.md');
  if (await pathExists(logPath)) {
    kept.push('wiki/log.md');
  } else {
    await writeFile(logPath, INITIAL_LOG_TEXT, { encoding: 'utf8', flag: 'wx' });
    created.push('wiki/log.md');
  }

  // 6. AGENTS.md
  const agentsPath = join(root, 'AGENTS.md');
  let agentsMd: 'written' | 'kept';
  if (await pathExists(agentsPath)) {
    kept.push('AGENTS.md');
    agentsMd = 'kept';
  } else {
    await writeFile(agentsPath, `${AGENTS_LINES.join('\n')}\n`, { encoding: 'utf8', flag: 'wx' });
    created.push('AGENTS.md');
    agentsMd = 'written';
  }

  return {
    created,
    kept,
    agents_md: agentsMd,
    agents_lines: [...AGENTS_LINES],
  };
}
