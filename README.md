# Knowlery

Knowlery turns an Obsidian vault into an AI-powered knowledge base control panel. It helps initialize a vault structure, install and manage agent skills, configure agent rules, and run vault health diagnostics for Claude Code and OpenCode workflows.

## Requirements

- Obsidian desktop.
- Community plugins enabled.
- Claude Code or OpenCode, if you want to run installed skills from the dashboard.
- Node.js and npm, if you want to browse or install skills from the external skills registry.

Knowlery is desktop-only because it uses local command-line tools and Electron desktop APIs.

## Install with BRAT

Knowlery can be installed as a beta plugin through BRAT before it is listed in the community plugin directory.

1. Install the BRAT plugin in Obsidian.
2. Open BRAT settings.
3. Add this beta plugin repository: `JayJiangCT/knowlery`.
4. Enable Knowlery from Settings -> Community plugins.

## Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Put those files in `.obsidian/plugins/knowlery/` inside your vault.
3. Reload Obsidian and enable Knowlery from Settings -> Community plugins.

## What Knowlery Creates

During setup, Knowlery can create or update these files and folders inside your vault:

- `KNOWLEDGE.md`
- `SCHEMA.md`
- `entities/`, `concepts/`, `comparisons/`, and `queries/`
- `.knowlery/manifest.json`
- `.agents/skills/` and `.agents/rules/`
- `.claude/skills/`, `.claude/rules/`, and `.claude/CLAUDE.md`
- `opencode.json`, when OpenCode is selected
- `skills-lock.json`

Knowlery may delete skill or rule files only when you use the corresponding delete or disable actions in the UI.

## Network and Command Use

Knowlery does not collect telemetry.

The skill browser can call the external `skills` registry through `npx skills ...` when you search for or install registry skills. This may connect to external services used by the skills CLI. Registry skill installation writes copied skill files into your vault.

Knowlery can run local CLI commands such as `claude`, `opencode`, `node`, `npx`, and `skills` when you explicitly use CLI-related features. These commands run on your computer with your user permissions.

## Development

```bash
npm install
npm run build
```

The production build writes `main.js`. Release assets should include:

- `main.js`
- `manifest.json`
- `styles.css`

## License

MIT
