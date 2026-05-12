import type { App } from 'obsidian';
import { BUNDLED_SKILLS } from '../assets/skills';
import { loadSkillsLock, saveSkillsLock, copySkillToClaudeDir } from './skill-manager';
import { ensureDir, writeFile } from './vault-io';

const SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';

export async function syncBuiltinSkills(app: App): Promise<void> {
  const lock = await loadSkillsLock(app);
  let lockChanged = false;

  await ensureDir(app, SKILLS_DIR);
  await ensureDir(app, CLAUDE_SKILLS_DIR);

  for (const skill of BUNDLED_SKILLS) {
    const entry = lock.skills[skill.name];

    if (entry && (entry.source === 'custom' || entry.forkedFrom)) {
      continue;
    }

    await ensureDir(app, `${SKILLS_DIR}/${skill.name}`);
    await writeFile(app, `${SKILLS_DIR}/${skill.name}/SKILL.md`, skill.content);

    // Write reference files (L2+) for bundled skills
    if (skill.references) {
      for (const [relPath, refContent] of Object.entries(skill.references)) {
        const fullPath = `${SKILLS_DIR}/${skill.name}/${relPath}`;
        const parentDir = fullPath.split('/').slice(0, -1).join('/');
        await ensureDir(app, parentDir);
        await writeFile(app, fullPath, refContent);
      }
    }

    if (!entry || (entry.source === 'builtin' && !entry.disabled)) {
      await copySkillToClaudeDir(app, skill.name);
    }

    if (!entry) {
      lock.skills[skill.name] = {
        source: 'builtin',
        version: '1.0.0',
        disabled: false,
      };
      lockChanged = true;
    }
  }

  if (lockChanged) {
    await saveSkillsLock(app, lock);
  }
}

interface SchemaSection {
  heading: string;
  level: number;
  content: string;
  predecessor: string | null;
}

const SCHEMA_SECTIONS: SchemaSection[] = [
  {
    heading: '## Knowledge Domains',
    level: 2,
    content: '\n_No domains defined yet. The agent adds domains here as knowledge pages are created._\n',
    predecessor: '# Knowledge Schema',
  },
  {
    heading: '## Tag Taxonomy',
    level: 2,
    content: [
      '',
      'Tags follow these conventions:',
      '- 2-5 tags per page, alphabetically sorted',
      '- Tags should be singular (use `#project` not `#projects`)',
      '- New tags should be added here first before use',
      '',
      '### Current Tags',
      '',
      '| Tag | Usage | Description |',
      '|-----|-------|-------------|',
      '',
      '_No tags defined yet. The agent adds tags here as knowledge pages are created._',
      '',
    ].join('\n'),
    predecessor: '## Knowledge Domains',
  },
  {
    heading: '## Domain Taxonomy',
    level: 2,
    content: [
      '',
      '| Domain | Description |',
      '|--------|-------------|',
      '',
      '_No domains defined yet. The agent adds domains here as knowledge pages are created._',
      '',
    ].join('\n'),
    predecessor: '## Tag Taxonomy',
  },
  {
    heading: '## Agent Page Conventions',
    level: 2,
    content: [
      '',
      '| Directory | Purpose |',
      '|-----------|---------|',
      '| `entities/` | Concrete, named things (people, organizations, products, systems) |',
      '| `concepts/` | Abstract ideas (methods, rules, decisions, processes) |',
      '| `comparisons/` | Side-by-side analyses of options |',
      '| `queries/` | User-question-driven answers worth keeping |',
      '',
    ].join('\n'),
    predecessor: '## Domain Taxonomy',
  },
  {
    heading: '## Frontmatter Schema',
    level: 2,
    content: [
      '',
      'See the /cook skill specification for the complete frontmatter schema. Key required fields:',
      '',
      '- `title` — concise one-line summary',
      '- `date` — primary temporal anchor (ISO 8601)',
      '- `created` — page creation date',
      '- `updated` — last content change date (bump on every edit)',
      '- `type` — one of: entity, concept, comparison, query',
      '- `tags` — 2-5 tags from this taxonomy, alphabetically sorted',
      '- `sources` — relative paths to contributing notes',
      '',
    ].join('\n'),
    predecessor: '## Agent Page Conventions',
  },
  {
    heading: '## Page Thresholds',
    level: 2,
    content: [
      '',
      '- Create a page when: entity/concept appears in 2+ notes OR is central subject of one note',
      '- Split a page when: it exceeds ~200 lines',
      '- Do NOT create pages for: passing mentions, minor details, out-of-domain topics',
      '',
    ].join('\n'),
    predecessor: '## Frontmatter Schema',
  },
  {
    heading: '## Custom Fields',
    level: 2,
    content: [
      '',
      '| Field | Type | Description |',
      '|-------|------|-------------|',
      '| `status` | text | Page status (active, draft, archived) |',
      '| `domain` | text | Knowledge domain |',
      '| `description` | text | Short description/summary |',
      '| `references` | list | Related wikilink references |',
      '| `author` | text | Content author |',
      '',
    ].join('\n'),
    predecessor: '## Page Thresholds',
  },
];

export async function migrateSchemaMd(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists('SCHEMA.md'))) return;

  let content = await adapter.read('SCHEMA.md');
  let changed = false;

  for (const section of SCHEMA_SECTIONS) {
    if (content.includes(section.heading)) continue;

    if (section.heading === '## Tag Taxonomy') {
      if (!content.includes('### Current Tags')) {
        const insertContent = section.content;
        const insertResult = insertAfterSection(content, section.predecessor, section.heading + insertContent);
        if (insertResult !== null) {
          content = insertResult;
          changed = true;
        }
      }
      continue;
    }

    const insertResult = insertAfterSection(content, section.predecessor, section.heading + section.content);
    if (insertResult !== null) {
      content = insertResult;
      changed = true;
    }
  }

  if (changed) {
    await writeFile(app, 'SCHEMA.md', content);
  }
}

function insertAfterSection(
  doc: string,
  predecessorHeading: string | null,
  newBlock: string,
): string | null {
  if (predecessorHeading === null) return null;

  const lines = doc.split('\n');
  const predIndex = lines.findIndex((line) => line.trimEnd() === predecessorHeading);
  if (predIndex === -1) return null;

  const predLevel = headingLevel(predecessorHeading);
  let insertAt = predIndex + 1;
  for (let i = predIndex + 1; i < lines.length; i++) {
    const lvl = headingLevel(lines[i]);
    if (lvl > 0 && lvl <= predLevel) {
      insertAt = i;
      break;
    }
    insertAt = i + 1;
  }

  const before = lines.slice(0, insertAt).join('\n');
  const after = lines.slice(insertAt).join('\n');
  const separator = before.endsWith('\n') ? '' : '\n';
  return `${before}${separator}${newBlock}${after}`;
}

function headingLevel(line: string): number {
  const match = /^(#{1,6})\s/.exec(line);
  return match ? match[1].length : 0;
}
