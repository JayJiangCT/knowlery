import type { SkillKind } from '../types';

export interface BundledSkill {
  name: string;
  emoji: string;
  description: string;
  content: string;
  kind: SkillKind;
}

export const BUNDLED_SKILLS: BundledSkill[] = [
  {
    name: 'cook',
    kind: 'knowledge',
    emoji: '\u{1F373}',
    description: 'Digest notes into knowledge pages and maintain INDEX.base',
    content: `---
name: cook
description: Digest notes into knowledge pages and maintain INDEX.base
version: 2.0.0
kind: knowledge
---

# Cook

## What it does

\`cook\` processes raw notes, articles, and web content into structured knowledge pages using the vault's schema. It identifies entity types, extracts relationships, and creates or updates pages with proper frontmatter and wikilinks.

## Best For

- Raw field notes or meeting transcripts that need structuring
- Pasted web articles waiting to be integrated into the vault
- Incremental vault updates after research sessions
- Refreshing INDEX.base after bulk imports

## Pro Tip

Run \`cook\` immediately after pasting meeting notes — it extracts action items and assigns them to entities already in your vault, turning loose transcripts into connected knowledge pages in one pass.

## Example

\`\`\`
/knowlery cook --format=meeting --extract-actions "notes/2024-q4-review.md"
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --format | String | Target page structure: 'meeting', 'article', 'entity', 'concept' |
| --extract-actions | Boolean | Auto-generate task list from text, default false |
| --index-only | Boolean | Refresh INDEX.base without cooking new content, default false |
`,
  },
  {
    name: 'ask',
    kind: 'knowledge',
    emoji: '\u{2753}',
    description: 'Open-ended Q&A against the knowledge base',
    content: `---
name: ask
description: Open-ended Q&A against the knowledge base
version: 1.0.0
kind: knowledge
---

# Ask

## What it does

\`ask\` queries the knowledge base to answer questions by searching across notes, following wikilinks, and synthesizing information from multiple pages. It returns a sourced answer with links to relevant vault pages.

## Best For

- Cross-referencing concepts stored across multiple notes
- Checking what the vault says about a specific topic
- Finding connections between two areas of knowledge
- Getting a synthesis before starting new research

## Pro Tip

Use \`ask\` before starting any new research — you might have already captured the answer in your vault. Discovering existing coverage saves time on duplicate work and often reveals angles worth expanding rather than rebuilding.

## Example

\`\`\`
/knowlery ask "What are the key differences between X and Y?"
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --depth | Integer | How many wikilink hops to follow, default 2 |
| --format | String | Output format: 'summary', 'detailed', 'bullets', default 'summary' |
| --cite | Boolean | Include wikilinks to sources in response, default true |
`,
  },
  {
    name: 'explore',
    kind: 'knowledge',
    emoji: '\u{1F9ED}',
    description: 'Trace idea timelines and find connections between topics',
    content: `---
name: explore
description: Trace idea timelines and find connections between topics
version: 1.0.0
kind: knowledge
---

# Explore

## What it does

\`explore\` navigates the vault's knowledge graph in two modes — timeline (how an idea evolved over time) and bridge (how two topics connect). It surfaces turning points, shared concepts, and hidden relationships across the vault.

## Best For

- Tracing how your thinking on a topic has changed over time
- Finding unexpected connections between separate research areas
- Building a chronological view of an evolving project
- Discovering which concepts bridge two domains you haven't explicitly linked

## Pro Tip

Use \`explore\` in bridge mode before writing a comparative essay — it maps the conceptual territory between two ideas and often surfaces a third angle you hadn't considered, one that's already grounded in your own notes.

## Example

\`\`\`
/knowlery explore --mode=bridge --from="machine learning" --to="epistemology"
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --mode | String | 'timeline' for single topic evolution or 'bridge' for two-topic connection |
| --from | String | Topic name for timeline mode or first topic for bridge mode |
| --to | String | Second topic for bridge mode only |
| --depth | Integer | Wikilink hops to follow, default 3 |
`,
  },
  {
    name: 'challenge',
    kind: 'knowledge',
    emoji: '\u{1F94A}',
    description: 'Pressure-test beliefs and track intention-vs-action gaps',
    content: `---
name: challenge
description: Pressure-test beliefs and track intention-vs-action gaps
version: 2.0.0
kind: knowledge
---

# Challenge

## What it does

\`challenge\` stress-tests the knowledge base by looking for contradictions, outdated claims, unsupported assertions, and drift between related notes. It surfaces which beliefs need updated evidence.

## Best For

- Auditing a knowledge area before making a high-stakes decision
- Detecting when notes have drifted from each other after long gaps
- Finding claims that lack supporting sources
- Reviewing assumptions before a project retrospective

## Pro Tip

Run \`challenge\` quarterly on your core concept pages — beliefs that haven't been tested become invisible assumptions. Surfacing them on a schedule keeps your knowledge base honest rather than self-reinforcing.

## Example

\`\`\`
/knowlery challenge --topic="AI safety" --since="2024-01-01"
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --topic | String | Vault area or concept to challenge |
| --since | String | ISO date — only flag drift newer than this date |
| --strict | Boolean | Fail on any unsupported claim, not just contradictions, default false |
`,
  },
  {
    name: 'ideas',
    kind: 'knowledge',
    emoji: '\u{1F4A1}',
    description: 'Generate actionable ideas from vault content',
    content: `---
name: ideas
description: Generate actionable ideas from vault content
version: 1.0.0
kind: knowledge
---

# Ideas

## What it does

\`ideas\` cross-pollinates the knowledge base to generate novel connections and synthesis. It finds concepts from different domains that share structural similarities and proposes new angles or research directions grounded in existing vault content.

## Best For

- Breaking out of a conceptual rut on a long-running topic
- Generating hypotheses for a research question
- Finding analogies between technical and non-technical domains
- Seeding brainstorming sessions with evidence-backed starting points

## Pro Tip

Feed \`ideas\` a specific constraint ("only connect to pages tagged #biology") — unconstrained synthesis produces too many weak connections, while constrained synthesis surfaces surprising depth from domains you wouldn't have checked manually.

## Example

\`\`\`
/knowlery ideas --seed="feedback loops" --domains="economics,ecology" --count=5
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --seed | String | Central concept to cross-pollinate |
| --domains | String | Comma-separated vault tags or folder names to draw from |
| --count | Integer | Number of idea threads to generate, default 3 |
`,
  },
  {
    name: 'audit',
    kind: 'knowledge',
    emoji: '\u{1FA7A}',
    description: 'Check vault health, frontmatter coverage, and structural integrity',
    content: `---
name: audit
description: Check vault health, frontmatter coverage, and structural integrity
version: 1.0.0
kind: knowledge
---

# Audit

## What it does

\`audit\` runs a comprehensive health check on the knowledge base — checking for orphan notes, missing frontmatter, stale INDEX.base, broken wikilinks, and structural inconsistencies against the vault schema.

## Best For

- Monthly vault maintenance sessions
- Before sharing or exporting vault content
- After bulk imports or migrations
- Diagnosing why vault search or navigation feels unreliable

## Pro Tip

Run \`audit\` before any major restructuring — it shows exactly what's already broken, so you're not compounding existing problems with structural changes. Use \`--dry-run\` to preview fixes before committing them.

## Example

\`\`\`
/knowlery audit --fix=orphans --report=full
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --fix | String | Auto-fix mode: 'orphans', 'frontmatter', 'index', or 'all' |
| --report | String | Output detail: 'summary' or 'full' |
| --dry-run | Boolean | Show what would be fixed without making changes, default false |
`,
  },
  {
    name: 'organize',
    kind: 'knowledge',
    emoji: '\u{1F4C1}',
    description: 'Reorganize directory structure',
    content: `---
name: organize
description: Reorganize directory structure
version: 1.0.0
kind: knowledge
---

# Organize

## What it does

\`organize\` analyzes the vault's directory structure and note clustering patterns, then proposes restructuring moves — merging over-fragmented topics, splitting overloaded directories, and renaming pages to follow the vault's naming conventions.

## Best For

- Vaults that have grown organically and feel chaotic to navigate
- After merging notes from multiple sources or projects
- When search results feel noisy or unfocused
- Preparing a vault for a new phase of use

## Pro Tip

Run \`organize\` with \`--dry-run\` first — the proposed moves often reveal structural assumptions you didn't realize you'd made, which is itself valuable even if you don't apply all of them.

## Example

\`\`\`
/knowlery organize --scope=concepts --dry-run
\`\`\`

## Parameters

| Flag | Type | Description |
|------|------|-------------|
| --scope | String | Vault area to reorganize: folder name, tag, or 'all' |
| --dry-run | Boolean | Propose moves without executing them, default true |
| --rename | Boolean | Also suggest page renames for consistency, default false |
`,
  },
  {
    name: 'obsidian-cli',
    kind: 'tooling',
    emoji: '\u{1F4BB}',
    description: 'Obsidian CLI usage',
    content: `---
name: obsidian-cli
description: Obsidian CLI usage
version: 1.0.0
kind: tooling
---

# Obsidian CLI

Use the Obsidian CLI to interact with the vault programmatically.

## Commands

- \`obsidian-cli read <path>\` - Read a note
- \`obsidian-cli create <path> --content <text>\` - Create a note
- \`obsidian-cli search <query>\` - Search vault
- \`obsidian-cli list [path]\` - List notes
`,
  },
  {
    name: 'obsidian-markdown',
    kind: 'tooling',
    emoji: '\u{270D}\u{FE0F}',
    description: 'Obsidian flavored markdown',
    content: `---
name: obsidian-markdown
description: Obsidian flavored markdown
version: 1.0.0
kind: tooling
---

# Obsidian Flavored Markdown

Write markdown using Obsidian's extensions.

## Key Features

- Wikilinks: \`[[Page Name]]\` or \`[[Page Name|Display Text]]\`
- Embeds: \`![[Page Name]]\`
- Callouts: \`> [!note] Title\`
- YAML frontmatter for metadata
- Tags in frontmatter: \`tags: [tag1, tag2]\`
`,
  },
  {
    name: 'obsidian-bases',
    kind: 'tooling',
    emoji: '\u{1F4CA}',
    description: 'Obsidian Bases (.base files)',
    content: `---
name: obsidian-bases
description: Obsidian Bases (.base files)
version: 1.0.0
kind: tooling
---

# Obsidian Bases

Create and edit .base files for structured data views.

## Format

Bases are JSON files with .base extension that define views over vault data.
`,
  },
  {
    name: 'json-canvas',
    kind: 'tooling',
    emoji: '\u{1F3A8}',
    description: 'JSON Canvas format',
    content: `---
name: json-canvas
description: JSON Canvas format
version: 1.0.0
kind: tooling
---

# JSON Canvas

Create and edit .canvas files using the JSON Canvas format.

## Format

Canvas files are JSON with nodes (text, file, link, group) and edges connecting them.
`,
  },
  {
    name: 'defuddle',
    kind: 'tooling',
    emoji: '\u{1F9F9}',
    description: 'Web content extraction',
    content: `---
name: defuddle
description: Web content extraction
version: 1.0.0
kind: tooling
---

# Defuddle

Extract clean markdown content from web pages.

## Usage

Use defuddle to strip navigation, ads, and clutter from web pages, extracting just the main content as clean markdown suitable for knowledge pages.
`,
  },
  {
    name: 'vault-conventions',
    kind: 'tooling',
    emoji: '\u{1F4D0}',
    description: 'Vault-specific conventions',
    content: `---
name: vault-conventions
description: Vault-specific conventions
version: 1.0.0
kind: tooling
---

# Vault Conventions

Follow these conventions when working in this vault:

- Knowledge pages live in typed directories (entities/, concepts/, comparisons/, queries/)
- Every knowledge page should have YAML frontmatter matching SCHEMA.md
- Use wikilinks to connect related pages
- Keep pages focused on a single topic
`,
  },
];
