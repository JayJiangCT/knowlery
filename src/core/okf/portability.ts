import { sha256 } from './hash';

/**
 * Cross-platform path portability (field finding: a macOS-exported bundle
 * carrying `_sources/... Wonder | Food On Demand.md` failed to install on
 * Windows with a raw ENOENT — `|` is a Windows-reserved character).
 *
 * Two halves, deliberately separated from policy:
 * - the export side builds a stable `{ originalPath → bundlePath }` map so
 *   bundles are portable by construction (compile.ts threads the map through
 *   files, wikilinks, indexes, and the manifest hash in one pass);
 * - the install side *detects* and reports issues on every platform; the
 *   caller decides whether to block (Windows) or warn (elsewhere).
 *
 * Windows filename rules covered: reserved characters `< > : " | ? *` and
 * control characters; trailing dots/spaces (stripped or rejected by Win32);
 * reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9 — with or
 * without an extension); and case-insensitive path collisions.
 */

const INVALID_CHARS = /[<>:"|?*\u0000-\u001f]/;
const INVALID_CHARS_ALL = /[<>:"|?*\u0000-\u001f]/g;
const TRAILING_DOTS_SPACES = /[. ]+$/;
const RESERVED_DEVICE_STEM = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export interface PortabilityIssue {
  /** The offending entry path (or a labeled bundle id) as found in the bundle. */
  path: string;
  problems: string[];
}

/** One path segment made Windows-safe. Deterministic and input-only. */
export function sanitizePortableSegment(segment: string): string {
  let out = segment.replace(INVALID_CHARS_ALL, '-');
  out = out.replace(TRAILING_DOTS_SPACES, '');
  if (!out) return '_';
  if (RESERVED_DEVICE_STEM.test(out.split('.')[0])) out = `_${out}`;
  return out;
}

/**
 * Stable `{ originalPath → portablePath }` map for bundle source files.
 *
 * Determinism contract: the portable path of an entry depends only on its
 * own original path and the *set* of paths it collides with — never on
 * input order. Collisions are grouped case-insensitively on the sanitized
 * full path (Windows filesystems are case-insensitive, so `Foo.md` and
 * `foo.md` are one file there); every member of a colliding group gets a
 * suffix derived from a hash of its own original path.
 */
export function buildPortableSourcePathMap(paths: string[]): Map<string, string> {
  const originals = [...new Set(paths)];
  const sanitized = new Map<string, string>(
    originals.map((original) => [
      original,
      original.split('/').map(sanitizePortableSegment).join('/'),
    ]),
  );

  const groups = new Map<string, string[]>();
  for (const [original, portable] of sanitized) {
    const key = portable.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), original]);
  }

  const result = new Map<string, string>();
  for (const members of groups.values()) {
    for (const original of members) {
      const portable = sanitized.get(original)!;
      result.set(
        original,
        // sha256() returns "sha256-<hex>" — take the first 8 hex chars.
        members.length > 1 ? suffixPath(portable, sha256(original).replace(/^sha256-/, '').slice(0, 8)) : portable,
      );
    }
  }
  return result;
}

function suffixPath(path: string, suffix: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const base = slash === -1 ? path : path.slice(slash + 1);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  return `${dir}${stem}-${suffix}${ext}`;
}

/**
 * Detection only — no platform policy. Scans every path (all entries, not
 * just `.md`) segment by segment, plus case-insensitive collisions across
 * the whole set. Callers pass posix-normalized paths.
 */
export function findPathPortabilityIssues(paths: string[]): PortabilityIssue[] {
  const lowerGroups = new Map<string, string[]>();
  for (const path of paths) {
    const key = path.toLowerCase();
    lowerGroups.set(key, [...(lowerGroups.get(key) ?? []), path]);
  }

  const issues: PortabilityIssue[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    const problems = segmentProblems(path.split('/'));
    const twins = (lowerGroups.get(path.toLowerCase()) ?? []).filter((twin) => twin !== path);
    if (twins.length > 0) {
      problems.push(`collides case-insensitively with ${[...new Set(twins)].join(', ')}`);
    }
    if (problems.length > 0) issues.push({ path, problems });
  }
  return issues;
}

/** Bundle ids become `Library/<id>` on disk — same rules, minus slashes (already forbidden). */
export function findBundleIdPortabilityProblems(id: string): string[] {
  return segmentProblems([id]);
}

function segmentProblems(segments: string[]): string[] {
  const problems: string[] = [];
  for (const segment of segments) {
    if (INVALID_CHARS.test(segment)) {
      problems.push(`"${segment}" contains characters Windows forbids (< > : " | ? * or control characters)`);
    }
    if (TRAILING_DOTS_SPACES.test(segment)) {
      problems.push(`"${segment}" ends with a dot or space, which Windows strips or rejects`);
    }
    if (RESERVED_DEVICE_STEM.test(segment.replace(TRAILING_DOTS_SPACES, '').split('.')[0])) {
      problems.push(`"${segment}" is a reserved Windows device name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)`);
    }
  }
  return problems;
}
