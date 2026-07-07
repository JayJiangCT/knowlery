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

describe('knowlery-cli skill (spec 0.8 f1, §4.3)', () => {
  it('ships as a tooling builtin', () => {
    const found = BUNDLED_SKILLS.find((entry) => entry.name === 'knowlery-cli');
    expect(found?.kind).toBe('tooling');
  });

  it('covers the full command surface', () => {
    const content = skill('knowlery-cli');
    for (const command of [
      'knowlery init', 'knowlery sync', 'knowlery health', 'knowlery query', 'knowlery stale',
      'knowlery bundle install', 'knowlery bundle list', 'knowlery bundle uninstall',
      'knowlery bundle export', 'knowlery bundle review',
    ]) {
      expect(content).toContain(command);
    }
  });

  it('teaches health as a post-bulk-change verification step', () => {
    expect(skill('knowlery-cli')).toContain('After any bulk change');
  });

  it('states the export review conduct: full checklist, user decisions only, explicit ids', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('Nothing ships unreviewed');
    expect(content).toContain('There is no approve-all flag');
    // 1. Present the checklist completely, warnings verbatim.
    expect(content).toContain('**completely**');
    expect(content).toContain('Never summarize warnings away');
    // 2. "Approve all" only after the full checklist was shown, expanded into ids.
    expect(content).toContain('only after');
    expect(content).toContain('expand it into explicit ids');
    // 3. Never act on own initiative; echo back what was recorded.
    expect(content).toContain('Never approve or flag items on your own initiative');
    expect(content).toContain('echo back');
  });

  it('shares the review state with the Obsidian modal (same scope file)', () => {
    expect(skill('knowlery-cli')).toContain('.knowlery/export-scope.json');
  });

  it('states the publish conduct: destination restated, risks shown before acknowledging, output relayed (spec 0.9 f2)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('knowlery bundle publish');
    expect(content).toContain('never pass');
    expect(content).toContain('--public');
    expect(content).toContain('Only pass');
    expect(content).toContain('--acknowledge-risks');
    expect(content).toContain('never on your own initiative');
    expect(content).toContain('audience statement');
    expect(content.replace(/\s+/g, ' ')).toContain('A public release is permanent');
  });

  it('teaches URL installs: gh delegation, browser degradation, verify conduct (spec 0.9 f1)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('accepts an https URL');
    expect(content).toContain('gh` login');
    expect(content).toContain('never ask for or handle tokens');
    expect(content).toContain('--verify <sha256>');
    expect(content).toContain('Never fabricate or guess a checksum');
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
