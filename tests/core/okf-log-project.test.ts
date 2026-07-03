import { describe, expect, it } from 'vitest';
import { projectLog } from '../../src/core/okf/log-project';
import type { ActivityRecord } from '../../src/types';

const RELEASED_AT = '2026-07-01T12:00:00.000Z';

function record(overrides: Partial<ActivityRecord>): ActivityRecord {
  return {
    time: '2026-06-30T10:00:00.000Z',
    agent: 'codex',
    type: 'analysis',
    topics: [],
    summary: 'Did a thing.',
    dimensions: [],
    questions: [],
    learned: [],
    thinking: [],
    followups: [],
    relatedFiles: [],
    captureState: 'unbaked',
    source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
    ...overrides,
  } as ActivityRecord;
}

describe('log projection', () => {
  it('emits the minimal Initialization log by default regardless of input records', () => {
    const log = projectLog([record({ summary: 'Private detail.' })], { releasedAt: RELEASED_AT });
    expect(log).toBe([
      '# Knowledge Update Log',
      '',
      '## 2026-07-01',
      '',
      '* **Initialization**: Bundle exported from Knowlery.',
      '',
    ].join('\n'));
    expect(log).not.toContain('Private detail');
    expect(log.startsWith('---')).toBe(false);
  });

  it('projects full history only when opted in, excluding system and maintenance records', () => {
    const log = projectLog([
      record({ time: '2026-06-29T08:00:00.000Z', type: 'creation', summary: 'Created page.' }),
      record({ time: '2026-06-30T09:00:00.000Z', type: 'reflection', summary: 'Reflected.' }),
      record({ time: '2026-06-30T10:00:00.000Z', type: 'maintenance', summary: 'Plumbing.' }),
      record({ time: '2026-06-30T11:00:00.000Z', summary: 'System thing.', source: { kind: 'agent-session', visibility: 'private-summary', surface: 'system' } }),
    ], { includeFullLog: true, releasedAt: RELEASED_AT });

    expect(log).not.toContain('Plumbing');
    expect(log).not.toContain('System thing');
    expect(log).toContain('* **Reflection**: Reflected.');
    expect(log).toContain('* **Creation**: Created page.');
    // Newest date first.
    expect(log.indexOf('## 2026-06-30')).toBeLessThan(log.indexOf('## 2026-06-29'));
  });

  it('falls back to the minimal log when full projection is opted in but activity is empty', () => {
    const log = projectLog([], { includeFullLog: true, releasedAt: RELEASED_AT });
    expect(log).toContain('* **Initialization**: Bundle exported from Knowlery.');
  });
});
