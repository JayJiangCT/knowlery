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
