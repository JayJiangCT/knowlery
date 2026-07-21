import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { BUNDLED_SKILLS } from '../../src/assets/skills';
import { generateKnowledgeMd, generateSchemaMd } from '../../src/assets/templates';

/**
 * Spec 0.7 f5, §4.1-4: the acceptance criteria for this feature are skill-content
 * facts. These assertions keep CI honest about them (they are contains-checks, not
 * prose review — wording may evolve as long as the instructions survive).
 */

function skill(name: string): string {
  const found = BUNDLED_SKILLS.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing bundled skill: ${name}`);
  return found.content;
}

describe('frontmatter identity', () => {
  it.each(BUNDLED_SKILLS.map((entry) => entry.name))(
    '%s: frontmatter name matches the bundled (directory) name',
    (name) => {
      expect(matter(skill(name)).data.name).toBe(name);
    },
  );

  it('vault-conventions keeps the legacy BYOAO pointer so old vaults still activate it', () => {
    expect(matter(skill('vault-conventions')).data.description).toContain('formerly BYOAO');
  });
});

describe('three-transport ladder (spec 0.7 f5, §4.1)', () => {
  it('/ask lists all three transports in order', () => {
    const ask = skill('ask');
    const inApp = ask.indexOf('obsidian knowlery:query');
    const globalCli = ask.indexOf('knowlery query "<question>"');
    const embedded = ask.indexOf('node .knowlery/bin/query.mjs');
    expect(inApp).toBeGreaterThan(-1);
    expect(globalCli).toBeGreaterThan(inApp);
    expect(embedded).toBeGreaterThan(globalCli);
  });

  it('/cook incremental mode lists all three staleness transports', () => {
    const cook = skill('cook');
    expect(cook).toContain('obsidian knowlery:stale');
    expect(cook).toContain('knowlery stale');
    expect(cook).toContain('node .knowlery/bin/query.mjs --stale');
  });

  it('KNOWLEDGE.md template teaches the ladder', () => {
    const knowledgeMd = generateKnowledgeMd('KB');
    expect(knowledgeMd).toContain('obsidian knowlery:query');
    expect(knowledgeMd).toContain('knowlery query "<question>"');
    expect(knowledgeMd).toContain('node .knowlery/bin/query.mjs');
  });
});

describe('headless write branch (spec 0.7 f5, §4.2)', () => {
  it.each(['cook', 'organize', 'vault-conventions'])('%s keeps obsidian preference and adds the headless branch', (name) => {
    const content = skill(name);
    expect(content.toLowerCase()).toContain('headless');
    expect(content).toContain('knowlery health');
  });

  it('KNOWLEDGE.md operating rules cover headless environments', () => {
    expect(generateKnowledgeMd('KB')).toContain('headless environments');
  });
});

describe('retrieval-aware /cook (spec 0.7 f5, §4.3)', () => {
  it('/cook records nicknames, abbreviations, and cross-language titles as aliases', () => {
    const cook = skill('cook');
    expect(cook).toContain('aliases');
    expect(cook).toContain('cross-language title');
    expect(cook).toContain('abbreviations');
  });

  it('SCHEMA.md template documents the aliases field', () => {
    expect(generateSchemaMd()).toContain('`aliases`');
  });
});

describe('knowlery-cli skill (spec 0.8 f1, §4.3)', () => {
  it('ships as a tooling builtin', () => {
    const found = BUNDLED_SKILLS.find((entry) => entry.name === 'knowlery-cli');
    expect(found?.kind).toBe('tooling');
  });

  it('covers the full command surface', () => {
    const content = skill('knowlery-cli');
    for (const command of [
      'knowlery init', 'knowlery sync', 'knowlery health', 'knowlery query', 'knowlery stale',
      'knowlery bundle install', 'knowlery bundle list', 'knowlery bundle uninstall',
      'knowlery bundle export', 'knowlery bundle review',
    ]) {
      expect(content).toContain(command);
    }
  });

  it('teaches health as a post-bulk-change verification step', () => {
    expect(skill('knowlery-cli')).toContain('After any bulk change');
  });

  it('states the export review conduct: full checklist, user decisions only, explicit ids', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('Nothing ships unreviewed');
    expect(content).toContain('There is no approve-all flag');
    // 1. Present the checklist completely, warnings verbatim.
    expect(content).toContain('**completely**');
    expect(content).toContain('Never summarize warnings away');
    // 2. "Approve all" only after the full checklist was shown, expanded into ids.
    expect(content).toContain('only after');
    expect(content).toContain('expand it into explicit ids');
    // 3. Never act on own initiative; echo back what was recorded.
    expect(content).toContain('Never approve or flag items on your own initiative');
    expect(content).toContain('echo back');
  });

  it('shares the review state with the Obsidian modal (same scope file)', () => {
    expect(skill('knowlery-cli')).toContain('.knowlery/export-scope.json');
  });

  it('states the publish conduct: destination restated, risks shown before acknowledging, output relayed (spec 0.9 f2)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('knowlery bundle publish');
    expect(content).toContain('never pass');
    expect(content).toContain('--public');
    expect(content).toContain('Only pass');
    expect(content).toContain('--acknowledge-risks');
    expect(content).toContain('never on your own initiative');
    expect(content).toContain('audience statement');
    expect(content.replace(/\s+/g, ' ')).toContain('A public release is permanent');
  });

  it('teaches the subscription loop: read-only checks, never auto-update (spec 0.9 f3)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('knowlery bundle check-updates');
    expect(content).toContain('knowlery bundle update');
    expect(content.replace(/\s+/g, ' ')).toContain('never run `update` without the user asking');
    expect(content).toContain('read-only');
  });

  it('teaches URL installs: gh delegation, browser degradation, verify conduct (spec 0.9 f1)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('accepts an https URL');
    expect(content).toContain('gh` login');
    expect(content).toContain('never ask for or handle tokens');
    expect(content).toContain('--verify <sha256>');
    expect(content).toContain('Never fabricate or guess a checksum');
  });

  it('names the mcp command as a client-configured server, not an ad hoc command (spec 1.0 f2)', () => {
    const content = skill('knowlery-cli');
    expect(content).toContain('knowlery mcp');
    expect(content).toContain('over stdio');
  });
});

