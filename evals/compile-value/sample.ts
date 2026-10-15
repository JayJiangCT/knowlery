import { existsSync, readFileSync } from 'node:fs';
import { integer, parseArgs, required, runCli } from './lib/args';
import { assertOutsideRepo, loadFreeze } from './lib/freeze';
import { writePrivate } from './lib/private';
import { DEFAULT_FLOOR, DEFAULT_SAMPLE_SIZE } from './lib/protocol';
import { loadQueue } from './lib/queue';
import { drawSample } from './lib/sample';
import { writeSheet } from './lib/sheet';

/**
 * Protocol §3–§4 — draw the diagnostic sample and write the blind sheet plus the
 * private harness file.
 *
 *   npx tsx evals/compile-value/sample.ts --freeze <freeze dir> --sheet <sheet.yaml> --private <private.json> \
 *     [--size 80] [--floor 15] [--seed <n>] [--seeded <file: one path per line>] [--no-jev-strata]
 *
 * --seeded: the up-to-10 notes you nominated, BEFORE sampling, as critical knowledge not
 * yet compiled. They are mixed into the sheet indistinguishably and reported individually.
 * Both outputs hold real paths: keep them outside the repository.
 */

const USAGE = 'Usage: tsx evals/compile-value/sample.ts --freeze <dir> --sheet <file> --private <file> [--size n] [--floor n] [--seed n] [--seeded <file>] [--no-jev-strata]';

runCli(() => {
  const args = parseArgs(process.argv.slice(2), ['no-jev-strata']);
  const sheetPath = required(args, 'sheet', USAGE);
  const privatePath = required(args, 'private', USAGE);
  for (const [path, what] of [[sheetPath, 'The sheet'], [privatePath, 'The private file']] as const) {
    assertOutsideRepo(path, what);
    if (existsSync(path)) throw new Error(`${path} exists; refusing to overwrite a sheet or private file`);
  }
  const freeze = loadFreeze(required(args, 'freeze', USAGE), { verify: true });
  const queue = loadQueue(freeze);
  const seededFile = args.get('seeded');
  const seeded = seededFile
    ? readFileSync(seededFile, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
    : [];
  const result = drawSample(freeze, queue, {
    size: integer(args, 'size', DEFAULT_SAMPLE_SIZE),
    floor: integer(args, 'floor', DEFAULT_FLOOR),
    seed: integer(args, 'seed', parseInt(freeze.freezeId.slice(0, 8), 16)),
    seeded,
    ...(args.has('no-jev-strata') ? { useJevStrata: false } : {}),
  });
  writeSheet(sheetPath, result.sheet);
  writePrivate(privatePath, result.privateFile);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  console.log(`Sheet: ${result.sheet.notes.length} notes → ${sheetPath}`);
  console.log(`Private harness file → ${privatePath} (do not open while annotating)`);
  console.log('Next: pool.ts adds the operational pool before you start labelling.');
});
