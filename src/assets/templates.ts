export function generateKnowledgeMd(kbName: string): string {
  return `# ${kbName}

This vault is an AI-powered knowledge base. Your notes are the raw material — the agent compiles them into structured, cross-referenced knowledge pages.

## Vault Structure

| Directory | Contents | Owner |
|-----------|----------|-------|
| \`entities/\` | Named things: people, tools, organizations, projects | Agent |
| \`concepts/\` | Ideas, theories, mental models, frameworks | Agent |
| \`comparisons/\` | Side-by-side analyses of related items | Agent |
| \`queries/\` | Saved questions and research threads | Agent |
| Everything else | Your notes (Daily/, Projects/, etc.) | User |

Agent pages are compiled from user notes. **User notes are never modified by the agent.**

## Operating Rules

### Obsidian CLI Only

**Use Obsidian CLI for all vault operations.** Never use bash commands (\`cat\`, \`grep\`, \`find\`, \`sed\`, \`ls\`, \`head\`, \`tail\`, etc.) to read or modify note files.

| Task | Command |
|------|---------|
| Read a note | \`obsidian read file="..."\` |
| Search vault | \`obsidian search query="..."\` |
| Create a note | \`obsidian create file="..." content="..."\` |
| List files | \`obsidian files folder="..."\` |
| Show folder | \`obsidian folder path="..."\` |
| Check links | \`obsidian links file="..."\` |
| Check backlinks | \`obsidian backlinks file="..."\` |

Obsidian CLI resolves wikilinks, understands frontmatter and aliases, and maintains link graph consistency. Raw bash treats files as plain text and breaks the semantic layer.

### Writing Conventions

- Use wikilinks (\`[[Page Name]]\`) to connect related pages
- Every knowledge page has YAML frontmatter matching SCHEMA.md
- Keep pages focused on a single topic
- Place new pages in the correct directory by \`type\`
- Preserve existing frontmatter when editing pages
- Use Obsidian-flavored markdown (callouts, embeds, properties)

## Knowledge Retrieval

When answering questions from this vault (not general knowledge):

1. Read \`INDEX.base\` first (compiled knowledge map)
2. Read \`SCHEMA.md\` for tag taxonomy and domain rules
3. Run \`obsidian search\` with key concepts; merge results
4. Run \`obsidian read\` on promising paths — prefer agent pages, \`status: reviewed\` over \`draft\`, recent \`updated\`
5. Synthesize a direct answer with \`[[wikilink]]\` citations and explicit gaps

Every claim must be backed by vault notes. See \`/ask\` for the full specification.

## Available Skills

### Knowledge Workflows

| Skill | Purpose |
|-------|---------|
| \`/cook\` | Digest notes and sources into knowledge pages, maintain INDEX.base |
| \`/ask\` | Answer questions from vault content with citations |
| \`/explore\` | Trace idea timelines or find connections between topics |
| \`/challenge\` | Pressure-test beliefs or track intention-vs-action gaps |
| \`/ideas\` | Generate actionable ideas from vault content |
| \`/audit\` | Check vault health, frontmatter, and structural integrity |
| \`/organize\` | Reorganize directory structure (dry-run by default) |

### Quick Reference

- New material to process → \`/cook\`
- Question about vault content → \`/ask\`
- How did X evolve? How are A and B related? → \`/explore\`
- Is this belief solid? Am I following through? → \`/challenge\`
- What should I work on? → \`/ideas\`
- Anything broken or stale? → \`/audit\`
- Files in wrong places? → \`/organize\`
`;
}

export function generateSchemaMd(): string {
  return `# Knowledge Schema

This file defines the structure for knowledge pages in this vault.

## Entity Schema

\`\`\`yaml
---
type: entity
aliases: []
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

## Concept Schema

\`\`\`yaml
---
type: concept
aliases: []
tags: []
related: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

## Comparison Schema

\`\`\`yaml
---
type: comparison
items: []
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`

## Query Schema

\`\`\`yaml
---
type: query
status: open | resolved
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
\`\`\`
`;
}

export function generateClaudeMd(): string {
  return `@../KNOWLEDGE.md
@../SCHEMA.md
`;
}

export function generateOpenCodeJson(kbName: string): string {
  return JSON.stringify({
    name: kbName,
    instructions: ['KNOWLEDGE.md', 'SCHEMA.md', '.agents/rules/*.md'],
  }, null, 2);
}