describe('/cook knows the inbox (spec 1.0 f3, §4.1)', () => {
  it('names inbox/ as first-priority capture material', () => {
    const cook = skill('cook');
    expect(cook).toContain('inbox/');
    expect(cook).toContain('first-priority cook material');
  });
});

describe('knowlery-mcp skill (spec 1.1 f2, §4.3/§5.5)', () => {
  it('ships as a tooling builtin and maps all nine tools', () => {
    const found = BUNDLED_SKILLS.find((entry) => entry.name === 'knowlery-mcp');
    expect(found?.kind).toBe('tooling');
    const content = skill('knowlery-mcp');
    for (const tool of ['query', 'capture', 'stale', 'health', 'init_kb', 'register_kb', 'sync', 'list_kbs', 'list_bundles']) {
      expect(content).toContain(`\`${tool}\``);
    }
  });

  it('carries the capture→cook loop, federation timing, and the conduct digest — not per-tool parameters', () => {
    const content = skill('knowlery-mcp');
    expect(content).toContain('a loop, not a call');
    expect(content).toContain('first-priority cook material');
    expect(content).toContain("Don't federate by default");
    expect(content).toContain('Findings are data');
    expect(content).toContain("Writes act on the user's words");
    expect(content).toContain("Surface conflicts, don't route around them");
    // Division of labor: parameters live in tool descriptions.
    expect(content.replace(/\s+/g, ' ')).toContain("Each tool's own description carries its parameters");
  });
});

