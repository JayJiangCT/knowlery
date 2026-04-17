export function generateKnowledgeMd(kbName: string): string {
  return `# ${kbName}

This file contains instructions for AI agents working in this vault.

## Vault Structure

- \`entities/\` — Named things (people, places, tools, organizations)
- \`concepts/\` — Ideas, theories, mental models, frameworks
- \`comparisons/\` — Side-by-side analyses of related items
- \`queries/\` — Saved questions and research threads

## Writing Conventions

- Use wikilinks (\`[[Page Name]]\`) to connect related pages
- Every knowledge page should have YAML frontmatter (see SCHEMA.md)
- Keep pages focused on a single topic
- Link liberally between related concepts

## Agent Behavior

- When creating knowledge pages, follow the structure defined in SCHEMA.md
- Always use wikilinks to reference other pages in the vault
- Place new pages in the appropriate directory based on their type
- Preserve existing frontmatter when editing pages
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
