import { describe, expect, it } from 'vitest';
import {
  buildDailyReviewRequest,
  parseDailyReviewResult,
} from '../../src/core/agent-review';

const records = [
  {
    time: '2026-05-02T12:00:00.000Z',
    agent: 'claude',
    type: 'creation' as const,
    topics: ['注意力机制', '心流'],
    summary: '整理了注意力机制和心流相关材料。',
    dimensions: ['creation' as const],
    questions: [],
    learned: ['心流和奖励反馈有关。'],
    thinking: ['需要和旧笔记连接。'],
    followups: [],
    relatedFiles: ['concepts/心流状态.md'],
    captureState: 'unbaked' as const,
    source: { kind: 'agent-session' as const, visibility: 'private-summary' as const },
  },
];

describe('agent review request contract', () => {
  it('builds a file-based daily review request with a deterministic result path', () => {
    const request = buildDailyReviewRequest(records, new Date('2026-05-03T10:00:00.000Z'));

    expect(request.id).toBe('daily-review-2026-05-03');
    expect(request.kind).toBe('daily-review');
    expect(request.resultPath).toBe('.knowlery/reviews/daily-review-2026-05-03.json');
    expect(request.context.topTopics).toEqual(['注意力机制', '心流']);
    expect(request.prompt).toContain('.knowlery/reviews/daily-review-2026-05-03.json');
    expect(request.prompt).toContain('只写入结果文件');
    expect(request.prompt).toContain('"title"');
  });

  it('accepts valid agent result JSON and rejects malformed results', () => {
    const valid = parseDailyReviewResult(JSON.stringify({
      requestId: 'daily-review-2026-05-03',
      generatedAt: '2026-05-03T10:10:00.000Z',
      title: '注意力机制正在成形',
      summary: '这两天你主要在沉淀注意力机制和心流。',
      nextRecipe: 'connect',
      suggestedPrompt: '帮我回看最近关于「注意力机制」的内容。',
    }));

    const invalid = parseDailyReviewResult(JSON.stringify({
      requestId: 'daily-review-2026-05-03',
      title: '',
      summary: 'missing fields',
    }));

    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.result.nextRecipe).toBe('connect');
    }
    expect(invalid.ok).toBe(false);
  });

  it('rejects a result written for a different request id', () => {
    const result = parseDailyReviewResult(JSON.stringify({
      requestId: 'daily-review-2026-05-02',
      generatedAt: '2026-05-03T10:10:00.000Z',
      title: '注意力机制正在成形',
      summary: '这两天你主要在沉淀注意力机制和心流。',
      nextRecipe: 'connect',
      suggestedPrompt: '帮我回看最近关于「注意力机制」的内容。',
    }), 'daily-review-2026-05-03');

    expect(result.ok).toBe(false);
  });
});
