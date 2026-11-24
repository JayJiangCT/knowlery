import { afterEach, describe, expect, it } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { runCli } from '../../src/v2/cli/main';
import { renderConventions } from '../../src/v2/core/conventions';
import type { GitCheckIgnoreRunner } from '../../src/v2/core/git';
import type { HealthResult } from '../../src/v2/core/health';
import { AGENTS_LINES, BETA1_AGENTS_LINES, type InitResult } from '../../src/v2/core/init';
import { WIKI_DIR } from '../../src/v2/core/paths';
import type { SyncResult } from '../../src/v2/core/sync';
import type { ValidateResult } from '../../src/v2/core/validate';
import { buildMcpServer } from '../../src/v2/mcp/server';
import {
  HEALTH_DESCRIPTION,
  READ_DESCRIPTION,
  SEARCH_DESCRIPTION,
  SERVER_INSTRUCTIONS,
} from '../../src/v2/mcp/texts';
import { buildReadme } from '../../src/v2/package/manifest';
import { SKILLS } from '../../src/v2/skills';
import { KIT_VERSION } from '../../src/v2/version';
import { configure, digest, failure, fileState, invoke, jsonRun, makeKb } from './helpers';

const tempDirs: string[] = [];

async function makeTempDir(prefix = 'knowlery-v2-hw-'): Promise<string> {
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

async function runDirect(
  root: string,
  argv: string[],
  ioExtra: { runGitCheckIgnore?: GitCheckIgnoreRunner } = {},
) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    cwd: root,
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
    runGitCheckIgnore: ioExtra.runGitCheckIgnore,
  });
  return { code, stdout, stderr };
}

async function runDirectJson<T>(
  root: string,
  argv: string[],
  ioExtra: { runGitCheckIgnore?: GitCheckIgnoreRunner } = {},
): Promise<T & { contract: string; ok: boolean; command: string }> {
  const res = await runDirect(root, [...argv, '--json'], ioExtra);
  expect(res.code, res.stdout || res.stderr).toBe(0);
  expect(res.stderr).toBe('');
  return JSON.parse(res.stdout) as T & { contract: string; ok: boolean; command: string };
}

