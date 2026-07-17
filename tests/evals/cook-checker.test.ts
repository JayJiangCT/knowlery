import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { scanVault } from '../../src/core/query/scan';
import { checkCookCase, extractTaxonomyTokens, type LoadedCookCase } from '../../evals/src/cook/checker';
import { loadCase, runCookEval, compareToBaseline, type CookEvalReport } from '../../evals/src/cook/run';

/**
 * Spec 1.3 f2, §5: the checker is tested before it judges anything — one
 * violation fixture per invariant must be flagged, the committed references
 * must pass, and the machinery (purity, baseline, report shape) is pinned.
 */

/** Build a minimal in-memory-backed case on disk and load it. */
function buildCase(mutate: (root: string) => void): LoadedCookCase {
  const root = mkdtempSync(join(tmpdir(), 'cook-violation-'));
  const cooked = join(root, 'cooked');
  mkdirSync(join(cooked, 'concepts'), { recursive: true });
  mkdirSync(join(cooked, 'Projects'), { recursive: true });
  writeFileSync(join(cooked, 'SCHEMA.md'), '# SCHEMA\n\n## Tag Taxonomy\n\n- `alpha`\n\n## Domain Taxonomy\n\n- `ops`\n');
  writeFileSync(join(cooked, 'Projects', 'note.md'), '---\ntitle: Source Note\n---\n\nRaw thinking about widgets.\n');
  writeFileSync(join(cooked, 'concepts', 'good.md'),
    '---\ntitle: Widget Policy\ntype: concept\ncreated: 2026-07-01\ndescription: The widget rollout policy\ntags: [alpha]\ndomain: ops\nsources:\n  - Projects/note.md\n---\n\nPolicy body. See [[Second Page]].\n');
  writeFileSync(join(cooked, 'concepts', 'second.md'),
    '---\ntitle: Second Page\ntype: concept\ncreated: 2026-07-01\ndescription: Companion page for linking\ntags: [alpha]\ndomain: ops\nsources:\n  - Projects/note.md\n---\n\nLinks back to [[Widget Policy]].\n');
  mutate(cooked);

  const files = new Map<string, string>();
  const walk = (dir: string, base: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, base);
      else files.set(full.slice(base.length + 1).split('\\').join('/'), readFileSync(full, 'utf8'));
    }
  };
  walk(cooked, cooked);

  const loaded: LoadedCookCase = {
    name: 'violation',
    snapshot: scanVault(cooked),
    files,
    material: new Map([['Projects/note.md', '---\ntitle: Source Note\n---\n\nRaw thinking about widgets.\n']]),
    expectations: { mustNotCompile: [] },
  };
  rmSync(root, { recursive: true, force: true });
  return loaded;
}

