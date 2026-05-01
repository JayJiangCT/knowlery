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
  {
    name: 'Activity ledger',
    description: 'Record lightweight private summaries of meaningful agent work',
    filename: 'activity-ledger.md',
    content: `# Activity Ledger

When meaningful work happens with the user, append one private summary record to:

\`.knowlery/activity/YYYY-MM-DD.jsonl\`

Before writing, check whether \`.knowlery/activity-disabled\` exists. If it exists, do not write an activity record.

Record only a concise summary. Do not store full conversation transcripts.

Write one JSON object per line using this shape:

\`\`\`json
{
  "time": "2026-05-01T14:20:00.000Z",
  "agent": "codex",
  "type": "discussion",
  "topics": ["Knowlery", "Product Strategy"],
  "summary": "Discussed shifting Knowlery from setup tool to personal knowledge review surface.",
  "dimensions": ["strategy", "reflection"],
  "questions": ["How should Knowlery capture what the user learns each day?"],
  "learned": ["Agent session receipts should be the main source."],
  "thinking": ["Avoid surveillance; use chosen traces instead."],
  "followups": ["Design Activity Ledger schema"],
  "relatedFiles": [],
  "captureState": "unbaked",
  "source": {
    "kind": "agent-session",
    "visibility": "private-summary"
  }
}
\`\`\`

Allowed dimensions:

- \`research\`
- \`creation\`
- \`building\`
- \`strategy\`
- \`reflection\`
- \`maintenance\`

Use \`captureState: "unbaked"\` when the discussion has not yet been turned into a durable note or knowledge page.
Use \`captureState: "baked"\` only when the useful result has already been captured in the vault.
`,
  },
];
