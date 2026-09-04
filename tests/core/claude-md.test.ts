import { describe, expect, it } from 'vitest';
import { generateOperatingRules } from '../../src/assets/templates';
import { RULES_DIR } from '../../src/core/agents-md';
import { CLAUDE_KNOWLEDGE_IMPORT, mergeClaudeMd, renderClaudeMdBlock, syncClaudeMd } from '../../src/core/claude-md';
import { MANAGED_BLOCK_END, MANAGED_BLOCK_START } from '../../src/core/managed-block';
import { createMemoryFs } from '../mocks/memory-fs';

const KNOWLEDGE = '# My KB\n\nWhat this knowledge base is about.\n';

describe('CLAUDE.md is the Claude Code entry: hard imports of KNOWLEDGE.md and the rules, operating rules inlined', () => {
  it('imports KNOWLEDGE.md first, inlines the operating rules, then imports each rule — and never AGENTS.md', () => {
    const block = renderClaudeMdBlock({ rulePaths: ['agent-pages.md', 'nested/style.md'] });

    const knowledgeAt = block.indexOf(CLAUDE_KNOWLEDGE_IMPORT);
    const opsAt = block.indexOf(generateOperatingRules().trim());
    const firstRuleAt = block.indexOf(`@../${RULES_DIR}/agent-pages.md`);
    const secondRuleAt = block.indexOf(`@../${RULES_DIR}/nested/style.md`);
    expect(knowledgeAt).toBeGreaterThan(-1);
    // KNOWLEDGE.md is the most important part of the prompt, so it leads.
    expect(opsAt).toBeGreaterThan(knowledgeAt);
    expect(firstRuleAt).toBeGreaterThan(opsAt);
    expect(secondRuleAt).toBeGreaterThan(firstRuleAt);

    // The user's description is referenced, not copied — the whole point of the file split.
    expect(block).not.toContain('What this knowledge base is about.');
    // AGENTS.md exists for harnesses without imports; importing it would repeat the operating rules.
    expect(block).not.toContain('@../AGENTS.md');
    expect(block.startsWith(MANAGED_BLOCK_START)).toBe(true);
    expect(block.endsWith(MANAGED_BLOCK_END)).toBe(true);
  });

  it('renders no dangling import list when the vault has no rules', () => {
    const block = renderClaudeMdBlock({ rulePaths: [] });
    expect(block).not.toContain(`@../${RULES_DIR}`);
    expect(block).toContain(CLAUDE_KNOWLEDGE_IMPORT);
  });

  it('converges a 1.5 file: the AGENTS.md import goes, the block leads, user text stays', () => {
    const block = renderClaudeMdBlock({ rulePaths: ['a.md'] });
    const merged = mergeClaudeMd('@../AGENTS.md\n\n# Claude only\n\nUse the Task tool for long searches.\n', block);
    expect(merged).toBe(`${block}\n\n# Claude only\n\nUse the Task tool for long searches.\n`);
    expect(merged.split('@../AGENTS.md').length - 1).toBe(0);
  });

  it('converges a pre-1.5 file: loose KNOWLEDGE.md / rule imports are absorbed into the block, user text stays', () => {
    const legacy = [
      '@../KNOWLEDGE.md',
      '@../SCHEMA.md',
      '@../INDEX.base',
      '',
      '# My own notes about this vault',
      'Keep answers short.',
      '<!-- Knowlery rule imports:start -->',
      '@rules/activity-ledger.md',
      '@rules/citation-required.md',
      '<!-- Knowlery rule imports:end -->',
      '',
    ].join('\n');
    const block = renderClaudeMdBlock({ rulePaths: ['activity-ledger.md'] });

    const merged = mergeClaudeMd(legacy, block);

    expect(merged.startsWith(block)).toBe(true);
    // Exactly one KNOWLEDGE.md import: the one inside the block.
    expect(merged.split(CLAUDE_KNOWLEDGE_IMPORT).length - 1).toBe(1);
    expect(merged).not.toContain('@../SCHEMA.md');
    expect(merged).not.toContain('@../INDEX.base');
    // `.claude/rules/` is auto-loaded by Claude; importing it too would double-load.
    expect(merged).not.toContain('@rules/');
    expect(merged).not.toContain('Knowlery rule imports');
    expect(merged).toContain('# My own notes about this vault\nKeep answers short.');
  });

  it('puts the block first in a hand-written CLAUDE.md that never had Knowlery imports', () => {
    const block = renderClaudeMdBlock({ rulePaths: [] });
    const merged = mergeClaudeMd('# Claude-only notes\n\nPrefer terse replies.\n', block);
    expect(merged).toBe(`${block}\n\n# Claude-only notes\n\nPrefer terse replies.\n`);
  });

  it('replaces the block in place and keeps text around it', () => {
    const v1 = renderClaudeMdBlock({ rulePaths: ['a.md'] });
    const v2 = renderClaudeMdBlock({ rulePaths: ['a.md', 'b.md'] });
    const merged = mergeClaudeMd(`# Before\n${v1}\n\n# After\n`, v2);
    expect(merged).toBe(`# Before\n${v2}\n\n# After\n`);
    expect(merged.split(MANAGED_BLOCK_START).length - 1).toBe(1);
  });

  it('is idempotent on disk (no mtime churn on plugin load)', async () => {
    const fs = createMemoryFs({
      'KNOWLEDGE.md': KNOWLEDGE,
      '.claude/CLAUDE.md': '@../KNOWLEDGE.md\n@rules/a.md\n',
      [`${RULES_DIR}/a.md`]: '# A\n',
    });
    await syncClaudeMd(fs);
    expect(fs.files.get('.claude/CLAUDE.md')).toBe(`${renderClaudeMdBlock({ rulePaths: ['a.md'] })}\n`);

    const writes = fs.writeLog.length;
    await syncClaudeMd(fs);
    expect(fs.writeLog.length).toBe(writes);
  });

  it('creates the file (and .claude/) when missing, for every platform', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': KNOWLEDGE });
    await syncClaudeMd(fs);
    expect(fs.files.get('.claude/CLAUDE.md')).toBe(`${renderClaudeMdBlock({ rulePaths: [] })}\n`);
  });

  it('does nothing in an uninitialized vault — the block would import a KNOWLEDGE.md that does not exist', async () => {
    const fs = createMemoryFs();
    await syncClaudeMd(fs);
    expect(fs.files.has('.claude/CLAUDE.md')).toBe(false);
  });
});
