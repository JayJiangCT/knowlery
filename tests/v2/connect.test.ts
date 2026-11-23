import { afterEach, describe, expect, it } from 'vitest';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import {
  HARNESS_IDS,
  type ConnectApplyResult,
  type ConnectListResult,
  type KnowleryVersionRunner,
} from '../../src/v2/core/connect';
import { AGENTS_LINES } from '../../src/v2/core/init';
import { findMcpRoot } from '../../src/v2/mcp/root';
import { SKILLS } from '../../src/v2/skills';
import { fileState, jsonRun } from './helpers';

const tempDirs: string[] = [];

async function makeTempDir(prefix = 'knowlery-v2-connect-'): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

interface RunEnv {
  pathEnv?: string;
  homeDir?: string;
  runKnowleryVersion?: KnowleryVersionRunner;
}

async function runDirect(root: string, argv: string[], env: RunEnv = {}) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
    pathEnv: env.pathEnv ?? '',
    homeDir: env.homeDir ?? '',
    runKnowleryVersion: env.runKnowleryVersion,
  });
  return { code, stdout, stderr };
}

async function runDirectJson<T>(root: string, argv: string[], env: RunEnv = {}): Promise<T & { contract: string; ok: boolean; command: string }> {
  const res = await runDirect(root, [...argv, '--json'], env);
  expect(res.code, res.stdout || res.stderr).toBe(0);
  expect(res.stderr).toBe('');
  expect(res.stdout.trimEnd().split('\n')).toHaveLength(1);
  const data = JSON.parse(res.stdout) as T & { contract: string; ok: boolean; command: string };
  expect(data).toMatchObject({ contract: '2.0', ok: true });
  return data;
}

async function makeExecutable(dir: string, name: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, name);
  await writeFile(file, '#!/bin/sh\nexit 0\n', 'utf8');
  await chmod(file, 0o755);
  return file;
}

async function initTempKb(root?: string): Promise<string> {
  const dir = root ?? await makeTempDir();
  await mkdir(join(dir, 'Notes'), { recursive: true });
  await writeFile(join(dir, 'Notes/policy.md'), '# Policy\n\nLimit is 12.\n', 'utf8');
  const initRes = await runDirect(dir, ['init']);
  expect(initRes.code, initRes.stderr).toBe(0);
  return dir;
}

async function allEntriesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string): Promise<void> {
    const full = rel ? join(dir, rel) : dir;
    const info = await lstat(full);
    if (info.isDirectory()) {
      for (const name of (await readdir(full)).sort()) {
        const childRel = rel ? `${rel}/${name}` : name;
        out.push(childRel);
        await walk(childRel);
      }
    }
  }
  await walk('');
  return out;
}

