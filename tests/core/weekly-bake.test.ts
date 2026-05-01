import { describe, expect, it } from 'vitest';
import { buildWeeklyBakeModel, generateWeeklyBakeHtml } from '../../src/core/weekly-bake';

describe('Weekly Bake report', () => {
  it('builds a model and HTML report from activity records', () => {
    const model = buildWeeklyBakeModel([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'codex',
        type: 'discussion',
        topics: ['Knowlery', 'Activity Ledger'],
        summary: 'Discussed how Knowlery should capture daily learning.',
        dimensions: ['strategy', 'reflection'],
        questions: ['How do we know what the user learned?'],
        learned: ['Use agent receipts, vault deltas, and manual reflections.'],
        thinking: ['The product should not feel like monitoring.'],
        followups: ['Create Counter'],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary' },
      },
    ], new Date('2026-05-01T15:00:00.000Z'));

    const html = generateWeeklyBakeHtml(model);

    expect(model.recurringThemes[0].name).toBe('Knowlery');
    expect(model.nextBatch[0]).toContain('Cook');
    expect(html).toContain('Weekly Bake');
    expect(html).toContain('Taste Profile');
    expect(html).toContain('Shelf Check');
  });
});