describe('transport-aware revisions (spec 1.1 f2, §4.4)', () => {
  it('ask: MCP query is step zero of the ladder', () => {
    const ask = skill('ask');
    expect(ask).toContain('Transport 0');
    expect(ask.replace(/\s+/g, ' ')).toContain('it *is* the ladder');
  });

  it('cook and audit name the MCP stale tool first', () => {
    expect(skill('cook')).toContain('MCP `stale` tool');
    expect(skill('audit')).toContain('MCP `stale` tool');
  });

  it('knowlery-cli points shell-less agents at knowlery-mcp', () => {
    expect(skill('knowlery-cli')).toContain('knowlery-mcp');
  });
});

describe('the graph half of the wiki is taught (spec 1.2 f1 amendment)', () => {
  it('ask: overview questions start from the map; reading follows wikilinks', () => {
    const ask = skill('ask');
    expect(ask).toContain('Overview questions take a different door');
    expect(ask).toContain('orientation map');
    expect(ask).toContain('The wiki is a graph — follow it');
    expect(ask.replace(/\s+/g, ' ')).toContain('title/alias matching is the resolver');
  });

  it('knowlery-mcp: graph navigation with the MCP-specific source boundary', () => {
    const mcp = skill('knowlery-mcp');
    expect(mcp).toContain('The wiki is a graph — navigate it');
    expect(mcp.replace(/\s+/g, ' ')).toContain('a graph, not a pile of files');
    expect(mcp.replace(/\s+/g, ' ')).toContain('raw source content stays out of bounds over MCP');
  });

  it('aggregate counts are quoted from map.counts, never recomputed (acceptance follow-up)', () => {
    expect(skill('ask').replace(/\s+/g, ' ')).toContain('quote `counts` from the map verbatim');
    expect(skill('knowlery-mcp').replace(/\s+/g, ' ')).toContain('quote aggregate numbers directly from `counts`');
  });

  it('organize and ideas start their vault-mapping from the orientation map', () => {
    expect(skill('organize')).toContain('knowlery index');
    expect(skill('ideas')).toContain('knowlery index');
  });
});

describe('write path chosen by operation, with the escaping failure branch (1.2.3 skills review)', () => {
  it('vault-conventions: the decision table, path= teaching, and the do-not-fight-the-shell branch', () => {
    const content = skill('vault-conventions').replace(/\s+/g, ' ');
    expect(content).toContain('by the operation, not by whether Obsidian is running');
    expect(content).toContain('path="dir/note.md"');
    expect(content).toContain('do not fight the shell');
    expect(content).toContain('command substitution');
  });

  it('cook: direct write for full pages, path= for create, no shell fighting', () => {
    const content = skill('cook').replace(/\s+/g, ' ');
    expect(content).toContain('by operation, not by environment');
    expect(content).toContain('write the `.md` file directly at its exact path');
    expect(content).toContain('fighting the shell');
  });

  it('obsidian-cli: the long-content section names the three bash hazards and the switch-over rule', () => {
    const content = skill('obsidian-cli').replace(/\s+/g, ' ');
    expect(content).toContain('Writing long or complex content');
    expect(content).toContain('command substitution');
    expect(content).toContain('path="dir/note.md"');
    expect(content).toContain('do not retry with more escaping');
  });

  it('ask and ideas save via the vault-conventions rules, not an unconditional obsidian create', () => {
    for (const name of ['ask', 'ideas']) {
      const content = skill(name).replace(/\s+/g, ' ');
      expect(content, name).toContain('vault-conventions');
      expect(content, name).not.toContain('Use `obsidian create` to save');
    }
  });

  it('explore and challenge scope the CLI principle to reading and defer writes to vault-conventions', () => {
    for (const name of ['explore', 'challenge']) {
      const content = skill(name).replace(/\s+/g, ' ');
      expect(content, name).toContain('reading workbench');
      expect(content, name).toContain('vault-conventions');
      expect(content, name).not.toContain('All note operations go through Obsidian CLI');
    }
  });
});

