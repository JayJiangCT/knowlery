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

**Use Obsidian CLI for note-centric vault operations.** Do not start vault discovery with raw Bash commands such as \`ls\`, \`find\`, \`grep\`, or \`cat\`. Use Bash only when Obsidian CLI is unavailable, a verified Obsidian CLI command fails, or the task is non-note environment diagnostics. State the fallback reason before using Bash.

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

Obsidian CLI resolves wikilinks, understands frontmatter and aliases, and maintains link graph consistency. Raw Bash treats files as plain text and breaks the semantic layer.

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
| \`/trace\` | Trace idea timelines or find connections between topics |
| \`/challenge\` | Pressure-test beliefs or track intention-vs-action gaps |
| \`/ideas\` | Generate actionable ideas from vault content |
| \`/health\` | Check vault health, frontmatter, and structural integrity |
| \`/organize\` | Reorganize directory structure (dry-run by default) |

### Quick Reference

- New material to process → \`/cook\`
- Question about vault content → \`/ask\`
- How did X evolve? How are A and B related? → \`/trace\`
- Is this belief solid? Am I following through? → \`/challenge\`
- What should I work on? → \`/ideas\`
- Anything broken or stale? → \`/health\`
- Files in wrong places? → \`/organize\`
`;
}

export function generateSchemaMd(): string {
  return `# Knowledge Schema

Knowledge taxonomy and conventions for this vault.

## Knowledge Domains

_No domains defined yet. The agent adds domains here as knowledge pages are created._

## Tag Taxonomy

Tags follow these conventions:
- 2-5 tags per page, alphabetically sorted
- Tags should be singular (use \`#project\` not \`#projects\`)
- New tags should be added here first before use

### Current Tags

| Tag | Usage | Description |
|-----|-------|-------------|

_No tags defined yet. The agent adds tags here as knowledge pages are created._

## Domain Taxonomy

| Domain | Description |
|--------|-------------|

_No domains defined yet. The agent adds domains here as knowledge pages are created._

## Agent Page Conventions

| Directory | Purpose |
|-----------|---------|
| \`entities/\` | Concrete, named things (people, organizations, products, systems) |
| \`concepts/\` | Abstract ideas (methods, rules, decisions, processes) |
| \`comparisons/\` | Side-by-side analyses of options |
| \`queries/\` | User-question-driven answers worth keeping |

## Frontmatter Schema

See the /cook skill specification for the complete frontmatter schema. Key required fields:

- \`title\` — concise one-line summary
- \`date\` — primary temporal anchor (ISO 8601)
- \`created\` — page creation date
- \`updated\` — last content change date (bump on every edit)
- \`type\` — one of: entity, concept, comparison, query
- \`tags\` — 2-5 tags from this taxonomy, alphabetically sorted
- \`sources\` — relative paths to contributing notes

## Page Thresholds

- Create a page when: entity/concept appears in 2+ notes OR is central subject of one note
- Split a page when: it exceeds ~200 lines
- Do NOT create pages for: passing mentions, minor details, out-of-domain topics

## Custom Fields

| Field | Type | Description |
|-------|------|-------------|
| \`status\` | text | Page status (active, draft, archived) |
| \`domain\` | text | Knowledge domain |
| \`description\` | text | Short description/summary |
| \`references\` | list | Related wikilink references |
| \`author\` | text | Content author |
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

export function generateClaudeMd(ruleImportPaths: string[] = []): string {
  const ruleImports = [...new Set(ruleImportPaths)]
    .filter((path) => path.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))
    .map((path) => `@rules/${path}`);

  return [
    '@../KNOWLEDGE.md',
    '@../SCHEMA.md',
    '@../INDEX.base',
    ...ruleImports,
    '',
  ].join('\n');
}

export function generateOpenCodeJson(kbName: string): string {
  return JSON.stringify({
    name: kbName,
    instructions: ['KNOWLEDGE.md', 'SCHEMA.md', 'INDEX.base', '.agents/rules/*.md'],
  }, null, 2);
}
