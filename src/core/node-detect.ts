import { Platform } from 'obsidian';

export interface NodeDetectResult {
  detected: boolean;
  version: string | null;
  path: string | null;
}

export async function detectNode(customPath?: string): Promise<NodeDetectResult> {
  if (Platform.isMobile) {
    return { detected: false, version: null, path: null };
  }

  const { exec } = await import('child_process');

  const paths = customPath
    ? [customPath]
    : ['/usr/local/bin/node', '/opt/homebrew/bin/node', 'node'];

  for (const nodePath of paths) {
    const result = await tryNode(exec, nodePath);
    if (result) return result;
  }

  return { detected: false, version: null, path: null };
}

function tryNode(
  exec: typeof import('child_process').exec,
  nodePath: string,
): Promise<NodeDetectResult | null> {
  return new Promise(resolve => {
    exec(`"${nodePath}" --version`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const version = stdout.trim();
      if (version.startsWith('v')) {
        resolve({ detected: true, version, path: nodePath });
      } else {
        resolve(null);
      }
    });
  });
}
