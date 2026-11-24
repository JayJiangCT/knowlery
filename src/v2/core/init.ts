import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { SKILLS } from '../skills';
import { KF_VERSION } from '../version';
import { Beta1WikiError, checkBeta1Wiki, readConfig } from './config';
import { renderConventions } from './conventions';
import { invalidInvocation, KnowleryError } from './errors';
import { checkGitWikiIgnore, type GitCheckIgnoreRunner, type GitIgnoreState } from './git';
import { listPages } from './page/files';
import type { ParsedPage } from './page/model';
import { parsePage } from './page/parse';
import { isMissing, relativePath, resolveInside, WIKI_DIR } from './paths';
import { renderWikiIndex } from './wiki-index';

export const DEFAULT_SKILLS_DIR = '.agents/skills';

export const BETA1_AGENTS_LINES: readonly string[] = [
  'This folder is a Knowlery knowledge base. Raw sources stay untouched; compiled pages are in wiki/.',
  'Before reading or editing anything under wiki/, read wiki/CONVENTIONS.md and follow it.',
  'Use the knowlery command to search, read, list stale sources and validate. Never edit .knowlery/.',
];

export const AGENTS_LINES: readonly string[] = [
  `This folder is a Knowlery knowledge base. Raw sources stay untouched; compiled pages are in ${WIKI_DIR}/.`,
  `Before reading or editing anything under ${WIKI_DIR}/, read ${WIKI_DIR}/CONVENTIONS.md and follow it.`,
  `Use the knowlery command to search, read, list stale sources and validate. Inside .knowlery/, edit only ${WIKI_DIR}/.`,
];

export const POINTER_FILES = [
  {
    name: 'CLAUDE.md',
    importLine: '@AGENTS.md',
    content: 'Follow the instructions in AGENTS.md in this folder.\n@AGENTS.md\n',
  },
  {
    name: 'GEMINI.md',
    importLine: '@./AGENTS.md',
    content: 'Follow the instructions in AGENTS.md in this folder.\n@./AGENTS.md\n',
  },
] as const;

const POINTER_IMPORT_LINES = new Set(['@AGENTS.md', '@./AGENTS.md']);

const V1_MARKERS = ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base'] as const;

const DEFAULT_CONFIG_TEXT = `${JSON.stringify({ kf: KF_VERSION, ignore: [], mcp: { raw: true } }, null, 2)}\n`;

const INITIAL_LOG_TEXT = [
  '# Log',
  '',
  'Append-only log of wiki edits, one line per batch: `- YYYY-MM-DD · <what> · by <actor>`.',
  '',
].join('\n');

export interface InitOptions {
  skillsDir?: string;
  runGitCheckIgnore?: GitCheckIgnoreRunner;
}

export interface InitResult {
  created: string[];
  kept: string[];
  agents_md: 'written' | 'kept';
  agents_lines: string[];
  claude_md: 'written' | 'kept';
  claude_line: string;
  gemini_md: 'written' | 'kept';
  gemini_line: string;
  git: GitIgnoreState;
  git_rule: string | null;
  warning: string | null;
}

export async function resolveSkillsDir(root: string, skillsDir: string = DEFAULT_SKILLS_DIR): Promise<{ abs: string; rel: string }> {
  let abs: string;
  try {
    abs = await resolveInside(root, skillsDir);
  } catch (error) {
    if (error instanceof KnowleryError && error.code === 'path_denied') {
      invalidInvocation(`Invalid --skills-dir "${skillsDir}": must stay inside the knowledge base root.`);
    }
    throw error;
  }
  const rel = relativePath(root, abs);
  const firstSegment = rel.split('/')[0];
  if (!rel || !firstSegment || !firstSegment.startsWith('.') || firstSegment === '.knowlery') {
    invalidInvocation(`Invalid --skills-dir "${skillsDir}": must be a hidden folder inside the root other than .knowlery.`);
  }
  return { abs, rel };
}

function splitLinesTrimRight(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/, ''));
}

export function hasAllAgentsLines(text: string): boolean {
  const existing = new Set(splitLinesTrimRight(text));
  return AGENTS_LINES.every((line) => existing.has(line.replace(/[ \t]+$/, '')));
}

