export interface BundledSkill {
  name: string;
  emoji: string;
  description: string;
  content: string;
}

export const BUNDLED_SKILLS: BundledSkill[] = [
  {
    name: 'cook',
    emoji: '\u{1F373}',
    description: 'Digest notes and external sources into knowledge pages',
    content: `---
name: cook
description: Digest notes and external sources into knowledge pages
version: 1.0.0
---

# Cook

Digest raw notes, articles, and external sources into structured knowledge pages.

## When to use

Use /cook when you have raw material (notes, articles, bookmarks, ideas) that needs to be turned into structured knowledge pages in the vault.

## Instructions

1. Read the source material provided by the user
2. Identify the type of knowledge (entity, concept, comparison, or query)
3. Create a new page in the appropriate directory with proper frontmatter
4. Extract key information and organize it clearly
5. Add wikilinks to connect with existing pages in the vault
6. Summarize what was created and suggest next steps
`,
  },
  {
    name: 'ask',
    emoji: '\u{2753}',
    description: 'Open-ended Q&A against the knowledge base',
    content: `---
name: ask
description: Open-ended Q&A against the knowledge base
version: 1.0.0
---

# Ask

Answer questions using the knowledge base as context.

## When to use

Use /ask when you want to query your knowledge base for answers, insights, or connections.

## Instructions

1. Search the vault for relevant pages using wikilinks and tags
2. Read and synthesize information from multiple sources
3. Provide a clear, well-sourced answer with wikilinks to relevant pages
4. If the answer isn't in the vault, say so and suggest what to /cook
`,
  },
  {
    name: 'health',
    emoji: '\u{1FA7A}',
    description: 'Audit knowledge page quality',
    content: `---
name: health
description: Audit knowledge page quality
version: 1.0.0
---

# Health

Audit the quality of knowledge pages in the vault.

## Instructions

1. Check for missing frontmatter fields per SCHEMA.md
2. Identify pages with no outgoing wikilinks (isolated)
3. Find pages with broken wikilinks
4. Report quality scores and suggest improvements
`,
  },
  {
    name: 'wiki',
    emoji: '\u{1F4DA}',
    description: 'Set up or refresh wiki index (INDEX.base)',
    content: `---
name: wiki
description: Set up or refresh wiki index (INDEX.base)
version: 1.0.0
---

# Wiki

Generate or refresh the vault's INDEX.base wiki index.

## Instructions

1. Scan all knowledge directories for pages
2. Generate an INDEX.base file that catalogs all pages
3. Group by type (entity, concept, comparison, query)
4. Include page titles, descriptions, and key metadata
`,
  },
  {
    name: 'prep',
    emoji: '\u{1F9F9}',
    description: 'Fix frontmatter and broken wikilinks',
    content: `---
name: prep
description: Fix frontmatter and broken wikilinks
version: 1.0.0
---

# Prep

Fix structural issues in the vault: frontmatter and broken wikilinks.

## Instructions

1. Scan pages for missing or malformed frontmatter
2. Add missing required fields per SCHEMA.md
3. Find and fix broken wikilinks
4. Report what was fixed
`,
  },
  {
    name: 'trace',
    emoji: '\u{1F50D}',
    description: 'Trace reasoning chains',
    content: `---
name: trace
description: Trace reasoning chains
version: 1.0.0
---

# Trace

Trace reasoning chains through connected knowledge pages.

## Instructions

1. Start from a given concept or question
2. Follow wikilinks to trace how ideas connect
3. Build a reasoning chain showing the path
4. Identify gaps or weak links in the chain
`,
  },
  {
    name: 'connect',
    emoji: '\u{1F517}',
    description: 'Find connections between concepts',
    content: `---
name: connect
description: Find connections between concepts
version: 1.0.0
---

# Connect

Find hidden connections between concepts in the vault.

## Instructions

1. Analyze two or more pages specified by the user
2. Identify shared themes, references, or underlying patterns
3. Suggest new wikilinks that should exist
4. Optionally create a comparison page
`,
  },
  {
    name: 'ideas',
    emoji: '\u{1F4A1}',
    description: 'Generate ideas from vault content',
    content: `---
name: ideas
description: Generate ideas from vault content
version: 1.0.0
---

# Ideas

Generate new ideas by combining existing knowledge.

## Instructions

1. Read relevant pages from the vault
2. Apply creative thinking techniques (analogy, inversion, combination)
3. Generate novel ideas grounded in vault knowledge
4. Create query pages for promising ideas worth exploring
`,
  },
  {
    name: 'challenge',
    emoji: '\u{1F94A}',
    description: 'Challenge assumptions in notes',
    content: `---
name: challenge
description: Challenge assumptions in notes
version: 1.0.0
---

# Challenge

Challenge assumptions and claims in your notes.

## Instructions

1. Read the specified page(s)
2. Identify key claims and assumptions
3. Present counterarguments or alternative perspectives
4. Suggest evidence that would strengthen or weaken each claim
`,
  },
  {
    name: 'drift',
    emoji: '\u{1F30A}',
    description: 'Explore tangential ideas',
    content: `---
name: drift
description: Explore tangential ideas
version: 1.0.0
---

# Drift

Explore tangential ideas starting from a given concept.

## Instructions

1. Start from the specified concept
2. Follow unexpected connections and tangents
3. Explore adjacent fields and analogies
4. Document interesting discoveries as new query pages
`,
  },
  {
    name: 'organize',
    emoji: '\u{1F4C1}',
    description: 'Reorganize directory structure',
    content: `---
name: organize
description: Reorganize directory structure
version: 1.0.0
---

# Organize

Reorganize vault directory structure for better knowledge organization.

## Instructions

1. Analyze current vault structure
2. Identify misplaced pages (wrong directory for their type)
3. Suggest moves with rationale
4. Execute moves if approved, updating all wikilinks
`,
  },
  {
    name: 'mise',
    emoji: '\u{1F9D1}\u{200D}\u{1F373}',
    description: 'Check overall vault health',
    content: `---
name: mise
description: Check overall vault health
version: 1.0.0
---

# Mise en Place

Comprehensive vault health check — everything in its place.

## Instructions

1. Run all health checks (frontmatter, wikilinks, orphans)
2. Check vault structure completeness
3. Verify agent configuration
4. Produce a summary report with action items
`,
  },
  {
    name: 'obsidian-cli',
    emoji: '\u{1F4BB}',
    description: 'Obsidian CLI usage',
    content: `---
name: obsidian-cli
description: Obsidian CLI usage
version: 1.0.0
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
    emoji: '\u{270D}\u{FE0F}',
    description: 'Obsidian flavored markdown',
    content: `---
name: obsidian-markdown
description: Obsidian flavored markdown
version: 1.0.0
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
    emoji: '\u{1F4CA}',
    description: 'Obsidian Bases (.base files)',
    content: `---
name: obsidian-bases
description: Obsidian Bases (.base files)
version: 1.0.0
---

# Obsidian Bases

Create and edit .base files for structured data views.

## Format

Bases are JSON files with .base extension that define views over vault data.
`,
  },
  {
    name: 'json-canvas',
    emoji: '\u{1F3A8}',
    description: 'JSON Canvas format',
    content: `---
name: json-canvas
description: JSON Canvas format
version: 1.0.0
---

# JSON Canvas

Create and edit .canvas files using the JSON Canvas format.

## Format

Canvas files are JSON with nodes (text, file, link, group) and edges connecting them.
`,
  },
  {
    name: 'defuddle',
    emoji: '\u{1F9F9}',
    description: 'Web content extraction',
    content: `---
name: defuddle
description: Web content extraction
version: 1.0.0
---

# Defuddle

Extract clean markdown content from web pages.

## Usage

Use defuddle to strip navigation, ads, and clutter from web pages, extracting just the main content as clean markdown suitable for knowledge pages.
`,
  },
  {
    name: 'vault-conventions',
    emoji: '\u{1F4D0}',
    description: 'Vault-specific conventions',
    content: `---
name: vault-conventions
description: Vault-specific conventions
version: 1.0.0
---

# Vault Conventions

Follow these conventions when working in this vault:

- Knowledge pages live in typed directories (entities/, concepts/, comparisons/, queries/)
- Every page has YAML frontmatter matching SCHEMA.md
- Use wikilinks to connect related pages
- Keep pages focused on a single topic
`,
  },
  {
    name: 'vault-thinking',
    emoji: '\u{1F9E0}',
    description: 'Vault-aware reasoning',
    content: `---
name: vault-thinking
description: Vault-aware reasoning
version: 1.0.0
---

# Vault-Aware Thinking

When reasoning about questions or tasks, always consider what's already in the vault.

## Process

1. Before creating new content, search for existing related pages
2. Build on existing knowledge rather than duplicating
3. Identify and fill gaps rather than restating known information
4. Connect new insights to existing pages via wikilinks
`,
  },
];
