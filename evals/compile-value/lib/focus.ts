import matter from 'gray-matter';

/**
 * Protocol §11 / store §2.3.1: `focus.md` may carry `until: YYYY-MM-DD` in frontmatter.
 * Inclusive through 23:59:59 local time on that date; no `until` means in force; an
 * unparseable `until` is treated as absent and reported. In evaluation, "local" is the
 * freeze manifest's time zone at frozenAt, never the evaluating machine's clock.
 */

export interface FocusState {
  inForce: boolean;
  until: string | null;
  warning: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar date of `instant` in `timeZone`, as YYYY-MM-DD. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseUntil(value: unknown): string | null {
  // YAML parses an unquoted date into a Date at UTC midnight; its UTC calendar date is what the user wrote.
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && ISO_DATE.test(value.trim())) {
    const date = value.trim();
    return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? null : date;
  }
  return null;
}

export function focusState(content: string, at: Date, timeZone: string): FocusState {
  let data: Record<string, unknown>;
  try {
    data = matter(content).data as Record<string, unknown>;
  } catch {
    return { inForce: true, until: null, warning: 'focus.md frontmatter could not be parsed; treated as having no until:' };
  }
  if (!('until' in data) || data.until === null || data.until === undefined) return { inForce: true, until: null, warning: null };
  const until = parseUntil(data.until);
  if (until === null) {
    return { inForce: true, until: null, warning: `focus.md until: ${JSON.stringify(data.until)} is not a YYYY-MM-DD date; treated as absent` };
  }
  return { inForce: localDate(at, timeZone) <= until, until, warning: null };
}
