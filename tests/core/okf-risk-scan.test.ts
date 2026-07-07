import { describe, expect, it } from 'vitest';
import { scanRisks } from '../../src/core/okf/risk-scan';

describe('OKF risk scanner', () => {
  it('reports warning-only hints for each privacy heuristic', () => {
    const hints = scanRisks({
      pages: [{
        conceptId: 'entities/jay',
        sourcePath: 'entities/jay.md',
        dir: 'entities',
        frontmatter: { type: 'person', email: 'jay@example.com' },
        body: 'See https://docs.google.com/document/d/private/edit',
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [{
        path: 'Meetings/standup.md',
        title: 'Standup',
        body: 'Private notes',
        frontmatter: {},
        citedBy: ['entities/jay'],
        contentHash: 'sha256-raw',
      }],
    });

    expect(hints.map((hint) => hint.kind).sort()).toEqual([
      'email',
      'meeting-like-path',
      'person-page',
      'sensitive-url',
    ]);
    expect(hints.every((hint) => !('status' in hint))).toBe(true);
  });

  // Spec 0.9 f2, §4.4/§5.5 — each highest-cost-if-public shape is detected.
  it.each([
    ['ghp token', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['fine-grained pat', 'github_pat_11ABCDEFG0abcdefghijklm'],
    ['sk key', 'sk-abcdefghijklmnopqrstuvwx'],
    ['aws key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['slack token', 'xoxb-1234567890-abcdefghij'],
    ['private key block', '-----BEGIN RSA PRIVATE KEY-----'],
  ])('flags a credential shape: %s', (_label, secret) => {
    const hints = scanRisks({
      pages: [{
        conceptId: 'concepts/deploy',
        sourcePath: 'concepts/deploy.md',
        dir: 'concepts',
        frontmatter: { type: 'concept' },
        body: `Deploy with ${secret} as the token.`,
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [],
    });
    const credential = hints.find((hint) => hint.kind === 'credential');
    expect(credential).toBeDefined();
    // Evidence proves the finding without repeating a full secret.
    if (!secret.startsWith('-----BEGIN')) {
      expect(credential!.evidence).not.toContain(secret);
    }
  });

  it.each([
    ['10.x', '10.0.12.7'],
    ['192.168.x', '192.168.1.10'],
    ['172.16-31.x', '172.20.0.1'],
  ])('flags a private ip: %s', (_label, ip) => {
    const hints = scanRisks({
      pages: [{
        conceptId: 'concepts/hosts',
        sourcePath: 'concepts/hosts.md',
        dir: 'concepts',
        frontmatter: { type: 'concept' },
        body: `The staging host is ${ip} internally.`,
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [],
    });
    expect(hints.some((hint) => hint.kind === 'private-ip' && hint.evidence === ip)).toBe(true);
  });

  it('flags a CN mobile number with masked evidence; public IPs and short numbers stay silent', () => {
    const hints = scanRisks({
      pages: [{
        conceptId: 'concepts/contact',
        sourcePath: 'concepts/contact.md',
        dir: 'concepts',
        frontmatter: { type: 'concept' },
        body: 'Call 13812345678. Public host 8.8.8.8, port 1234567 is fine.',
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [],
    });
    const phone = hints.find((hint) => hint.kind === 'phone-number');
    expect(phone?.evidence).toBe('138****5678');
    expect(hints.some((hint) => hint.kind === 'private-ip')).toBe(false);
  });

  it('stays silent on clean content', () => {
    expect(scanRisks({
      pages: [{
        conceptId: 'concepts/search',
        sourcePath: 'concepts/search.md',
        dir: 'concepts',
        frontmatter: { type: 'concept' },
        body: 'Public research note.',
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [],
    })).toEqual([]);
  });
});
