export interface RuleTemplate {
  name: string;
  filename: string;
  content: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Obsidian CLI',
    filename: 'obsidian-cli.md',
    content: `# Obsidian CLI

When interacting with this Obsidian vault:

- Use the Obsidian CLI to read, create, search, and manage notes
- Prefer \`obsidian-cli\` commands over direct file system access
- Respect the vault's folder structure and naming conventions
`,
  },
  {
    name: 'Obsidian markdown writing',
    filename: 'obsidian-markdown-writing.md',
    content: `# Obsidian Markdown Writing

When writing markdown in this vault:

- Use wikilinks \`[[Page Name]]\` instead of standard markdown links
- Use callouts for important information: \`> [!note]\`, \`> [!warning]\`, etc.
- Use YAML frontmatter for metadata on every page
- Use tags in frontmatter, not inline \`#tags\`
- Embed content with \`![[Page Name]]\` syntax
`,
  },
];
