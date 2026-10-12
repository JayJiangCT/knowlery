import { readFileSync, writeFileSync } from 'node:fs';
import { Document, parse as parseYaml } from 'yaml';
import {
  DELTA, IMPORTANCE, NOTE_TYPES, PASSES, PROTOCOL, PROTOCOL_REVISION, REASON_CODES, RELEVANCE, SESSION_SIZE, WORTH, YES_NO,
  type Delta, type Importance, type NoteType, type Pass, type ReasonCode, type Relevance, type Worth,
} from './protocol';

/**
 * The blind annotation sheet (protocol §3, §6; template: evals/compile-value/
 * annotation-template.yaml). It carries ids, paths and the annotator's labels only —
 * never scores, ranks, tiers, strata, inclusion probabilities or seeded flags.
 */

export interface SheetHeader {
  protocol: string;
  protocol_revision: number;
  freeze_id: string;
  frozen_at: string;
  frozen_tz: string;
  focus_sources: string[];
  session_size: number;
  annotator: string;
  pass: Pass;
  sheet_seed: number;
}

export interface SheetNote {
  id: string;
  path: string;
  worth: Worth | null;
  delta: Delta | null;
  delta_evidence: { pages: string[]; how_checked: string | null };
  relevance: Relevance | null;
  cook_next: 'yes' | 'no' | null;
  cook_next_reason: { code: ReasonCode; why: string } | null;
  depends_on: string[];
  compile_with: string[];
  type: NoteType | null;
  importance: Importance | null;
  actionable_critical: 'yes' | 'no' | null;
  target: string | null;
  minutes_spent: number | null;
  notes: string | null;
}

export interface Sheet {
  header: SheetHeader;
  notes: SheetNote[];
  selected_next: string[];
}

/** The only keys a sheet entry may carry; the blindness test pins this list. */
export const SHEET_NOTE_KEYS: ReadonlyArray<keyof SheetNote> = [
  'id', 'path', 'worth', 'delta', 'delta_evidence', 'relevance', 'cook_next', 'cook_next_reason', 'depends_on',
  'compile_with', 'type', 'importance', 'actionable_critical', 'target', 'minutes_spent', 'notes',
];

export function blankNote(id: string, path: string): SheetNote {
  return {
    id, path, worth: null, delta: null, delta_evidence: { pages: [], how_checked: null }, relevance: null, cook_next: null,
    cook_next_reason: null, depends_on: [], compile_with: [], type: null, importance: null, actionable_critical: null,
    target: null, minutes_spent: null, notes: null,
  };
}

export function isLabelled(note: SheetNote): boolean {
  return note.worth !== null || note.cook_next !== null || note.delta !== null;
}

const RULES = `Compile-value annotation sheet — protocol ${PROTOCOL}, revision ${PROTOCOL_REVISION}
(docs/design/compile-value/evaluation-protocol.md; worked example: evals/compile-value/annotation-template.yaml)

REAL DATA. Keep this file outside the repository; never commit it.

Rules:
  - Do not look at Jev scores, signal values, orderings, or the private harness file.
  - Judge against the FROZEN copy (<freeze>/vault), and the focus in force at frozen_at in frozen_tz.
  - Read each note in full. "redundant" needs the compiled page's CONTENT checked.
  - Step 1: label every note. Step 2: only then fill selected_next (at most session_size ids, in priority order).

Values:
  worth: yes | no | unsure
  delta: new | partial | redundant | unknown | n/a   (n/a only when worth is no)
  relevance: high | medium | low | unknown
  cook_next: yes | no — yes only if all four criteria of protocol §6.4.1 hold
  cook_next_reason (required when yes): { code: new-decision | updates-page | focus-gap | unblocks | time-sensitive | other, why: "<one sentence>" }
  depends_on / compile_with: lists of paths
  type: decision | requirement | ticket | meeting | journal | reference | draft | template | generated | other
  importance: critical | normal
  actionable_critical: fill (yes | no) ONLY when importance is critical and delta is unknown; otherwise leave ~
  target, minutes_spent, notes: optional`;

export function serializeSheet(sheet: Sheet): string {
  const doc = new Document(sheet);
  doc.commentBefore = RULES.split('\n').map((line) => (line ? ` ${line}` : '')).join('\n');
  return doc.toString({ lineWidth: 0, nullStr: '~' });
}

export function writeSheet(path: string, sheet: Sheet): void {
  writeFileSync(path, serializeSheet(sheet));
}

export function readSheet(path: string): Sheet {
  const data = parseYaml(readFileSync(path, 'utf8')) as Partial<Sheet> | null;
  if (!data || typeof data !== 'object' || !data.header || !Array.isArray(data.notes)) {
    throw new Error(`${path} is not an annotation sheet (needs header and notes)`);
  }
  return {
    header: data.header,
    notes: data.notes.map((note) => ({ ...blankNote(note.id, note.path), ...note })),
    selected_next: Array.isArray(data.selected_next) ? data.selected_next : [],
  };
}

