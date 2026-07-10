import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUNDLED_SKILLS } from '../src/assets/skills';

/**
 * Generates the agent plugin tree (spec 1.1 f2, §4.1/§4.2): one tree, three
 * platform manifests (Claude Code, Codex, Cursor), skills from
 * BUNDLED_SKILLS, MCP configs from one template, and the Claude Code bin
 * shim. The committed plugin/ directory must always equal this script's
 * output — CI diffs them (the plugin-drift check).
 *
 * Antigravity is deferred (maintainer decision at spec review): this layout
 * must not preclude a later root plugin.json + mcp_config.json, and it
 * doesn't — the root is free.
 *
 * Usage: npm run build:plugin [-- <outDir>]   (default: plugin/)
 */

const DESCRIPTION = 'Knowlery: the knowledge base your agents can live in — '
  + 'query, capture, and maintain plain-markdown knowledge bases by conversation.';

/** One template, every platform (spec §4.1): the pin leans on the 1.0 freeze. */
const MCP_CONFIG = {
  mcpServers: {
    knowlery: {
      command: 'npx',
      args: ['-y', 'knowlery@^1', 'mcp'],
    },
  },
};

const SHIM = `#!/bin/sh
# Knowlery CLI shim (spec 1.1 f2): on the agent's PATH while the plugin is enabled.
exec npx -y knowlery@^1 "$@"
`;

/**
 * The repo-root marketplace catalog (spec 1.1 f3, §4.1): makes the repository
 * itself installable-from — `/plugin marketplace add JayJiangCT/knowlery`.
 * Lives at <repo>/.claude-plugin/marketplace.json per the platform's
 * marketplace-repo convention; drift-guarded like the tree.
 */
export function buildMarketplaceCatalog(outPath: string): void {
  const version = readPackageVersion();
  const catalog = {
    name: 'knowlery',
    description: DESCRIPTION,
    owner: { name: 'Jay Jiang', url: 'https://github.com/JayJiangCT' },
    plugins: [
      {
        name: 'knowlery',
        source: './plugin',
        description: DESCRIPTION,
        version,
      },
    ],
  };
  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);
}

function readPackageVersion(): string {
  return (JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }).version;
}

export function buildPluginTree(outDir: string): void {
  const version = readPackageVersion();

  rmSync(outDir, { recursive: true, force: true });

  const base = {
    name: 'knowlery',
    version,
    description: DESCRIPTION,
    author: { name: 'Jay Jiang', url: 'https://github.com/JayJiangCT/knowlery' },
    homepage: 'https://jayjiangct.github.io/knowlery/',
    repository: 'https://github.com/JayJiangCT/knowlery',
    license: 'MIT',
    keywords: ['knowledge-base', 'mcp', 'notes', 'retrieval', 'obsidian'],
  };

  const manifests: Record<string, object> = {
    '.claude-plugin/plugin.json': {
      ...base,
      mcpServers: './.mcp.json',
    },
    '.codex-plugin/plugin.json': {
      ...base,
      skills: './skills/',
      mcpServers: './.mcp.json',
      interface: {
        displayName: 'Knowlery',
        shortDescription: 'The knowledge base your agents can live in.',
        developerName: 'Jay Jiang',
        category: 'Productivity',
        defaultPrompt: ['List my knowledge bases', 'Set up a knowledge base for me'],
      },
    },
    '.cursor-plugin/plugin.json': {
      ...base,
      skills: './skills/',
      mcpServers: './mcp.json',
    },
  };
  for (const [path, manifest] of Object.entries(manifests)) {
    mkdirSync(join(outDir, path, '..'), { recursive: true });
    writeFileSync(join(outDir, path), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  for (const skill of BUNDLED_SKILLS) {
    const dir = join(outDir, 'skills', skill.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), skill.content);
  }

  const mcpJson = `${JSON.stringify(MCP_CONFIG, null, 2)}\n`;
  writeFileSync(join(outDir, '.mcp.json'), mcpJson);
  writeFileSync(join(outDir, 'mcp.json'), mcpJson);

  mkdirSync(join(outDir, 'bin'), { recursive: true });
  writeFileSync(join(outDir, 'bin', 'knowlery'), SHIM);
  chmodSync(join(outDir, 'bin', 'knowlery'), 0o755);
}

if (process.argv[1]?.endsWith('build-plugin.ts')) {
  const outDir = process.argv[2] ?? join(__dirname, '..', 'plugin');
  buildPluginTree(outDir);
  const catalogPath = process.argv[3] ?? join(__dirname, '..', '.claude-plugin', 'marketplace.json');
  buildMarketplaceCatalog(catalogPath);
  process.stdout.write(`Plugin tree written to ${outDir}; catalog to ${catalogPath}\n`);
}
