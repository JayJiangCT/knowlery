import { initKb, type InitResult } from '../../core/init';

export async function runInit(root: string): Promise<{ result: InitResult; text: string }> {
  const result = await initKb(root);
  const lines: string[] = [];
  for (const path of result.created) lines.push(`created\t${path}`);
  for (const path of result.kept) lines.push(`kept\t${path}`);
  if (result.agents_md === 'kept') {
    lines.push('', 'Add to AGENTS.md:');
    for (const line of result.agents_lines) lines.push(line);
  }
  return { result, text: `${lines.join('\n')}\n` };
}