describe('the dot-directory boundary is taught (field finding, verified on Obsidian 1.12.7)', () => {
  it('obsidian-cli: read and create cannot reach dot-directories; no retries; success/failure signals named', () => {
    const content = skill('obsidian-cli').replace(/\s+/g, ' ');
    expect(content).toContain("outside Obsidian's vault index");
    expect(content).toContain('including `read` and `create`, even with `path=`');
    expect(content).toContain('do not retry the Obsidian CLI');
    expect(content).toContain('while still exiting with status 0');
    expect(content).toContain('require a `Created: <path>` result');
  });

  it('vault-conventions: boundary covers read and create; full-page rule names charts and tables', () => {
    const content = skill('vault-conventions').replace(/\s+/g, ' ');
    expect(content).toContain('Hidden Config Paths');
    expect(content).toContain('including `read` and `create`');
    expect(content).toContain('Mermaid or other charts');
  });

  it('vault-conventions: rules loading is platform-scoped — Codex reads hidden rule files itself', () => {
    const content = skill('vault-conventions').replace(/\s+/g, ' ');
    expect(content).toContain('Codex does not automatically receive');
    expect(content).toContain('AGENTS.md');
  });
});

describe('blank-note side effect is taught (field finding: CLI introspection call created Untitled.md)', () => {
  it('obsidian-cli: bare invocation forbidden — it opens the TUI and can leave Untitled.md', () => {
    const content = skill('obsidian-cli').replace(/\s+/g, ' ');
    expect(content).toContain('Never run `obsidian` with no command');
    expect(content).toContain('Untitled.md');
  });

  it('obsidian-cli: deletion requires proof of tool origin (own bare call, new, empty); otherwise leave and ask', () => {
    const content = skill('obsidian-cli').replace(/\s+/g, ' ');
    expect(content).toContain('provably tool debris');
    expect(content).toContain('did not exist before');
    expect(content).toContain('it is empty');
    expect(content).toContain('`obsidian delete path="Untitled.md"`');
    expect(content).toContain('leave it and ask the user');
  });

  it('obsidian-cli: deletion is verified with a targeted read and a not-found signal, never the exit code', () => {
    const content = skill('obsidian-cli').replace(/\s+/g, ' ');
    expect(content).toContain('`obsidian read path="Untitled.md"`');
    expect(content).toContain('not found');
    expect(content).toContain('never the exit code');
  });
});

describe('reference hygiene: no phantom skills, no invalid CLI syntax (1.2.3 skills review)', () => {
  it.each(BUNDLED_SKILLS.map((entry) => entry.name))('%s references no removed skill (/trace, /connect, /wiki)', (name) => {
    const content = skill(name);
    expect(content).not.toContain('/trace');
    expect(content).not.toContain('/connect');
    expect(content).not.toContain('/wiki');
  });

  it.each(BUNDLED_SKILLS.map((entry) => entry.name))('%s uses no OR search operator', (name) => {
    expect(skill(name)).not.toContain('" OR "');
  });

  it('search commands pass query= (the documented CLI signature)', () => {
    expect(skill('explore')).toContain('obsidian search query=');
    expect(skill('explore')).toContain('obsidian search:context query=');
    expect(skill('explore')).not.toContain('obsidian tags "');
    expect(skill('challenge')).toContain('obsidian search query=');
    expect(skill('ask')).toContain('obsidian search query=');
  });
});

describe('naming conventions agree across skills (1.2.3 skills review)', () => {
  it('vault-conventions and organize both state lowercase-hyphen for agent pages and hands-off for user notes', () => {
    const conventions = skill('vault-conventions').replace(/\s+/g, ' ');
    expect(conventions).toContain('lowercase with hyphens');
    expect(conventions).not.toContain('Title Case or kebab-case');
    const organize = skill('organize').replace(/\s+/g, ' ');
    expect(organize).toContain('lowercase with hyphens');
    expect(organize).toContain("user notes keep the user's own naming");
  });
});

describe('/audit on CLI primitives (spec 0.7 f5, §4.4)', () => {
  it('names the deterministic tools and the dangling-sources category', () => {
    const audit = skill('audit');
    expect(audit).toContain('obsidian orphans');
    expect(audit).toContain('obsidian unresolved');
    expect(audit).toContain('obsidian deadends');
    expect(audit).toContain('Dangling Sources');
    expect(audit).toContain('--stale');
  });
});
