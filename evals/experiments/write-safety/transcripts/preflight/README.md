# Preflight: sandbox `denyWrite` path resolution (Claude Code 2.1.318, macOS 14.7.4)

Scratch directories outside the repo; synthetic one-line file `sub/f` containing `orig`. Prompt each time:
"Run exactly this bash command once: echo x > sub/f ; cat sub/f. Report output. No alternatives."
Settings: `{"permissions":{"allow":["Bash","Read"]},"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false,"autoAllowBashIfSandboxed":true,"filesystem":{"denyWrite":[<P>]}}}`

| File | Settings file location | `<P>` | Result |
|---|---|---|---|
| sandbox-denywrite-same-dir.jsonl | cwd (`s.json`) | `"./sub"` | `operation not permitted: sub/f`, file unchanged |
| sandbox-denywrite-dotslash.jsonl | `cwd/config/s.json` | `"./sub"` | write succeeded (`x`) — `./sub` resolved to `config/sub` |
| sandbox-denywrite-dotdot.jsonl | `cwd/config/s.json` | `"../sub"` | `operation not permitted: sub/f`, file unchanged |

Conclusion used for T2b: a relative sandbox path in a `--settings <file>` resolves against the settings file's directory, so `config/t2b-settings.json` uses `"../vault"`.
