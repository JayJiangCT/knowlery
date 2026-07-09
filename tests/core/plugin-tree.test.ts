import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildPluginTree } from '../../scripts/build-plugin';
import { BUNDLED_SKILLS } from '../../src/assets/skills';

/**
 * Spec 1.1 f2, §5: the committed plugin tree is generated output — these
 * tests hold it to its generator (drift), its source (parity), and its
 * promises (manifests, configs, no-execution).
 */

const repoRoot = join(__dirname, '..', '..');
const committed = join(repoRoot, 'plugin');
let fresh: string;

function walk(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full));
  }
  return out.sort();
}

beforeAll(() => {
  fresh = mkdtempSync(join(tmpdir(), 'knowlery-plugin-'));
  buildPluginTree(fresh);
});

afterAll(() => {
  rmSync(fresh, { recursive: true, force: true });
});

describe('drift: the committed tree equals a fresh build (§5.1)', () => {
  it('same file set, same bytes', () => {
    const committedFiles = walk(committed, committed);
    expect(committedFiles).toEqual(walk(fresh, fresh));
    for (const file of committedFiles) {
      expect(readFileSync(join(committed, file), 'utf8'), file)
        .toBe(readFileSync(join(fresh, file), 'utf8'));
    }
  });
});

describe('parity with BUNDLED_SKILLS (§5.2)', () => {
  it('every skill, exactly, byte-for-byte', () => {
    const dirs = readdirSync(join(committed, 'skills')).sort();
    expect(dirs).toEqual(BUNDLED_SKILLS.map((skill) => skill.name).sort());
    for (const skill of BUNDLED_SKILLS) {
      expect(readFileSync(join(committed, 'skills', skill.name, 'SKILL.md'), 'utf8'), skill.name)
        .toBe(skill.content);
    }
  });
});

describe('manifests (§5.3)', () => {
  const packageVersion = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;

  it.each([
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
  ])('%s parses, is named knowlery, and matches the package version', (path) => {
    const manifest = JSON.parse(readFileSync(join(committed, path), 'utf8')) as { name: string; version: string };
    expect(manifest.name).toBe('knowlery');
    expect(manifest.version).toBe(packageVersion);
  });
});

describe('MCP configs and the shim (§5.4)', () => {
  it('.mcp.json and mcp.json are identical and pin exactly npx -y knowlery@^1 mcp', () => {
    const dotted = readFileSync(join(committed, '.mcp.json'), 'utf8');
    expect(readFileSync(join(committed, 'mcp.json'), 'utf8')).toBe(dotted);
    const config = JSON.parse(dotted) as { mcpServers: { knowlery: { command: string; args: string[] } } };
    expect(config.mcpServers.knowlery.command).toBe('npx');
    expect(config.mcpServers.knowlery.args).toEqual(['-y', 'knowlery@^1', 'mcp']);
  });

  it('the shim is executable and carries the same pin', () => {
    const shimPath = join(committed, 'bin', 'knowlery');
    expect(statSync(shimPath).mode & 0o111).not.toBe(0);
    const shim = readFileSync(shimPath, 'utf8');
    expect(shim).toContain('npx -y knowlery@^1');
    expect(shim.startsWith('#!/bin/sh')).toBe(true);
  });
});

describe('no execution surface (§5.8)', () => {
  it('no hooks, and nothing outside the declared shape', () => {
    const files = walk(committed, committed);
    expect(files.some((file) => file.includes('hooks'))).toBe(false);
    for (const file of files) {
      const allowed = file.endsWith('/SKILL.md')
        || file.endsWith('plugin.json')
        || file === '.mcp.json'
        || file === 'mcp.json'
        || file === 'bin/knowlery';
      expect(allowed, file).toBe(true);
    }
  });
});
