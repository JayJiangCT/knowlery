export interface RuleTemplate {
  name: string;
  description: string;
  filename: string;
  content: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Citation required',
    description: 'Always cite source notes when answering questions',
    filename: 'citation-required.md',
    content: `# Citation Required

When answering questions from the knowledge base:

- Always cite the source note(s) using wikilinks: \`[[Note Name]]\`
- If the answer spans multiple notes, list all sources
- If unsure, say so — do not fabricate references
- Quote key passages when they directly answer the question
`,
  },
  {
    name: 'Language preference',
    description: 'Set the preferred response language',
    filename: 'language-preference.md',
    content: `# Language Preference

Respond in the same language as the user's message.

If the user writes in English, respond in English.
If the user writes in another language, match that language.
`,
  },
  {
    name: 'Domain context',
    description: 'Define the knowledge domain for better answers',
    filename: 'domain-context.md',
    content: `# Domain Context

This knowledge base covers [YOUR DOMAIN HERE].

When interpreting queries:

- Use domain-specific terminology accurately
- Prefer explanations relevant to this domain
- Cross-reference related concepts within the vault
`,
  },
];
