import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from '../../src/v2/cli/args';
import { exitCode, KnowleryError, type ErrorCode } from '../../src/v2/core/errors';
import { createIgnoreMatcher } from '../../src/v2/core/ignore';

const fixture = join(process.cwd(), 'tests/v2/fixtures/kb');

describe('v2 skeleton and fixture', () => {
  it('parses global flags anywhere and validates numeric flags', () => {
    expect(parseArgs(['--json', 'inventory', '--dir', 'kb', '--limit', '2', '--offset', '0']))
      .toMatchObject({ command: 'inventory', dir: 'kb', json: true, limit: 2, offset: 0 });
    for (const argv of [['inventory', '--limit', '1.2'], ['inventory', '--offset', '9007199254740992'], ['inventory', '--dir', '']]) {
      expect(() => parseArgs(argv)).toThrow(KnowleryError);
    }
  });

  it('defines every error exit code', () => {
    const failures: ErrorCode[] = ['not_found', 'path_denied', 'stale_version', 'invalid_config', 'unsupported_schema', 'internal', 'invalid_selector', 'raw_disabled', 'extraction_unavailable', 'limit_reached', 'deadline'];
    expect(exitCode('invalid_invocation')).toBe(2);
    for (const code of failures) expect(exitCode(code)).toBe(1);
  });

  it('treats non-star glob punctuation literally and matches case exactly', () => {
    const matches = createIgnoreMatcher(['Notes/file[1]?.*', '*.PDF']);
    expect(matches('Notes/file[1]?.txt')).toBe(true);
    expect(matches('Notes/file1x.txt')).toBe(false);
    expect(matches('a/b.PDF')).toBe(true);
    expect(matches('a/b.pdf')).toBe(false);
  });

  it('contains the specified text and CSV edge cases', async () => {
    const chinese = await readFile(join(fixture, 'Notes/会议记录.txt'), 'utf8');
    expect(Buffer.byteLength(chinese)).toBeGreaterThanOrEqual(15000);
    expect(chinese).not.toMatch(/\n\s*\n/);
    const policy = await readFile(join(fixture, 'Projects/policy notes.txt'), 'utf8');
    expect(policy.trimEnd().split('\n').length).toBeGreaterThanOrEqual(60);
    const meeting = await readFile(join(fixture, 'Notes/meeting.md'), 'utf8');
    expect(meeting).toMatch(/^### /m);
    const csv = await readFile(join(fixture, 'Finance/orders.csv'), 'utf8');
    expect(csv).toContain('"Company, Ltd"');
    expect(csv).toContain('"Two\nLines"');
    expect(csv.match(/^\d+,/gm)).toHaveLength(200);
  });
});
