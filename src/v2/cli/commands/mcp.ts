import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { ExtractionOptions } from '../../core/extract';
import { findMcpRoot, formatRootSource } from '../../mcp/root';
import { buildMcpServer } from '../../mcp/server';

export interface RunMcpOptions {
  dir?: string;
  envDir?: string;
  cwd: string;
  stderr: (text: string) => void;
  extractionOptions?: Pick<ExtractionOptions, 'registry' | 'ceiling'>;
}

export async function runMcp(options: RunMcpOptions): Promise<void> {
  try {
    const found = await findMcpRoot(options.dir, options.envDir, options.cwd);
    options.stderr(`knowlery mcp: root ${found.root} (${formatRootSource(found.source)})\n`);
  } catch {
    options.stderr('knowlery mcp: no knowledge base found yet\n');
  }

  serveStdio(
    () => buildMcpServer({
      dir: options.dir,
      envDir: options.envDir,
      cwd: options.cwd,
      extractionOptions: options.extractionOptions,
    }),
    { legacy: 'serve' },
  );
}
