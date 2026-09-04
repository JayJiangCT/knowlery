import { describe, expect, it } from 'vitest';
import {
  AGENTS_MD_MANAGED_END,
  AGENTS_MD_MANAGED_START,
  mergeAgentsMd,
  renderAgentsMdBlock,
  syncAgentsMd,
} from '../../src/core/agents-md';
import { generateClaudeMd } from '../../src/assets/templates';
import { RULE_TEMPLATES } from '../../src/assets/rules';
import { generatePlatformConfig, migratePlatform } from '../../src/core/platform-adapter';
import { deleteRule, installDefaultRules, writeRule } from '../../src/core/rule-manager';
import { collectRuleImportPaths } from '../../src/core/rule-imports';
import { createMemoryFs } from '../mocks/memory-fs';

const KNOWLEDGE = '# My KB\n\nOperating card body.\n';

function managedBlock(agentsMd: string): string {
  const start = agentsMd.indexOf(AGENTS_MD_MANAGED_START);
  const end = agentsMd.indexOf(AGENTS_MD_MANAGED_END);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return agentsMd.slice(start, end + AGENTS_MD_MANAGED_END.length);
}

describe('AGENTS.md mirrors the fixed context CLAUDE.md assembles by import', () => {
  it('inlines exactly the files CLAUDE.md imports, in the same order', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs, 'claude-code');
    await generatePlatformConfig(fs, 'claude-code');

    const claudeImports = generateClaudeMd(await collectRuleImportPaths(fs, '.claude/rules'))
      .split('\n')
      .filter((line) => line.startsWith('@'));
    const block = managedBlock(fs.files.get('AGENTS.md')!);

    // Same sources: the operating card first, then every imported rule.
    expect(claudeImports[0]).toBe('@../KNOWLEDGE.md');
    expect(block).toContain(KNOWLEDGE.trim());
    let cursor = block.indexOf(KNOWLEDGE.trim());
    for (const importLine of claudeImports.slice(1)) {
      const rulePath = importLine.replace(/^@rules\//, '');
      const ruleBody = fs.files.get(`.claude/rules/${rulePath}`)!.trim();
      const at = block.indexOf(ruleBody, cursor);
      expect(at, `${rulePath} inlined after the preceding source`).toBeGreaterThan(cursor);
      cursor = at;
    }
    // Nothing beyond those sources leaks in (SCHEMA.md stays on-demand — spec f4).
    expect(block).not.toContain('@../');
    expect(block).not.toContain('SCHEMA.md\n');
  });

  it('is written for the OpenCode platform from .agents/rules, with no opencode.json', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs, 'opencode');
    await generatePlatformConfig(fs, 'opencode');

    const agentsMd = fs.files.get('AGENTS.md')!;
    expect(agentsMd).toContain('.agents/rules/*.md');
    for (const rule of RULE_TEMPLATES) {
      expect(agentsMd).toContain(rule.content.trim());
    }
    expect(fs.files.has('opencode.json')).toBe(false);
  });

  it('stays current when KNOWLEDGE.md or a rule changes — the reason the block is regenerated, not copied once', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs, 'opencode');
    await generatePlatformConfig(fs, 'opencode');

    await writeRule(fs, 'opencode', 'team-glossary.md', '# Team Glossary\n\nMRR means monthly recurring revenue.\n');
    expect(fs.files.get('AGENTS.md')).toContain('MRR means monthly recurring revenue.');

    await deleteRule(fs, 'opencode', 'citation-required.md');
    expect(fs.files.get('AGENTS.md')).not.toContain('# Citation Required');

    fs.files.set('KNOWLEDGE.md', '# My KB\n\nEdited by hand while Obsidian was closed.\n');
    await syncAgentsMd(fs, '.agents/rules');
    expect(fs.files.get('AGENTS.md')).toContain('Edited by hand while Obsidian was closed.');
    expect(fs.files.get('AGENTS.md')).not.toContain('Operating card body.');
  });

  it('restates a Claude path-scoped rule as prose instead of inlining its YAML frontmatter', () => {
    const scoped = [
      '---',
      'paths:',
      '  - "entities/**/*.md"',
      '  - "!SCHEMA.md"',
      '---',
      '# Agent-Maintained Pages',
      '',
      'You can create and update them.',
      '',
    ].join('\n');
    const block = renderAgentsMdBlock({
      knowledgeMd: 'card',
      rulesDir: '.claude/rules',
      rules: [{ path: 'agent-pages.md', content: scoped }],
    });

    expect(block).not.toContain('---');
    expect(block).not.toContain('paths:');
    expect(block).toContain(
      '# Agent-Maintained Pages\n\n_Applies to files matching: `entities/**/*.md`, `!SCHEMA.md`_\n\nYou can create and update them.',
    );
  });

  it('follows the rules directory across a platform switch', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs, 'claude-code');
    await generatePlatformConfig(fs, 'claude-code');
    expect(fs.files.get('AGENTS.md')).toContain('.claude/rules/*.md');

    await migratePlatform(fs, 'claude-code', 'opencode', false);
    const agentsMd = fs.files.get('AGENTS.md')!;
    expect(agentsMd).toContain('.agents/rules/*.md');
    expect(agentsMd).toContain('# Citation Required');
    expect(fs.files.has('.claude/CLAUDE.md')).toBe(false);
  });
});

describe('AGENTS.md is a managed block, not an owned file', () => {
  it('preserves user prose around the block and replaces the block in place', () => {
    const before = '# Team notes\n\nAlways run the linter.\n';
    const after = '\n## Appendix\n\nMore of mine.\n';
    const v1 = renderAgentsMdBlock({ knowledgeMd: 'card v1', rulesDir: '.agents/rules', rules: [] });
    const v2 = renderAgentsMdBlock({ knowledgeMd: 'card v2', rulesDir: '.agents/rules', rules: [] });

    const merged1 = mergeAgentsMd(`${before}${v1}${after}`, v1);
    const merged2 = mergeAgentsMd(merged1, v2);

    expect(merged2.startsWith(before)).toBe(true);
    expect(merged2.endsWith(after)).toBe(true);
    expect(merged2).toContain('card v2');
    expect(merged2).not.toContain('card v1');
    expect(merged2.split(AGENTS_MD_MANAGED_START).length - 1).toBe(1);
  });

  it('appends the block to a pre-existing AGENTS.md that has no markers', () => {
    const existing = '# Hand-written instructions\n\nUse British spelling.\n';
    const block = renderAgentsMdBlock({ knowledgeMd: 'card', rulesDir: '.agents/rules', rules: [] });
    const merged = mergeAgentsMd(existing, block);
    expect(merged.startsWith(existing.trimEnd())).toBe(true);
    expect(merged).toContain(block);
  });

  it('does not rewrite an already-synced file (no mtime churn on plugin load)', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE, '.agents/rules/a.md': '# A\n' });
    await syncAgentsMd(fs, '.agents/rules');
    const synced = fs.files.get('AGENTS.md');

    const writesBefore = fs.writeLog.length;
    await syncAgentsMd(fs, '.agents/rules');
    expect(fs.writeLog.length).toBe(writesBefore);
    expect(fs.files.get('AGENTS.md')).toBe(synced);
  });

  it('does nothing in an uninitialized vault (no KNOWLEDGE.md)', async () => {
    const fs = createMemoryFs({ '.agents/rules/a.md': '# A\n' });
    await syncAgentsMd(fs, '.agents/rules');
    expect(fs.files.has('AGENTS.md')).toBe(false);
  });
});