export function hasPointerImport(text: string): boolean {
  return text.replace(/\r\n/g, '\n').split('\n').some((line) => POINTER_IMPORT_LINES.has(line.trim()));
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function ensureAgentsFile(root: string): Promise<{ state: 'written' | 'kept'; missingLines: string[] }> {
  const agentsPath = join(root, 'AGENTS.md');
  if (await pathExists(agentsPath)) {
    const existingAgents = await readFile(agentsPath, 'utf8');
    return {
      state: 'kept',
      missingLines: hasAllAgentsLines(existingAgents) ? [] : [...AGENTS_LINES],
    };
  }
  await writeFile(agentsPath, `${AGENTS_LINES.join('\n')}\n`, { encoding: 'utf8', flag: 'wx' });
  return { state: 'written', missingLines: [] };
}

export async function ensurePointerFile(
  root: string,
  pointer: (typeof POINTER_FILES)[number],
): Promise<{ state: 'written' | 'kept'; missingLine: string }> {
  const pointerPath = join(root, pointer.name);
  if (await pathExists(pointerPath)) {
    const existingText = await readFile(pointerPath, 'utf8');
    return {
      state: 'kept',
      missingLine: hasPointerImport(existingText) ? '' : pointer.importLine,
    };
  }
  await writeFile(pointerPath, pointer.content, { encoding: 'utf8', flag: 'wx' });
  return { state: 'written', missingLine: '' };
}

export async function ensureSkills(
  root: string,
  skillsDir: string = DEFAULT_SKILLS_DIR,
): Promise<{ created: string[]; kept: string[]; outdated: string[] }> {
  const skillsTarget = await resolveSkillsDir(root, skillsDir);
  const created: string[] = [];
  const kept: string[] = [];
  const outdated: string[] = [];
  for (const skill of SKILLS) {
    const relPath = `${skillsTarget.rel}/${skill.name}/SKILL.md`;
    const skillDir = join(skillsTarget.abs, skill.name);
    const skillPath = join(skillDir, 'SKILL.md');
    if (await pathExists(skillPath)) {
      kept.push(relPath);
      const existingText = await readFile(skillPath, 'utf8');
      if (existingText !== skill.text) {
        outdated.push(relPath);
      }
    } else {
      await mkdir(skillDir, { recursive: true });
      await writeFile(skillPath, skill.text, { encoding: 'utf8', flag: 'wx' });
      created.push(relPath);
    }
  }
  return { created, kept, outdated };
}

export async function initKb(root: string, options: InitOptions = {}): Promise<InitResult> {
  await resolveSkillsDir(root, options.skillsDir);
  await checkBeta1Wiki(root);

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
    if (error instanceof Beta1WikiError) {
      throw error;
    } else if (error instanceof KnowleryError && error.code === 'not_found') {
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

  // 2. wiki directory
  const wikiDir = join(root, WIKI_DIR);
  if (await pathExists(wikiDir)) {
    const info = await lstat(wikiDir);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new KnowleryError(
        'unsupported_schema',
        `${WIKI_DIR}/ is not a regular directory.`,
        `Remove or rename ${WIKI_DIR}/ or choose another root.`,
      );
    }
  } else {
    await mkdir(wikiDir, { recursive: false });
    created.push(`${WIKI_DIR}/`);
  }

  // 3. CONVENTIONS.md
  const conventionsPath = join(wikiDir, 'CONVENTIONS.md');
  if (await pathExists(conventionsPath)) {
    kept.push(`${WIKI_DIR}/CONVENTIONS.md`);
  } else {
    await writeFile(conventionsPath, renderConventions(), { encoding: 'utf8', flag: 'wx' });
    created.push(`${WIKI_DIR}/CONVENTIONS.md`);
  }

  // 4. index.md
  const indexPath = join(wikiDir, 'index.md');
  if (await pathExists(indexPath)) {
    kept.push(`${WIKI_DIR}/index.md`);
  } else {
    const pagePaths = await listPages(root);
    const pages: ParsedPage[] = [];
    for (const pagePath of pagePaths) {
      const text = await readFile(join(root, pagePath), 'utf8');
      pages.push(parsePage(text, basename(pagePath)));
    }
    await writeFile(indexPath, renderWikiIndex(pages), { encoding: 'utf8', flag: 'wx' });
    created.push(`${WIKI_DIR}/index.md`);
  }

  // 5. log.md
  const logPath = join(wikiDir, 'log.md');
  if (await pathExists(logPath)) {
    kept.push(`${WIKI_DIR}/log.md`);
  } else {
    await writeFile(logPath, INITIAL_LOG_TEXT, { encoding: 'utf8', flag: 'wx' });
    created.push(`${WIKI_DIR}/log.md`);
  }

  // 6. AGENTS.md
  const agents = await ensureAgentsFile(root);
  if (agents.state === 'written') created.push('AGENTS.md');
  else kept.push('AGENTS.md');

  // 7. Pointer files (CLAUDE.md, GEMINI.md)
  const pointerStates: Record<string, { state: 'written' | 'kept'; line: string }> = {};
  for (const pointer of POINTER_FILES) {
    const res = await ensurePointerFile(root, pointer);
    if (res.state === 'written') created.push(pointer.name);
    else kept.push(pointer.name);
    pointerStates[pointer.name] = { state: res.state, line: res.missingLine };
  }

  // 8. Skills
  const skills = await ensureSkills(root, options.skillsDir);
  created.push(...skills.created);
  kept.push(...skills.kept);

  const gitStatus = await checkGitWikiIgnore(root, options.runGitCheckIgnore);

  return {
    created,
    kept,
    agents_md: agents.state,
    agents_lines: agents.missingLines,
    claude_md: pointerStates['CLAUDE.md'].state,
    claude_line: pointerStates['CLAUDE.md'].line,
    gemini_md: pointerStates['GEMINI.md'].state,
    gemini_line: pointerStates['GEMINI.md'].line,
    git: gitStatus.state,
    git_rule: gitStatus.rule,
    warning: gitStatus.warning,
  };
}
