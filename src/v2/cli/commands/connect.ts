import {
  connectHarness,
  inspectConnect,
  type ConnectApplyResult,
  type ConnectEnv,
  type ConnectListResult,
  type HarnessDetails,
  type HarnessStatus,
} from '../../core/connect';
import type { ParsedArgs } from '../args';

function formatDetailNotes(status: HarnessStatus, details: HarnessDetails): string {
  const parts: string[] = [];
  if (details.missingEntryFiles.length > 0) {
    parts.push(`missing: ${details.missingEntryFiles.join(', ')}`);
  }
  if (details.incompleteEntryFiles.length > 0) {
    parts.push(`incomplete: ${details.incompleteEntryFiles.join(', ')}`);
  }
  if (details.missingSkillCount > 0) {
    const noun = details.missingSkillCount === 1 ? 'Skill' : 'Skills';
    parts.push(`missing: ${details.missingSkillCount} ${noun} in ${status.skills_dir}`);
  }
  if (details.outdatedSkillCount > 0) {
    const noun = details.outdatedSkillCount === 1 ? 'Skill' : 'Skills';
    parts.push(`outdated: ${details.outdatedSkillCount} ${noun} in ${status.skills_dir}`);
  }
  return parts.join('; ');
}

function formatHarnessRow(status: HarnessStatus, details: HarnessDetails): string {
  const cols = [
    status.id,
    status.name,
    status.found ? 'found' : 'not found',
    status.ready ? 'ready' : 'not connected',
    `mcp: ${status.mcp}`,
  ];
  const notes = formatDetailNotes(status, details);
  if (notes) cols.push(notes);
  return cols.join('\t');
}

export async function runConnect(
  root: string,
  args: Pick<ParsedArgs, 'harness' | 'mcp'>,
  env: ConnectEnv = {},
): Promise<{ result: ConnectListResult | ConnectApplyResult; text: string }> {
  if (args.harness === undefined) {
    const { result, details } = await inspectConnect(root, env);
    const lines: string[] = [
      `connect  root: ${result.root}  knowlery command: ${result.knowlery_on_path ? 'on PATH' : 'not on PATH'}`,
    ];
    if (!result.knowlery_on_path) {
      lines.push('warning: the Skills and MCP entries run "knowlery"; put the command on PATH.');
    }
    for (const status of result.harnesses) {
      lines.push(formatHarnessRow(status, details[status.id]));
    }
    const anyFound = result.harnesses.some((h) => h.found);
    if (!anyFound) {
      lines.push('No agent client was found on this machine. knowlery connect <id> works all the same.');
    } else {
      for (const status of result.harnesses) {
        if (status.found && !status.ready) {
          lines.push(`next: knowlery connect ${status.id}`);
        }
      }
    }
    lines.push('MCP is optional for these clients. Add --mcp to write a project MCP entry: knowlery connect <id> --mcp');
    return { result, text: `${lines.join('\n')}\n` };
  }

  const report = await connectHarness(root, args.harness, { mcp: args.mcp, env });
  const { result, details, outdatedSkills, mcpHint } = report;
  const lines: string[] = [];

  for (const path of result.created) lines.push(`created\t${path}`);
  for (const path of result.kept) lines.push(`kept\t${path}`);

  for (const hint of result.hints) {
    if (mcpHint && hint.file === result.harness.mcp_file) {
      lines.push('', mcpHint.heading);
      for (const line of mcpHint.lines) lines.push(line);
    } else {
      lines.push('', `Add to ${hint.file}:`);
      for (const line of hint.lines) lines.push(line);
    }
  }

  if (outdatedSkills) {
    const extra = result.harness.id === 'claude' ? ' --skills-dir .claude/skills' : '';
    lines.push('', `Outdated Skills: run knowlery sync --apply${extra}`);
  }

  lines.push('', formatHarnessRow(result.harness, details));
  lines.push(`then: ${result.then}`);
  if (result.mcp_note !== null) {
    lines.push(`mcp: ${result.mcp_note}`);
  }
  if (result.user_wide !== null) {
    lines.push(
      '',
      'User-wide, not written by Knowlery. To use this knowledge base from other folders too:',
      result.user_wide,
    );
  }

  return { result, text: `${lines.join('\n')}\n` };
}
