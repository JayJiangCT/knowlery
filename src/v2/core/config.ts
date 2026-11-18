import { readFile } from 'node:fs/promises';
import { KF_VERSION } from '../version';
import { KnowleryError } from './errors';
import { validateIgnore } from './ignore';
import { isMissing, resolveInside } from './paths';

export interface Config {
  kf: string;
  ignore: string[];
  mcp: { raw: boolean };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readConfig(root: string): Promise<Config> {
  let text: string;
  try {
    text = await readFile(await resolveInside(root, '.knowlery/config.json'), 'utf8');
  } catch (error) {
    if (isMissing(error)) {
      throw new KnowleryError('not_found', 'This is not a knowledge base: .knowlery/config.json is missing.', 'Create .knowlery/config.json containing {"kf":"2.0"}.');
    }
    throw error;
  }
  const invalid = () => new KnowleryError('invalid_config', 'Invalid .knowlery/config.json.', 'Provide a JSON object with string kf, optional string[] ignore and optional boolean mcp.raw.');
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw invalid();
  }
  if (!isObject(value) || typeof value.kf !== 'string') throw invalid();
  if (value.kf !== KF_VERSION) {
    throw new KnowleryError('unsupported_schema', `Unsupported knowledge format: ${value.kf}`, 'Use a knowledge base with kf "2.0".');
  }
  const ignore = value.ignore ?? [];
  if (value.ignore === null || !Array.isArray(ignore) || !ignore.every((entry): entry is string => typeof entry === 'string')) throw invalid();
  for (const entry of ignore) validateIgnore(entry);
  if (value.mcp !== undefined && !isObject(value.mcp)) throw invalid();
  const raw = isObject(value.mcp) ? value.mcp.raw : undefined;
  if (raw !== undefined && typeof raw !== 'boolean') throw invalid();
  return { kf: value.kf, ignore, mcp: { raw: raw ?? true } };
}
