import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Delta, Importance, NoteType, Relevance, Worth } from '../lib/protocol';

/**
 * Synthetic full vault for the compile-value harness (protocol §2, §13). Entirely
 * invented content. Built in code rather than committed as files because the policies
 * depend on mtimes, which git does not keep.
 *
 * Designed so the expected metrics can be worked out by hand (see tests):
 *   - 40 notes `note-NN` aged 1 + 9·NN days, plus three snapshots of one versioned spec
 *     (aged 400–420 days, so they sit at the bottom of every order). Queue = 43.
 *   - B0 (mtime): top 10 = note-00..09 with cook_next yes at 00, 03, 05, 08 → P@10 0.4;
 *     note-12 and note-15 are yes too → P@20 6/20 = 0.3.
 *   - B2 (1.6.0 Jev): scored-likely first by worth: 22 (Jev's top score, but already
 *     compiled: redundant, so cook_next no), 25, 28, 31, 34, 00, 03 (yes), then 30, 33,
 *     36 (no) → P@10 0.6; then unscored in mtime order 05..14 (yes at 05, 08, 12) →
 *     P@20 9/20 = 0.45; 01, 02, 04 (worth ≤ 0.2) last.
 *   - Actionable critical: note-03 (partial), note-25 (new), note-39 (new, blocked so
 *     cook_next no, ranked in every policy's bottom 20%). note-22 is critical but
 *     redundant, so not actionable.
 */

export const T0 = new Date('2026-10-01T04:00:00Z');
export const T0_ZONE = 'Asia/Shanghai';
const DAY_MS = 86_400_000;
const DIRS = ['Projects/svc', 'Meetings', 'Journal', 'Reference'];

export interface TruthLabel {
  worth: Worth;
  delta: Delta;
  relevance: Relevance;
  cookNext: boolean;
  type: NoteType;
  importance: Importance;
}

export interface SyntheticNote {
  path: string;
  ageDays: number;
  jevWorth: number | null;
  truth: TruthLabel;
}

const YES = new Set([0, 3, 5, 8, 12, 15, 25, 28, 31, 34]);
const JEV: Record<number, number> = { 22: 0.95, 25: 0.94, 28: 0.93, 31: 0.92, 34: 0.91, 0: 0.9, 3: 0.89, 30: 0.5, 33: 0.45, 36: 0.4, 1: 0.1, 2: 0.1, 4: 0.1 };

export function notePath(index: number): string {
  return `${DIRS[index % DIRS.length]}/note-${String(index).padStart(2, '0')}.md`;
}

function truthFor(index: number): TruthLabel {
  if (index === 22) return { worth: 'yes', delta: 'redundant', relevance: 'medium', cookNext: false, type: 'decision', importance: 'critical' };
  if (index === 39) return { worth: 'yes', delta: 'new', relevance: 'high', cookNext: false, type: 'requirement', importance: 'critical' };
  if (index === 3) return { worth: 'yes', delta: 'partial', relevance: 'high', cookNext: true, type: 'decision', importance: 'critical' };
  if (index === 25) return { worth: 'yes', delta: 'new', relevance: 'high', cookNext: true, type: 'decision', importance: 'critical' };
  if (YES.has(index)) return { worth: 'yes', delta: 'new', relevance: 'high', cookNext: true, type: 'decision', importance: 'normal' };
  return { worth: 'no', delta: 'n/a', relevance: 'low', cookNext: false, type: index % 2 === 0 ? 'journal' : 'meeting', importance: 'normal' };
}

export function syntheticNotes(): SyntheticNote[] {
  const notes: SyntheticNote[] = [];
  for (let index = 0; index < 40; index++) {
    notes.push({ path: notePath(index), ageDays: 1 + 9 * index, jevWorth: JEV[index] ?? null, truth: truthFor(index) });
  }
  ['2025-08-01', '2025-08-11', '2025-08-21'].forEach((date, offset) => {
    notes.push({
      path: `Specs/api spec ${date}.md`,
      ageDays: 420 - 10 * offset,
      jevWorth: null,
      truth: { worth: 'no', delta: 'n/a', relevance: 'low', cookNext: false, type: 'reference', importance: 'normal' },
    });
  });
  return notes;
}

export const COMPILED_SOURCE = 'Projects/svc/storage kickoff.md';

function write(root: string, path: string, content: string, mtimeMs: number): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
}

/** Writes the synthetic vault into `root` (an empty temp dir). Returns the notes for truth lookups. */
export function writeSyntheticVault(root: string): SyntheticNote[] {
  const t0 = T0.getTime();
  const notes = syntheticNotes();
  const mtimeOf = (ageDays: number) => Math.round(t0 - ageDays * DAY_MS);
  for (const note of notes) {
    const name = note.path.split('/').pop()?.replace(/\.md$/, '') ?? note.path;
    write(root, note.path, `# ${name}\n\nSynthetic note about the example service, written for the evaluation fixture.\n`, mtimeOf(note.ageDays));
  }
  write(root, COMPILED_SOURCE, '# Storage kickoff\n\nSynthetic source already compiled.\n', mtimeOf(500));
  write(root, 'concepts/example-storage.md', `---\ntitle: Example storage\ndescription: Synthetic compiled page.\nsources:\n  - "${COMPILED_SOURCE}"\n---\n# Example storage\n\nRetention is 30 days.\n`, mtimeOf(450));
  write(root, 'KNOWLEDGE.md', '# Knowledge\n\n## About This Knowledge Base\n\nSynthetic knowledge base about an example service.\n', mtimeOf(600));
  write(root, '.knowlery/focus.md', '---\nuntil: 2026-12-31\n---\n- example service storage\n', mtimeOf(10));
  const entries: Record<string, { mtimeMs: number; worth: number; target: null; scoredAt: string }> = {};
  for (const note of notes) {
    if (note.jevWorth !== null) entries[note.path] = { mtimeMs: mtimeOf(note.ageDays), worth: note.jevWorth, target: null, scoredAt: '2026-09-30T00:00:00.000Z' };
  }
  write(root, '.knowlery/triage.json', `${JSON.stringify({ schemaVersion: 1, model: 'jev-1.13.0', entries }, null, 2)}\n`, mtimeOf(1));
  return notes;
}
