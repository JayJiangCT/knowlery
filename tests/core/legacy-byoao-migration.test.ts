import { describe, expect, it } from 'vitest';
import {
  buildSkillMergePlan,
  classifyByoaoLegacySignals,
  normalizeLegacySkillsLock,
} from '../../src/core/legacy-byoao-migration';

describe('classifyByoaoLegacySignals', () => {
  it('detects BYOAO from manifest, OpenCode skills, AGENTS.md, and knowledge directories', () => {
    const result = classifyByoaoLegacySignals({
      byoaoManifestExists: true,
      opencodeSkillsExists: true,
      agentsMdContent: '# Vault\n\nThis vault uses BYOAO commands.',
      existingKnowledgeDirs: ['entities', 'queries'],
    });

    expect(result.isLegacyByoao).toBe(true);
    expect(result.signals).toEqual([
      '.byoao/manifest.json',
      '.opencode/skills/',
      'AGENTS.md mentions BYOAO',
      'knowledge directories exist',
    ]);
  });

  it('does not classify a normal empty vault as BYOAO', () => {
    const result = classifyByoaoLegacySignals({
      byoaoManifestExists: false,
      opencodeSkillsExists: false,
      agentsMdContent: null,
      existingKnowledgeDirs: [],
    });

    expect(result.isLegacyByoao).toBe(false);
    expect(result.signals).toEqual([]);
  });
});

describe('buildSkillMergePlan', () => {
  it('keeps existing .agents skills, imports missing OpenCode skills, and adds missing bundled skills', () => {
    const plan = buildSkillMergePlan({
      existingAgentsSkills: ['ask', 'cook', 'custom-local'],
      existingOpenCodeSkills: ['ask', 'trace'],
      bundledSkillNames: ['ask', 'cook', 'explore'],
    });

    expect(plan.preserveAgents).toEqual(['ask', 'cook', 'custom-local']);
    expect(plan.importFromOpenCode).toEqual(['trace']);
    expect(plan.installBundled).toEqual(['explore']);
    expect(plan.conflicts).toEqual([{ name: 'ask', kept: '.agents/skills', skipped: '.opencode/skills' }]);
    expect(plan.finalSkillNames).toEqual(['ask', 'cook', 'custom-local', 'trace', 'explore']);
  });
});

describe('normalizeLegacySkillsLock', () => {
  it('rewrites a legacy skills lock into Knowlery shape', () => {
    const lock = normalizeLegacySkillsLock({
      existingLock: {
        version: 1,
        skills: {
          'excalidraw-diagram-generator': {
            source: 'github/awesome-copilot',
            sourceType: 'github',
            computedHash: 'abc123',
          },
        },
      },
      finalSkillNames: ['ask', 'trace', 'excalidraw-diagram-generator'],
      bundledSkillNames: ['ask'],
    });

    expect(lock).toEqual({
      version: '1.0.0',
      skills: {
        ask: { source: 'builtin', version: '1.0.0', disabled: false },
        trace: { source: 'custom', version: '1.0.0', disabled: false },
        'excalidraw-diagram-generator': {
          source: 'registry',
          version: '1.0.0',
          disabled: false,
          registryIdentifier: 'github/awesome-copilot',
        },
      },
    });
  });
});
