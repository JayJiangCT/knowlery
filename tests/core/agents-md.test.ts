import { describe, expect, it } from 'vitest';
import {
  AGENTS_MD_MANAGED_END,
  AGENTS_MD_MANAGED_START,
  RULES_DIR,
  collectRulePaths,
  mergeAgentsMd,
  renderAgentsMdBlock,
  resetAgentsMd,
  syncAgentsMd,
} from '../../src/core/agents-md';
import { RULE_TEMPLATES } from '../../src/assets/rules';
import { generateOperatingRules } from '../../src/assets/templates';
import { generatePlatformConfig } from '../../src/core/platform-adapter';
import { deleteRule, installDefaultRules, writeRule } from '../../src/core/rule-manager';
import { createMemoryFs } from '../mocks/memory-fs';

const KNOWLEDGE = '# My KB\n\nOperating card body.\n';

function managedBlock(agentsMd: string): string {
  const start = agentsMd.indexOf(AGENTS_MD_MANAGED_START);
  const end = agentsMd.indexOf(AGENTS_MD_MANAGED_END);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return agentsMd.slice(start, end + AGENTS_MD_MANAGED_END.length);
}

describe('AGENTS.md is the single fixed context every platform ends up with', () => {
  it('inlines KNOWLEDGE.md first, then every rule from .agents/rules in sorted order', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    const block = managedBlock(fs.files.get('AGENTS.md')!);
    expect(block).toContain(KNOWLEDGE.trim());

    // Order: the user's KNOWLEDGE.md, then Knowlery's operating rules (rendered from
    // the template, not read from any user file), then the rules directory.
    const opsAt = block.indexOf(generateOperatingRules().trim());
    expect(opsAt).toBeGreaterThan(block.indexOf(KNOWLEDGE.trim()));
    let cursor = opsAt;
    for (const rulePath of await collectRulePaths(fs)) {
      const ruleBody = fs.files.get(`${RULES_DIR}/${rulePath}`)!.trim();
      const at = block.indexOf(ruleBody, cursor);
      expect(at, `${rulePath} inlined after the preceding source`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(RULE_TEMPLATES.every((rule) => block.includes(rule.content.trim()))).toBe(true);
    // SCHEMA.md stays an on-demand read (spec f4); nothing beyond the sources leaks in.
    expect(block).not.toContain('@../');
  });

  it('is written together with .claude/CLAUDE.md, which imports it — no opencode.json, no .claude/rules', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    expect(fs.files.get('.claude/CLAUDE.md')).toBe('@../AGENTS.md\n');
    expect(fs.files.has('opencode.json')).toBe(false);
    expect(fs.dirs.has('.claude/rules')).toBe(false);
    expect(fs.dirs.has(RULES_DIR)).toBe(true);
  });

  it('stays current when KNOWLEDGE.md or a rule changes — the reason the block is regenerated, not copied once', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    await writeRule(fs, 'team-glossary.md', '# Team Glossary\n\nMRR means monthly recurring revenue.\n');
    expect(fs.files.get('AGENTS.md')).toContain('MRR means monthly recurring revenue.');

    await deleteRule(fs, 'citation-required.md');
    expect(fs.files.get('AGENTS.md')).not.toContain('# Citation Required');

    fs.files.set('KNOWLEDGE.md', '# My KB\n\nEdited by hand while Obsidian was closed.\n');
    await syncAgentsMd(fs);
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
      rules: [{ path: 'agent-pages.md', content: scoped }],
    });

    expect(block).not.toMatch(/^---$/m);
    expect(block).not.toContain('paths:');
    expect(block).toContain(
      '# Agent-Maintained Pages\n\n_Applies to files matching: `entities/**/*.md`, `!SCHEMA.md`_\n\nYou can create and update them.',
    );
  });

  it('also understands the comma-separated paths form Claude actually parses', () => {
    const block = renderAgentsMdBlock({
      knowledgeMd: 'card',
      rules: [{ path: 'r.md', content: '---\npaths: src/**/*.ts, lib/**/*.ts\n---\n# R\n\nBody.\n' }],
    });
    expect(block).toContain('_Applies to files matching: `src/**/*.ts`, `lib/**/*.ts`_');
  });
});

describe('AGENTS.md is a managed block, not an owned file', () => {
  it('preserves user prose around the block and replaces the block in place', () => {
    const before = '# Team notes\n\nAlways run the linter.\n';
    const after = '\n## Appendix\n\nMore of mine.\n';
    const v1 = renderAgentsMdBlock({ knowledgeMd: 'card v1', rules: [] });
    const v2 = renderAgentsMdBlock({ knowledgeMd: 'card v2', rules: [] });

    const merged1 = mergeAgentsMd(`${before}${v1}${after}`, v1);
    const merged2 = mergeAgentsMd(merged1, v2);

    expect(merged2.startsWith(before)).toBe(true);
    expect(merged2.endsWith(after)).toBe(true);
    expect(merged2).toContain('card v2');
    expect(merged2).not.toContain('card v1');
    expect(merged2.split(AGENTS_MD_MANAGED_START).length - 1).toBe(1);
  });

  it('puts the block first in a pre-existing AGENTS.md without markers, keeping the user text after it', () => {
    // Same order Claude documents for CLAUDE.md: shared instructions lead, additions trail.
    const existing = '# Hand-written instructions\n\nUse British spelling.\n';
    const block = renderAgentsMdBlock({ knowledgeMd: 'card', rules: [] });
    const merged = mergeAgentsMd(existing, block);
    expect(merged).toBe(`${block}\n\n${existing.trim()}\n`);
  });

  it('resetAgentsMd is the only path that drops text outside the markers', async () => {
    const fs = createMemoryFs({
      'KNOWLEDGE.md': KNOWLEDGE,
      'AGENTS.md': '# Stale pre-Knowlery guide\n\nRun /wiki.\n',
    });
    await syncAgentsMd(fs);
    expect(fs.files.get('AGENTS.md')).toContain('Run /wiki.');

    await resetAgentsMd(fs);
    const reset = fs.files.get('AGENTS.md')!;
    expect(reset).not.toContain('Run /wiki.');
    expect(reset.startsWith(AGENTS_MD_MANAGED_START)).toBe(true);
    expect(reset).toContain(KNOWLEDGE.trim());
  });

  it('does not rewrite an already-synced file (no mtime churn on plugin load)', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE, [`${RULES_DIR}/a.md`]: '# A\n' });
    await syncAgentsMd(fs);
    const synced = fs.files.get('AGENTS.md');

    const writesBefore = fs.writeLog.length;
    await syncAgentsMd(fs);
    expect(fs.writeLog.length).toBe(writesBefore);
    expect(fs.files.get('AGENTS.md')).toBe(synced);
  });

  it('does nothing in an uninitialized vault (no KNOWLEDGE.md)', async () => {
    const fs = createMemoryFs({ [`${RULES_DIR}/a.md`]: '# A\n' });
    await syncAgentsMd(fs);
    expect(fs.files.has('AGENTS.md')).toBe(false);
  });
});
