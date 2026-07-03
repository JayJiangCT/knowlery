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
