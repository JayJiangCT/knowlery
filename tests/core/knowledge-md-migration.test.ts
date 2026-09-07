import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_MD_BACKUP_PATH,
  migrateKnowledgeMdLegacyOperatingRules,
  stripLegacyOperatingRules,
} from '../../src/core/knowledge-md-migration';
import { generateKnowledgeMd } from '../../src/assets/templates';
import { hasLegacyOperatingRules } from '../../src/core/vault-config-health';
import { refreshInstalledBundlesBlock } from '../../src/core/okf/knowledge-md-bundles';
import { runVaultSync } from '../../src/core/vault-sync';
import { createMemoryFs } from '../mocks/memory-fs';

/** Shape of the maintainer's real pre-1.5 KNOWLEDGE.md, abridged. */
const LEGACY = [
  "# Jay's Knowledge Base",
  '',
  'This vault is an agent-assisted knowledge base.',
  '',
  '## Vault Structure',
  '',
  '| Directory | Contents | Owner |',
  '|-----------|----------|-------|',
  '| `entities/` | Named things | Agent |',
  '',
  '## Operating Rules',
  '',
  '### Obsidian CLI Only',
  '',
  '| Query the knowledge index | `obsidian base:query path="INDEX.base" view="All Pages" format=paths` |',
  '',
  '### Writing Conventions',
  '',
  '- Every knowledge page has YAML frontmatter matching SCHEMA.md',
  '',
  '## Knowledge Retrieval',
  '',
  '1. Run the retrieval engine once',
  '',
  '### Freshness Review',
  '',
  'Freshness metadata is a retrieval signal, not authority.',
  '',
  '#### Fields',
  '',
  '| `superseded_by` | Follow these links |',
  '',
  '## Available Skills',
  '',
  '### Knowledge Workflows',
  '',
  '| `/cook` | Digest notes and sources into knowledge pages, maintain INDEX.base |',
  '',
  '### Quick Reference',
  '',
  '- New material to process → `/cook`',
  '',
  '<!-- KNOWLERY:INSTALLED_BUNDLES:BEGIN -->',
  '9. If the question might be answered by an installed knowledge bundle,',
  '   check `.knowlery/bundles.json`.',
  '<!-- KNOWLERY:INSTALLED_BUNDLES:END -->',
  '',
].join('\n');

describe('pre-1.5 KNOWLEDGE.md loses the Knowlery-authored operating rules on sync', () => {
  it('drops the three legacy sections and their template subsections, keeps everything else verbatim', () => {
    const stripped = stripLegacyOperatingRules(LEGACY);

    expect(hasLegacyOperatingRules(stripped)).toBe(false);
    // The stale instruction the maintainer spotted — INDEX.base as a retrieval step — is gone.
    expect(stripped).not.toContain('INDEX.base');
    expect(stripped).not.toContain('### Obsidian CLI Only');
    expect(stripped).not.toContain('Run the retrieval engine once');
    expect(stripped).not.toContain('### Quick Reference');

    expect(stripped.startsWith("# Jay's Knowledge Base\n\nThis vault is an agent-assisted knowledge base.\n\n## Vault Structure\n")).toBe(true);
    expect(stripped).toContain('| `entities/` | Named things | Agent |');
  });

  it("promotes the user's own H3 under a legacy H2 to H2 (subtree included), where the legacy section stood", () => {
    const stripped = stripLegacyOperatingRules(LEGACY);

    expect(stripped).toContain('## Freshness Review\n\nFreshness metadata is a retrieval signal, not authority.\n\n### Fields\n\n| `superseded_by` | Follow these links |');
    expect(stripped).not.toContain('### Freshness Review');
    expect(stripped.indexOf('## Freshness Review')).toBeGreaterThan(stripped.indexOf('## Vault Structure'));
  });

  it('keeps the installed-bundles marker block at the end of the file for the bundles refresh to normalize', async () => {
    const stripped = stripLegacyOperatingRules(LEGACY);
    expect(stripped.trimEnd().endsWith('<!-- KNOWLERY:INSTALLED_BUNDLES:END -->')).toBe(true);
    expect(stripped).toContain('9. If the question might be answered');

    // With no bundles installed, the refresh that follows in sync removes the leftover block.
    const fs = createMemoryFs({ 'KNOWLEDGE.md': stripped });
    await refreshInstalledBundlesBlock(fs);
    expect(fs.files.get('KNOWLEDGE.md')).not.toContain('KNOWLERY:INSTALLED_BUNDLES');
  });

  it('is a no-op on the current template and on an already-stripped file', () => {
    const fresh = generateKnowledgeMd('KB');
    expect(stripLegacyOperatingRules(fresh)).toBe(fresh);
    const once = stripLegacyOperatingRules(LEGACY);
    expect(stripLegacyOperatingRules(once)).toBe(once);
  });

  it('leaves headings inside fenced code alone', () => {
    const md = '# KB\n\n## Notes\n\n```md\n## Operating Rules\n### Obsidian CLI Only\n```\n';
    expect(stripLegacyOperatingRules(md)).toBe(md);
  });

  it('backs the original up once under .knowlery/backups and writes only when something changed', async () => {
    const fs = createMemoryFs({ 'KNOWLEDGE.md': LEGACY });

    await migrateKnowledgeMdLegacyOperatingRules(fs);
    expect(fs.files.get(KNOWLEDGE_MD_BACKUP_PATH)).toBe(LEGACY);
    expect(hasLegacyOperatingRules(fs.files.get('KNOWLEDGE.md')!)).toBe(false);

    const writes = fs.writeLog.length;
    await migrateKnowledgeMdLegacyOperatingRules(fs);
    expect(fs.writeLog.length).toBe(writes);

    // A second legacy-looking file never overwrites the first backup.
    fs.files.set('KNOWLEDGE.md', '# KB\n\n## Available Skills\n\n### Quick Reference\n\n- x\n');
    await migrateKnowledgeMdLegacyOperatingRules(fs);
    expect(fs.files.get(KNOWLEDGE_MD_BACKUP_PATH)).toBe(LEGACY);
  });

  it('runs as part of vault sync, before the bundles block is refreshed', async () => {
    const fs = createMemoryFs({
      '.knowlery/manifest.json': JSON.stringify({ version: '0.1.0', platform: 'claude-code', kbName: 'KB', createdAt: 'x', updatedAt: 'x' }),
      'KNOWLEDGE.md': LEGACY,
    });
    expect(await runVaultSync(fs)).toEqual({ skipped: false });

    const knowledgeMd = fs.files.get('KNOWLEDGE.md')!;
    expect(hasLegacyOperatingRules(knowledgeMd)).toBe(false);
    expect(knowledgeMd).toContain('## Freshness Review');
    expect(knowledgeMd).not.toContain('KNOWLERY:INSTALLED_BUNDLES');
    expect(fs.files.has(KNOWLEDGE_MD_BACKUP_PATH)).toBe(true);
  });
});
