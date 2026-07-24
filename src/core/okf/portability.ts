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
 * Determinism contract: the result is a pure function of the *set* of input
 * paths — never of input order (entries are processed in canonical sorted
 * order). Collisions are grouped case-insensitively on the sanitized full
 * path (Windows filesystems are case-insensitive, so `Foo.md` and `foo.md`
 * are one file there); every member of a colliding group gets a suffix
 * derived from a hash of its own original path.
 *
 * Suffixed candidates can themselves collide with a legitimate path that
 * already carries that exact name (implementation review, P1): final names
 * are claimed against a case-folded occupied set — unrenamed paths reserve
 * their names first, then renamed entries extend their hash suffix
 * deterministically until free — and uniqueness is asserted before return.
 */
export function buildPortableSourcePathMap(paths: string[]): Map<string, string> {
  const originals = [...new Set(paths)].sort();
  const sanitized = new Map<string, string>(
    originals.map((original) => [
      original,
      original.split('/').map(sanitizePortableSegment).join('/'),
    ]),
  );

  const groupSizes = new Map<string, number>();
  for (const portable of sanitized.values()) {
    const key = portable.toLowerCase();
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  const occupied = new Set<string>();
  const result = new Map<string, string>();

  // Pass 1: paths that keep their sanitized name (no group collision) claim
  // it unconditionally — a renamed entry must never displace an untouched one.
  const needsSuffix: string[] = [];
  for (const original of originals) {
    const portable = sanitized.get(original)!;
    if ((groupSizes.get(portable.toLowerCase()) ?? 0) > 1) {
      needsSuffix.push(original);
    } else {
      occupied.add(portable.toLowerCase());
      result.set(original, portable);
    }
  }

  // Pass 2: colliding entries take hash suffixes, extended deterministically
  // (longer hash slice, then a counter) until the name is free.
  for (const original of needsSuffix) {
    const base = sanitized.get(original)!;
    // sha256() returns "sha256-<hex>" — use the hex part.
    const hash = sha256(original).replace(/^sha256-/, '');
    let candidate = suffixPath(base, hash.slice(0, 8));
    for (let length = 12; occupied.has(candidate.toLowerCase()) && length <= hash.length; length += 4) {
      candidate = suffixPath(base, hash.slice(0, length));
    }
    for (let counter = 2; occupied.has(candidate.toLowerCase()); counter += 1) {
      candidate = suffixPath(base, `${hash}-${counter}`);
    }
    occupied.add(candidate.toLowerCase());
    result.set(original, candidate);
  }

  const distinct = new Set([...result.values()].map((value) => value.toLowerCase()));
  if (distinct.size !== result.size) {
    throw new Error('Portable path mapping produced duplicate targets — this is a bug.');
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
 * the whole set — including file-vs-directory conflicts, where one entry's
 * full path is another entry's directory prefix (Windows cannot hold a file
 * and a case-variant directory under the same name). Callers pass
 * posix-normalized paths.
 */
export function findPathPortabilityIssues(paths: string[]): PortabilityIssue[] {
  const lowerGroups = new Map<string, string[]>();
  const dirPrefixes = new Map<string, string>();
  for (const path of paths) {
    const key = path.toLowerCase();
    lowerGroups.set(key, [...(lowerGroups.get(key) ?? []), path]);
    const segments = path.split('/');
    for (let depth = 1; depth < segments.length; depth += 1) {
      const prefix = segments.slice(0, depth).join('/').toLowerCase();
      if (!dirPrefixes.has(prefix)) dirPrefixes.set(prefix, path);
    }
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
    const claimedAsDir = dirPrefixes.get(path.toLowerCase());
    if (claimedAsDir !== undefined) {
      problems.push(`is a file, but ${claimedAsDir} needs it as a directory (case-insensitive on Windows)`);
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
