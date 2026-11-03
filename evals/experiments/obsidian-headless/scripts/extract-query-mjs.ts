/**
 * Writes the shipped query.mjs from the repo's committed bundle (src/assets/query-script.generated.ts)
 * at a git ref. The benchmark's group A ran the build with sha256 prefix e07dfb0ae4ad, which equals the
 * bundle at tag 1.6.2 (and at develop/2.0 @ 973127f).
 *
 * Usage: npx tsx evals/experiments/obsidian-headless/scripts/extract-query-mjs.ts <ref> <out.mjs>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [ref = '1.6.2', out = 'query.mjs'] = process.argv.slice(2);
const marker = 'export const QUERY_SCRIPT: string = ';
const text = execFileSync('git', ['show', `${ref}:src/assets/query-script.generated.ts`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const start = text.indexOf(marker) + marker.length;
const code = JSON.parse(text.slice(start, text.lastIndexOf(';'))) as string;
writeFileSync(out, code);
console.log(`${out} sha256=${createHash('sha256').update(code).digest('hex')}`);
