import { describe, expect, it } from 'vitest';
import { buildTodayModel } from '../../src/core/today-model';
import type { ActivityRecord, VaultStats } from '../../src/types';

const emptyStats: VaultStats = {
  notesCount: 2,
  wikilinksCount: 0,
  entitiesCount: 0,
  conceptsCount: 0,
  comparisonsCount: 0,
  queriesCount: 0,
};

const existingStats: VaultStats = {
  notesCount: 18,
  wikilinksCount: 12,
  entitiesCount: 2,
  conceptsCount: 4,
  comparisonsCount: 1,
  queriesCount: 0,
};

const record: ActivityRecord = {
  time: '2026-05-03T12:00:00.000Z',
  agent: 'claude',
  type: 'creation',
  topics: ['注意力机制', '心流'],
  summary: 'Created notes about attention and flow.',
  dimensions: ['creation'],
  questions: [],
  learned: [],
  thinking: [],
  followups: [],
  relatedFiles: ['concepts/心流状态.md'],
  captureState: 'unbaked',
  source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
};

const maintenanceRecord: ActivityRecord = {
  time: '2026-05-07T12:00:00.000Z',
  agent: 'claude',
  type: 'maintenance',
  topics: ['knowledge base maintenance', 'vault audit'],
  summary: 'Completed a vault maintenance pass and produced findings.',
  dimensions: ['maintenance'],
  questions: [],
  learned: [],
  thinking: [],
  followups: ['Review the maintenance findings.'],
  relatedFiles: ['.knowlery/reports/maintenance-pass.md'],
  captureState: 'baked',
  source: {
    kind: 'agent-session',
    visibility: 'private-summary',
    surface: 'system',
  },
};

const knowledgeAnalysisRecord: ActivityRecord = {
  time: '2026-05-07T22:55:00.000Z',
  agent: 'claude',
  type: 'analysis',
  topics: ['AWS Outage Incident', 'Knowledge Base Review'],
  summary: 'Reviewed an incident report and identified knowledge base updates.',
  dimensions: ['analysis', 'maintenance'],
  questions: [],
  learned: [],
  thinking: [],
  followups: ['Create an error classification concept page.'],
  relatedFiles: ['queries/AWS Outage Impact on Relay DSP - Incident Report (2026-05-07).md'],
  captureState: 'unbaked',
  source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
};

describe('buildTodayModel', () => {
  it('guides empty vaults toward one first note', () => {
    const model = buildTodayModel(emptyStats, []);

    expect(model.stage).toBe('empty-vault');
    expect(model.title).toContain('Start with one note');
    expect(model.primaryAction.label).toBe('Add first note');
  });

  it('guides existing vaults without Knowlery activity toward first cook', () => {
    const model = buildTodayModel(existingStats, []);

    expect(model.stage).toBe('first-maintenance');
    expect(model.title).toContain('already has material');
    expect(model.primaryAction.label).toBe('Prepare first cook');
    expect(model.primaryAction.request).toContain('Activity Ledger');
    expect(model.primaryAction.request).not.toContain('JSON object');
    expect(model.primaryAction.request).not.toContain('.jsonl');
  });

  it('summarizes returning users from recent activity', () => {
    const model = buildTodayModel(existingStats, [record]);

    expect(model.stage).toBe('returning');
    expect(model.title).toContain('注意力机制');
    expect(model.primaryAction.label).toBe('Prepare next move');
    expect(model.stats[0].value).toBe('1');
  });

  it('presents maintenance-only activity as a system update, not an active knowledge thread', () => {
    const model = buildTodayModel(existingStats, [maintenanceRecord]);

    expect(model.stage).toBe('returning');
    expect(model.title).toContain('Latest maintenance pass completed');
    expect(model.title).not.toContain('Recently you have been shaping');
    expect(model.body).toContain('Review the maintenance findings');
    expect(model.primaryAction.label).toBe('Open review menu');
    expect(model.summary.knowledgeThreads).toHaveLength(0);
    expect(model.stats[1]).toEqual({ label: 'active threads', value: '0' });
  });

  it('prefers knowledge threads over system updates when both are present', () => {
    const model = buildTodayModel(existingStats, [maintenanceRecord, knowledgeAnalysisRecord]);

    expect(model.stage).toBe('returning');
    expect(model.title).toContain('AWS Outage Incident');
    expect(model.title).not.toContain('Latest maintenance pass completed');
    expect(model.stats[1]).toEqual({ label: 'active threads', value: '1' });
  });
});