/** A complete, validated label. */
export interface Label {
  id: string;
  path: string;
  worth: Worth;
  delta: Delta;
  relevance: Relevance;
  cookNext: boolean;
  reason: { code: ReasonCode; why: string } | null;
  dependsOn: string[];
  compileWith: string[];
  type: NoteType;
  importance: Importance;
  /** critical ∧ delta ∈ {new, partial}; explicit when delta is unknown (§6.6). */
  actionableCritical: boolean;
}

export interface ValidatedSheet {
  labels: Map<string, Label>;
  /** Ids with no labels at all. */
  unlabelled: string[];
  selectedNext: string[];
  errors: string[];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null;
}

export function validateSheet(sheet: Sheet): ValidatedSheet {
  const errors: string[] = [];
  const labels = new Map<string, Label>();
  const unlabelled: string[] = [];
  const seen = new Set<string>();
  if (!oneOf(sheet.header.pass, PASSES)) errors.push(`header.pass must be one of ${PASSES.join(', ')}`);

  for (const note of sheet.notes) {
    const where = `${note.id} (${note.path})`;
    if (seen.has(note.id)) errors.push(`${where}: duplicate id`);
    seen.add(note.id);
    if (!isLabelled(note)) {
      unlabelled.push(note.id);
      continue;
    }
    const problems: string[] = [];
    if (!oneOf(note.worth, WORTH)) problems.push(`worth must be ${WORTH.join(' | ')}`);
    if (!oneOf(note.delta, DELTA)) problems.push(`delta must be ${DELTA.join(' | ')}`);
    if (note.delta === 'n/a' && note.worth !== 'no') problems.push('delta n/a is only allowed when worth is no');
    if (!oneOf(note.relevance, RELEVANCE)) problems.push(`relevance must be ${RELEVANCE.join(' | ')}`);
    if (!oneOf(note.cook_next, YES_NO)) problems.push('cook_next must be yes | no');
    if (note.cook_next === 'yes') {
      const reason = note.cook_next_reason;
      if (!reason || !oneOf(reason.code, REASON_CODES) || typeof reason.why !== 'string' || reason.why.trim() === '') {
        problems.push(`cook_next yes needs cook_next_reason { code: ${REASON_CODES.join(' | ')}, why: "<sentence>" }`);
      }
    }
    const dependsOn = stringList(note.depends_on);
    const compileWith = stringList(note.compile_with);
    if (!dependsOn) problems.push('depends_on must be a list of paths');
    if (!compileWith) problems.push('compile_with must be a list of paths');
    if (!oneOf(note.type, NOTE_TYPES)) problems.push(`type must be ${NOTE_TYPES.join(' | ')}`);
    if (!oneOf(note.importance, IMPORTANCE)) problems.push('importance must be critical | normal');

    let actionableCritical = false;
    if (note.importance === 'critical' && note.delta === 'unknown') {
      if (!oneOf(note.actionable_critical, YES_NO)) problems.push('critical with delta unknown: actionable_critical must be stated (yes | no)');
      actionableCritical = note.actionable_critical === 'yes';
    } else {
      const derived = note.importance === 'critical' && (note.delta === 'new' || note.delta === 'partial');
      if (note.actionable_critical !== null && note.actionable_critical !== (derived ? 'yes' : 'no')) {
        problems.push(`actionable_critical contradicts its derivation (critical ∧ delta ∈ {new, partial} = ${derived ? 'yes' : 'no'}); leave it ~`);
      }
      actionableCritical = derived;
    }

    if (problems.length > 0) {
      for (const problem of problems) errors.push(`${where}: ${problem}`);
      continue;
    }
    labels.set(note.id, {
      id: note.id,
      path: note.path,
      worth: note.worth as Worth,
      delta: note.delta as Delta,
      relevance: note.relevance as Relevance,
      cookNext: note.cook_next === 'yes',
      reason: note.cook_next === 'yes' ? note.cook_next_reason : null,
      dependsOn: dependsOn ?? [],
      compileWith: compileWith ?? [],
      type: note.type as NoteType,
      importance: note.importance as Importance,
      actionableCritical,
    });
  }

  const sessionSize = typeof sheet.header.session_size === 'number' ? sheet.header.session_size : SESSION_SIZE;
  const selected = sheet.selected_next;
  if (selected.length > sessionSize) errors.push(`selected_next lists ${selected.length} notes; the session holds at most ${sessionSize}`);
  if (new Set(selected).size !== selected.length) errors.push('selected_next lists an id twice');
  for (const id of selected) {
    const label = labels.get(id);
    if (!seen.has(id)) errors.push(`selected_next: ${id} is not on the sheet`);
    else if (label && !label.cookNext) errors.push(`selected_next: ${id} is not cook_next: yes`);
  }
  return { labels, unlabelled, selectedNext: [...selected], errors };
}
