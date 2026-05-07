import assert from 'node:assert/strict';
import {
  buildClaudeCodePowerShellInstallScript,
  buildWindowsCommandInvocation,
} from '../src/core/command-runner';

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
