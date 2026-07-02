import type { ActivityRecord } from '../../types';

const VERB_BY_TYPE: Record<string, string> = {
  creation: 'Creation',
  implementation: 'Update',
  analysis: 'Update',
  research: 'Update',
  reflection: 'Reflection',
};

export function projectLog(
  records: ActivityRecord[],
  options: { includeFullLog?: boolean; releasedAt: string },
): string {
  if (!options.includeFullLog) return minimalLog(options.releasedAt);

  const filtered = records
    .filter((record) => record.source.surface !== 'system')
    .filter((record) => record.type !== 'maintenance')
    .sort((a, b) => b.time.localeCompare(a.time));

  if (filtered.length === 0) return minimalLog(options.releasedAt);

  // Reserved file: no frontmatter (OKF §7).
  const lines = ['# Knowledge Update Log', ''];
  let currentDate = '';
  for (const record of filtered) {
    const date = record.time.slice(0, 10);
    if (date !== currentDate) {
      currentDate = date;
      lines.push(`## ${date}`, '');
    }
    const verb = VERB_BY_TYPE[record.type] ?? 'Update';
    lines.push(`* **${verb}**: ${record.summary}`);
  }
  lines.push('');
  return lines.join('\n');
}

function minimalLog(releasedAt: string): string {
  return [
    '# Knowledge Update Log',
    '',
    `## ${releasedAt.slice(0, 10)}`,
    '',
    '* **Initialization**: Bundle exported from Knowlery.',
    '',
  ].join('\n');
}
