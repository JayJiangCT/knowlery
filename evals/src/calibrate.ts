import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { scanVault } from '../../src/core/query/scan';
import { runQuery } from '../../src/core/query/engine';
import type { GoldenCase } from './types';

/**
 * Calibration instrument for spec 0.8 f2, §4.1: prints the top candidates' confidence
 * signals for every golden question so the gate constants are chosen from data.
 * Dev tool — invoked manually via `npx tsx evals/src/calibrate.ts`, not part of CI.
 */

const EVALS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cases = parseYaml(readFileSync(join(EVALS_ROOT, 'golden', 'questions.yaml'), 'utf8')) as GoldenCase[];
const snapshot = scanVault(join(EVALS_ROOT, 'fixtures', 'vault'));

for (const goldenCase of cases) {
  const result = runQuery(goldenCase.question, snapshot, 10, { debug: true });
  const terms = result.terms;
  console.log(`\n${goldenCase.id} [${goldenCase.category}] ${goldenCase.question}`);
  console.log(`  terms(${terms.length}): ${terms.join(', ')} | verdict=${result.verdict}`);
  for (const candidate of (result.debugCandidates ?? []).slice(0, 3)) {
    const coverage = terms.length > 0 ? (candidate.matchedTerms.length / terms.length).toFixed(2) : '0';
    console.log(
      `    ${candidate.path}  score=${candidate.score.toFixed(1)} cov=${coverage} ` +
      `structTerms=${candidate.structuredTermCount} desc=${candidate.descriptionHits} ` +
      `body=${candidate.bodyScore} ev=${candidate.evidence.length} matched=[${candidate.matchedTerms.join(',')}]`,
    );
  }
}
