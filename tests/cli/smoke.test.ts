import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import esbuild from 'esbuild';

const run = promisify(execFile);

/**
 * Spec 0.7 f2, §6.5: the built artifact (not just the handlers) runs the full
 * init -> health -> sync round trip. The bundle is built here with the same entry the
 * release build uses, into a temp file, then spawned with plain node.
 */
describe('knowlery-cli.mjs smoke (spec 0.7 f2, §6.5)', () => {
  it('round-trips init, health, sync in a temp workspace', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'knowlery-smoke-'));
    const cliPath = join(workDir, 'knowlery-cli.mjs');
    const vaultDir = join(workDir, 'kb');

    try {
      await esbuild.build({
        entryPoints: [join(__dirname, '..', '..', 'src', 'cli', 'main.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node18',
        outfile: cliPath,
        logLevel: 'silent',
        define: { KNOWLERY_VERSION: JSON.stringify('0.0.0-test') },
        banner: {
          js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
        },
      });

      const version = await run('node', [cliPath, '--version']);
      expect(version.stdout.trim()).toBe('0.0.0-test');

      const init = await run('node', [cliPath, 'init', '--dir', vaultDir, '--platform', 'claude-code', '--name', 'Smoke KB']);
      expect(init.stdout).toContain('Initialized Knowlery workspace "Smoke KB"');
      await stat(join(vaultDir, 'KNOWLEDGE.md'));
      await stat(join(vaultDir, '.knowlery', 'bin', 'query.mjs'));

      const health = await run('node', [cliPath, 'health', '--dir', vaultDir]);
      expect(health.stdout).toContain('Built-in skills — 14 installed');

      const sync = await run('node', [cliPath, 'sync', '--dir', vaultDir]);
      const secondSync = await run('node', [cliPath, 'sync', '--dir', vaultDir]);
      expect(`${sync.stdout}${secondSync.stdout}`).toContain('No changes');

      // query/stale (spec 0.7 f3, §5.4): global CLI vs the vault-embedded script,
      // against the same workspace state, must print identical output.
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        join(vaultDir, 'concepts', 'widget-design.md'),
        '---\ntitle: Widget Design\ntype: concept\ncreated: 2026-01-01\ntags: [design]\n---\n\nWidgets are designed with care.\n',
      );
      const cliQuery = await run('node', [cliPath, 'query', '--dir', vaultDir, 'widget design']);
      const embeddedQuery = await run('node', [join(vaultDir, '.knowlery', 'bin', 'query.mjs'), 'widget design']);
      expect(cliQuery.stdout.trim()).toBe(embeddedQuery.stdout.trim());
      expect(cliQuery.stdout).toContain('concepts/widget-design.md');

      const cliStale = await run('node', [cliPath, 'stale', '--dir', vaultDir]);
      const embeddedStale = await run('node', [join(vaultDir, '.knowlery', 'bin', 'query.mjs'), '--stale']);
      expect(cliStale.stdout.trim()).toBe(embeddedStale.stdout.trim());

      // EPIPE (spec 0.8 f3, §4.4): the agent-pipes-to-head shape. pipefail makes the
      // pipeline report node's exit status, not head's — without it this assertion
      // would be falsely green while node dies of EPIPE.
      const piped = await run('bash', [
        '-o', 'pipefail', '-c',
        `node "${cliPath}" query --dir "${vaultDir}" "widget design" | head -1`,
      ]);
      expect(piped.stdout.trim()).toBe(cliQuery.stdout.trim().split('\n')[0].trim());
      expect(piped.stderr).not.toContain('EPIPE');

      // Deterministic EPIPE: destroy the read end before the CLI finishes scanning,
      // forcing its writes onto a broken pipe. Exit 0 proves the stream handler.
      const { spawn } = await import('node:child_process');
      const epipeExit = await new Promise<number | null>((resolvePromise) => {
        const child = spawn('node', [cliPath, 'query', '--dir', vaultDir, '--json', 'widget design']);
        child.stdout.destroy();
        child.on('close', (code) => resolvePromise(code));
      });
      expect(epipeExit).toBe(0);

      // Weighted-coverage abstention (spec 0.9 f4, §5.5): a short CJK title hit
      // with a long unmatched chunk abstains identically on both transports.
      await writeFile(
        join(vaultDir, 'entities', '云雀.md'),
        '---\ntitle: 云雀\ntype: entity\ncreated: 2026-01-01\n---\n\n云雀 is a codename.\n',
      );
      const weightedCli = await run('node', [cliPath, 'query', '--dir', vaultDir, '云雀的移动端路线图是什么']);
      expect(weightedCli.stdout).toContain('No confident matches');
      const weightedEmbedded = await run('node', [join(vaultDir, '.knowlery', 'bin', 'query.mjs'), '云雀的移动端路线图是什么']);
      expect(weightedEmbedded.stdout.trim()).toBe(weightedCli.stdout.trim());

      // Abstention is a result, not an error: exit 0.
      const abstain = await run('node', [cliPath, 'query', '--dir', vaultDir, 'zebra quantum lighthouse']);
      expect(abstain.stdout).toContain('No confident matches');

      // Near-collision abstention (spec 0.8 f2, §5.4): "widget" hits the existing
      // page title but covers 1/3 terms — the confidence gate must refuse, not rank noise.
      const nearCollision = await run('node', [cliPath, 'query', '--dir', vaultDir, 'widget pricing roadmap']);
      expect(nearCollision.stdout).toContain('No confident matches');
      const embeddedNearCollision = await run('node', [join(vaultDir, '.knowlery', 'bin', 'query.mjs'), 'widget pricing roadmap']);
      expect(embeddedNearCollision.stdout.trim()).toBe(nearCollision.stdout.trim());

      // Missing question: usage error, exit 2.
      const noQuestion = await run('node', [cliPath, 'query', '--dir', vaultDir]).catch(
        (error: { code: number; stderr: string }) => error,
      );
      expect(noQuestion.code).toBe(2);

      // bundle install -> list -> uninstall (spec 0.7 f4, §5.5).
      const bundleDir = join(workDir, 'bundle-src');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(bundleDir, 'concepts'), { recursive: true });
      await writeFile(join(bundleDir, 'knowlery-bundle.json'), JSON.stringify({
        schemaVersion: 1, okfVersion: '0.1', id: 'smoke.pack', title: 'Smoke Pack',
        version: '1.0.0', creator: { name: 'Smoke', url: '' },
        releasedAt: '2026-07-01T00:00:00.000Z', entrypoint: 'index.md',
        contentHash: 'sha256-smoke', license: 'personal', knowleryVersion: '0.6.1', conceptCount: 1,
      }));
      await writeFile(join(bundleDir, 'index.md'), '---\nokf_version: "0.1"\n---\n\n# Smoke Pack\n');
      await writeFile(
        join(bundleDir, 'concepts', 'thing.md'),
        '---\ntype: Concept\ntitle: Thing\ndescription: A smoke thing\ndomain: smoke\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
      );

      const install = await run('node', [cliPath, 'bundle', 'install', bundleDir, '--dir', vaultDir]);
      expect(install.stdout).toContain('Installed smoke.pack v1.0.0');
      const list = await run('node', [cliPath, 'bundle', 'list', '--dir', vaultDir]);
      expect(list.stdout).toContain('smoke.pack v1.0.0');
      const uninstall = await run('node', [cliPath, 'bundle', 'uninstall', 'smoke.pack', '--dir', vaultDir]);
      expect(uninstall.stdout).toContain('Uninstalled smoke.pack');

      // export -> review -> export --zip -> install into a fresh workspace (spec 0.8 f1, §5.5).
      const gate = await run('node', [cliPath, 'bundle', 'export', 'widget-design', '--dir', vaultDir]).catch(
        (error: { code: number; stdout: string }) => error,
      );
      expect(gate.code).toBe(1);
      expect(gate.stdout).toContain('[unreviewed');
      const review = await run('node', [cliPath, 'bundle', 'review', 'widget-design', '--dir', vaultDir, '--approve', 'concepts/widget-design']);
      expect(review.stdout).toContain('fully reviewed');
      const exported = await run('node', [cliPath, 'bundle', 'export', 'widget-design', '--dir', vaultDir, '--zip']);
      expect(exported.stdout).toContain('Exported creator.widget.design v0.1.0');
      const zipPath = exported.stdout.match(/Zip:\s+(\S+)/)?.[1];
      expect(zipPath).toBeTruthy();

      const kb3 = join(workDir, 'kb3');
      await run('node', [cliPath, 'init', '--dir', kb3, '--platform', 'claude-code', '--name', 'KB3']);
      const installExported = await run('node', [cliPath, 'bundle', 'install', zipPath!, '--dir', kb3, '--skip-conformance']);
      expect(installExported.stdout).toContain('Installed creator.widget.design v0.1.0');
      const bundleQuery = await run('node', [cliPath, 'query', '--dir', kb3, 'widget design']);
      expect(bundleQuery.stdout).toContain('widget-design');

      // Remote install (spec 0.9 f1): the built artifact installs from a served URL.
      const { createServer } = await import('node:http');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('knowlery-bundle.json', JSON.stringify({
        schemaVersion: 1, okfVersion: '0.1', id: 'remote.smoke', title: 'Remote Smoke',
        version: '1.0.0', creator: { name: 'Smoke', url: '' },
        releasedAt: '2026-07-07T00:00:00.000Z', entrypoint: 'index.md',
        contentHash: 'sha256-remote-smoke', license: 'personal', knowleryVersion: '0.8.0', conceptCount: 1,
      }));
      zip.file('index.md', '---\nokf_version: "0.1"\n---\n\n# Remote Smoke\n');
      zip.file('concepts/remote-thing.md', '---\ntype: Concept\ntitle: Remote Thing\ndescription: A remote smoke thing\ndomain: smoke\ntimestamp: 2026-07-07T00:00:00.000Z\n---\n\nBody.');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const bundleServer = createServer((_req, res) => { res.writeHead(200); res.end(zipBuffer); });
      await new Promise<void>((r) => bundleServer.listen(0, '127.0.0.1', r));
      const port = (bundleServer.address() as { port: number }).port;
      try {
        const remoteInstall = await run('node', [cliPath, 'bundle', 'install', `http://127.0.0.1:${port}/remote.zip`, '--dir', vaultDir, '--skip-conformance']);
        expect(remoteInstall.stdout).toContain('Installed remote.smoke v1.0.0');
        expect(remoteInstall.stdout).toContain('plain http');
        const remoteList = await run('node', [cliPath, 'bundle', 'list', '--dir', vaultDir]);
        expect(remoteList.stdout).toContain('from 127.0.0.1');
        await run('node', [cliPath, 'bundle', 'uninstall', 'remote.smoke', '--dir', vaultDir]);
      } finally {
        await new Promise<void>((r) => bundleServer.close(() => r()));
      }

      // KB registry (spec 1.0 f1): register, resolve --kb from an unrelated cwd,
      // federated attribution, and the --kb/--dir conflict — on the built artifact.
      const configDir = join(workDir, 'kb-config');
      const kbEnv = { ...process.env, KNOWLERY_CONFIG_DIR: configDir };
      await run('node', [cliPath, 'kb', 'add', 'smoke', vaultDir], { env: kbEnv });
      const kbList = await run('node', [cliPath, 'kb', 'list'], { env: kbEnv });
      expect(kbList.stdout).toContain('smoke');
      const kbQuery = await run('node', [cliPath, 'query', '--kb', 'smoke', 'widget design'], { env: kbEnv });
      expect(kbQuery.stdout).toContain('concepts/widget-design.md');
      const federated = await run('node', [cliPath, 'query', '--kb', '*', 'widget design'], { env: kbEnv });
      expect(federated.stdout).toContain('smoke: concepts/widget-design.md');
      const conflict = await run('node', [cliPath, 'query', '--kb', 'smoke', '--dir', vaultDir, 'x'], { env: kbEnv })
        .catch((error: { code: number; stderr: string }) => error);
      expect(conflict.code).toBe(2);
      expect(conflict.stderr).toContain('not both');

      // MCP over stdio (spec 1.0 f2, §5.7): the built artifact serves a real
      // JSON-RPC session — handshake, tool list, one query — then exits when
      // the client hangs up.
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const mcpTransport = new StdioClientTransport({
        command: 'node',
        args: [cliPath, 'mcp'],
        env: { ...kbEnv } as Record<string, string>,
      });
      const mcpClient = new Client({ name: 'smoke', version: '0.0.0' });
      await mcpClient.connect(mcpTransport);
      try {
        const mcpTools = await mcpClient.listTools();
        expect(mcpTools.tools.map((tool) => tool.name).sort()).toEqual(
          ['capture', 'health', 'init_kb', 'list_bundles', 'list_kbs', 'query', 'stale', 'sync'],
        );
        const mcpQuery = await mcpClient.callTool({ name: 'query', arguments: { kb: 'smoke', question: 'widget design' } });
        const mcpData = mcpQuery.structuredContent as { candidates: Array<{ path: string }> };
        expect(mcpData.candidates[0].path).toBe('concepts/widget-design.md');

        // The write path on the built artifact (spec 1.0 f3, §5.8):
        // init_kb → capture → query finds the capture → sync.
        const mcpInit = await mcpClient.callTool({
          name: 'init_kb',
          arguments: { name: 'mcp-born', path: join(workDir, 'mcp-born'), platform: 'claude-code' },
        });
        expect(mcpInit.isError).toBeFalsy();
        await stat(join(workDir, 'mcp-born', 'KNOWLEDGE.md'));

        const mcpCapture = await mcpClient.callTool({
          name: 'capture',
          arguments: { kb: 'mcp-born', content: 'Zephyr protocol handshake uses rotating nonces.', title: 'Zephyr handshake' },
        });
        const captureData = mcpCapture.structuredContent as { path: string };
        expect(captureData.path).toMatch(/^inbox\//);

        const mcpFindCapture = await mcpClient.callTool({
          name: 'query',
          arguments: { kb: 'mcp-born', question: 'zephyr protocol handshake' },
        });
        const findData = mcpFindCapture.structuredContent as { candidates: Array<{ path: string }> };
        expect(findData.candidates[0].path).toBe(captureData.path);

        // First sync may stamp the manifest; the second must be a clean no-op.
        await mcpClient.callTool({ name: 'sync', arguments: { kb: 'mcp-born' } });
        const mcpSync = await mcpClient.callTool({ name: 'sync', arguments: { kb: 'mcp-born' } });
        expect(mcpSync.isError).toBeFalsy();
        expect((mcpSync.structuredContent as { updated: string[] }).updated).toEqual([]);
      } finally {
        await mcpClient.close();
      }

      // Remote mode (spec 1.0 f4, §5.9): the built artifact serves HTTP with a
      // token file — one authorized query, one 401, clean SIGTERM shutdown.
      // Startup output must never contain the token (§5.8 hygiene).
      const serveToken = 'smoke-token-0123456789abcdef';
      const tokenFile = join(workDir, 'mcp-token');
      await writeFile(tokenFile, `${serveToken}\n`);
      const servePort = 20000 + Math.floor(Math.random() * 40000);
      const serveChild = spawn('node', [cliPath, 'mcp', 'serve', '--port', String(servePort), '--token-file', tokenFile], { env: kbEnv });
      let serveOutput = '';
      serveChild.stdout.on('data', (chunk: Buffer) => { serveOutput += chunk.toString(); });
      serveChild.stderr.on('data', (chunk: Buffer) => { serveOutput += chunk.toString(); });
      try {
        await new Promise<void>((resolveReady, rejectReady) => {
          const poll = setInterval(() => { if (serveOutput.includes('serving on')) { clearInterval(poll); resolveReady(); } }, 50);
          serveChild.once('exit', () => { clearInterval(poll); rejectReady(new Error(`serve exited early:\n${serveOutput}`)); });
        });
        expect(serveOutput).toContain('Access: reads only.');
        expect(serveOutput).not.toContain(serveToken);

        const denied = await fetch(`http://127.0.0.1:${servePort}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        });
        expect(denied.status).toBe(401);

        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
        const httpTransport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${servePort}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${serveToken}` } },
        });
        const httpClient = new Client({ name: 'smoke-http', version: '0.0.0' });
        await httpClient.connect(httpTransport);
        try {
          const httpQuery = await httpClient.callTool({ name: 'query', arguments: { kb: 'smoke', question: 'widget design' } });
          expect((httpQuery.structuredContent as { candidates: Array<{ path: string }> }).candidates[0].path)
            .toBe('concepts/widget-design.md');
        } finally {
          await httpClient.close();
        }
      } finally {
        const exited = new Promise<number | null>((resolveExit) => serveChild.once('exit', (code) => resolveExit(code)));
        serveChild.kill('SIGTERM');
        expect(await exited).toBe(0);
      }

      // Non-TTY init without flags must fail deterministically.
      const badInit = await run('node', [cliPath, 'init', '--dir', join(workDir, 'kb2')]).catch(
        (error: { code: number; stderr: string }) => error,
      );
      expect(badInit.code).toBe(1);
      expect(badInit.stderr).toContain('--platform');
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 30000);
});
