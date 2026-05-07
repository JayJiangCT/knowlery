export function generateKnowledgeMd(kbName: string): string {
  return `# ${kbName}

This vault is an agent-assisted knowledge base. Your notes are the raw material — the agent helps turn them into structured, cross-referenced knowledge pages.

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

**Prefer Obsidian CLI for note-centric vault operations.** Use bash only when the CLI cannot express the task cleanly, such as a folder-listing fallback during knowledge retrieval.

| Task | Command |
|------|---------|
| Read a note | \`obsidian read file="..."\` |
| Search vault | \`obsidian search query="..."\` |
| Query the knowledge index | \`obsidian base:query path="INDEX.base" view="All Pages" format=paths\` |
| Read a note property | \`obsidian property:read name="type" path="entities/example.md"\` |
| Create a note | \`obsidian create path="queries/example.md" content="..."\` |
| List files | \`obsidian files folder="..."\` |
| Show folder | \`obsidian folder path="..."\` |
| Check links | \`obsidian links file="..."\` |
| Check backlinks | \`obsidian backlinks file="..."\` |

Obsidian CLI resolves wikilinks, understands frontmatter and aliases, and maintains link graph consistency. Raw bash treats files as plain text and breaks the semantic layer.

Do not start routine work by running \`obsidian help\`. Use the verified command patterns above first, and only open help when:

- a command fails with a parameter or usage error
- you need an unfamiliar subcommand
- the local CLI appears to have changed after an upgrade

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
2. Run \`obsidian base:query path="INDEX.base" view="All Pages" format=paths\` to enumerate compiled pages
3. Read \`SCHEMA.md\` for tag taxonomy and domain rules
4. Run \`obsidian search query="..."\` with key concepts; merge results
5. Use \`obsidian property:read\` and \`obsidian read\` on promising paths — prefer agent pages, \`status: reviewed\` over \`draft\`, recent \`updated\`
6. If the Base query cannot give usable paths, fall back to \`rg --files entities concepts comparisons queries\`
7. Synthesize a direct answer with \`[[wikilink]]\` citations and explicit gaps

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

export function generateIndexBase(): string {
  return `filters:
  or:
    - file.inFolder("entities")
    - file.inFolder("concepts")
    - file.inFolder("comparisons")
    - file.inFolder("queries")
formulas:
  type_label: if(type == "entity", "Entity", if(type == "concept", "Concept", if(type == "comparison", "Comparison", "Query")))
  days_since_update: if(updated, (today() - date(updated)).days, "")
  backlink_count: file.backlinks.length
properties:
  title:
    displayName: Title
  type:
    displayName: Type
  domain:
    displayName: Domain
  tags:
    displayName: Tags
  status:
    displayName: Status
  created:
    displayName: Created
  updated:
    displayName: Updated
  formula.type_label:
    displayName: Type
  formula.days_since_update:
    displayName: Days Since Update
  formula.backlink_count:
    displayName: Backlinks
  file.path:
    displayName: Path
views:
  - type: table
    name: All Pages
    groupBy:
      property: type
      direction: ASC
    order:
      - file.name
      - title
      - formula.type_label
      - domain
      - tags
      - status
      - created
      - updated
      - formula.days_since_update
      - formula.backlink_count
      - file.path
    sort:
      - property: updated
        direction: DESC
  - type: table
    name: Entities
    filters:
      and:
        - type == "entity"
    groupBy:
      property: domain
      direction: ASC
    order:
      - file.name
      - title
      - domain
      - tags
      - status
      - updated
      - formula.days_since_update
      - formula.backlink_count
  - type: table
    name: Concepts
    filters:
      and:
        - type == "concept"
    groupBy:
      property: domain
      direction: ASC
    order:
      - file.name
      - title
      - domain
      - tags
      - status
      - updated
      - formula.days_since_update
      - formula.backlink_count
  - type: table
    name: Comparisons
    filters:
      and:
        - type == "comparison"
    order:
      - file.name
      - title
      - tags
      - status
      - updated
      - formula.days_since_update
      - formula.backlink_count
  - type: table
    name: Queries
    filters:
      and:
        - type == "query"
    order:
      - file.name
      - title
      - tags
      - status
      - updated
      - formula.days_since_update
      - formula.backlink_count
  - type: table
    name: Recently Updated
    order:
      - updated
      - file.name
      - title
      - formula.type_label
      - tags
      - formula.backlink_count
    limit: 10
`;
}

export function generateClaudeMd(): string {
  return `@../KNOWLEDGE.md
@../SCHEMA.md
@../INDEX.base
`;
}

export function generateOpenCodeJson(kbName: string): string {
  return JSON.stringify({
    name: kbName,
    instructions: ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base', '.agents/rules/*.md'],
  }, null, 2);
}
