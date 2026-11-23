import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMMANDS } from '../../src/v2/cli/args';
import { runCli } from '../../src/v2/cli/main';
import { AGENTS_LINES, type InitResult } from '../../src/v2/core/init';
import type { SyncResult } from '../../src/v2/core/sync';
import { SKILLS } from '../../src/v2/skills';
import { fileState } from './helpers';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'knowlery-v2-skills-')));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

async function runDirect(root: string, argv: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  });
  return { code, stdout, stderr };
}

async function runDirectJson<T>(root: string, argv: string[]) {
  const res = await runDirect(root, [...argv, '--json']);
  expect(res.code, res.stdout || res.stderr).toBe(0);
  expect(res.stderr).toBe('');
  return JSON.parse(res.stdout) as T & { contract: string; ok: boolean; command: string };
}

describe('v2 skills', () => {
  it('validates skill frontmatter, size, CLI commands, and client neutrality', () => {
    expect(SKILLS.map((s) => s.name)).toEqual(['knowlery-compile', 'knowlery-maintain', 'knowlery-answer']);
    const validCommands = new Set<string>(COMMANDS);
    const forbiddenClientWords = /\b(Obsidian|Claude|Codex|Cursor|Gemini|Copilot)\b/i;

    for (const skill of SKILLS) {
      expect(Buffer.byteLength(skill.text, 'utf8')).toBeLessThan(8192);
      expect(skill.text.endsWith('\n')).toBe(true);
      expect(skill.text.endsWith('\n\n')).toBe(false);

      const match = skill.text.match(/^---\n([\s\S]*?)\n---\n/);
      expect(match, `missing frontmatter in ${skill.name}`).not.toBeNull();
      const fmLines = match![1].split('\n');
      expect(fmLines).toHaveLength(2);
      expect(fmLines[0]).toBe(`name: ${skill.name}`);
      expect(fmLines[1].startsWith('description: ')).toBe(true);
      const description = fmLines[1].slice('description: '.length);
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(1024);

      const cmdMatches = skill.text.matchAll(/\bknowlery ([a-z][a-z0-9-]*)/g);
      let sawCommand = false;
      for (const cmdMatch of cmdMatches) {
        const word = cmdMatch[1];
        if (word === 'command' || word === 'wiki' || word === 'knowledge') continue;
        sawCommand = true;
        expect(validCommands.has(word), `unknown command "knowlery ${word}" in ${skill.name}`).toBe(true);
      }
      expect(sawCommand).toBe(true);

      expect(skill.text).not.toContain('[[');
      for (const line of skill.text.split('\n')) {
        expect(line.startsWith('/'), `slash-command line in ${skill.name}: ${line}`).toBe(false);
      }
      expect(skill.text).not.toMatch(forbiddenClientWords);
    }
  });

  it('installs skills and pointer files on init, excludes pointers from inventory/read, supports --skills-dir, and preserves existing skills', async () => {
    const root = await makeTempDir();
    await mkdir(join(root, 'Notes'), { recursive: true });
    await writeFile(join(root, 'Notes/a.md'), '# Note\n');

    const first = await runDirectJson<InitResult>(root, ['init']);
    for (const skill of SKILLS) {
      const relPath = `.agents/skills/${skill.name}/SKILL.md`;
      expect(first.created).toContain(relPath);
      expect(await readFile(join(root, relPath), 'utf8')).toBe(skill.text);
    }
    expect(first.created).toContain('CLAUDE.md');
    expect(first.created).toContain('GEMINI.md');
    expect(await readFile(join(root, 'CLAUDE.md'), 'utf8')).toBe(
      'Follow the instructions in AGENTS.md in this folder.\n@AGENTS.md\n',
    );
    expect(await readFile(join(root, 'GEMINI.md'), 'utf8')).toBe(
      'Follow the instructions in AGENTS.md in this folder.\n@./AGENTS.md\n',
    );

    const inv = await runDirectJson<{ items: Array<{ path: string }> }>(root, ['inventory']);
    expect(inv.items.map((item) => item.path)).toEqual(['Notes/a.md']);

    const readClaude = await runDirect(root, ['read', 'CLAUDE.md', '--json']);
    expect(readClaude.code).not.toBe(0);
    expect(JSON.parse(readClaude.stdout)).toMatchObject({ ok: false, error: { code: 'path_denied' } });

    const readGemini = await runDirect(root, ['read', 'GEMINI.md', '--json']);
    expect(readGemini.code).not.toBe(0);
    expect(JSON.parse(readGemini.stdout)).toMatchObject({ ok: false, error: { code: 'path_denied' } });

    const beforeSecond = await fileState(root);
    const secondText = await runDirect(root, ['init']);
    expect(secondText.code).toBe(0);
    expect(secondText.stdout).not.toContain('Add to');
    expect(await fileState(root)).toEqual(beforeSecond);

    const claudeRoot = await makeTempDir();
    const customSkillPath = join(claudeRoot, '.claude/skills/knowlery-compile/SKILL.md');
    await mkdir(join(claudeRoot, '.claude/skills/knowlery-compile'), { recursive: true });
    const customContent = 'Custom compile skill\n';
    await writeFile(customSkillPath, customContent);

    const customInit = await runDirectJson<InitResult>(claudeRoot, ['init', '--skills-dir', '.claude/skills']);
    expect(customInit.kept).toContain('.claude/skills/knowlery-compile/SKILL.md');
    expect(customInit.created).toContain('.claude/skills/knowlery-maintain/SKILL.md');
    expect(customInit.created).toContain('.claude/skills/knowlery-answer/SKILL.md');
    expect(await readFile(customSkillPath, 'utf8')).toBe(customContent);
  });

  it('rejects invalid --skills-dir values with invalid_invocation and writes nothing', async () => {
    for (const badDir of ['skills', '../x', '.knowlery/skills']) {
      const root = await makeTempDir();
      const before = await fileState(root);
      const res = await runDirect(root, ['init', '--skills-dir', badDir, '--json']);
      expect(res.code).toBe(2);
      expect(JSON.parse(res.stdout)).toMatchObject({ ok: false, error: { code: 'invalid_invocation' } });
      expect(await fileState(root)).toEqual(before);
    }
  });

  it('syncs skills across current, outdated, apply, missing, and create states', async () => {
    const root = await makeTempDir();
    await runDirectJson<InitResult>(root, ['init']);

    const current = await runDirectJson<SyncResult>(root, ['sync']);
    expect(current.conventions).toBe('current');
    expect(current.skills.map((s) => ({ name: s.name, state: s.state }))).toEqual([
      { name: 'knowlery-compile', state: 'current' },
      { name: 'knowlery-maintain', state: 'current' },
      { name: 'knowlery-answer', state: 'current' },
    ]);

    const compilePath = join(root, '.agents/skills/knowlery-compile/SKILL.md');
    const compileDesired = SKILLS[0].text;
    const modified = `${compileDesired}Extra stray line.\n`;
    await writeFile(compilePath, modified);

    const outdated = await runDirectJson<SyncResult>(root, ['sync']);
    const outdatedEntry = outdated.skills.find((s) => s.name === 'knowlery-compile');
    expect(outdatedEntry).toMatchObject({
      name: 'knowlery-compile',
      path: '.agents/skills/knowlery-compile/SKILL.md',
      state: 'outdated',
      removed: ['Extra stray line.'],
      added: [],
      removed_more: 0,
      added_more: 0,
    });
    expect(await readFile(compilePath, 'utf8')).toBe(modified);

    const applied = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(applied.skills.find((s) => s.name === 'knowlery-compile')?.state).toBe('updated');
    expect(await readFile(compilePath, 'utf8')).toBe(compileDesired);

    await rm(compilePath);
    const missing = await runDirectJson<SyncResult>(root, ['sync']);
    expect(missing.skills.find((s) => s.name === 'knowlery-compile')?.state).toBe('missing');

    const created = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(created.skills.find((s) => s.name === 'knowlery-compile')?.state).toBe('created');
    expect(await readFile(compilePath, 'utf8')).toBe(compileDesired);
  });

  it('prints Add to hints only when AGENTS.md or pointer files are missing the required lines', async () => {
    const root = await makeTempDir();
    await runDirectJson<InitResult>(root, ['init']);
    const second = await runDirect(root, ['init']);
    expect(second.stdout).not.toContain('Add to AGENTS.md:');
    expect(second.stdout).not.toContain('Add to CLAUDE.md:');
    expect(second.stdout).not.toContain('Add to GEMINI.md:');

    const customRoot = await makeTempDir();
    const agentsOriginal = 'Custom agents file.\n';
    const claudeOriginal = 'Custom claude file.\n';
    const geminiOriginal = 'Custom gemini file.\n@./AGENTS.md\n';
    await writeFile(join(customRoot, 'AGENTS.md'), agentsOriginal);
    await writeFile(join(customRoot, 'CLAUDE.md'), claudeOriginal);
    await writeFile(join(customRoot, 'GEMINI.md'), geminiOriginal);

    const jsonRes = await runDirectJson<InitResult>(customRoot, ['init']);
    expect(jsonRes.agents_md).toBe('kept');
    expect(jsonRes.agents_lines).toEqual([...AGENTS_LINES]);
    expect(jsonRes.claude_md).toBe('kept');
    expect(jsonRes.claude_line).toBe('@AGENTS.md');
    expect(jsonRes.gemini_md).toBe('kept');
    expect(jsonRes.gemini_line).toBe('');

    const textRes = await runDirect(customRoot, ['init']);
    expect(textRes.stdout).toContain('Add to AGENTS.md:');
    expect(textRes.stdout).toContain('Add to CLAUDE.md:\n@AGENTS.md');
    expect(textRes.stdout).not.toContain('Add to GEMINI.md:');
    expect(await readFile(join(customRoot, 'AGENTS.md'), 'utf8')).toBe(agentsOriginal);
    expect(await readFile(join(customRoot, 'CLAUDE.md'), 'utf8')).toBe(claudeOriginal);
    expect(await readFile(join(customRoot, 'GEMINI.md'), 'utf8')).toBe(geminiOriginal);
  });
});
