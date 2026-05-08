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

Write one compact JSON object on a single line. Do not pretty-print the object across multiple lines. Use this shape:

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
    "visibility": "private-summary",
    "surface": "knowledge"
  }
}
\`\`\`

Allowed dimensions:

- \`analysis\`
- \`research\`
- \`creation\`
- \`building\`
- \`strategy\`
- \`reflection\`
- \`maintenance\`

Use \`captureState: "unbaked"\` when the discussion has not yet been turned into a durable note or knowledge page.
Use \`captureState: "baked"\` only when the useful result has already been captured in the vault.

Use \`source.surface: "knowledge"\` for user knowledge work that should influence Today, active threads, and review suggestions.
Use \`source.surface: "system"\` for setup, diagnostics, vault maintenance, agent operation logs, and generated reports. System records should summarize what happened, but they are not knowledge threads.

For analysis work that reviews evidence, incidents, documents, or notes and creates reusable knowledge follow-ups, use \`type: "analysis"\`, include \`"analysis"\` in \`dimensions\`, and set \`source.surface: "knowledge"\`.
For maintenance or audit work, use \`type: "maintenance"\`, include \`"maintenance"\` in \`dimensions\`, and set \`source.surface: "system"\`.

An Activity Ledger receipt is a private system receipt, not a persistent report note or knowledge page. If a task says not to create new vault notes, still append the Activity Ledger record when logging is enabled.

Do not create persistent report notes unless the user explicitly asks. Summarize findings in chat by default. If the user asks for a persistent operational report, place it under \`.knowlery/reports/\` or \`.knowlery/reviews/\`, not in user knowledge directories such as \`queries/\`.
`,
  },
];
