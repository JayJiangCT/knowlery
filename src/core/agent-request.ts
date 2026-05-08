const ACTIVITY_LEDGER_REMINDER = [
  'Before you finish, complete this Activity Ledger checklist:',
  '',
  '- Append one private Activity Ledger receipt to `.knowlery/activity/YYYY-MM-DD.jsonl` according to the loaded Activity Ledger rule.',
  '- This receipt is allowed even when the task says not to create new vault notes; it is not a report or knowledge page.',
  '- If you intentionally skip the receipt because activity logging is disabled or no meaningful work happened, say so explicitly.',
  '',
  'End your final response with:',
  '',
  'Activity Ledger: written | skipped',
  'Path: <activity file path, or n/a>',
  'Reason: <one short reason>',
].join('\n');

export function withActivityLedgerReminder(request: string): string {
  const trimmed = request.trimEnd();
  if (trimmed.includes('Activity Ledger: written | skipped')) return trimmed;
  return `${trimmed}\n\n${ACTIVITY_LEDGER_REMINDER}`;
}
