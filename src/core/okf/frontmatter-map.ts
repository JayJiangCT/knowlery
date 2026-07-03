import type { ConformanceIssue, OkfFrontmatter } from '../../types';
import type { FrontmatterMapResult, PageRecord } from './shared';
import { OKF_TYPE_BY_DIR, dirFromConceptId, titleFromPath, toIsoString } from './shared';

const TYPE_MAP: Record<string, string> = {
  entity: 'Entity',
  person: 'Person',
  concept: 'Concept',
  comparison: 'Comparison',
  query: 'Query',
  reference: 'Reference',
};

const TIMESTAMP_KEYS = ['updated', 'date', 'created'] as const;

export function mapFrontmatterToOkf(
  page: PageRecord,
  options: { includeSources?: boolean } = {},
): FrontmatterMapResult {
  const warnings: ConformanceIssue[] = [];
  const source = { ...page.frontmatter };
  const originalType = typeof source.type === 'string' ? source.type.trim() : '';
  const dir = dirFromConceptId(page.conceptId) ?? page.dir;
  const inferredType = OKF_TYPE_BY_DIR[dir] ?? 'Concept';
  const mappedType = TYPE_MAP[originalType.toLowerCase()] ?? inferredType;

  if (!originalType) {
    warnings.push({
      path: page.sourcePath,
      code: 'missing-input-type',
      message: `Missing frontmatter type; inferred ${mappedType} from ${dir}.`,
    });
  } else if (!TYPE_MAP[originalType.toLowerCase()]) {
    warnings.push({
      path: page.sourcePath,
      code: 'unknown-input-type',
      message: `Unknown frontmatter type "${originalType}"; inferred ${mappedType} from ${dir}.`,
    });
  } else if (mappedType !== inferredType && !(dir === 'entities' && mappedType === 'Person')) {
    warnings.push({
      path: page.sourcePath,
      code: 'type-directory-mismatch',
      message: `Frontmatter type ${mappedType} does not match ${dir} directory (${inferredType}).`,
    });
  }

  const timestamp = firstString(source, TIMESTAMP_KEYS);
  const output: Record<string, unknown> = {
    ...source,
    type: mappedType,
    title: stringOr(source.title, titleFromPath(page.sourcePath)),
  };

  if (timestamp) output.timestamp = timestamp;
  if (!options.includeSources) delete output.sources;

  return {
    frontmatter: output as OkfFrontmatter,
    warnings,
  };
}

function firstString(source: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = toIsoString(source[key]);
    if (value) return value;
  }
  return undefined;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
