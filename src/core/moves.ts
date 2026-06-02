import type { DashboardMove } from '../types';

export const RECIPE_BOOK: DashboardMove[] = [
  {
    id: 'digest-new-material',
    title: 'Digest new material',
    meta: 'Fresh notes, clips, or conversations',
    description: 'Turn rough material into durable notes, concepts, and index updates.',
    prompt: 'Help me distill recently added or unprocessed material into the knowledge base — extract key concepts, related entities, reusable structures, and update the necessary indexes.',
    skillTag: 'cook',
  },
  {
    id: 'connect-thread',
    title: 'Connect a thread',
    meta: 'A topic that keeps coming back',
    description: 'Find older notes, adjacent themes, and reusable patterns around one active topic.',
    prompt: 'Pick a topic that keeps coming back recently. Review related older notes, find connections, reusable patterns, structural gaps, and parts worth distilling further.',
    skillTag: 'explore + cook',
  },
  {
    id: 'pressure-test',
    title: 'Pressure-test an idea',
    meta: 'A belief, plan, or conclusion',
    description: 'Check assumptions, missing evidence, counterexamples, and open questions.',
    prompt: 'Help me pressure-test a recent important idea: which conclusions lack evidence, which assumptions should be challenged, and which counterexamples or risks are worth recording in the knowledge base.',
    skillTag: 'challenge + ask',
  },
  {
    id: 'clean-pantry',
    title: 'Clean the pantry',
    meta: 'Vault structure and metadata',
    description: 'Review drift, duplicates, frontmatter gaps, broken links, and index hygiene.',
    prompt: 'Check the current structural health of the knowledge base: broken links, duplicate content, frontmatter gaps, index drift, and directories or notes that need organizing.',
    skillTag: 'audit + organize',
  },
  {
    id: 'bake-output',
    title: 'Create an output',
    meta: 'Reusable artifact or decision',
    description: 'Turn existing notes into a checklist, outline, template, proposal, or decision memo.',
    prompt: 'Based on my knowledge base content, help me turn a mature topic into a reusable output: an outline, template, checklist, proposal, or decision memo.',
    skillTag: 'ask + ideas + cook',
  },
];
