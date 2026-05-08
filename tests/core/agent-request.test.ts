import { describe, expect, it } from 'vitest';
import { withActivityLedgerReminder } from '../../src/core/agent-request';

describe('withActivityLedgerReminder', () => {
  it('adds a verifiable Activity Ledger completion checklist without exposing the JSON schema', () => {
    const request = withActivityLedgerReminder('Review this vault.');

    expect(request).toContain('Before you finish, complete this Activity Ledger checklist');
    expect(request).toContain('.knowlery/activity/YYYY-MM-DD.jsonl');
    expect(request).toContain('Activity Ledger: written | skipped');
    expect(request).toContain('Path:');
    expect(request).toContain('Reason:');
    expect(request).toContain('loaded Activity Ledger rule');
    expect(request).not.toContain('JSON object');
    expect(request).not.toContain('"captureState"');
  });

  it('does not duplicate the reminder', () => {
    const once = withActivityLedgerReminder('Review this vault.');
    const twice = withActivityLedgerReminder(once);

    expect(twice).toBe(once);
  });
});
