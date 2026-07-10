import { collectOrientationMap } from '../../core/orientation-source';
import { renderOrientationMap } from '../../core/query/orientation';

export interface IndexCommandOptions {
  json?: boolean;
  log: (line: string) => void;
}

/**
 * `knowlery index` (spec 1.2 f1, §4.2): the orientation map's CLI rendering.
 * Read-only live view, no init gate — an empty map is a finding, exit 0.
 */
export async function runIndexCommand(root: string, options: IndexCommandOptions): Promise<void> {
  const map = await collectOrientationMap(root, new Date().toISOString());
  if (options.json) {
    options.log(JSON.stringify(map, null, 2));
    return;
  }
  options.log(renderOrientationMap(map).trimEnd());
}