describe('each invariant has a violation it flags (§5.2)', () => {
  it('healthy synthetic case passes everything', () => {
    const report = checkCookCase(buildCase(() => { /* no mutation */ }));
    expect(Object.values(report.metrics).every((value) => value === 1)).toBe(true);
    expect(Object.values(report.booleans).every(Boolean)).toBe(true);
  });

  it('missing sources → citation-coverage finding', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'good.md'),
        '---\ntitle: Widget Policy\ntype: concept\ncreated: 2026-07-01\ndescription: The widget rollout policy\ntags: [alpha]\ndomain: ops\n---\n\nNo sources. See [[Second Page]].\n');
    }));
    expect(report.metrics.citationCoverage).toBeLessThan(1);
    expect(report.findings.some((finding) => finding.invariant === 'citation-coverage')).toBe(true);
  });

  it('dangling source → citations-resolve hard fail', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'good.md'),
        '---\ntitle: Widget Policy\ntype: concept\ncreated: 2026-07-01\ndescription: The widget rollout policy\ntags: [alpha]\ndomain: ops\nsources:\n  - Projects/deleted.md\n---\n\nSee [[Second Page]].\n');
    }));
    expect(report.booleans.citationsResolve).toBe(false);
  });

  it('unfindable page → retrievability finding', () => {
    // A page is essentially always findable by its own exact title (the
    // structured self-match the spec's §4.1.2 predicts) — the violation
    // shape is a title whose tokenization is empty: probes yield no terms,
    // the engine abstains, the page cannot be reached by its own framing.
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'opaque.md'),
        '---\ntitle: "?!…"\ntype: concept\ncreated: 2026-07-01\ndescription: "——"\ntags: [alpha]\ndomain: ops\nsources:\n  - Projects/note.md\n---\n\nBody. [[Widget Policy]]\n');
    }));
    expect(report.metrics.retrievability).toBeLessThan(1);
    expect(report.findings.some((finding) => finding.invariant === 'retrievability')).toBe(true);
  });

  it('missing frontmatter → frontmatter finding', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'bare.md'),
        '---\ntitle: Bare Page\ntags: [alpha]\nsources:\n  - Projects/note.md\n---\n\nMissing type/created/description. [[Widget Policy]]\n');
    }));
    expect(report.metrics.frontmatterCompleteness).toBeLessThan(1);
  });

  it('rogue tag → taxonomy finding; case-variant → near-duplicate finding', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'second.md'),
        '---\ntitle: Second Page\ntype: concept\ncreated: 2026-07-01\ndescription: Companion page\ntags: [Alpha, rogue-tag]\ndomain: ops\nsources:\n  - Projects/note.md\n---\n\n[[Widget Policy]]\n');
    }));
    expect(report.metrics.taxonomyCompliance).toBeLessThan(1);
    expect(report.findings.some((finding) => finding.invariant === 'taxonomy' && finding.detail.includes('rogue-tag'))).toBe(true);
    expect(report.findings.some((finding) => finding.invariant === 'taxonomy-near-duplicate')).toBe(true);
  });

  it('orphan compiled page → connectivity finding', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'concepts', 'island.md'),
        '---\ntitle: Island Widget Notes\ntype: concept\ncreated: 2026-07-01\ndescription: Widget island with no links\ntags: [alpha]\ndomain: ops\nsources:\n  - Projects/note.md\n---\n\nNo wikilinks at all.\n');
    }));
    expect(report.metrics.connectivity).toBeLessThan(1);
  });

  it('rewritten user material → material-untouched hard fail', () => {
    const report = checkCookCase(buildCase((root) => {
      writeFileSync(join(root, 'Projects', 'note.md'), '---\ntitle: Source Note\n---\n\nEDITED by a misbehaving cook.\n');
    }));
    expect(report.booleans.materialUntouched).toBe(false);
  });

  it('compiled decoy → restraint hard fail', () => {
    const loaded = buildCase(() => { /* healthy tree */ });
    loaded.expectations.mustNotCompile = ['Projects/note.md']; // both pages cite it
    const report = checkCookCase(loaded);
    expect(report.booleans.decoysRespected).toBe(false);
    expect(report.findings.some((finding) => finding.invariant === 'restraint')).toBe(true);
  });
});

describe('machinery (§5.1, §5.3, §5.5)', () => {
  it('determinism: same loaded case → identical report', () => {
    const loaded = loadCase('greenfield');
    expect(checkCookCase(loaded)).toEqual(checkCookCase(loaded));
  });

  it('purity: the checker imports no obsidian module', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'evals', 'src', 'cook', 'checker.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]obsidian['"]/);
  });

  it('the committed references pass all floors; report shape is stable', () => {
    const report = runCookEval();
    expect(report.suite).toBe('cook');
    expect(report.disclaimer).toContain('necessary, not sufficient');
    expect(report.cases.map((entry) => entry.case)).toEqual(['collision', 'greenfield', 'incremental']);
    for (const caseReport of report.cases) {
      expect(Object.keys(caseReport.metrics).sort()).toEqual(
        ['citationCoverage', 'connectivity', 'frontmatterCompleteness', 'retrievability', 'taxonomyCompliance'],
      );
      expect(Object.values(caseReport.booleans).every(Boolean), caseReport.case).toBe(true);
    }

    const baseline = JSON.parse(readFileSync(join(__dirname, '..', '..', 'evals', 'cook', 'baseline.json'), 'utf8')) as Parameters<typeof compareToBaseline>[1];
    expect(compareToBaseline(report, baseline)).toEqual([]);
  });

  it('baseline mechanics: a below-floor metric and a false boolean both fail with named causes', () => {
    const report = runCookEval();
    const doctored: CookEvalReport = JSON.parse(JSON.stringify(report)) as CookEvalReport;
    doctored.cases[0].metrics.citationCoverage = 0.5;
    doctored.cases[1].booleans.materialUntouched = false;
    const baseline = JSON.parse(readFileSync(join(__dirname, '..', '..', 'evals', 'cook', 'baseline.json'), 'utf8')) as Parameters<typeof compareToBaseline>[1];
    const failures = compareToBaseline(doctored, baseline);
    expect(failures.some((failure) => failure.includes('citationCoverage'))).toBe(true);
    expect(failures.some((failure) => failure.includes('materialUntouched'))).toBe(true);
  });
});

describe('taxonomy token extraction', () => {
  it('reads list items and inline code under taxonomy headings only', () => {
    const tokens = extractTaxonomyTokens('# S\n\n## Tag Taxonomy\n\n- `a-b`\n- plain\n\n## Other\n\n- `not-this`\n\n## Domain Taxonomy\n\n- ops\n');
    expect(tokens.has('a-b')).toBe(true);
    expect(tokens.has('plain')).toBe(true);
    expect(tokens.has('ops')).toBe(true);
    expect(tokens.has('not-this')).toBe(false);
  });
});
