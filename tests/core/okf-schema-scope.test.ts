import { describe, expect, it } from 'vitest';
import { scopeSchemaToBundle } from '../../src/core/okf/schema-scope';

const FULL_SCHEMA = [
  '# Knowledge Schema',
  '',
  'Knowledge taxonomy and conventions for this vault.',
  '',
  '## Knowledge Domains',
  '',
  'Prose describing every domain, including the private client work.',
  '',
  '## Tag Taxonomy',
  '',
  'Tags follow these conventions:',
  '- 2-5 tags per page, alphabetically sorted',
  '',
  '### Current Tags',
  '',
  '| Tag | Usage | Description |',
  '|-----|-------|-------------|',
  '| #delivery | 12 | Drone delivery work |',
  '| #acme-client | 8 | Confidential Acme engagement |',
  '| #health | 3 | Personal health tracking |',
  '',
  '## Domain Taxonomy',
  '',
  '| Domain | Description |',
  '|--------|-------------|',
  '| logistics | Delivery and routing knowledge |',
  '| finances | Household finances |',
  '',
  '## Agent Page Conventions',
  '',
  '| Directory | Purpose |',
  '|-----------|---------|',
  '| `entities/` | Concrete, named things |',
  '',
  '## Page Thresholds',
  '',
  '- Create a page when: entity/concept appears in 2+ notes',
  '',
  '## Private Notes Policy',
  '',
  'Custom section mentioning the Acme retainer terms.',
  '',
].join('\n');

describe('scopeSchemaToBundle', () => {
  it('keeps only the tag and domain rows used by the bundle', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, ['delivery'], ['logistics']);

    expect(scoped).toContain('| #delivery | 12 | Drone delivery work |');
    expect(scoped).not.toContain('acme-client');
    expect(scoped).not.toContain('#health');
    expect(scoped).toContain('| logistics | Delivery and routing knowledge |');
    expect(scoped).not.toContain('finances');
  });

  it('replaces the free-prose Knowledge Domains body with the used-domain list', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, [], ['Logistics']);

    expect(scoped).toContain('## Knowledge Domains');
    expect(scoped).not.toContain('private client work');
    expect(scoped).toContain('- Logistics');
  });

  it('keeps generic convention sections and drops unrecognized custom sections', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, [], []);

    expect(scoped).toContain('## Agent Page Conventions');
    expect(scoped).toContain('| `entities/` | Concrete, named things |');
    expect(scoped).toContain('## Page Thresholds');
    expect(scoped).not.toContain('Private Notes Policy');
    expect(scoped).not.toContain('Acme retainer');
  });

  it('matches tags and domains case-insensitively and ignores # and backticks', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, ['Delivery'], ['LOGISTICS']);

    expect(scoped).toContain('| #delivery |');
    expect(scoped).toContain('| logistics |');
  });

  it('notes when no taxonomy rows survive instead of shipping an empty table silently', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, ['unrelated'], []);

    expect(scoped).toContain('_No entries from this taxonomy are used by this bundle._');
    expect(scoped).toContain('_No domains are declared by the pages in this bundle._');
  });

  it('keeps table headers and separators so filtered tables stay valid markdown', () => {
    const scoped = scopeSchemaToBundle(FULL_SCHEMA, ['delivery'], ['logistics']);

    expect(scoped).toContain('| Tag | Usage | Description |');
    expect(scoped).toContain('|-----|-------|-------------|');
    expect(scoped).toContain('| Domain | Description |');
  });

  it('survives a degenerate SCHEMA.md with no recognized sections', () => {
    const scoped = scopeSchemaToBundle('# Schema\n\nFreeform private prose.\n', ['a'], ['b']);

    expect(scoped.startsWith('# Schema\n')).toBe(true);
    expect(scoped).not.toContain('Freeform private prose');
  });
});
