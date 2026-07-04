export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  summary: string;
  highlights: {
    title: string;
    description: string;
  }[];
}

export const RELEASE_NOTES: Record<string, ReleaseNote> = {
  '0.7.0': {
    version: '0.7.0',
    date: 'Jul 4',
    title: 'One core, two shells',
    summary: 'Knowlery now works wherever your markdown lives: the same knowledge-base lifecycle is available as a standalone CLI, and this plugin stays the richest way to use it.',
    highlights: [
      {
        title: 'The knowlery CLI',
        description: 'npm i -g knowlery — init, sync, health, query, stale, and bundle install from any terminal. A workspace initialized by the CLI opens here with zero migration, and this vault works with the CLI as-is.',
      },
      {
        title: 'Skills that adapt to where they run',
        description: 'Retrieval now has three transports (in-app command, global CLI, embedded script), and the writing skills gained a headless path — same conventions, whether Obsidian is open or not.',
      },
      {
        title: 'Names you can find',
        description: '/cook now records nicknames, abbreviations, and cross-language titles as aliases while compiling — so asking with the words you actually use finds the page.',
      },
      {
        title: 'Safe to mix versions',
        description: 'The workspace remembers which Knowlery last synced it; an older plugin or CLI will refuse to sync rather than quietly downgrade what a newer one upgraded.',
      },
    ],
  },
  '0.6.1': {
    version: '0.6.1',
    date: 'Jul 4',
    title: 'Retrieval you can measure',
    summary: 'Finding knowledge is now one deterministic command with two transports, staleness is detected mechanically, and every retrieval improvement is proven by a scored evaluation.',
    highlights: [
      {
        title: 'One retrieval command',
        description: 'Run `obsidian knowlery:query` with Obsidian open, or `node .knowlery/bin/query.mjs` with it closed — same engine, same ranked results, with an honest "no confident matches" answer when your vault does not cover a question.',
      },
      {
        title: 'Knowledge health',
        description: 'The dashboard now shows which compiled pages have changed sources and which notes were never compiled, with a one-click re-cook prompt. /cook starts from this report instead of a log timestamp.',
      },
      {
        title: 'Smarter cross-language answers',
        description: 'Evidence found in a raw note now credits the compiled page that cites it — so a question asked in Chinese finds the English page compiled from your Chinese notes, and vice versa.',
      },
      {
        title: 'Lighter every conversation',
        description: 'Agent sessions now load only the operating card and your rules. The growing taxonomy file and the Base index moved to on-demand reads, migrated in place without touching your own edits.',
      },
    ],
  },
  '0.6.0': {
    version: '0.6.0',
    date: 'Jul 3',
    title: 'Retrieval you can measure',
    summary: 'Finding knowledge is now one deterministic command with two transports, staleness is detected mechanically, and every retrieval improvement is proven by a scored evaluation.',
    highlights: [
      {
        title: 'One retrieval command',
        description: 'Run `obsidian knowlery:query` with Obsidian open, or `node .knowlery/bin/query.mjs` with it closed — same engine, same ranked results, with an honest "no confident matches" answer when your vault does not cover a question.',
      },
      {
        title: 'Knowledge health',
        description: 'The dashboard now shows which compiled pages have changed sources and which notes were never compiled, with a one-click re-cook prompt. /cook starts from this report instead of a log timestamp.',
      },
      {
        title: 'Smarter cross-language answers',
        description: 'Evidence found in a raw note now credits the compiled page that cites it — so a question asked in Chinese finds the English page compiled from your Chinese notes, and vice versa.',
      },
      {
        title: 'Lighter every conversation',
        description: 'Agent sessions now load only the operating card and your rules. The growing taxonomy file and the Base index moved to on-demand reads, migrated in place without touching your own edits.',
      },
    ],
  },
  '0.5.0': {
    version: '0.5.0',
    date: 'Jul 3',
    title: 'Share your knowledge',
    summary: 'Knowlery can now package reviewed knowledge into portable bundles, install bundles shared by others, and retrieve installed knowledge deliberately.',
    highlights: [
      {
        title: 'Share knowledge bundles',
        description: 'Pick a topic, review every connected page and source, and export only what you approve as a portable bundle — with an automated risk scan and a schema scoped to just that bundle.',
      },
      {
        title: 'Install knowledge bundles',
        description: 'Install a bundle from a zip or folder into Library/ with a manifest and conformance preview first. Installed bundles are listed on the dashboard and can be uninstalled cleanly.',
      },
      {
        title: 'Fork to my knowledge',
        description: 'Copy a concept page from an installed bundle into your own knowledge directories and evolve it as your own.',
      },
      {
        title: 'Bundle-aware /ask',
        description: 'The /ask skill now checks installed bundles explicitly and reads their structured indexes, so shared knowledge shows up in answers instead of being found by accident.',
      },
    ],
  },
  '0.3.7': {
    version: '0.3.7',
    date: 'May 20',
    title: 'Community-ready release',
    summary: 'Knowlery is ready for Community plugin review, with clearer setup behavior and release checks.',
    highlights: [
      {
        title: 'Community plugin preparation',
        description: 'Release assets, versioning, plugin metadata, and disclosure notes now match the Community review flow.',
      },
      {
        title: 'Safer companion install paths',
        description: 'Optional Claudian setup now respects the vault\'s configured plugin folder.',
      },
      {
        title: 'What\'s new modal',
        description: 'Knowlery can show concise release notes after an update without interrupting first-time setup.',
      },
      {
        title: 'Release checks',
        description: 'Linting, tests, build, docs build, and dependency audit are part of the release path.',
      },
    ],
  },
};

export function getReleaseNote(version: string): ReleaseNote | null {
  return RELEASE_NOTES[version] ?? null;
}
