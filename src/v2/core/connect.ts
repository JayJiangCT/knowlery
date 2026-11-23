import { access, constants, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { SKILLS } from '../skills';
import { isObject } from './config';
import { invalidInvocation, KnowleryError } from './errors';
import {
  DEFAULT_SKILLS_DIR,
  POINTER_FILES,
  ensureAgentsFile,
  ensurePointerFile,
  ensureSkills,
  hasAllAgentsLines,
  hasPointerImport,
  pathExists,
} from './init';
import { quoteSelect } from '../cli/commands/read';
import { isMissing } from './paths';

export type HarnessId = 'pi' | 'codex' | 'cursor' | 'gemini' | 'claude';

export interface HarnessSpec {
  id: HarnessId;
  name: string;
  command: string;
  homeDirName: string;
  pointerFile: 'GEMINI.md' | 'CLAUDE.md' | null;
  skillsDir: string;
  mcpFile: string;
  mcpFormat: 'json' | 'toml';
  mcpExposure?: 'direct';
  thenLine: string;
  mcpLine: string;
}

export const HARNESSES: readonly HarnessSpec[] = [
  {
    id: 'pi',
    name: 'Pi',
    command: 'pi',
    homeDirName: '.pi',
    pointerFile: null,
    skillsDir: DEFAULT_SKILLS_DIR,
    mcpFile: '.pi/mcp.json',
    mcpFormat: 'json',
    mcpExposure: 'direct',
    thenLine: 'Start pi in this folder. It asks once to trust the project: say yes.',
    mcpLine: 'Type /mcp in Pi: knowlery should be connected with 3 tools.',
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    homeDirName: '.codex',
    pointerFile: null,
    skillsDir: DEFAULT_SKILLS_DIR,
    mcpFile: '.codex/config.toml',
    mcpFormat: 'toml',
    thenLine: 'Start codex in this folder and trust the project when it asks.',
    mcpLine: 'The entry in .codex/config.toml loads only in a trusted project.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    command: 'cursor',
    homeDirName: '.cursor',
    pointerFile: null,
    skillsDir: DEFAULT_SKILLS_DIR,
    mcpFile: '.cursor/mcp.json',
    mcpFormat: 'json',
    thenLine: 'Open this folder in Cursor.',
    mcpLine: "Check that knowlery is listed under MCP in Cursor's settings.",
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    homeDirName: '.gemini',
    pointerFile: 'GEMINI.md',
    skillsDir: DEFAULT_SKILLS_DIR,
    mcpFile: '.gemini/settings.json',
    mcpFormat: 'json',
    thenLine: 'Start gemini in this folder.',
    mcpLine: 'Type /mcp in Gemini CLI: knowlery should be listed.',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    homeDirName: '.claude',
    pointerFile: 'CLAUDE.md',
    skillsDir: '.claude/skills',
    mcpFile: '.mcp.json',
    mcpFormat: 'json',
    thenLine: 'Start claude in this folder.',
    mcpLine: 'Claude Code asks once to approve the server from .mcp.json: approve it.',
  },
];

export const HARNESS_IDS: readonly HarnessId[] = HARNESSES.map((h) => h.id);

export function getHarnessSpec(id: string): HarnessSpec {
  const found = HARNESSES.find((h) => h.id === id);
  if (!found) {
    invalidInvocation(`Unknown harness "${id}". Expected one of: ${HARNESS_IDS.join(', ')}.`);
  }
  return found;
}

export interface ConnectEnv {
  pathEnv?: string;
  homeDir?: string;
  platform?: NodeJS.Platform;
}

export type EntryState = 'ok' | 'missing' | 'incomplete';
export type SkillsState = 'ok' | 'outdated' | 'missing';
export type McpState = 'configured' | 'none';
export type FoundBy = 'path' | 'home' | null;

export interface HarnessStatus {
  id: HarnessId;
  name: string;
  found: boolean;
  found_by: FoundBy;
  entry: EntryState;
  skills: SkillsState;
  skills_dir: string;
  mcp: McpState;
  mcp_file: string;
  ready: boolean;
}

export interface HarnessDetails {
  missingEntryFiles: string[];
  incompleteEntryFiles: string[];
  missingSkillCount: number;
  outdatedSkillCount: number;
}

export interface ConnectListResult {
  root: string;
  knowlery_on_path: boolean;
  harnesses: HarnessStatus[];
}

export interface ConnectListReport {
  result: ConnectListResult;
  details: Record<HarnessId, HarnessDetails>;
}

export interface ConnectHint {
  file: string;
  lines: string[];
}

export interface ConnectApplyResult {
  harness: HarnessStatus;
  created: string[];
  kept: string[];
  hints: ConnectHint[];
  then: string;
  mcp_note: string | null;
  user_wide: string | null;
}

export interface ConnectApplyReport {
  result: ConnectApplyResult;
  details: HarnessDetails;
  outdatedSkills: boolean;
  mcpHint: { heading: string; lines: string[] } | null;
}

async function isExecutableFile(filePath: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;
    if (platform === 'win32') return true;
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findCommandOnPath(
  command: string,
  pathEnv: string | undefined,
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> {
  if (!pathEnv) return false;
  const dirs = pathEnv.split(delimiter).filter(Boolean);
  const candidates = platform === 'win32'
    ? [command, `${command}.cmd`, `${command}.exe`]
    : [command];
  for (const dir of dirs) {
    for (const candidate of candidates) {
      if (await isExecutableFile(join(dir, candidate), platform)) return true;
    }
  }
  return false;
}

async function homeFolderExists(homeDir: string | undefined, folderName: string): Promise<boolean> {
  if (!homeDir) return false;
  try {
    return (await stat(join(homeDir, folderName))).isDirectory();
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function inspectEntry(
  root: string,
  spec: HarnessSpec,
): Promise<{ state: EntryState; missingEntryFiles: string[]; incompleteEntryFiles: string[] }> {
  const missingEntryFiles: string[] = [];
  const incompleteEntryFiles: string[] = [];

  const agentsText = await readTextIfExists(join(root, 'AGENTS.md'));
  if (agentsText === null) {
    missingEntryFiles.push('AGENTS.md');
  } else if (!hasAllAgentsLines(agentsText)) {
    incompleteEntryFiles.push('AGENTS.md');
  }

  if (spec.pointerFile !== null) {
    const pointerText = await readTextIfExists(join(root, spec.pointerFile));
    if (pointerText === null) {
      missingEntryFiles.push(spec.pointerFile);
    } else if (!hasPointerImport(pointerText)) {
      incompleteEntryFiles.push(spec.pointerFile);
    }
  }

  let state: EntryState;
  if (missingEntryFiles.length > 0) state = 'missing';
  else if (incompleteEntryFiles.length > 0) state = 'incomplete';
  else state = 'ok';

  return { state, missingEntryFiles, incompleteEntryFiles };
}

async function inspectSkills(
  root: string,
  skillsDir: string,
): Promise<{ state: SkillsState; missingSkillCount: number; outdatedSkillCount: number }> {
  let missingSkillCount = 0;
  let outdatedSkillCount = 0;

  for (const skill of SKILLS) {
    const text = await readTextIfExists(join(root, skillsDir, skill.name, 'SKILL.md'));
    if (text === null) missingSkillCount++;
    else if (text !== skill.text) outdatedSkillCount++;
  }

  let state: SkillsState;
  if (missingSkillCount > 0) state = 'missing';
  else if (outdatedSkillCount > 0) state = 'outdated';
  else state = 'ok';

  return { state, missingSkillCount, outdatedSkillCount };
}

async function inspectMcp(root: string, spec: HarnessSpec): Promise<McpState> {
  const text = await readTextIfExists(join(root, spec.mcpFile));
  if (text === null) return 'none';

  if (spec.mcpFormat === 'toml') {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    return lines.some((line) => line.trim() === '[mcp_servers.knowlery]') ? 'configured' : 'none';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return 'none';
  }
  if (!isObject(parsed) || !isObject(parsed.mcpServers)) return 'none';
  return Object.prototype.hasOwnProperty.call(parsed.mcpServers, 'knowlery') ? 'configured' : 'none';
}

export async function inspectHarness(
  root: string,
  spec: HarnessSpec,
  env: ConnectEnv = {},
): Promise<{ status: HarnessStatus; details: HarnessDetails }> {
  const platform = env.platform ?? process.platform;
  let foundBy: FoundBy = null;
  if (await findCommandOnPath(spec.command, env.pathEnv, platform)) {
    foundBy = 'path';
  } else if (await homeFolderExists(env.homeDir, spec.homeDirName)) {
    foundBy = 'home';
  }

  const entry = await inspectEntry(root, spec);
  const skills = await inspectSkills(root, spec.skillsDir);
  const mcp = await inspectMcp(root, spec);
  const ready = entry.state === 'ok' && (skills.state === 'ok' || skills.state === 'outdated');

  return {
    status: {
      id: spec.id,
      name: spec.name,
      found: foundBy !== null,
      found_by: foundBy,
      entry: entry.state,
      skills: skills.state,
      skills_dir: spec.skillsDir,
      mcp,
      mcp_file: spec.mcpFile,
      ready,
    },
    details: {
      missingEntryFiles: entry.missingEntryFiles,
      incompleteEntryFiles: entry.incompleteEntryFiles,
      missingSkillCount: skills.missingSkillCount,
      outdatedSkillCount: skills.outdatedSkillCount,
    },
  };
}

export async function inspectConnect(root: string, env: ConnectEnv = {}): Promise<ConnectListReport> {
  const platform = env.platform ?? process.platform;
  const knowleryOnPath = await findCommandOnPath('knowlery', env.pathEnv, platform);
  const harnesses: HarnessStatus[] = [];
  const details = {} as Record<HarnessId, HarnessDetails>;

  for (const spec of HARNESSES) {
    const inspected = await inspectHarness(root, spec, env);
    harnesses.push(inspected.status);
    details[spec.id] = inspected.details;
  }

  return {
    result: {
      root,
      knowlery_on_path: knowleryOnPath,
      harnesses,
    },
    details,
  };
}

function buildJsonMcpServerEntry(root: string, spec: HarnessSpec): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    command: 'knowlery',
    args: ['mcp', '--dir', root],
  };
  if (spec.mcpExposure) {
    entry.exposure = spec.mcpExposure;
  }
  return entry;
}

function buildJsonMcpFileText(root: string, spec: HarnessSpec): string {
  const payload = {
    mcpServers: {
      knowlery: buildJsonMcpServerEntry(root, spec),
    },
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function buildTomlMcpLines(root: string): string[] {
  return [
    '[mcp_servers.knowlery]',
    `command = ${JSON.stringify('knowlery')}`,
    `args = [${JSON.stringify('mcp')}, ${JSON.stringify('--dir')}, ${JSON.stringify(root)}]`,
  ];
}

function formatInlineJsonMcpEntry(root: string, spec: HarnessSpec): string {
  const argsText = `[${JSON.stringify('mcp')}, ${JSON.stringify('--dir')}, ${JSON.stringify(root)}]`;
  const exposurePart = spec.mcpExposure ? `, "exposure": ${JSON.stringify(spec.mcpExposure)}` : '';
  return `"knowlery": { "command": "knowlery", "args": ${argsText}${exposurePart} }`;
}

export function buildUserWideLine(root: string, spec: HarnessSpec): string {
  const quoted = quoteSelect(root);
  switch (spec.id) {
    case 'pi':
      return `pi mcp add knowlery --exposure direct -- knowlery mcp --dir ${quoted}`;
    case 'codex':
      return `codex mcp add knowlery -- knowlery mcp --dir ${quoted}`;
    case 'cursor':
      return `Add to ~/.cursor/mcp.json, under "mcpServers": ${formatInlineJsonMcpEntry(root, spec)}`;
    case 'gemini':
      return `gemini mcp add --scope user knowlery knowlery mcp -- --dir ${quoted}`;
    case 'claude':
      return `claude mcp add --scope user knowlery -- knowlery mcp --dir ${quoted}`;
  }
}

export async function connectHarness(
  root: string,
  harnessId: string,
  options: { mcp?: boolean; env?: ConnectEnv } = {},
): Promise<ConnectApplyReport> {
  const spec = getHarnessSpec(harnessId);
  const withMcp = options.mcp ?? false;
  const created: string[] = [];
  const kept: string[] = [];
  const hints: ConnectHint[] = [];

  // 1. AGENTS.md
  const agents = await ensureAgentsFile(root);
  if (agents.state === 'written') created.push('AGENTS.md');
  else kept.push('AGENTS.md');
  if (agents.missingLines.length > 0) {
    hints.push({ file: 'AGENTS.md', lines: agents.missingLines });
  }

  // 2. Pointer file for gemini / claude
  if (spec.pointerFile !== null) {
    const pointer = POINTER_FILES.find((p) => p.name === spec.pointerFile);
    if (!pointer) {
      throw new KnowleryError('internal', `Missing pointer definition for ${spec.pointerFile}.`, 'Report this bug.');
    }
    const res = await ensurePointerFile(root, pointer);
    if (res.state === 'written') created.push(pointer.name);
    else kept.push(pointer.name);
    if (res.missingLine) {
      hints.push({ file: pointer.name, lines: [res.missingLine] });
    }
  }

  // 3. Skills in the client's Skills folder
  const skills = await ensureSkills(root, spec.skillsDir);
  created.push(...skills.created);
  kept.push(...skills.kept);

  // 4. Optional project MCP file
  let mcpHint: { heading: string; lines: string[] } | null = null;
  if (withMcp) {
    const mcpAbsPath = join(root, spec.mcpFile);
    if (await pathExists(mcpAbsPath)) {
      kept.push(spec.mcpFile);
      const mcpState = await inspectMcp(root, spec);
      if (mcpState === 'none') {
        if (spec.mcpFormat === 'toml') {
          const tomlLines = buildTomlMcpLines(root);
          hints.push({ file: spec.mcpFile, lines: tomlLines });
          mcpHint = { heading: `Add to ${spec.mcpFile}:`, lines: tomlLines };
        } else {
          const entryLine = formatInlineJsonMcpEntry(root, spec);
          hints.push({ file: spec.mcpFile, lines: [entryLine] });
          mcpHint = { heading: `Add to ${spec.mcpFile}, under "mcpServers":`, lines: [entryLine] };
        }
      }
    } else {
      await mkdir(dirname(mcpAbsPath), { recursive: true });
      const content = spec.mcpFormat === 'toml'
        ? `${buildTomlMcpLines(root).join('\n')}\n`
        : buildJsonMcpFileText(root, spec);
      await writeFile(mcpAbsPath, content, { encoding: 'utf8', flag: 'wx' });
      created.push(spec.mcpFile);
    }
  }

  const inspected = await inspectHarness(root, spec, options.env);

  return {
    result: {
      harness: inspected.status,
      created,
      kept,
      hints,
      then: spec.thenLine,
      mcp_note: withMcp ? spec.mcpLine : null,
      user_wide: withMcp ? buildUserWideLine(root, spec) : null,
    },
    details: inspected.details,
    outdatedSkills: skills.outdated.length > 0,
    mcpHint,
  };
}
