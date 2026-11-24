import { WIKI_DIR } from '../core/paths';
import { KIT_VERSION } from '../version';

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  license: string;
  author: string;
  repository: { type: string; url: string };
  bin: { knowlery: string };
  files: string[];
  engines: { node: string };
  dependencies: { 'pdfjs-dist': string };
  publishConfig: { tag: string };
  pi: { skills: string[] };
}

export function buildPackageManifest(pdfjsVersion: string): PackageManifest {
  return {
    name: 'knowlery',
    version: KIT_VERSION,
    description: 'Turns a folder of files into a Markdown wiki that AI agents compile, maintain and answer from.',
    license: 'MIT',
    author: 'Jay Jiang',
    repository: { type: 'git', url: 'git+https://github.com/JayJiangCT/knowlery.git' },
    bin: { knowlery: 'knowlery.mjs' },
    files: ['knowlery.mjs', 'skills', 'README.md', 'LICENSE'],
    engines: { node: '>=20' },
    dependencies: { 'pdfjs-dist': pdfjsVersion },
    publishConfig: { tag: 'next' },
    pi: { skills: ['./skills'] },
  };
}

export function buildReadme(): string {
  return `# Knowlery

Knowlery turns a folder of your files into a Markdown wiki that AI agents compile, keep up to date and answer from. Your files stay untouched, and the wiki cites them.

This is Knowlery 2.0. It does not read or convert a Knowlery 1.x vault. Knowlery 1.x stays available as \`knowlery@1\`.

## Install

    npm install -g knowlery@next

It needs Node.js 20 or later.

## Start

    cd your-folder
    knowlery init
    knowlery connect

\`init\` adds a hidden \`${WIKI_DIR}/\` folder, an \`AGENTS.md\` file and three Skills to the folder. \`connect\` lists the agent clients it knows (Pi, Codex, Cursor, Gemini CLI, Claude Code) and what each still needs. Then start your agent in the folder and ask it to compile the folder into the wiki.

Coming from 2.0.0-beta.1: in the knowledge base folder run \`mv wiki ${WIKI_DIR}\`, then \`knowlery sync --apply\`.

## Pi

    pi install npm:knowlery@${KIT_VERSION}

This gives Pi the three Skills in every folder. The \`knowlery\` command is still installed with npm, as above.

## License

MIT
`;
}
