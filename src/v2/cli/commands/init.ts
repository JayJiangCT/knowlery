import type { GitCheckIgnoreRunner } from '../../core/git';
import { initKb, type InitResult } from '../../core/init';
import type { ParsedArgs } from '../args';

export async function runInit(
  root: string,
  args: Pick<ParsedArgs, 'skillsDir'> = {},
  options: { runGitCheckIgnore?: GitCheckIgnoreRunner } = {},
): Promise<{ result: InitResult; text: string }> {
  const result = await initKb(root, { skillsDir: args.skillsDir, runGitCheckIgnore: options.runGitCheckIgnore });
  const lines: string[] = [];
  for (const path of result.created) lines.push(`created\t${path}`);
  for (const path of result.kept) lines.push(`kept\t${path}`);
  if (result.agents_lines.length > 0) {
    lines.push('', 'Add to AGENTS.md:');
    for (const line of result.agents_lines) lines.push(line);
  }
  if (result.claude_line) {
    lines.push('', 'Add to CLAUDE.md:', result.claude_line);
  }
  if (result.gemini_line) {
    lines.push('', 'Add to GEMINI.md:', result.gemini_line);
  }
  if (result.warning) {
    lines.push(result.warning);
  }
  return { result, text: `${lines.join('\n')}\n` };
}
