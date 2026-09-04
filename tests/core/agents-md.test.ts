import { describe, expect, it } from 'vitest';
import {
  AGENTS_MD_MANAGED_END,
  AGENTS_MD_MANAGED_START,
  RULES_DIR,
  collectRulePaths,
  renderAgentsMdBlock,
  renderReadFirst,
  resetAgentsMd,
  syncAgentsMd,
} from '../../src/core/agents-md';
import { mergeManagedBlock } from '../../src/core/managed-block';
import { RULE_TEMPLATES } from '../../src/assets/rules';
import { generateOperatingRules } from '../../src/assets/templates';
import { generatePlatformConfig } from '../../src/core/platform-adapter';
import { deleteRule, installDefaultRules, writeRule } from '../../src/core/rule-manager';
import { createMemoryFs } from '../mocks/memory-fs';

const KNOWLEDGE = '# My KB\n\nWhat this knowledge base is about.\n';

function managedBlock(agentsMd: string): string {
  const start = agentsMd.indexOf(AGENTS_MD_MANAGED_START);
  const end = agentsMd.indexOf(AGENTS_MD_MANAGED_END);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return agentsMd.slice(start, end + AGENTS_MD_MANAGED_END.length);
}

describe('AGENTS.md is the Codex/OpenCode entry: it points at KNOWLEDGE.md and the rules, and carries the operating rules', () => {
  it('tells the agent to read KNOWLEDGE.md first, then lists every rule path in sorted order, then the operating rules', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    const block = managedBlock(fs.files.get('AGENTS.md')!);

    // Referenced, not copied: KNOWLEDGE.md stays the one standalone description.
    expect(block).not.toContain('What this knowledge base is about.');
    expect(block).toContain('obsidian read file="KNOWLEDGE.md"');

    const readFirstAt = block.indexOf('## Read First');
    const opsAt = block.indexOf(generateOperatingRules().trim());
    expect(readFirstAt).toBeGreaterThan(-1);
    expect(opsAt).toBeGreaterThan(readFirstAt);

    let cursor = readFirstAt;
    for (const rulePath of await collectRulePaths(fs)) {
      const at = block.indexOf(`- \`${RULES_DIR}/${rulePath}\``, cursor);
      expect(at, `${rulePath} listed in order`).toBeGreaterThan(cursor);
      expect(at).toBeLessThan(opsAt);
      cursor = at;
    }
    // Rule bodies are not inlined either — Codex/OpenCode are told to read the files.
    expect(RULE_TEMPLATES.some((rule) => block.includes(rule.content.trim()))).toBe(false);
    // No Claude import syntax leaks into a file Claude never reads.
    expect(block).not.toContain('@../');
  });

  it('skips the rule paragraph when the vault has no rules', () => {
    const readFirst = renderReadFirst([]);
    expect(readFirst).toContain('KNOWLEDGE.md');
    expect(readFirst).not.toContain(RULES_DIR);
  });

  it('is written together with .claude/CLAUDE.md — no opencode.json, no .claude/rules', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    expect(fs.files.get('.claude/CLAUDE.md')).toContain('@../KNOWLEDGE.md');
    expect(fs.files.get('.claude/CLAUDE.md')).not.toContain('@../AGENTS.md');
    expect(fs.files.has('opencode.json')).toBe(false);
    expect(fs.dirs.has('.claude/rules')).toBe(false);
    expect(fs.dirs.has(RULES_DIR)).toBe(true);
  });

  it('both entry files follow a rule add/remove — the reason the blocks are regenerated, not written once', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await installDefaultRules(fs);
    await generatePlatformConfig(fs);

    await writeRule(fs, 'team-glossary.md', '# Team Glossary\n\nMRR means monthly recurring revenue.\n');
    expect(fs.files.get('AGENTS.md')).toContain(`\`${RULES_DIR}/team-glossary.md\``);
    expect(fs.files.get('.claude/CLAUDE.md')).toContain(`@../${RULES_DIR}/team-glossary.md`);

    await deleteRule(fs, 'citation-required.md');
    expect(fs.files.get('AGENTS.md')).not.toContain('citation-required.md');
    expect(fs.files.get('.claude/CLAUDE.md')).not.toContain('citation-required.md');
  });

  it('does not change when KNOWLEDGE.md changes — nothing of it is copied', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await generatePlatformConfig(fs);
    const before = fs.files.get('AGENTS.md');

    fs.files.set('KNOWLEDGE.md', '# My KB\n\nEdited by hand while Obsidian was closed.\n');
    await syncAgentsMd(fs);
    expect(fs.files.get('AGENTS.md')).toBe(before);
  });
});

describe('AGENTS.md is a managed block, not an owned file', () => {
  it('preserves user prose around the block and replaces the block in place', () => {
    const before = '# Team notes\n\nAlways run the linter.\n';
    const after = '\n## Appendix\n\nMore of mine.\n';
    const v1 = renderAgentsMdBlock({ rulePaths: ['v1.md'] });
    const v2 = renderAgentsMdBlock({ rulePaths: ['v2.md'] });

    const merged1 = mergeManagedBlock(`${before}${v1}${after}`, v1);
    const merged2 = mergeManagedBlock(merged1, v2);

    expect(merged2.startsWith(before)).toBe(true);
    expect(merged2.endsWith(after)).toBe(true);
    expect(merged2).toContain('v2.md');
    expect(merged2).not.toContain('v1.md');
    expect(merged2.split(AGENTS_MD_MANAGED_START).length - 1).toBe(1);
  });

  it('puts the block first in a pre-existing AGENTS.md without markers, keeping the user text after it', () => {
    // Same order Claude documents for CLAUDE.md: shared instructions lead, additions trail.
    const existing = '# Hand-written instructions\n\nUse British spelling.\n';
    const block = renderAgentsMdBlock({ rulePaths: [] });
    const merged = mergeManagedBlock(existing, block);
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
    expect(reset).toContain('## Read First');
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
