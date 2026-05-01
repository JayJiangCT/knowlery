# Developer Notes

This page covers local development, build commands, and documentation maintenance.

## Local Setup

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

Start the documentation site:

```bash
npm run docs:dev
```

Build the documentation site:

```bash
npm run docs:build
```

## Release Assets

Plugin releases should include:

- `main.js`
- `manifest.json`
- `styles.css`

The existing release workflow runs on version tags and publishes those assets to GitHub Releases.

## Documentation Architecture

Official docs live in `docs-site/`.

Internal project notes, design documents, Obsidian API references, and test guides remain in `docs/`. Keeping those separate prevents the public documentation from inheriting internal drafts or outdated planning material.

## Bilingual Structure

English is the default locale at `/`.

Simplified Chinese lives at `/zh/`.

When adding a new public page, add both language versions and update sidebars in `docs-site/.vitepress/config.ts`.

## GitHub Pages

The docs workflow builds the VitePress site and deploys it with GitHub Pages.

For a project page at `https://<owner>.github.io/knowlery/`, the workflow sets:

```bash
KNOWLERY_DOCS_BASE=/knowlery/
```

Local builds use `/` as the base path.

## Documentation Style

Prefer:

- Product-facing explanations before internals.
- Short sections with concrete file paths.
- “Current behavior” wording for features that may evolve.
- Examples that work in a clean test vault.
- English and Chinese pages that match structure but read naturally.

Avoid:

- Mixing internal design drafts into official docs.
- Promising automation that does not exist yet.
- Describing code behavior from memory when source files can be checked.
