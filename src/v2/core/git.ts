import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WIKI_DIR } from './paths';

const execFileAsync = promisify(execFile);
const GIT_CHECK_IGNORE_TIMEOUT_MS = 5000;

export type GitIgnoreState = 'ignored' | 'not_ignored' | 'no_repo';

export interface GitCheckIgnoreOutput {
  exitCode: number | null;
  stdout: string;
}

export type GitCheckIgnoreRunner = (root: string, targetPath: string) => Promise<GitCheckIgnoreOutput>;

export interface GitWikiIgnoreStatus {
  state: GitIgnoreState;
  rule: string | null;
  warning: string | null;
}

export async function defaultRunGitCheckIgnore(root: string, targetPath: string): Promise<GitCheckIgnoreOutput> {
  try {
    const { stdout } = await execFileAsync('git', ['check-ignore', '-v', '--', targetPath], {
      cwd: root,
      timeout: GIT_CHECK_IGNORE_TIMEOUT_MS,
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    if (error && typeof error === 'object') {
      const err = error as { code?: unknown; killed?: unknown; stdout?: unknown };
      if (typeof err.code === 'number' && !err.killed) {
        return {
          exitCode: err.code,
          stdout: typeof err.stdout === 'string' ? err.stdout : '',
        };
      }
    }
    return { exitCode: null, stdout: '' };
  }
}

export async function checkGitWikiIgnore(
  root: string,
  runner: GitCheckIgnoreRunner = defaultRunGitCheckIgnore,
): Promise<GitWikiIgnoreStatus> {
  let output: GitCheckIgnoreOutput;
  try {
    output = await runner(root, `${WIKI_DIR}/CONVENTIONS.md`);
  } catch {
    return { state: 'no_repo', rule: null, warning: null };
  }

  if (output.exitCode === 0) {
    const firstLine = output.stdout.replace(/\r\n/g, '\n').split('\n')[0] ?? '';
    const tabIdx = firstLine.indexOf('\t');
    const rule = (tabIdx === -1 ? firstLine : firstLine.slice(0, tabIdx)).trim();
    const warning = `warning: git ignores ${WIKI_DIR}/ (${rule}), so commits will not contain the wiki. Ignore only .knowlery/cache/ instead. Knowlery does not change ignore files.`;
    return { state: 'ignored', rule, warning };
  }

  if (output.exitCode === 1) {
    return { state: 'not_ignored', rule: null, warning: null };
  }

  return { state: 'no_repo', rule: null, warning: null };
}
