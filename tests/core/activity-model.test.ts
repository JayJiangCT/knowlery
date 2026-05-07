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
    expect(result.records[0].source.surface).toBe('knowledge');
  });

  it('accepts a pretty-printed activity object even when the agent misses JSONL formatting', () => {
    const result = parseActivityJsonl(
      JSON.stringify({
        time: '2026-05-07T13:10:00.000Z',
        agent: 'claude',
        type: 'discussion',
        topics: ['Vault Maintenance', 'Knowledge Base'],
        summary: 'Ran first knowledge base maintenance pass.',
        dimensions: ['maintenance', 'strategy'],
        questions: ['Which gap should be tackled first?'],
        learned: ['Glossary terms need better granularity.'],
        thinking: ['Maintenance should be reviewed before becoming knowledge pages.'],
        followups: ['Split top glossary terms into entities.'],
        relatedFiles: ['INDEX.base'],
        captureState: 'unbaked',
        source: {
          kind: 'agent-session',
          visibility: 'private-summary',
          surface: 'system',
        },
      }, null, 2),
      '.knowlery/activity/2026-05-07.jsonl',
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].source.surface).toBe('system');
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
        source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
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
        source: { kind: 'manual-reflection', visibility: 'private-summary', surface: 'knowledge' },
      },
    ]);

    expect(summary.recurringThemes[0]).toMatchObject({ name: 'Knowlery', count: 2 });
    expect(summary.recentAgentWork[0].summary).toContain('Captured a personal reflection');
    expect(summary.unbakedNotes).toHaveLength(1);
    expect(summary.tasteProfile.reflection).toBe(2);
    expect(summary.coverage.recordsLogged).toBe(2);
  });

  it('groups records into knowledge threads with contextual next moves', () => {
    const summary = buildCounterSummary([
      {
        time: '2026-05-01T12:00:00.000Z',
        agent: 'claude',
        type: 'creation',
        topics: ['亲子旅行规划', '南安旅游'],
        summary: 'Created a Nan\'an family trip itinerary.',
        dimensions: ['creation'],
        questions: [],
        learned: ['九日山和清境桃源适合一日游串联。'],
        thinking: ['亲子游需要平衡文化体验和游乐项目。'],
        followups: [],
        relatedFiles: ['Traveling/2026-05-02 南安亲子一日游.md'],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
      },
      {
        time: '2026-05-01T13:00:00.000Z',
        agent: 'claude',
        type: 'discussion',
        topics: ['亲子旅行规划', '带娃清单'],
        summary: 'Discussed reusable packing checklist ideas.',
        dimensions: ['reflection'],
        questions: ['哪些经验可以复用？'],
        learned: [],
        thinking: ['旅行规划可以沉淀成模板。'],
        followups: [],
        relatedFiles: [],
        captureState: 'unbaked',
        source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
      },
      {
        time: '2026-05-01T14:00:00.000Z',
        agent: 'claude',
        type: 'research',
        topics: ['南安旅游', '亲子旅行规划'],
        summary: 'Compared travel stops from another session.',
        dimensions: ['research'],
        questions: [],
        learned: [],
        thinking: [],
        followups: [],
        relatedFiles: [],
        captureState: 'baked',
        source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
      },
    ]);

    expect(summary.knowledgeThreads).toHaveLength(1);
    expect(summary.knowledgeThreads[0]).toMatchObject({
      title: '亲子旅行规划',
      recordsCount: 3,
      stage: 'Capture',
      nextMove: 'Connect',
    });
    expect(summary.knowledgeThreads[0].suggestedRequest).toContain('older notes');
    expect(summary.knowledgeThreads[0].relatedFiles).toEqual(['Traveling/2026-05-02 南安亲子一日游.md']);
  });

  it('keeps system maintenance records out of knowledge threads', () => {
    const summary = buildCounterSummary([
      {
        time: '2026-05-07T12:00:00.000Z',
        agent: 'claude',
        type: 'maintenance',
        topics: ['knowledge base maintenance', 'vault audit'],
        summary: 'Completed a vault maintenance pass and wrote a report.',
        dimensions: ['maintenance'],
        questions: [],
        learned: [],
        thinking: [],
        followups: ['Review generated report before turning findings into knowledge pages.'],
        relatedFiles: ['.knowlery/reports/maintenance-pass.md'],
        captureState: 'baked',
        source: {
          kind: 'agent-session',
          visibility: 'private-summary',
          surface: 'system',
        },
      },
    ]);

    expect(summary.coverage.recordsLogged).toBe(1);
    expect(summary.recentAgentWork).toHaveLength(1);
    expect(summary.recurringThemes).toHaveLength(0);
    expect(summary.knowledgeThreads).toHaveLength(0);
  });
});
