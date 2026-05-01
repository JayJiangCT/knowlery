import { describe, expect, it } from 'vitest';
import {
  buildCounterSummary,
  parseActivityJsonl,
} from '../../src/core/activity-model';

describe('parseActivityJsonl', () => {
  it('keeps valid records and reports malformed lines', () => {
    const result = parseActivityJsonl(
      [
        JSON.stringify({
          time: '2026-05-01T12:00:00.000Z',
          agent: 'codex',
          type: 'creation',
          topics: ['Knowlery', 'Product Strategy'],
          summary: 'Discussed Counter and Weekly Bake.',
          dimensions: ['strategy', 'reflection'],
          questions: ['How does Knowlery get daily thinking signals?'],
          learned: ['Agent session receipts should be the main source.'],
          thinking: ['Avoid surveillance; use chosen traces.'],
          followups: ['Design Activity Ledger schema'],
          relatedFiles: ['docs/superpowers/specs/2026-05-01-counter-weekly-bake-design.md'],
          captureState: 'unbaked',
          source: { kind: 'agent-session', visibility: 'private-summary' },
        }),
        '{not-json',
      ].join('\n'),
      '.knowlery/activity/2026-05-01.jsonl',
    );

    expect(result.records).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.records[0].type).toBe('creation');
    expect(result.records[0].topics).toEqual(['Knowlery', 'Product Strategy']);
  });
});

describe('buildCounterSummary', () => {
  it('summarizes recurring themes, recent work, unbaked notes, taste profile, and coverage', () => {
    const summary = buildCounterSummary([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'codex',
        type: 'discussion',
        topics: ['Knowlery', 'Product Strategy'],
        summary: 'Discussed Counter and Weekly Bake.',
        dimensions: ['strategy', 'reflection'],
        questions: ['How does Knowlery get daily thinking signals?'],
        learned: ['Agent session receipts should be the main source.'],
        thinking: ['Avoid surveillance; use chosen traces.'],
        followups: ['Design Activity Ledger schema'],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary' },
      },
      {
        time: '2026-05-01T13:00:00.000Z',
        agent: 'manual',
        type: 'reflection',
        topics: ['Knowlery'],
        summary: 'Captured a personal reflection about product direction.',
        dimensions: ['reflection'],
        questions: [],
        learned: ['Counter should feel warm, not like a KPI panel.'],
        thinking: ['Reports should be beautiful but restrained.'],
        followups: [],
        relatedFiles: [],
        captureState: 'baked',
        source: { kind: 'manual-reflection', visibility: 'private-summary' },
      },
    ]);

    expect(summary.recurringThemes[0]).toMatchObject({ name: 'Knowlery', count: 2 });
    expect(summary.recentAgentWork[0].summary).toContain('Captured a personal reflection');
    expect(summary.unbakedNotes).toHaveLength(1);
    expect(summary.tasteProfile.reflection).toBe(2);
    expect(summary.coverage.recordsLogged).toBe(2);
  });
});
