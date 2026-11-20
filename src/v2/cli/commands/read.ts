import type { Config } from '../../core/config';
import { invalidInvocation, KnowleryError } from '../../core/errors';
import type { ExtractionOptions } from '../../core/extract';
import { relativePath, resolveInside } from '../../core/paths';
import { readCited, type ReadCitedResult } from '../../core/read/cited';
import { readRaw, type ReadRawResult } from '../../core/read/raw';
import { readWiki, type ReadWikiResult } from '../../core/read/wiki';
import type { ParsedArgs } from '../args';

export type ReadResult = ReadRawResult | ReadWikiResult | ReadCitedResult;

export function quoteSelect(value: string): string {
  if (/^[A-Za-z0-9._/-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function withTrailingNewline(output: string): string {
  return output.endsWith('\n') ? output : `${output}\n`;
}

export function formatReadRawText(result: ReadRawResult): string {
  const end = result.offset + result.bytes;
  const tail = `${result.partial ? 'partial · ' : ''}${result.more ? 'more' : 'end'}`;
  const header = `read ${result.path} · ${result.version} · ${result.select} · bytes ${result.offset}-${end} of ${result.total_bytes} · ${tail}`;
  const lines = [header];
  if (result.next) {
    lines.push(`more: --select ${quoteSelect(result.next.select)} --offset ${result.next.offset} --expected-version ${result.next.expected_version}`);
  }
  return withTrailingNewline(`${lines.join('\n')}\n\n${result.text}`);
}

export function formatReadWikiText(result: ReadWikiResult): string {
  const end = result.offset + result.bytes;
  const tail = `${result.partial ? 'partial · ' : ''}${result.more ? 'more' : 'end'}`;
  const header = `read ${result.path} · ${result.version} · ${result.select} · bytes ${result.offset}-${end} of ${result.total_bytes} · ${tail}`;
  const lines = [header];
  if (result.next) {
    lines.push(`more: --select ${quoteSelect(result.next.select)} --offset ${result.next.offset} --expected-version ${result.next.expected_version}`);
  }
  return withTrailingNewline(`${lines.join('\n')}\n\n${result.text}`);
}

export function formatReadCitedText(result: ReadCitedResult): string {
  const end = result.offset + result.bytes;
  const tail = `${result.partial ? 'partial · ' : ''}${result.more ? 'more' : 'end'}`;
  const header = `read ${result.path} · ${result.version} · ${result.select} · pin ${result.pin} · bytes ${result.offset}-${end} of ${result.total_bytes} · ${tail}`;
  const lines = [header];
  if (result.next) {
    lines.push(
      `more: --select ${quoteSelect(result.next.select)} --from ${quoteSelect(result.next.from)} --offset ${result.next.offset} --expected-version ${result.next.expected_version}`,
    );
  }
  return withTrailingNewline(`${lines.join('\n')}\n\n${result.text}`);
}

function isWikiRelPath(rel: string): boolean {
  return rel === 'wiki' || rel.startsWith('wiki/');
}

function parseCitedKey(select: string): string | null {
  if (!select.startsWith('cited:')) return null;
  const key = select.slice('cited:'.length);
  return key.length > 0 ? key : null;
}

export async function runRead(
  root: string,
  config: Config,
  args: Pick<ParsedArgs, 'path' | 'select' | 'from' | 'offset' | 'expectedVersion'>,
  options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<{ result: ReadResult; text: string }> {
  if (!args.path) invalidInvocation('Missing PATH for read.');

  const resolved = await resolveInside(root, args.path);
  const rel = relativePath(root, resolved);
  const isWiki = isWikiRelPath(rel);
  const isCitedSelector = args.select !== undefined && args.select.startsWith('cited:');

  if (isWiki) {
    if (args.from !== undefined) {
      throw new KnowleryError(
        'invalid_selector',
        `--from cannot be used when reading a wiki path: ${args.path}`,
        'Use --from only with --select cited:<key> on a raw source.',
      );
    }
    const result = await readWiki(root, args.path, {
      select: args.select,
      offset: args.offset,
      expectedVersion: args.expectedVersion,
    });
    return { result, text: formatReadWikiText(result) };
  }

  if (args.from !== undefined || isCitedSelector) {
    if (args.from === undefined) {
      throw new KnowleryError(
        'invalid_selector',
        `Selector "${args.select}" requires --from PAGE.`,
        'Pass --from wiki/<page>.md alongside --select cited:<key>.',
      );
    }
    const key = args.select !== undefined ? parseCitedKey(args.select) : null;
    if (!key) {
      throw new KnowleryError(
        'invalid_selector',
        `--from requires --select cited:<key>, got ${args.select ?? 'default selector'}.`,
        'Pass --select cited:<key> with --from, or omit --from for a regular raw read.',
      );
    }
    const result = await readCited(root, config, args.path, key, args.from, {
      ...options,
      offset: args.offset,
      expectedVersion: args.expectedVersion,
    });
    return { result, text: formatReadCitedText(result) };
  }

  const result = await readRaw(root, args.path, {
    ...options,
    config,
    select: args.select,
    offset: args.offset,
    expectedVersion: args.expectedVersion,
  });
  return { result, text: formatReadRawText(result) };
}
