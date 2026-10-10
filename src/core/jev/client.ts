/**
 * Minimal client for TypeSafe AI's System One (Jev) decision endpoint. Pure core:
 * the shell supplies the transport (plugin: Obsidian requestUrl; tests: a stub), the
 * API key is passed per call and never persisted here.
 *
 * Jev is optional throughout Knowlery. Nothing on the retrieval path depends on it;
 * it only ranks cook candidates when the user has configured a key.
 */

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** Pinned: Jev releases are not guaranteed to keep calibration across versions. */
export const JEV_MODEL = 'jev-1.13.0';
/** Published input price; output tokens are free. Used only for cost estimates in the UI. */
export const JEV_PRICE_PER_MTOK = 0.042;

export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
  criteria: { true: string; false: string };
}

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion;

export interface JevRequest {
  state: unknown;
  model: string;
  questions: Record<string, JevQuestion>;
}

export interface JevNoulAnswer { type: 'noul'; noul: number }
export interface JevChoiceAnswer { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
export type JevAnswer = JevNoulAnswer | JevChoiceAnswer;

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface JevTransportResult {
  status: number;
  text: string;
}

/** Shell-supplied HTTP POST. Must not throw on non-2xx; return the status instead. */
export type JevTransport = (url: string, headers: Record<string, string>, body: string) => Promise<JevTransportResult>;

export type JevErrorKind = 'unauthorized' | 'rate-limited' | 'http' | 'malformed';

export class JevError extends Error {
  constructor(public kind: JevErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'JevError';
  }
}

export async function askJev(transport: JevTransport, apiKey: string, request: JevRequest): Promise<JevResponse> {
  const result = await transport(
    JEV_ENDPOINT,
    { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    JSON.stringify(request),
  );
  if (result.status === 401 || result.status === 403) {
    throw new JevError('unauthorized', 'Jev rejected the API key.', result.status);
  }
  if (result.status === 429 || result.status === 529) {
    throw new JevError('rate-limited', 'Jev is rate-limiting requests; try again shortly.', result.status);
  }
  if (result.status < 200 || result.status >= 300) {
    throw new JevError('http', `Jev returned HTTP ${result.status}.`, result.status);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new JevError('malformed', 'Jev returned a non-JSON body.');
  }
  if (!isJevResponse(parsed)) {
    throw new JevError('malformed', 'Jev response is missing answers.');
  }
  return parsed;
}

function isJevResponse(value: unknown): value is JevResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.answers === 'object' && record.answers !== null;
}
