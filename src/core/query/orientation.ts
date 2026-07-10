import type { VaultSnapshot } from './scan';
import { AGENT_DIRS } from './scan';
import { computeStaleness } from './staleness';

/**
 * The orientation map (spec 1.2 f1): Karpathy's Index.md insight, done as a
 * view. Pure in the strict sense — every input is injected, including the
 * timestamp; the function reads no clock, no file, no env. Never persisted:
 * the map is a function of the vault at read time, so there is nothing to
 * drift and nothing to invalidate.
 */

export interface OrientationBundleEntry {
  id: string;
  title: string;
  version: string;
  entrypoint: string;
}

export interface OrientationPage {
  path: string;
  title: string;
  description?: string;
  domain?: string;
  updated?: string;
}

export interface OrientationGroup {
  /** Grouping is by directory, not frontmatter (spec §4.1) — the rule is total. */
  group: (typeof AGENT_DIRS)[number];
  pages: OrientationPage[];
}

export interface OrientationMap {
  kbName?: string;
  /** Injected honesty stamp: this is a view, dated. */
  generatedAt: string;
  compiled: OrientationGroup[];
  bundles: OrientationBundleEntry[];
  counts: { compiled: number; bundles: number; uncooked: number };
}

export interface OrientationInputs {
  snapshot: VaultSnapshot;
  bundles: OrientationBundleEntry[];
  kbName?: string;
  generatedAt: string;
}

export function buildOrientationMap(inputs: OrientationInputs): OrientationMap {
  const { snapshot, bundles, kbName, generatedAt } = inputs;

  const compiled: OrientationGroup[] = [];
  let compiledCount = 0;
  for (const dir of AGENT_DIRS) {
    const pages = snapshot.pages
      .filter((page) => page.tier === 'agent' && page.path.split('/')[0] === dir)
      .map((page) => ({
        path: page.path,
        title: page.title,
        ...(page.description !== undefined ? { description: page.description } : {}),
        ...(page.domain !== undefined ? { domain: page.domain } : {}),
        ...(page.updated !== undefined ? { updated: page.updated } : {}),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    compiledCount += pages.length;
    if (pages.length > 0) compiled.push({ group: dir, pages });
  }

  // Same semantics as `knowlery stale` (maintainer P1 at implementation
  // review): a raw note already cited by a compiled page is folded in, not
  // uncooked — the two surfaces must report the same number. computeStaleness
  // is pure over the snapshot, so purity is preserved.
  const uncooked = computeStaleness(snapshot).uncookedNotes.length;

  return {
    ...(kbName !== undefined ? { kbName } : {}),
    generatedAt,
    compiled,
    bundles: [...bundles].sort((a, b) => a.id.localeCompare(b.id)),
    counts: { compiled: compiledCount, bundles: bundles.length, uncooked },
  };
}

/** Shared human/markdown rendering — the CLI prints it, the MCP resource serves it. */
export function renderOrientationMap(map: OrientationMap, options: { markdown?: boolean } = {}): string {
  const h = (text: string) => (options.markdown ? `## ${text}` : text);
  const lines: string[] = [];

  lines.push(options.markdown
    ? `# ${map.kbName ?? 'Knowledge base'} — orientation map`
    : `${map.kbName ?? 'Knowledge base'} — orientation map`);
  lines.push(`Generated ${map.generatedAt} (live view — nothing is stored)`);
  lines.push('');

  if (map.compiled.length === 0) {
    lines.push('No compiled knowledge pages yet — run /cook on your material.');
  }
  for (const group of map.compiled) {
    lines.push(h(`${group.group} (${group.pages.length})`));
    for (const page of group.pages) {
      const detail = [page.description, page.domain ? `domain: ${page.domain}` : undefined]
        .filter(Boolean).join(' · ');
      lines.push(`- ${page.path} — ${page.title}${detail ? ` · ${detail}` : ''}`);
    }
    lines.push('');
  }

  if (map.bundles.length > 0) {
    lines.push(h(`Installed bundles (${map.bundles.length})`));
    for (const bundle of map.bundles) {
      lines.push(`- ${bundle.id} v${bundle.version} — "${bundle.title}" (start at Library/${bundle.id}/${bundle.entrypoint})`);
    }
    lines.push('');
  }

  lines.push(`${map.counts.uncooked} user note(s) not yet compiled — \`knowlery stale\` lists them.`);
  return `${lines.join('\n')}\n`;
}
