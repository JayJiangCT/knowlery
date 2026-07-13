import type { DashboardMove } from '../types';
import { t } from '../i18n';

/**
 * The suggested-moves recipe book, built per call so titles and descriptions
 * render in the current UI language. Prompts and skill tags deliberately stay
 * English: prompts cooperate with the (English) skill set, and skill tags are
 * skill names.
 */
export function getRecipeBook(): DashboardMove[] {
  return [
    {
      id: 'digest-new-material',
      title: t('moves.digest.title'),
      meta: t('moves.digest.meta'),
      description: t('moves.digest.description'),
      prompt: 'Help me distill recently added or unprocessed material into the knowledge base — extract key concepts, related entities, reusable structures, and update the necessary indexes.',
      skillTag: 'cook',
    },
    {
      id: 'connect-thread',
      title: t('moves.connect.title'),
      meta: t('moves.connect.meta'),
      description: t('moves.connect.description'),
      prompt: 'Pick a topic that keeps coming back recently. Review related older notes, find connections, reusable patterns, structural gaps, and parts worth distilling further.',
      skillTag: 'explore + cook',
    },
    {
      id: 'pressure-test',
      title: t('moves.challenge.title'),
      meta: t('moves.challenge.meta'),
      description: t('moves.challenge.description'),
      prompt: 'Help me challenge a recent important idea: which conclusions lack evidence, which assumptions should be questioned, and which counterexamples or risks are worth recording in the knowledge base.',
      skillTag: 'challenge + ask',
    },
    {
      id: 'clean-pantry',
      title: t('moves.clean.title'),
      meta: t('moves.clean.meta'),
      description: t('moves.clean.description'),
      prompt: 'Check the current structural health of the knowledge base: broken links, duplicate content, frontmatter gaps, index drift, and directories or notes that need organizing.',
      skillTag: 'audit + organize',
    },
    {
      id: 'bake-output',
      title: t('moves.bake.title'),
      meta: t('moves.bake.meta'),
      description: t('moves.bake.description'),
      prompt: 'Based on my knowledge base content, help me turn a mature topic into a reusable output: an outline, template, checklist, proposal, or decision memo.',
      skillTag: 'ask + ideas + cook',
    },
  ];
}
