import { describe, expect, it } from 'vitest';
import { BUNDLED_SKILLS } from '../../src/assets/skills';
import { generateKnowledgeMd, generateSchemaMd } from '../../src/assets/templates';

/**
 * Spec 0.7 f5, §4.1-4: the acceptance criteria for this feature are skill-content
 * facts. These assertions keep CI honest about them (they are contains-checks, not
 * prose review — wording may evolve as long as the instructions survive).
 */

function skill(name: string): string {
  const found = BUNDLED_SKILLS.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing bundled skill: ${name}`);
  return found.content;
}

describe('three-transport ladder (spec 0.7 f5, §4.1)', () => {
  it('/ask lists all three transports in order', () => {
    const ask = skill('ask');
    const inApp = ask.indexOf('obsidian knowlery:query');
    const globalCli = ask.indexOf('knowlery query "<question>"');
    const embedded = ask.indexOf('node .knowlery/bin/query.mjs');
    expect(inApp).toBeGreaterThan(-1);
    expect(globalCli).toBeGreaterThan(inApp);
    expect(embedded).toBeGreaterThan(globalCli);
  });

  it('/cook incremental mode lists all three staleness transports', () => {
    const cook = skill('cook');
    expect(cook).toContain('obsidian knowlery:stale');
    expect(cook).toContain('knowlery stale');
    expect(cook).toContain('node .knowlery/bin/query.mjs --stale');
  });

  it('KNOWLEDGE.md template teaches the ladder', () => {
    const knowledgeMd = generateKnowledgeMd('KB');
    expect(knowledgeMd).toContain('obsidian knowlery:query');
    expect(knowledgeMd).toContain('knowlery query "<question>"');
    expect(knowledgeMd).toContain('node .knowlery/bin/query.mjs');
  });
});

describe('headless write branch (spec 0.7 f5, §4.2)', () => {
  it.each(['cook', 'organize', 'vault-conventions'])('%s keeps obsidian preference and adds the headless branch', (name) => {
    const content = skill(name);
    expect(content.toLowerCase()).toContain('headless');
    expect(content).toContain('knowlery health');
  });

  it('KNOWLEDGE.md operating rules cover headless environments', () => {
    expect(generateKnowledgeMd('KB')).toContain('headless environments');
  });
});

describe('retrieval-aware /cook (spec 0.7 f5, §4.3)', () => {
  it('/cook records nicknames, abbreviations, and cross-language titles as aliases', () => {
    const cook = skill('cook');
    expect(cook).toContain('aliases');
    expect(cook).toContain('cross-language title');
    expect(cook).toContain('abbreviations');
  });

  it('SCHEMA.md template documents the aliases field', () => {
    expect(generateSchemaMd()).toContain('`aliases`');
  });
});

describe('/audit on CLI primitives (spec 0.7 f5, §4.4)', () => {
  it('names the deterministic tools and the dangling-sources category', () => {
    const audit = skill('audit');
    expect(audit).toContain('obsidian orphans');
    expect(audit).toContain('obsidian unresolved');
    expect(audit).toContain('obsidian deadends');
    expect(audit).toContain('Dangling Sources');
    expect(audit).toContain('--stale');
  });
});
