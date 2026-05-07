const ACTIVITY_LEDGER_REMINDER = [
  'After you finish, append the private Activity Ledger receipt according to the loaded Activity Ledger rule.',
  'This receipt is allowed even when the task says not to create new vault notes; it is not a report or knowledge page.',
].join(' ');

export function withActivityLedgerReminder(request: string): string {
  const trimmed = request.trimEnd();
  if (trimmed.includes('After you finish, append the private Activity Ledger receipt')) return trimmed;
  return `${trimmed}\n\n${ACTIVITY_LEDGER_REMINDER}`;
}