describe('v2 connect', () => {
  it('lists the five clients in order and writes nothing (not even cache)', async () => {
    const root = await initTempKb();
    const binDir = await makeTempDir('knowlery-v2-bin-');
    const homeDir = await makeTempDir('knowlery-v2-home-');
    await makeExecutable(binDir, 'knowlery');
    await makeExecutable(binDir, 'pi');
    await mkdir(join(homeDir, '.claude'));

    const beforeState = await fileState(root);
    const beforeEntries = await allEntriesUnder(root);

    const env: RunEnv = {
      pathEnv: binDir,
      homeDir,
      runKnowleryVersion: () => Promise.resolve('knowlery 2.0.0 (kf 2.0)\n'),
    };
    const listJson = await runDirectJson<ConnectListResult>(root, ['connect'], env);
    expect(listJson.command).toBe('connect');
    expect(listJson.root).toBe(root);
    expect(listJson.knowlery_on_path).toBe(true);
    expect(listJson.knowlery_version).toBe('2.0.0');
    expect(listJson.knowlery_ok).toBe(true);
    expect(listJson.warning).toBeNull();
    expect(listJson.harnesses.map((h) => h.id)).toEqual(['pi', 'codex', 'cursor', 'gemini', 'claude']);

    const byId = Object.fromEntries(listJson.harnesses.map((h) => [h.id, h]));
    expect(byId.pi).toMatchObject({ ready: true, entry: 'ok', skills: 'ok', mcp: 'none' });
    expect(byId.codex).toMatchObject({ ready: true, entry: 'ok', skills: 'ok', mcp: 'none' });
    expect(byId.cursor).toMatchObject({ ready: true, entry: 'ok', skills: 'ok', mcp: 'none' });
    expect(byId.gemini).toMatchObject({ ready: true, entry: 'ok', skills: 'ok', mcp: 'none' });
    expect(byId.claude).toMatchObject({
      ready: false,
      entry: 'ok',
      skills: 'missing',
      skills_dir: '.claude/skills',
      mcp: 'none',
    });

    const listText = await runDirect(root, ['connect'], env);
    expect(listText.code).toBe(0);
    expect(listText.stdout).toContain(`connect  root: ${root}  knowlery command: 2.0.0 on PATH`);
    expect(listText.stdout).toContain('claude\tClaude Code\tfound\tnot connected\tmcp: none\tmissing: 3 Skills in .claude/skills');
    expect(listText.stdout).toContain('next: knowlery connect claude');
    expect(listText.stdout).toContain('MCP is optional for these clients. Add --mcp to write a project MCP entry: knowlery connect <id> --mcp');

    expect(await fileState(root)).toEqual(beforeState);
    expect(await allEntriesUnder(root)).toEqual(beforeEntries);
  });

  it('detects clients from PATH and home folder and emits next: only for found and not ready', async () => {
    const root = await initTempKb();
    const binDir = await makeTempDir('knowlery-v2-bin-');
    const homeDir = await makeTempDir('knowlery-v2-home-');

    // Neither PATH nor home has any client or knowlery
    const noneRes = await runDirectJson<ConnectListResult>(root, ['connect'], { pathEnv: binDir, homeDir });
    expect(noneRes.knowlery_on_path).toBe(false);
    for (const h of noneRes.harnesses) {
      expect(h.found).toBe(false);
      expect(h.found_by).toBeNull();
    }
    const noneText = await runDirect(root, ['connect'], { pathEnv: binDir, homeDir });
    expect(noneText.stdout).toContain('knowlery command: not on PATH');
    expect(noneText.stdout).toContain('warning: the Skills and MCP entries run "knowlery", and it is not on PATH. Install it: npm install -g knowlery@next');
    expect(noneText.stdout).toContain('No agent client was found on this machine. knowlery connect <id> works all the same.');
    expect(noneText.stdout).not.toContain('next:');

    // Executable pi on PATH, .claude in home
    await makeExecutable(binDir, 'pi');
    await mkdir(join(homeDir, '.claude'));

    const someRes = await runDirectJson<ConnectListResult>(root, ['connect'], { pathEnv: binDir, homeDir });
    const byId = Object.fromEntries(someRes.harnesses.map((h) => [h.id, h]));
    expect(byId.pi).toMatchObject({ found: true, found_by: 'path', ready: true });
    expect(byId.claude).toMatchObject({ found: true, found_by: 'home', ready: false });
    expect(byId.codex).toMatchObject({ found: false, found_by: null });

    const someText = await runDirect(root, ['connect'], { pathEnv: binDir, homeDir });
    const nextLines = someText.stdout.split('\n').filter((l) => l.startsWith('next:'));
    expect(nextLines).toEqual(['next: knowlery connect claude']);
  });

  it('connects claude, recreates deleted GEMINI.md, and keeps custom AGENTS.md with hint', async () => {
    const root = await initTempKb();
    const env = { pathEnv: '', homeDir: '' };

    const first = await runDirectJson<ConnectApplyResult>(root, ['connect', 'claude'], env);
    expect(first.command).toBe('connect');
    expect(first.created).toEqual(SKILLS.map((s) => `.claude/skills/${s.name}/SKILL.md`));
    expect(first.kept).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(first.hints).toEqual([]);
    expect(first.mcp_note).toBeNull();
    expect(first.user_wide).toBeNull();
    expect(first.harness.ready).toBe(true);

    const stateAfterFirst = await fileState(root);
    const second = await runDirectJson<ConnectApplyResult>(root, ['connect', 'claude'], env);
    expect(second.created).toEqual([]);
    expect(second.kept).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
      ...SKILLS.map((s) => `.claude/skills/${s.name}/SKILL.md`),
    ]);
    expect(await fileState(root)).toEqual(stateAfterFirst);

    const listAfter = await runDirectJson<ConnectListResult>(root, ['connect'], env);
    expect(listAfter.harnesses.find((h) => h.id === 'claude')?.ready).toBe(true);

    // Deleted GEMINI.md is recreated by connect gemini
    await rm(join(root, 'GEMINI.md'));
    const geminiRes = await runDirectJson<ConnectApplyResult>(root, ['connect', 'gemini'], env);
    expect(geminiRes.created).toEqual(['GEMINI.md']);
    expect(geminiRes.harness.ready).toBe(true);
    expect(await readFile(join(root, 'GEMINI.md'), 'utf8')).toContain('@./AGENTS.md');

    // Custom AGENTS.md stays byte-identical and gets the hint
    const customAgents = '# Team rules\n\nDo not delete.\n';
    await writeFile(join(root, 'AGENTS.md'), customAgents, 'utf8');
    const customRes = await runDirectJson<ConnectApplyResult>(root, ['connect', 'pi'], env);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(customAgents);
    expect(customRes.kept).toContain('AGENTS.md');
    expect(customRes.hints).toEqual([{ file: 'AGENTS.md', lines: [...AGENTS_LINES] }]);
    expect(customRes.harness.entry).toBe('incomplete');
    expect(customRes.harness.ready).toBe(false);

    const customText = await runDirect(root, ['connect', 'pi'], env);
    expect(customText.stdout).toContain('Add to AGENTS.md:');
    for (const line of AGENTS_LINES) {
      expect(customText.stdout).toContain(line);
    }
  });

  it('writes valid --mcp entries for all five clients, keeps them on rerun, and leaves inventory unchanged', async () => {
    const root = await initTempKb();
    const env = { pathEnv: '', homeDir: '' };
    const invBefore = (await jsonRun(root, ['inventory'])).items.map((item) => item.path);

    for (const id of HARNESS_IDS) {
      const res = await runDirectJson<ConnectApplyResult>(root, ['connect', id, '--mcp'], env);
      expect(res.created).toContain(res.harness.mcp_file);
      expect(res.harness.mcp).toBe('configured');
      expect(res.mcp_note).toBeTruthy();
      expect(res.user_wide).toBeTruthy();

      const raw = await readFile(join(root, res.harness.mcp_file), 'utf8');
      let dirArg: string;
      if (id === 'codex') {
        const lines = raw.trimEnd().split('\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('[mcp_servers.knowlery]');
        expect(JSON.parse(lines[1].replace(/^command = /, ''))).toBe('knowlery');
        const args = JSON.parse(lines[2].replace(/^args = /, '')) as string[];
        expect(args).toEqual(['mcp', '--dir', root]);
        dirArg = args[2];
      } else {
        const parsed = JSON.parse(raw) as { mcpServers: { knowlery: { command: string; args: string[]; exposure?: string } } };
        expect(parsed.mcpServers.knowlery.command).toBe('knowlery');
        expect(parsed.mcpServers.knowlery.args).toEqual(['mcp', '--dir', root]);
        if (id === 'pi') {
          expect(parsed.mcpServers.knowlery.exposure).toBe('direct');
        } else {
          expect(parsed.mcpServers.knowlery.exposure).toBeUndefined();
        }
        dirArg = parsed.mcpServers.knowlery.args[2];
      }

      const resolved = await findMcpRoot(dirArg, undefined, tmpdir());
      expect(resolved.root).toBe(root);

      const second = await runDirectJson<ConnectApplyResult>(root, ['connect', id, '--mcp'], env);
      expect(second.created).toEqual([]);
      expect(second.kept).toContain(second.harness.mcp_file);
    }

    const invAfter = (await jsonRun(root, ['inventory'])).items.map((item) => item.path);
    expect(invAfter).toEqual(invBefore);
  });

  it('never modifies an existing MCP file, prints hint when missing knowlery, and prints none when configured', async () => {
    const root = await initTempKb();
    const env = { pathEnv: '', homeDir: '' };

    await mkdir(join(root, '.cursor'), { recursive: true });
    const existingOther = '{"mcpServers":{"other":{"command":"x"}}}\n';
    await writeFile(join(root, '.cursor/mcp.json'), existingOther, 'utf8');

    const textRes = await runDirect(root, ['connect', 'cursor', '--mcp'], env);
    expect(textRes.code).toBe(0);
    expect(await readFile(join(root, '.cursor/mcp.json'), 'utf8')).toBe(existingOther);
    expect(textRes.stdout).toContain('kept\t.cursor/mcp.json');
    expect(textRes.stdout).toContain('Add to .cursor/mcp.json, under "mcpServers":');
    expect(textRes.stdout).toContain(`"knowlery": { "command": "knowlery", "args": ["mcp", "--dir", ${JSON.stringify(root)}] }`);

    const existingConfigured = `${JSON.stringify({ mcpServers: { knowlery: { command: 'knowlery', args: ['mcp', '--dir', root] } } }, null, 2)}\n`;
    await writeFile(join(root, '.cursor/mcp.json'), existingConfigured, 'utf8');

    const configuredJson = await runDirectJson<ConnectApplyResult>(root, ['connect', 'cursor', '--mcp'], env);
    expect(configuredJson.harness.mcp).toBe('configured');
    expect(configuredJson.hints).toEqual([]);
    expect(configuredJson.kept).toContain('.cursor/mcp.json');
    expect(await readFile(join(root, '.cursor/mcp.json'), 'utf8')).toBe(existingConfigured);

    const configuredText = await runDirect(root, ['connect', 'cursor', '--mcp'], env);
    expect(configuredText.stdout).not.toContain('Add to .cursor/mcp.json');
  });

  it('never writes to the home folder or outside the knowledge base root', async () => {
    const parent = await makeTempDir('knowlery-v2-parent-');
    const root = join(parent, 'kb');
    await mkdir(root);
    await initTempKb(root);
    const homeDir = await makeTempDir('knowlery-v2-home-');
    const parentBefore = (await readdir(parent)).sort();

    for (const id of HARNESS_IDS) {
      const res = await runDirect(root, ['connect', id, '--mcp'], { pathEnv: '', homeDir });
      expect(res.code, res.stderr).toBe(0);
    }

    expect(await readdir(homeDir)).toEqual([]);
    expect((await readdir(parent)).sort()).toEqual(parentBefore);
  });

  it('rejects invalid invocations and missing knowledge base without writing anything', async () => {
    const root = await initTempKb();
    const env = { pathEnv: '', homeDir: '' };

    const bogus = await runDirect(root, ['connect', 'bogus'], env);
    expect(bogus.code).toBe(2);
    expect(bogus.stderr).toContain('error [invalid_invocation]:');
    for (const id of HARNESS_IDS) {
      expect(bogus.stderr).toContain(id);
    }

    const mcpNoHarness = await runDirect(root, ['connect', '--mcp'], env);
    expect(mcpNoHarness.code).toBe(2);
    expect(mcpNoHarness.stderr).toContain('error [invalid_invocation]:');

    const healthMcp = await runDirect(root, ['health', '--mcp'], env);
    expect(healthMcp.code).toBe(2);
    expect(healthMcp.stderr).toContain('error [invalid_invocation]:');

    const empty = await makeTempDir('knowlery-v2-empty-');
    for (const argv of [['connect'], ['connect', 'pi']]) {
      const res = await runDirect(empty, argv, env);
      expect(res.code).toBe(1);
      expect(res.stderr).toContain('error [not_found]:');
      expect(res.stderr).toContain('knowlery init');
    }
    expect(await readdir(empty)).toEqual([]);
  });

  it('quotes a root with a space in user-wide commands and preserves it in JSON and TOML', async () => {
    const parent = await makeTempDir('knowlery-v2-space-');
    const root = join(parent, 'my knowledge base');
    await mkdir(root);
    await initTempKb(root);
    const env = { pathEnv: '', homeDir: '' };

    for (const id of ['pi', 'codex', 'gemini', 'claude'] as const) {
      const res = await runDirectJson<ConnectApplyResult>(root, ['connect', id, '--mcp'], env);
      expect(res.user_wide).toContain(`'${root}'`);
    }

    const piJson = JSON.parse(await readFile(join(root, '.pi/mcp.json'), 'utf8')) as {
      mcpServers: { knowlery: { args: string[] } };
    };
    expect(piJson.mcpServers.knowlery.args[2]).toBe(root);

    const codexToml = (await readFile(join(root, '.codex/config.toml'), 'utf8')).trimEnd().split('\n');
    const argsLine = codexToml.find((line) => line.startsWith('args = '));
    expect(argsLine).toBeDefined();
    const parsedArgs = JSON.parse(argsLine!.slice('args = '.length)) as string[];
    expect(parsedArgs).toEqual(['mcp', '--dir', root]);
  });

  it('reports each knowlery version state on PATH and checks the first PATH entry', async () => {
    const root = await initTempKb();
    const bin1 = await makeTempDir('knowlery-v2-bin1-');
    const bin2 = await makeTempDir('knowlery-v2-bin2-');
    const knowleryPath1 = await makeExecutable(bin1, 'knowlery');
    await makeExecutable(bin2, 'knowlery');
    const bothPath = `${bin1}${delimiter}${bin2}`;

    // 2.0.0 ok — no warning, and runner gets the first PATH entry
    const seenPaths: string[] = [];
    const okEnv: RunEnv = {
      pathEnv: bothPath,
      homeDir: '',
      runKnowleryVersion: (p) => {
        seenPaths.push(p);
        return Promise.resolve('knowlery 2.0.0 (kf 2.0)\n');
      },
    };
    const okText = await runDirect(root, ['connect'], okEnv);
    expect(okText.code).toBe(0);
    expect(seenPaths).toEqual([knowleryPath1]);
    expect(okText.stdout.split('\n')[0]).toBe(`connect  root: ${root}  knowlery command: 2.0.0 on PATH`);
    expect(okText.stdout).not.toContain('warning:');
    const okJson = await runDirectJson<ConnectListResult>(root, ['connect'], okEnv);
    expect(okJson).toMatchObject({
      knowlery_on_path: true,
      knowlery_path: knowleryPath1,
      knowlery_version: '2.0.0',
      knowlery_ok: true,
      warning: null,
    });

    // 1.6.2 on PATH — needs 2.x warning with path and install command
    const oldEnv: RunEnv = {
      pathEnv: bin1,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve('1.6.2\n'),
    };
    const oldText = await runDirect(root, ['connect'], oldEnv);
    expect(oldText.code).toBe(0);
    const oldLines = oldText.stdout.split('\n');
    expect(oldLines[0]).toBe(`connect  root: ${root}  knowlery command: 1.6.2 on PATH, needs 2.x`);
    expect(oldLines[1]).toBe(`warning: the knowlery on PATH is 1.6.2 (${knowleryPath1}); the Skills and MCP entries need 2.x. Run: npm install -g knowlery@next`);
    const oldJson = await runDirectJson<ConnectListResult>(root, ['connect'], oldEnv);
    expect(oldJson).toMatchObject({
      knowlery_on_path: true,
      knowlery_path: knowleryPath1,
      knowlery_version: '1.6.2',
      knowlery_ok: false,
      warning: oldLines[1],
    });

    // Unknown version
    const unknownEnv: RunEnv = {
      pathEnv: bin1,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve(null),
    };
    const unknownText = await runDirect(root, ['connect'], unknownEnv);
    expect(unknownText.code).toBe(0);
    const unknownLines = unknownText.stdout.split('\n');
    expect(unknownLines[0]).toBe(`connect  root: ${root}  knowlery command: on PATH, version unknown`);
    expect(unknownLines[1]).toBe(`warning: could not read the version of the knowlery on PATH (${knowleryPath1}); the Skills and MCP entries need 2.x.`);
    const unknownJson = await runDirectJson<ConnectListResult>(root, ['connect'], unknownEnv);
    expect(unknownJson).toMatchObject({
      knowlery_on_path: true,
      knowlery_path: knowleryPath1,
      knowlery_version: null,
      knowlery_ok: false,
      warning: unknownLines[1],
    });

    // Not on PATH — runner is not called
    let called = false;
    const missingEnv: RunEnv = {
      pathEnv: '',
      homeDir: '',
      runKnowleryVersion: () => {
        called = true;
        return Promise.resolve('2.0.0\n');
      },
    };
    const missingText = await runDirect(root, ['connect'], missingEnv);
    expect(missingText.code).toBe(0);
    expect(called).toBe(false);
    const missingLines = missingText.stdout.split('\n');
    expect(missingLines[0]).toBe(`connect  root: ${root}  knowlery command: not on PATH`);
    expect(missingLines[1]).toBe('warning: the Skills and MCP entries run "knowlery", and it is not on PATH. Install it: npm install -g knowlery@next');
    const missingJson = await runDirectJson<ConnectListResult>(root, ['connect'], missingEnv);
    expect(missingJson).toMatchObject({
      knowlery_on_path: false,
      knowlery_path: null,
      knowlery_version: null,
      knowlery_ok: false,
      warning: missingLines[1],
    });
  });

  it('connect <harness> still writes files with 1.x in front and appends warning only when not ok', async () => {
    const root = await initTempKb();
    const binDir = await makeTempDir('knowlery-v2-bin-');
    const knowleryPath = await makeExecutable(binDir, 'knowlery');

    const oldWarning = `warning: the knowlery on PATH is 1.6.2 (${knowleryPath}); the Skills and MCP entries need 2.x. Run: npm install -g knowlery@next`;
    const oldText = await runDirect(root, ['connect', 'pi', '--mcp'], {
      pathEnv: binDir,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve('1.6.2\n'),
    });
    expect(oldText.code).toBe(0);
    const mcpRaw = await readFile(join(root, '.pi/mcp.json'), 'utf8');
    expect(JSON.parse(mcpRaw)).toMatchObject({
      mcpServers: { knowlery: { command: 'knowlery', args: ['mcp', '--dir', root], exposure: 'direct' } },
    });
    const oldLines = oldText.stdout.trimEnd().split('\n');
    expect(oldLines[oldLines.length - 1]).toBe(oldWarning);
    expect(oldLines[oldLines.length - 2]).toBe('');

    const oldJson = await runDirectJson<ConnectApplyResult>(root, ['connect', 'pi', '--mcp'], {
      pathEnv: binDir,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve('1.6.2\n'),
    });
    expect(oldJson.warning).toBe(oldWarning);

    const okText = await runDirect(root, ['connect', 'pi', '--mcp'], {
      pathEnv: binDir,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve('knowlery 2.0.0 (kf 2.0)\n'),
    });
    expect(okText.code).toBe(0);
    expect(okText.stdout).not.toContain('warning:');

    const okJson = await runDirectJson<ConnectApplyResult>(root, ['connect', 'pi', '--mcp'], {
      pathEnv: binDir,
      homeDir: '',
      runKnowleryVersion: () => Promise.resolve('knowlery 2.0.0 (kf 2.0)\n'),
    });
    expect(okJson.warning).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('runs the real knowlery executable on PATH to read its version', async () => {
    const root = await initTempKb();
    const binDir = await makeTempDir('knowlery-v2-real-bin-');
    const scriptPath = join(binDir, 'knowlery');
    await writeFile(scriptPath, '#!/bin/sh\necho 1.6.2\n', 'utf8');
    await chmod(scriptPath, 0o755);

    const res = await runDirect(root, ['connect'], { pathEnv: binDir, homeDir: '' });
    expect(res.code).toBe(0);
    const lines = res.stdout.split('\n');
    expect(lines[0]).toBe(`connect  root: ${root}  knowlery command: 1.6.2 on PATH, needs 2.x`);
    expect(lines[1]).toBe(`warning: the knowlery on PATH is 1.6.2 (${scriptPath}); the Skills and MCP entries need 2.x. Run: npm install -g knowlery@next`);
  });
});
