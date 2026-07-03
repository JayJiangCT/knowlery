import matter from 'gray-matter';
import type { ConformanceIssue, ConformanceReport, FieldQualitySummary } from '../../types';
import type { BundleFile } from './shared';
import { dirFromConceptId, normalizeItemText, toIsoString } from './shared';

const NEAR_MISS_TIMESTAMP_KEYS = ['modified', 'last-updated', 'last_updated', 'updated_at', 'date-modified'];

export function checkConformance(files: BundleFile[]): ConformanceReport {
  const errors: ConformanceIssue[] = [];
  const warnings: ConformanceIssue[] = [];
  const fieldQuality: FieldQualitySummary = {
    missingDescription: { count: 0, pages: [] },
    missingTimestamp: { count: 0, pages: [] },
    missingDomain: { count: 0, pages: [] },
    typeMismatch: { count: 0, pages: [] },
  };

  for (const file of files.filter((entry) => entry.path.endsWith('.md'))) {
    if (file.path === 'index.md' || file.path.endsWith('/index.md')) {
      validateReservedIndex(file, warnings);
      continue;
    }
    if (file.path === 'log.md') {
      validateReservedLog(file, warnings);
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(file.content);
    } catch {
      errors.push(issue(file.path, 'invalid-frontmatter', 'Frontmatter is not parseable YAML.'));
      continue;
    }

    const type = normalizeItemText(parsed.data.type);
    if (!type) {
      errors.push(issue(file.path, 'missing-type', 'Frontmatter is missing a non-empty type.'));
    }

    if (file.kind === 'concept') {
      if (!normalizeItemText(parsed.data.description)) {
        warnings.push(issue(file.path, 'missing-description', 'Missing description; index drill-down will be thinner.'));
        fieldQuality.missingDescription.pages.push(file.path);
      }
      if (!toIsoString(parsed.data.timestamp) && !toIsoString(parsed.data.updated) && !toIsoString(parsed.data.date) && !toIsoString(parsed.data.created)) {
        const nearMissKey = NEAR_MISS_TIMESTAMP_KEYS.find((key) => toIsoString(parsed.data[key]));
        warnings.push(issue(
          file.path,
          'missing-timestamp',
          nearMissKey ? `Missing timestamp; found ${nearMissKey}, which is not interpreted.` : 'Missing timestamp.',
        ));
        fieldQuality.missingTimestamp.pages.push(nearMissKey ? { path: file.path, nearMissKey } : { path: file.path });
      }
      if (!normalizeItemText(parsed.data.domain)) {
        warnings.push(issue(file.path, 'missing-domain', 'Missing domain; page falls into the unspecified group.'));
        fieldQuality.missingDomain.pages.push(file.path);
      }
      const dir = dirFromConceptId(file.path.replace(/\.md$/i, ''));
      if (dir && type && !typeMatchesDir(type, dir)) {
        warnings.push(issue(file.path, 'type-directory-mismatch', `Type ${type} does not match ${dir}.`));
        fieldQuality.typeMismatch.pages.push(file.path);
      }
      if (Array.isArray(parsed.data.contradictions) && parsed.data.contradictions.length > 0) {
        warnings.push(issue(file.path, 'contradictions-present', 'Page contains contradictions.'));
      }
    }
  }

  fieldQuality.missingDescription.count = fieldQuality.missingDescription.pages.length;
  fieldQuality.missingTimestamp.count = fieldQuality.missingTimestamp.pages.length;
  fieldQuality.missingDomain.count = fieldQuality.missingDomain.pages.length;
  fieldQuality.typeMismatch.count = fieldQuality.typeMismatch.pages.length;

  return { conformant: errors.length === 0, errors, warnings, fieldQuality };
}

function validateReservedIndex(file: BundleFile, warnings: ConformanceIssue[]): void {
  if (!file.content.includes('# ')) {
    warnings.push(issue(file.path, 'weak-index', 'Index file has no heading.'));
  }
  if (file.path === 'index.md' && !/^---\nokf_version: "[^"]+"\n---\n/.test(file.content)) {
    warnings.push(issue(file.path, 'missing-okf-version', 'Root index should carry the okf_version frontmatter line (OKF §11).'));
  }
}

function validateReservedLog(file: BundleFile, warnings: ConformanceIssue[]): void {
  if (!file.content.includes('# Knowledge Update Log')) {
    warnings.push(issue(file.path, 'weak-log', 'Log file has no Knowledge Update Log heading.'));
  }
}

function issue(path: string, code: string, message: string): ConformanceIssue {
  return { path, code, message };
}

function typeMatchesDir(type: string, dir: string): boolean {
  return (
    (dir === 'entities' && (type === 'Entity' || type === 'Person')) ||
    (dir === 'concepts' && type === 'Concept') ||
    (dir === 'comparisons' && type === 'Comparison') ||
    (dir === 'queries' && type === 'Query')
  );
}
