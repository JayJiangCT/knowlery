import type { App } from 'obsidian';
import { z } from 'zod';
import type { ActivityRecord, CounterSummary } from '../types';
import { buildCounterSummary } from './activity-model';

export const REVIEW_REQUEST_DIR = '.knowlery/requests';
export const REVIEW_RESULT_DIR = '.knowlery/reviews';

const DailyReviewResultSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  nextRecipe: z.string().min(1),
  suggestedPrompt: z.string().min(1),
});

export type DailyReviewResult = z.infer<typeof DailyReviewResultSchema>;

export interface DailyReviewContext {
  date: string;
  topTopics: string[];
  activeThreads: Array<{
    title: string;
    records: number;
    files: number;
    stage: string;
    nextMove: string;
    reason: string;
  }>;
  coverage: CounterSummary['coverage'];
  tasteProfile: CounterSummary['tasteProfile'];
  recentSummaries: string[];
}

export interface DailyReviewRequest {
  id: string;
  kind: 'daily-review';
  createdAt: string;
  requestPath: string;
  resultPath: string;
  context: DailyReviewContext;
  prompt: string;
}

export type DailyReviewParseResult =
  | { ok: true; result: DailyReviewResult }
  | { ok: false; error: string };

export interface LatestDailyReviewResult {
  path: string;
  result: DailyReviewParseResult;
}

export interface DailyReviewWriteResult {
  request: DailyReviewRequest;
  sent: boolean;
}

export function buildDailyReviewRequest(
  records: ActivityRecord[],
  now = new Date(),
): DailyReviewRequest {
  const date = getLocalDateLabel(now);
  const id = `daily-review-${date}`;
  const resultPath = normalizeReviewPath(`${REVIEW_RESULT_DIR}/${id}.json`);
  const requestPath = normalizeReviewPath(`${REVIEW_REQUEST_DIR}/${id}.json`);
  const context = buildDailyReviewContext(records, date);

  return {
    id,
    kind: 'daily-review',
    createdAt: now.toISOString(),
    requestPath,
    resultPath,
    context,
    prompt: buildDailyReviewPrompt(id, resultPath, context),
  };
}

export async function writeDailyReviewRequest(
  app: App,
  request: DailyReviewRequest,
): Promise<void> {
  await ensureAdapterDir(app, REVIEW_REQUEST_DIR);
  await ensureAdapterDir(app, REVIEW_RESULT_DIR);
  await app.vault.adapter.write(request.requestPath, `${JSON.stringify(request, null, 2)}\n`);
}

export async function readDailyReviewResult(
  app: App,
  resultPath: string,
  expectedRequestId?: string,
): Promise<DailyReviewParseResult | null> {
  const path = normalizeReviewPath(resultPath);
  if (!(await app.vault.adapter.exists(path))) return null;

  const content = await app.vault.adapter.read(path);
  return parseDailyReviewResult(content, expectedRequestId);
}

export async function readLatestDailyReviewResult(app: App): Promise<LatestDailyReviewResult | null> {
  if (!(await app.vault.adapter.exists(REVIEW_RESULT_DIR))) return null;

  const listed = await app.vault.adapter.list(REVIEW_RESULT_DIR);
  const latestPath = listed.files
    .filter((path) => /daily-review-\d{4}-\d{2}-\d{2}\.json$/.test(path))
    .sort((a, b) => b.localeCompare(a))[0];

  if (!latestPath) return null;

  const result = await readDailyReviewResult(app, latestPath);
  return result ? { path: latestPath, result } : null;
}

export function parseDailyReviewResult(content: string, expectedRequestId?: string): DailyReviewParseResult {
  try {
    const parsed = JSON.parse(content);
    const result = DailyReviewResultSchema.safeParse(parsed);
    if (result.success) {
      if (expectedRequestId && result.data.requestId !== expectedRequestId) {
        return {
          ok: false,
          error: `Result belongs to ${result.data.requestId}, expected ${expectedRequestId}`,
        };
      }
      return { ok: true, result: result.data };
    }
    return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid daily review result' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse daily review JSON' };
  }
}

function buildDailyReviewContext(records: ActivityRecord[], date: string): DailyReviewContext {
  const summary = buildCounterSummary(records);
  return {
    date,
    topTopics: summary.recurringThemes.map((theme) => theme.name).slice(0, 5),
    activeThreads: summary.knowledgeThreads.slice(0, 3).map((thread) => ({
      title: thread.title,
      records: thread.recordsCount,
      files: thread.relatedFiles.length,
      stage: thread.stage,
      nextMove: thread.nextMove,
      reason: thread.nextMoveReason,
    })),
    coverage: summary.coverage,
    tasteProfile: summary.tasteProfile,
    recentSummaries: summary.recentAgentWork.map((record) => record.summary).slice(0, 5),
  };
}

function buildDailyReviewPrompt(
  requestId: string,
  resultPath: string,
  context: DailyReviewContext,
): string {
  return [
    'Based on the Knowlery Activity Context below, generate a warm, restrained personal knowledge review summary.',
    '',
    'Constraints:',
    '- Do not judge whether the user is “using things well enough.”',
    '- Only describe the current state of recent knowledge activity and suggest one lightweight next step.',
    '- Only write to the result file — do not modify any other vault files.',
    `- Result file path: ${resultPath}`,
    '- Output must be strict JSON with these fields:',
    '{',
    `  "requestId": "${requestId}",`,
    '  "generatedAt": "<ISO timestamp>",',
    '  "title": "<short title>",',
    '  "summary": "<warm daily review summary>",',
    '  "nextRecipe": "<one recipe name, such as connect/challenge/cook>",',
    '  "suggestedPrompt": "<one prompt the user can send next>"',
    '}',
    '',
    'Activity Context:',
    JSON.stringify(context, null, 2),
  ].join('\n');
}

function normalizeReviewPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function getLocalDateLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureAdapterDir(app: App, path: string): Promise<void> {
  const normalized = normalizeReviewPath(path);
  if (!(await app.vault.adapter.exists(normalized))) {
    await app.vault.adapter.mkdir(normalized);
  }
}
