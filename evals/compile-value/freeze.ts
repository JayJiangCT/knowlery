import { parseArgs, required, runCli } from './lib/args';
import { freezeVault } from './lib/freeze';
import { loadQueue } from './lib/queue';

/**
 * Protocol §2 — freeze a vault for evaluation.
 *
 *   npx tsx evals/compile-value/freeze.ts --vault "/path/to/vault" --out "/outside/repo/freeze-2026-10"
 *
 * Copies every indexed page plus KNOWLEDGE.md, .knowlery/{config.json,triage.json,focus.md}
 * with original mtimes, verifies the source did not change during the copy (up to three
 * attempts), and writes manifest.json. The freeze id is sha256(manifest.json). Local only:
 * nothing leaves the machine.
 */

const USAGE = 'Usage: tsx evals/compile-value/freeze.ts --vault <dir> --out <dir outside the repo> [--time-zone <IANA zone>]';

runCli(() => {
  const args = parseArgs(process.argv.slice(2));
  const freeze = freezeVault(required(args, 'vault', USAGE), required(args, 'out', USAGE), {
    ...(args.get('time-zone') ? { timeZone: args.get('time-zone') } : {}),
  });
  const queue = loadQueue(freeze);
  console.log(`Froze ${freeze.manifest.files.length} files at ${freeze.manifest.frozenAt} (${freeze.manifest.timeZone}).`);
  console.log(`Uncooked queue: ${queue.notes.length} notes; 1.6.0 Jev scores: ${queue.hasJevScores ? 'present' : 'absent'}.`);
  console.log(`freezeId ${freeze.freezeId}`);
  console.log(`Next: tsx evals/compile-value/sample.ts --freeze "${freeze.dir}" --sheet <file> --private <file>`);
});
