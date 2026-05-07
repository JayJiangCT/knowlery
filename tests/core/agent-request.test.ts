import { describe, expect, it } from 'vitest';
import { withActivityLedgerReminder } from '../../src/core/agent-request';

describe('withActivityLedgerReminder', () => {
  it('adds a compact Activity Ledger reminder without exposing JSONL schema', () => {
    const request = withActivityLedgerReminder('Review this vault.');

    expect(request).toContain('private Activity Ledger receipt');
    expect(request).toContain('loaded Activity Ledger rule');
    expect(request).not.toContain('JSON object');
    expect(request).not.toContain('.jsonl');
  });

  it('does not duplicate the reminder', () => {
    const once = withActivityLedgerReminder('Review this vault.');
    const twice = withActivityLedgerReminder(once);

    expect(twice).toBe(once);
  });
});

