import assert from 'node:assert/strict';
import {
  buildClaudeCodePowerShellInstallScript,
  buildWindowsCommandInvocation,
} from '../src/core/command-runner';
import { BUNDLED_SKILLS } from '../src/assets/skills';
import { generateKnowledgeMd } from '../src/assets/templates';

const npmInvocation = buildWindowsCommandInvocation('C:\\Program Files\\nodejs\\npx.cmd', [
  '--yes',
  'skills',
  '--help',
]);

assert.equal(npmInvocation.executable, 'cmd.exe');
assert.deepEqual(npmInvocation.args.slice(0, 4), ['/d', '/s', '/c', '""C:\\Program Files\\nodejs\\npx.cmd" "--yes" "skills" "--help""']);

const plainInvocation = buildWindowsCommandInvocation('powershell.exe', ['-NoProfile']);
assert.equal(plainInvocation.executable, 'powershell.exe');
assert.deepEqual(plainInvocation.args, ['-NoProfile']);

const installScript = buildClaudeCodePowerShellInstallScript();
assert.match(installScript, /SecurityProtocolType\]::Tls12/);
assert.match(installScript, /Invoke-RestMethod https:\/\/claude\.ai\/install\.ps1/);
assert.match(installScript, /Invoke-Expression/);

const knowledge = generateKnowledgeMd('Test Knowledge Base');
assert.match(knowledge, /Mandatory for vault-grounded retrieval/);
assert.match(knowledge, /the first search step must be `obsidian search query="\.\.\."`/);
assert.match(knowledge, /Do not use raw shell search/);
assert.doesNotMatch(knowledge, /Prefer Obsidian CLI for note-centric vault operations/);

const obsidianCliSkill = BUNDLED_SKILLS.find((candidate) => candidate.name === 'obsidian-cli');
assert.ok(obsidianCliSkill);
assert.match(obsidianCliSkill.content, /Vault-grounded retrieval must use Obsidian CLI/);
assert.match(obsidianCliSkill.content, /Do not use `grep`, `rg`, `find`, `ls`, `cat`/);
assert.match(obsidianCliSkill.content, /Start with `obsidian search query="\.\.\."`/);
