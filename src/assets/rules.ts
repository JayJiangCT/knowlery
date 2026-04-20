export interface RuleTemplate {
  name: string;
  filename: string;
  content: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Obsidian markdown writing',
    filename: 'obsidian-markdown-writing.md',
    content: `# Obsidian Markdown Writing

Before creating or editing any note, use the \`obsidian-markdown\` skill to ensure correct formatting:

- Wikilinks: \`[[Page Name]]\` or \`[[folder/Page Name]]\`
- Embeds: \`![[Page Name]]\`
- Callouts: \`> [!note]\`, \`> [!warning]\`, etc.
- YAML frontmatter for metadata on every page
- Tags in frontmatter, not inline \`#tags\`
`,
  },
  {
    name: 'User notes are read-only',
    filename: 'user-notes-readonly.md',
    content: `---
paths:
  - "**/*.md"
  - "!entities/**"
  - "!concepts/**"
  - "!comparisons/**"
  - "!queries/**"
  - "!SCHEMA.md"
  - "!log.md"
---
# User Notes Are Read-Only

These notes are raw material for knowledge compilation via /cook.

- Read them to extract entities, concepts, and relationships
- Do not modify, rename, or delete them
- Use Obsidian CLI for reading: \`obsidian read file="..."\`
`,
  },
];
