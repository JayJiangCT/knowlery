import { normalizePath, Platform, type App } from 'obsidian';
import type {
  InstallDetectionResult,
  Platform as AgentPlatform,
} from '../types';
import { detectAgentCli } from './cli-detect';
import { detectNode } from './node-detect';

export interface EnvironmentDetectOptions {
  app: App;
  platform: AgentPlatform;
  nodePath?: string;
}

export interface EnvironmentDetectSnapshot {
  nodeDetected: boolean;
  nodePath: string | null;
  nodeVersion: string | null;
  items: InstallDetectionResult[];
}

export async function detectEnvironment(
  options: EnvironmentDetectOptions,
): Promise<EnvironmentDetectSnapshot> {
  const node = await detectNode(options.nodePath);
  const cli = await detectAgentCli();

  const platformCliInstalled = options.platform === 'claude-code'
    ? cli.claudeCode.installed
    : cli.opencode.installed;
  const platformCliVersion = options.platform === 'claude-code'
    ? cli.claudeCode.version
    : cli.opencode.version;

  return {
    nodeDetected: node.detected,
    nodePath: node.path,
    nodeVersion: node.version,
    items: [
      {
        id: 'platform-cli',
        label: options.platform === 'claude-code' ? 'Claude Code' : 'OpenCode',
        description: 'Installs the agent CLI used by this vault.',
        status: platformCliInstalled ? 'installed' : 'not-installed',
        installedVersion: platformCliVersion,
        selectedByDefault: !platformCliInstalled,
      },
      await detectClaudian(options.app),
      detectSkillsTooling(node.detected),
    ],
  };
}

async function detectClaudian(app: App): Promise<InstallDetectionResult> {
  const manifestPath = normalizePath('.obsidian/plugins/claudian/manifest.json');
  const adapter = app.vault.adapter;
  const installed = Platform.isMobile ? false : await adapter.exists(manifestPath);

  return {
    id: 'claudian',
    label: 'Claudian',
    description: 'Adds an in-vault chat UI on top of the selected agent CLI.',
    status: installed ? 'installed' : 'not-installed',
    detail: installed ? 'Plugin files detected' : 'Not installed',
    recommended: true,
    selectedByDefault: !installed,
  };
}

function detectSkillsTooling(nodeDetected: boolean): InstallDetectionResult {
  if (!nodeDetected) {
    return {
      id: 'skills-tooling',
      label: 'Skills tooling',
      description: 'Prepares external skill discovery and install flows.',
      status: 'missing-dependency',
      detail: 'Node.js required',
      requiresNode: true,
    };
  }

  return {
    id: 'skills-tooling',
    label: 'Skills tooling',
    description: 'Prepares external skill discovery and install flows.',
    status: 'not-installed',
    detail: 'Uses npx on demand',
    requiresNode: true,
  };
}
