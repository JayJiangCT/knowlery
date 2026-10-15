import { integer, parseArgs, required, runCli } from './lib/args';
import { loadFreeze } from './lib/freeze';
import { availablePolicies, policiesFor } from './lib/policies';
import { buildPool } from './lib/pool';
import { readPrivate, writePrivate } from './lib/private';
import { loadQueue } from './lib/queue';
import { readSheet, writeSheet } from './lib/sheet';

/**
 * Protocol §5 — run every available policy over the full frozen queue, add the union
 * of their top 20 (and an optional random probe of ranks 21–50) to the blind sheet.
 * Run it right after sample.ts, before labelling, so pooled notes are indistinguishable.
 *
 *   npx tsx evals/compile-value/pool.ts --freeze <dir> --sheet <sheet.yaml> --private <private.json> [--probe 10]
 */

const USAGE = 'Usage: tsx evals/compile-value/pool.ts --freeze <dir> --sheet <file> --private <file> [--probe n]';

runCli(() => {
  const args = parseArgs(process.argv.slice(2));
  const sheetPath = required(args, 'sheet', USAGE);
  const privatePath = required(args, 'private', USAGE);
  const freeze = loadFreeze(required(args, 'freeze', USAGE), { verify: true });
  const privateFile = readPrivate(privatePath);
  if (privateFile.freezeId !== freeze.freezeId) throw new Error('The private file belongs to a different freeze');
  const policies = policiesFor(loadQueue(freeze));
  for (const policy of policies) {
    console.log(policy.available ? `${policy.id}: available` : `${policy.id}: not available — missing ${policy.missing.join('; ')}`);
  }
  const result = buildPool(readSheet(sheetPath), privateFile, availablePolicies(policies), {
    seed: privateFile.seed,
    probePerPolicy: integer(args, 'probe', 0),
  });
  writeSheet(sheetPath, result.sheet);
  writePrivate(privatePath, result.privateFile);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  console.log(`Added ${result.added.length} pooled notes; sheet now has ${result.sheet.notes.length}.`);
});