describe('v2 hidden wiki, built-in skips, and beta.2', () => {
  it('sets KIT_VERSION to 2.0.0-beta.2', () => {
    expect(KIT_VERSION).toBe('2.0.0-beta.2');
  });

  it('uses .knowlery/wiki/ in every user- and agent-facing text and keeps size limits', () => {
    const texts: Array<{ name: string; content: string }> = [
      { name: 'CONVENTIONS.md', content: renderConventions() },
      ...SKILLS.map((s) => ({ name: s.name, content: s.text })),
      { name: 'SERVER_INSTRUCTIONS', content: SERVER_INSTRUCTIONS },
      { name: 'SEARCH_DESCRIPTION', content: SEARCH_DESCRIPTION },
      { name: 'READ_DESCRIPTION', content: READ_DESCRIPTION },
      { name: 'HEALTH_DESCRIPTION', content: HEALTH_DESCRIPTION },
      { name: 'AGENTS_LINES', content: AGENTS_LINES.join('\n') },
      { name: 'README', content: buildReadme() },
    ];

    for (const { name, content } of texts) {
      const bareWikiSlash = content.match(/(?<!\.knowlery\/)\bwiki\//g);
      expect(bareWikiSlash, `${name} contains bare wiki/`).toBeNull();
    }

    expect(Buffer.byteLength(renderConventions(), 'utf8')).toBeLessThan(12288);
    for (const skill of SKILLS) {
      expect(Buffer.byteLength(skill.text, 'utf8')).toBeLessThan(8192);
    }
    expect(SEARCH_DESCRIPTION.length).toBeLessThanOrEqual(1000);
    expect(READ_DESCRIPTION.length).toBeLessThanOrEqual(1000);
    expect(HEALTH_DESCRIPTION.length).toBeLessThanOrEqual(1000);
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(2000);
  });

  it('creates .knowlery/wiki/ without root wiki/, treats user wiki/ as raw sources, and validates citations accordingly', async () => {
    const root = await makeTempDir();
    await mkdir(join(root, 'wiki'), { recursive: true });
    const ownNote = '# Own note\n\nKept in a folder named wiki.\n';
    await writeFile(join(root, 'wiki/own.md'), ownNote);

    const initRes = await runDirectJson<InitResult>(root, ['init'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(initRes.created).toContain(`${WIKI_DIR}/`);
    expect(initRes.created).not.toContain('wiki/');

    const inv = await jsonRun(root, ['inventory']);
    expect(inv.items.map((item) => item.path)).toEqual(['wiki/own.md']);

    // Page citing a source under user's wiki/ validates cleanly.
    const ownSha = digest(ownNote).slice('sha256:'.length);
    await writeFile(
      join(root, `${WIKI_DIR}/own-topic.md`),
      [
        '---',
        'type: concept',
        'title: Own topic',
        'description: Cites a user file in root wiki/.',
        'status: current',
        'created: 2026-11-20',
        'updated: 2026-11-20',
        '---',
        '# Own topic',
        '',
        '## Current',
        '- User notes in wiki/ are ordinary sources (src: s1) ^c1',
        '',
        '## Sources',
        `- s1 · \`wiki/own.md\` · sha256:${ownSha} · heading Own note · "Kept in a folder named wiki."`,
        '',
      ].join('\n'),
    );

    const valOk = await runDirectJson<ValidateResult>(root, ['validate']);
    expect(valOk.counts.errors).toBe(0);
    expect(valOk.counts.warnings).toBe(0);

    // Page citing a path under .knowlery/ fails validation with source_path_invalid.
    await writeFile(
      join(root, `${WIKI_DIR}/bad-internal.md`),
      [
        '---',
        'type: concept',
        'title: Bad internal',
        'description: Cites a path inside .knowlery/.',
        'status: current',
        'created: 2026-11-20',
        'updated: 2026-11-20',
        '---',
        '# Bad internal',
        '',
        '## Current',
        '- Invalid internal citation (src: s1) ^c1',
        '',
        '## Sources',
        `- s1 · \`.knowlery/config.json\` · sha256:${'a'.repeat(64)} · line 1`,
        '',
      ].join('\n'),
    );

    const valBad = await runDirectJson<ValidateResult>(root, ['validate', '--scope', `${WIKI_DIR}/bad-internal.md`]);
    expect(valBad.counts.errors).toBeGreaterThan(0);
    expect(valBad.items.some((item) => item.code === 'source_path_invalid')).toBe(true);

    // read, search, stale, and index rebuild all use .knowlery/wiki/.
    const readRes = await invoke(root, ['read', `${WIKI_DIR}/own-topic.md`]);
    expect(readRes.code).toBe(0);
    expect(readRes.stdout).toContain(`read ${WIKI_DIR}/own-topic.md`);

    const searchRes = await invoke(root, ['search', 'ordinary sources']);
    expect(searchRes.code).toBe(0);
    expect(searchRes.stdout).toContain(`${WIKI_DIR}/own-topic.md`);

    const rebuildRes = await runDirect(root, ['index', 'rebuild', '--json']);
    expect(rebuildRes.code).toBe(0);
    expect(JSON.parse(rebuildRes.stdout)).toMatchObject({ pages: 2, index: 'written' });
    await expect(lstat(join(root, 'wiki/index.md'))).rejects.toThrow();
  });

  it('detects a 2.0.0-beta.1 base on every command and MCP tool, then migrates cleanly via mv + sync --apply', async () => {
    const root = await makeTempDir();
    await configure(root, { kf: '2.0', ignore: [], mcp: { raw: true } });
    await mkdir(join(root, 'wiki'), { recursive: true });
    await writeFile(
      join(root, 'wiki/CONVENTIONS.md'),
      '<!-- Generated by knowlery for kf 2.0. Do not edit: knowlery sync --apply overwrites this file. -->\n# Old beta.1 conventions\n',
    );
    await writeFile(join(root, 'wiki/index.md'), '# Index\n');
    await writeFile(join(root, 'wiki/log.md'), '# Log\n');
    await writeFile(join(root, 'AGENTS.md'), `${BETA1_AGENTS_LINES.join('\n')}\n`);
    for (const skill of SKILLS) {
      const dir = join(root, '.agents/skills', skill.name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'SKILL.md'), `Old ${skill.name} referencing wiki/\n`);
    }

    const expectedMessage = 'Found wiki/ made by an earlier 2.0 beta. The wiki now lives in .knowlery/wiki/.';
    const expectedMoveRecovery = 'In the knowledge base folder run: mv wiki .knowlery/wiki   Then run: knowlery sync --apply';

    for (const argv of [['health'], ['init'], ['sync'], ['connect']]) {
      const before = await fileState(root);
      const res = await runDirect(root, [...argv, '--json']);
      expect(res.code).toBe(1);
      const payload = JSON.parse(res.stdout) as { ok: boolean; error: { code: string; message: string; recovery: string } };
      expect(payload).toMatchObject({
        ok: false,
        error: {
          code: 'unsupported_schema',
          message: expectedMessage,
          recovery: expectedMoveRecovery,
        },
      });
      expect(await fileState(root)).toEqual(before);
    }

    // MCP tool also fails with the exact message and writes nothing.
    const beforeMcp = await fileState(root);
    const server = buildMcpServer({ cwd: root });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test-client', version: '0.0.1' });
    await client.connect(clientTransport);
    const mcpRes = await client.callTool({ name: 'health', arguments: {} }) as {
      isError?: boolean;
      structuredContent?: { error?: { code: string; message: string; recovery: string } };
    };
    expect(mcpRes.isError).toBe(true);
    expect(mcpRes.structuredContent?.error).toEqual({
      code: 'unsupported_schema',
      message: expectedMessage,
      recovery: expectedMoveRecovery,
    });
    expect(await fileState(root)).toEqual(beforeMcp);
    await client.close();
    await server.close();

    // When both wiki/ and .knowlery/wiki/ exist, recovery tells the user to merge by hand.
    await mkdir(join(root, WIKI_DIR), { recursive: true });
    const bothRes = await runDirect(root, ['health', '--json']);
    expect(bothRes.code).toBe(1);
    const bothPayload = JSON.parse(bothRes.stdout) as { error: { recovery: string } };
    expect(bothPayload.error.recovery).toBe(
      'Both wiki/ and .knowlery/wiki/ exist. Knowlery does not choose. Merge the pages into .knowlery/wiki/ by hand, then remove wiki/.',
    );
    await rm(join(root, WIKI_DIR), { recursive: true, force: true });

    // Move wiki -> .knowlery/wiki, then sync and sync --apply.
    await rename(join(root, 'wiki'), join(root, WIKI_DIR));

    const syncCheck = await runDirectJson<SyncResult>(root, ['sync']);
    expect(syncCheck.conventions).toBe('outdated');
    expect(syncCheck.agents.state).toBe('outdated');
    expect(syncCheck.skills.every((s) => s.state === 'outdated')).toBe(true);

    const syncApplied = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(syncApplied.conventions).toBe('updated');
    expect(syncApplied.agents.state).toBe('updated');
    expect(syncApplied.skills.every((s) => s.state === 'updated')).toBe(true);
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(`${AGENTS_LINES.join('\n')}\n`);

    const healthAfter = await runDirectJson<HealthResult>(root, ['health'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(healthAfter.wiki.conventions).toBe('current');

    // User-customized AGENTS.md with one extra line stays byte-identical under sync --apply and is reported incomplete.
    const customAgents = `${BETA1_AGENTS_LINES.join('\n')}\nMy own project note.\n`;
    await writeFile(join(root, 'AGENTS.md'), customAgents);
    const syncCustom = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(syncCustom.agents.state).toBe('incomplete');
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(customAgents);

    // Missing AGENTS.md is reported missing, then created on --apply.
    await rm(join(root, 'AGENTS.md'));
    const syncMissing = await runDirectJson<SyncResult>(root, ['sync']);
    expect(syncMissing.agents.state).toBe('missing');
    const syncCreated = await runDirectJson<SyncResult>(root, ['sync', '--apply']);
    expect(syncCreated.agents.state).toBe('created');
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe(`${AGENTS_LINES.join('\n')}\n`);
  });

  it('reports git ignore states in health and warning in health and init only when ignored', async () => {
    const root = await makeTempDir();
    const ignoredRunner: GitCheckIgnoreRunner = () => Promise.resolve({
      exitCode: 0,
      stdout: '.gitignore:1:.knowlery/\t.knowlery/wiki/CONVENTIONS.md\n',
    });
    const notIgnoredRunner: GitCheckIgnoreRunner = () => Promise.resolve({
      exitCode: 1,
      stdout: '',
    });
    const noRepoRunner: GitCheckIgnoreRunner = () => Promise.resolve({
      exitCode: 128,
      stdout: '',
    });

    const expectedWarning = 'warning: git ignores .knowlery/wiki/ (.gitignore:1:.knowlery/), so commits will not contain the wiki. Ignore only .knowlery/cache/ instead. Knowlery does not change ignore files.';

    const initIgnored = await runDirect(root, ['init'], { runGitCheckIgnore: ignoredRunner });
    expect(initIgnored.code).toBe(0);
    expect(initIgnored.stdout.trimEnd().split('\n').pop()).toBe(expectedWarning);

    const initNotIgnored = await runDirect(root, ['init'], { runGitCheckIgnore: notIgnoredRunner });
    expect(initNotIgnored.code).toBe(0);
    expect(initNotIgnored.stdout).not.toContain('warning: git ignores');

    const healthIgnored = await runDirect(root, ['health'], { runGitCheckIgnore: ignoredRunner });
    expect(healthIgnored.code).toBe(0);
    expect(healthIgnored.stdout).toContain('git=ignored');
    expect(healthIgnored.stdout.trimEnd().split('\n').pop()).toBe(expectedWarning);

    const healthIgnoredJson = await runDirectJson<HealthResult>(root, ['health'], { runGitCheckIgnore: ignoredRunner });
    expect(healthIgnoredJson.wiki.git).toBe('ignored');
    expect(healthIgnoredJson.wiki.git_rule).toBe('.gitignore:1:.knowlery/');
    expect(healthIgnoredJson.warning).toBe(expectedWarning);

    const healthNotIgnored = await runDirect(root, ['health'], { runGitCheckIgnore: notIgnoredRunner });
    expect(healthNotIgnored.code).toBe(0);
    expect(healthNotIgnored.stdout).toContain('git=not_ignored');
    expect(healthNotIgnored.stdout).not.toContain('warning: git ignores');

    const healthNoRepo = await runDirect(root, ['health'], { runGitCheckIgnore: noRepoRunner });
    expect(healthNoRepo.code).toBe(0);
    expect(healthNoRepo.stdout).toContain('git=no_repo');
    expect(healthNoRepo.stdout).not.toContain('warning: git ignores');
  });

  it('applies built-in skips, reports skipped counts and health line, denies direct reads/scopes, and checks skips before ignore', async () => {
    const root = await makeKb();
    tempDirs.push(root);

    // 1. node_modules at root and nested
    await mkdir(join(root, 'node_modules/root-pkg'), { recursive: true });
    await writeFile(join(root, 'node_modules/root-pkg/README.md'), 'Root pkg\n');
    await mkdir(join(root, 'app/node_modules/nested-pkg'), { recursive: true });
    await writeFile(join(root, 'app/node_modules/nested-pkg/README.md'), 'Nested pkg\n');

    // 2. dist beside package.json in subfolder -> skipped
    await writeFile(join(root, 'app/package.json'), '{}\n');
    await writeFile(join(root, 'app/notes.md'), '# App notes\n');
    await mkdir(join(root, 'app/dist'), { recursive: true });
    await writeFile(join(root, 'app/dist/out.md'), 'Build output\n');

    // 3. dist without a project manifest beside it -> kept
    await mkdir(join(root, 'plain/dist'), { recursive: true });
    await writeFile(join(root, 'plain/dist/kept.md'), '# Kept dist note\n');

    // 4. root outputs/ beside root package.json -> kept
    await writeFile(join(root, 'package.json'), '{}\n');
    await mkdir(join(root, 'outputs'), { recursive: true });
    await writeFile(join(root, 'outputs/deliverable.md'), '# Deliverable\n');

    // 5. Configure ignore to also name app/node_modules -> must still be skipped, not counted as ignored
    await configure(root, { kf: '2.0', ignore: ['app/node_modules'] });

    const inv = await jsonRun(root, ['inventory']);
    const paths = inv.items.map((item) => item.path);
    expect(paths).toContain('app/notes.md');
    expect(paths).toContain('plain/dist/kept.md');
    expect(paths).toContain('outputs/deliverable.md');
    expect(paths.some((p) => p.includes('node_modules') || p.startsWith('app/dist/'))).toBe(false);
    expect(inv.counts.skipped).toBe(3);
    expect(inv.counts.ignored).toBe(0);

    const healthText = await runDirect(root, ['health'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(healthText.code).toBe(0);
    expect(healthText.stdout).toContain('skipped=3');
    expect(healthText.stdout).toContain('skipped folders: app/dist, app/node_modules, node_modules');

    const healthJson = await runDirectJson<HealthResult>(root, ['health'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(healthJson.sources.skipped).toBe(3);
    expect(healthJson.skipped_folders).toEqual(['app/dist', 'app/node_modules', 'node_modules']);
    expect(healthJson.skipped_folders_more).toBe(0);

    // read and stale --scope on skipped folders fail with path_denied
    await failure(root, ['read', 'app/node_modules/nested-pkg/README.md'], 'path_denied', 1);
    await failure(root, ['read', 'app/dist/out.md'], 'path_denied', 1);
    await failure(root, ['stale', '--scope', 'app/node_modules'], 'path_denied', 1);
    await failure(root, ['stale', '--scope', 'app/dist'], 'path_denied', 1);

    // More than 10 skipped folders caps at 10 and appends (+N more)
    for (let i = 1; i <= 10; i++) {
      const dir = join(root, `pkg-${String(i).padStart(2, '0')}/__pycache__`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'cache.txt'), 'x\n');
    }
    const manyHealth = await runDirect(root, ['health'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(manyHealth.stdout).toContain('skipped=13');
    expect(manyHealth.stdout).toContain('(+3 more)');
    const manyHealthJson = await runDirectJson<HealthResult>(root, ['health'], {
      runGitCheckIgnore: () => Promise.resolve({ exitCode: 128, stdout: '' }),
    });
    expect(manyHealthJson.skipped_folders).toHaveLength(10);
    expect(manyHealthJson.skipped_folders_more).toBe(3);
  });
});
