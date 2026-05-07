import { describe, expect, it } from 'vitest';
import { buildWeeklyBakeModel, generateWeeklyBakeHtml } from '../../src/core/weekly-bake';

describe('Weekly Bake report', () => {
  it('builds a model and HTML report from activity records', () => {
    const model = buildWeeklyBakeModel([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'codex',
        type: 'discussion',
        topics: ['Knowlery', 'Activity Ledger', '<script>alert(1)</script>'],
        summary: 'Discussed how Knowlery should capture daily learning.',
        dimensions: ['strategy', 'reflection'],
        questions: ['How do we know what the user learned?'],
        learned: ['Use agent receipts, vault deltas, and manual reflections.'],
        thinking: ['The product should not feel like monitoring.'],
        followups: ['Create Counter'],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
      },
    ], new Date('2026-05-01T15:00:00.000Z'));

    const html = generateWeeklyBakeHtml(model);

    expect(model.recurringThemes[0].name).toBe('Knowlery');
    expect(model.learningHighlights[0]).toContain('agent receipts');
    expect(model.nextMoves[0].title).toContain('Connect');
    expect(model.hexagon).toHaveLength(6);
    expect(model.timeline[0].title).toBe('Knowlery');
    expect(html).toContain('Knowledge Review Atlas');
    expect(html).toContain('Knowledge Hexagon');
    expect(html).toContain('Knowledge Timeline');
    expect(html).toContain('Knowledge Extensions');
    expect(html).toContain('What You Learned');
    expect(html).toContain('Next Batch');
    expect(html).toContain('本周知识地图');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
