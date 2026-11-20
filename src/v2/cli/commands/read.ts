import type { Config } from '../../core/config';
import { invalidInvocation } from '../../core/errors';
import type { ExtractionOptions } from '../../core/extract';
import { readRaw, type ReadRawResult } from '../../core/read/raw';
import type { ParsedArgs } from '../args';

function quoteSelect(value: string): string {
  if (/^[A-Za-z0-9._/-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function formatReadRawText(result: ReadRawResult): string {
  const end = result.offset + result.bytes;
  const tail = `${result.partial ? 'partial · ' : ''}${result.more ? 'more' : 'end'}`;
  const header = `read ${result.path} · ${result.version} · ${result.select} · bytes ${result.offset}-${end} of ${result.total_bytes} · ${tail}`;
  const lines = [header];
  if (result.next) {
    lines.push(`more: --select ${quoteSelect(result.next.select)} --offset ${result.next.offset} --expected-version ${result.next.expected_version}`);
  }
  return `${lines.join('\n')}\n\n${result.text}`;
}

export async function runRead(
  root: string,
  config: Config,
  args: Pick<ParsedArgs, 'path' | 'select' | 'offset' | 'expectedVersion'>,
  options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<{ result: ReadRawResult; text: string }> {
  if (!args.path) invalidInvocation('Missing PATH for read.');
  const result = await readRaw(root, args.path, {
    ...options,
    config,
    select: args.select,
    offset: args.offset,
    expectedVersion: args.expectedVersion,
  });
  return { result, text: formatReadRawText(result) };
}
