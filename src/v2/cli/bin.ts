import { homedir } from 'node:os';
import { runCli } from './main';

void runCli(process.argv.slice(2), {
  stdout: (text) => { process.stdout.write(text); },
  stderr: (text) => { process.stderr.write(text); },
  cwd: process.cwd(),
  knowleryDir: process.env.KNOWLERY_DIR,
  pathEnv: process.env.PATH,
  homeDir: homedir(),
}).then((code) => { process.exitCode = code; });
