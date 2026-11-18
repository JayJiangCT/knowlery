import type { Config } from '../../core/config';
import { inventory, inventoryPaths } from '../../core/inventory';
import type { ParsedArgs } from '../args';

export async function runInventory(root: string, config: Config, args: ParsedArgs) {
  if (args.paths) {
    const result = await inventoryPaths(root, args.paths);
    const text = result.paths.map((item) => item.exists
      ? `${item.path}\t${item.size}\t${item.sha256}`
      : `${item.path}\tmissing`).join('\n');
    return { result, text: text ? `${text}\n` : '' };
  }
  const result = await inventory(root, config, args);
  const counts = result.counts;
  const formats = Object.entries(counts.by_format).map(([format, count]) => `${format} ${count}`).join(', ');
  const lines = [`sources: ${counts.total} (${formats})  unsupported: ${counts.unsupported}  ignored: ${counts.ignored}  symlinks: ${counts.symlinks}`];
  for (const item of result.items) lines.push(`${item.path}\t${item.format}\t${item.size}\t${item.sha256}\t${item.extraction}`);
  if (result.next) lines.push(`more: --offset ${result.next.offset} --snapshot ${result.next.snapshot}`);
  for (const warning of result.warnings) lines.push(`warning: ${warning}`);
  return { result, text: `${lines.join('\n')}\n` };
}
