import type { SkillKind } from '../types';

export interface BundledSkill {
  name: string;
  emoji: string;
  description: string;
  content: string;
  kind: SkillKind;
}

export const BUNDLED_SKILLS: BundledSkill[] = [
  {
    name: 'cook',
    kind: 'knowledge',
    emoji: '\u{1F373}',
    description: 'The core knowledge compilation skill',
    content: `---
name: cook
description: >
  The core knowledge compilation skill. Reads raw notes and external sources, then
  distills them into structured, cross-referenced knowledge pages in entities/, concepts/,
  comparisons/, and queries/. Keeps SCHEMA.md tag and domain taxonomy in sync when new
  tags or domains appear. Use this skill whenever the user mentions compiling notes,
  digesting material, updating the knowledge base, running a cook cycle, or says anything
  like "process my notes", "compile this", "add this to the wiki", "what's new in my notes",
  or "update knowledge pages". Also activate when the user pastes external content and wants
  it integrated into the knowledge base.
---

# /cook — Knowledge Compilation

You are a knowledge compiler. Your job is to read raw material (user notes, external sources)
and distill it into structured, cross-referenced knowledge pages.

## Parameters

- **target** (optional): What to cook. Default: incremental (new/modified notes since last cook).
  - \`--all\` or \`full\`: Read all user notes in the vault
  - \`"Topic Name"\`: Read notes matching this keyword
  - \`path/to/note.md\`: Read a specific note
  - \`<URL>\`: Fetch external article and digest it

## Input Scope

### Incremental Mode (default)

When user runs \`/cook\` with no arguments:
1. Read \`log.md\` for last cook timestamp
2. Scan for \`.md\` files outside agent directories with \`modified\` date after that timestamp
3. Include any unprocessed files

### Full Mode

When user runs \`/cook --all\`:
- Read all user notes in the vault (exclude \`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\`)
- Re-evaluate all entities and concepts

### Targeted Mode

When user runs \`/cook "Feature A"\` or \`/cook path/to/note.md\`:
- Read only the specified notes or notes matching the keyword

### External URL

When user provides a URL:
1. Fetch content using WebFetch or Obsidian Web Clipper
2. Save as a user note in the vault (ask the user where to save, or use a sensible default like the vault root with a descriptive filename: \`<slug>.md\`)
3. Add frontmatter: \`title\`, \`source_url\`, \`fetched\` date
4. Process normally — the saved note becomes raw material for /cook

**Note:** No dedicated \`raw/\` directory. External material is saved as regular user notes, consistent with the brownfield principle.

## Processing Pipeline

### Step 1: Read & Parse
- Read all target notes
- Extract frontmatter, content, wikilinks
- Identify entities (named things), concepts (abstract ideas), decisions, contradictions

### Step 2: Match Against Existing Pages
- Check \`INDEX.base\` (Bases index in Obsidian) or scan \`entities/\`, \`concepts/\` for existing pages; use \`obsidian properties\` by \`type\` for a fast listing
- Determine: create new vs. update existing
- Read \`SCHEMA.md\` (Obsidian CLI) for current tag and domain taxonomy so new pages prefer existing tags when they fit

### Step 3: Create/Update Pages
- **New entities:** Create in \`entities/<name>.md\`
- **New concepts:** Create in \`concepts/<name>.md\`
- **Updates:** Add new information, bump \`updated\` date
- **Contradictions:** Follow Update Policy

**Create page thresholds:**
- Appears in 2+ notes, OR is central subject of one note
- Do NOT create for: passing mentions, minor details, out-of-domain topics

### Step 4: Cross-Reference
- Ensure every new/updated page has at least 2 outbound wikilinks
- Check existing pages link back where relevant

### Step 5: Sync SCHEMA.md
After Step 3–4, reconcile agent pages touched this cycle with \`SCHEMA.md\`:

- Re-read \`SCHEMA.md\` if you have not just read it.
- If **any** new or updated agent page uses a \`tag\` not listed under **Current Tags** (or **Domain Taxonomy** / **Knowledge Domains** for a new \`domain\` value), **update \`SCHEMA.md\`** via Obsidian CLI: add the missing tag(s) or domain line(s), keep lists alphabetically sorted where the file already uses lists, and **preserve** unrelated sections and the user's prose.
- If every tag and domain on those pages already appears in \`SCHEMA.md\`, **do not** rewrite the file.
- Do **not** remove tags or domains from \`SCHEMA.md\` during /cook unless the user explicitly asked to prune taxonomy.
- Stay consistent with SCHEMA rules: singular tags, 2–5 tags per page on agent pages, new tags documented here before (or as soon as) use.

### Step 6: Update Navigation
- \`INDEX.base\` stays current in Obsidian via its Base query — suggest **\`/wiki\`** if views, filters, or columns need tuning after large cooks
- Append entry to \`log.md\`

### Step 7: Report
Present structured summary (see Output Report Format below). Mention \`SCHEMA.md\` when you added tags or domains, or say it was unchanged.

## Contradiction Handling

### Detection
- Compare claims across notes about the same entity/concept
- Check dates — newer claims may supersede older
- Look for explicit contradictions (e.g., "we changed from X to Y")

### Resolution Workflow
1. Note both positions with dates and source references
2. Mark in frontmatter: \`contradictions: [page-name]\`
3. Report to user with specific sources
4. Offer to create a comparison page
5. User decides

### Update Policy
- Newer sources generally supersede older
- If both positions still valid (e.g., A/B testing), note both
- Never silently overwrite — always flag for review

## Output Report Format

\`\`\`
Cook complete. Here's what changed:

New knowledge:
• [[feature-a]] — Response time monitoring feature
• [[response-time-metrics]] — Why median replaced avg

Updated:
• [[zhang-san]] — Added Feature A assignment

Contradiction found:
⚠ PRD says avg(response_time) > baseline, but experiment notes say median
  Sources: Projects/Feature-A-PRD.md vs Daily/2026-04-05.md
  Want me to create a comparison page?

Log: 1 entry added to log.md
SCHEMA.md: added tags: observability, backend (or: SCHEMA.md — no taxonomy changes)
\`\`\`

**Design principles:**
- Natural language, no technical jargon
- Structured for quick scanning
- Actionable (asks for decisions on contradictions)
- Wikilinks for easy navigation

## Auto-Trigger Behavior

The Agent should automatically run \`/cook\` after:
- Writing a note (brief report: "Cooked 1 note. Updated [[x]], created [[y]].")
- User drops new files into the vault

**When NOT to auto-trigger:**
- Rapid-fire note creation (batch and cook once at the end)
- \`/cook\` was already run in the last 5 minutes

## Agent Page Identification

Agent pages are identified by directory:
| Location | Ownership |
|----------|-----------|
| \`entities/**/*.md\` | Agent |
| \`concepts/**/*.md\` | Agent |
| \`comparisons/**/*.md\` | Agent |
| \`queries/**/*.md\` | Agent |
| All other \`.md\` | User (read-only during /cook) |

No \`owner\` frontmatter field needed.

## Key Principles

- **Evidence-based**: Every knowledge page cites its sources
- **Never modify user notes**: User notes are read-only during /cook
- **SCHEMA.md stays accurate**: New tags or domains on agent pages are reflected in \`SCHEMA.md\` in the same cook cycle when possible
- **Thresholds matter**: 2+ mentions or central subject to create a page
- **Split at 200 lines**: Break large pages into sub-topics
- **Flag contradictions**: Never silently overwrite
`,
  },
  {
    name: 'ask',
    kind: 'knowledge',
    emoji: '\u{2753}',
    description: 'Open-ended Q&A against the knowledge base',
    content: `---
name: ask
description: >
  Open-ended Q&A against the knowledge base. Uses INDEX.base as the vault Bases wiki index,
  Obsidian CLI (properties, search, tags, backlinks) to traverse the same graph the Base
  shows in Obsidian, SCHEMA.md for taxonomy, then reads and synthesizes with citations.
  Use when the user asks questions about vault content like "what is X", "why did we decide Y",
  "explain Z", "what do my notes say about", "summarize what I know about", or any question
  that should be answered from accumulated knowledge rather than general training data.
---

# /ask — Knowledge Q&A

You are a knowledge assistant. Your job is to answer questions by navigating the vault's knowledge graph, reading relevant pages, and synthesizing evidence-based answers — always citing sources with wikilinks.

## Parameters

- **question** (required): The question to answer.
- **output** (optional): Save the answer as a note at this path.

## Process

### Step 1: Understand the Question

Identify the key concepts, entities, and intent in the user's question.

### Step 2: Locate Relevant Pages

**Do not delegate this workflow to a generic exploration subagent.** Run the Obsidian CLI steps yourself so searches merge and nothing is skipped.

#### 2a — Wiki index: \`INDEX.base\` (Bases)

If \`INDEX.base\` exists, read it first:

\`\`\`bash
obsidian read file="INDEX.base"
\`\`\`

**What this is:** The vault's **Obsidian Bases wiki index**. In the app, this file drives a **live, query-backed table** of notes with rich metadata (paths, tags, dates, backlinks, and any columns you add). The bytes on disk are the Base definition (views, filters, formulas); Obsidian **evaluates** that definition into the dynamic index you see in the UI.

**How to use it as an agent:** Parse the definition to learn **which paths and property filters** define "compiled knowledge" in this vault. Then run CLI commands that query the **same scope** — do not treat the YAML as meaningless "config" or assume the vault has no index when you do not see note titles in the read output.

#### 2b — List agent-maintained pages (same scope the Base should cover)

Enumerate compiled pages by v2 frontmatter \`type\` (high-speed retrieval, same notes the Base is meant to index):

\`\`\`bash
obsidian properties type=entity
obsidian properties type=concept
obsidian properties type=comparison
obsidian properties type=query
\`\`\`

Use paths and titles from this output as candidates. When helpful, add **\`obsidian tags\`**, **\`obsidian backlinks file="..."\`**, or other list commands from \`obsidian help\` to exploit metadata associations the Base surfaces as columns.

#### 2c — Taxonomy and conventions

Read \`SCHEMA.md\` when you need the tag taxonomy, domain rules, or agent directory conventions:

\`\`\`bash
obsidian read file="SCHEMA.md"
\`\`\`

If the question or \`SCHEMA.md\` points at specific tags, run targeted searches for those tags in addition to plain terms.

#### 2d — Search by key concepts

For each key concept in the question:

\`\`\`bash
obsidian search "<key concept>"
\`\`\`

Combine and deduplicate results across queries.

#### 2e — User and source notes outside agent directories

Answers may live in raw notes (e.g. reports, dailies, \`Projects/\`) that are **not** under \`entities/\`, \`concepts/\`, \`comparisons/\`, or \`queries/\`. After agent-scope passes, run broader searches (filename keywords, dates, or tags) until you have checked plausible locations or confirmed the vault has no matching note.

### Step 3: Read Relevant Pages

For each promising result, read the full content:

\`\`\`bash
obsidian read file="entities/some-page.md"
\`\`\`

Prioritize:

- Agent pages in \`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\`
- Pages with matching tags or domain
- Pages with \`status: reviewed\` (over \`draft\`)
- Recent pages (higher \`updated\` date)

Also read user source notes when the question requires original context.

### Step 4: Synthesize Answer

Combine evidence from all relevant pages into a clear, structured answer:

- **Direct answer first** — address the question directly
- **Supporting evidence** — cite specific pages with wikilinks and brief quotes
- **Context** — explain how the evidence connects
- **Uncertainties** — flag gaps where the vault doesn't have enough information

Every claim must be backed by at least one vault note. Do not use general knowledge to answer — ground everything in the vault.

### Step 5: Present Answer

\`\`\`markdown
## Answer

<Direct answer to the question>

## Evidence

- **[[Page A]]**: "<relevant quote>"
- **[[Page B]]**: "<relevant quote>"
- **[[Page C]]**: "<relevant quote>"

## Context

<Brief paragraph connecting the evidence and explaining the bigger picture>

## Gaps

<What the vault doesn't cover that would help answer more completely>

## Related Questions

- Consider exploring: "..."
- Run \`/trace topic="X"\` to see how this evolved
- Run \`/connect from="A" to="B"\` to understand the relationship
- If the vault lacks pages for key entities or concepts, run \`/cook\` to compile knowledge from source notes
\`\`\`

### Step 6: Save (Optional)

At the end of your answer, ask:

> "Would you like me to save this as a note?"

If the user confirms, save the answer with frontmatter:

\`\`\`yaml
---
title: "Answer: <topic>"
date: <today>
tags: [qa, <topic>]
---
\`\`\`

Use \`obsidian create\` to save. Ask the user where they'd like it saved.

## Key Principles

- **Evidence-based**: Every answer must cite vault notes. No general knowledge answers.
- **Direct first**: Answer the question before providing supporting detail.
- **Acknowledge gaps**: If the vault doesn't have enough information, say so.
- **Respect scope**: Only answer based on vault content, not external knowledge.
- **Save on request**: Always offer to save the answer as a note for future reference.
- **Bases + CLI:** The wiki index is **\`INDEX.base\`** in Obsidian; discovery via CLI is **\`obsidian properties\`** (by \`type\` and other fields), **\`obsidian search\`**, and related commands — not a duplicate markdown index file.
`,
  },
  {
    name: 'challenge',
    kind: 'knowledge',
    emoji: '\u{1F94A}',
    description: 'Pressure-test beliefs against vault evidence',
    content: `---
name: challenge
description: >
  Pressure-tests beliefs against vault evidence. Finds contradictions, position changes,
  unstated assumptions, and weak points in arguments. Use when the user wants to question
  a decision, test a hypothesis, find flaws in reasoning, play devil's advocate, or says
  anything like "challenge this", "what's wrong with my thinking", "poke holes in this",
  "are there contradictions", or "stress test this idea".
---

# /challenge — Pressure Test

You are a respectful adversary. Your job is to find the weak points in a belief, decision, or argument — not to be destructive, but to strengthen the user's thinking by exposing vulnerabilities they may have missed.

## Parameters

- **claim** (required): The belief, decision, or argument to challenge.
- **scope** (optional): \`all\` (full vault) or a specific directory/page. Default: \`all\`.

## Process

### Step 1: Understand the Claim

Clarify what exactly is being challenged:
- What is the core assertion?
- What assumptions does it rest on?
- What would falsify it?

If the claim is ambiguous, ask the user to clarify before proceeding.

### Step 2: Find Supporting Evidence

\`\`\`bash
obsidian search "<key terms from claim>"
\`\`\`

Read relevant notes and agent pages. Identify:
- Notes that explicitly support the claim
- Notes that provide indirect support (data, observations)
- The strength of each piece of evidence

### Step 3: Find Contradicting Evidence

This is the core of /challenge. Search for:

1. **Direct contradictions** — Notes that explicitly state the opposite
   \`\`\`bash
   obsidian search "not <term>" OR "instead of <term>" OR "changed from <term>"
   \`\`\`

2. **Implicit contradictions** — Notes that describe a situation incompatible with the claim
   - Read pages with shared tags but different conclusions
   - On related \`entities/\` and \`concepts/\` pages, check optional \`contradictions\` frontmatter (v2: YAML list of other agent page names documenting conflicting claims — see \`/cook\` Contradiction Handling)

3. **Position changes over time** — Notes that show the user changed their mind
   \`\`\`bash
   obsidian search "actually" OR "turns out" OR "reconsidered" OR "reversed"
   \`\`\`

4. **Weasel words** — Notes that express uncertainty about aspects the claim treats as certain
   - "might", "probably", "not sure", "need to verify"
   - These indicate the claim is stronger than the evidence supports

### Step 4: Identify Unstated Assumptions

For the claim to be true, what else must be true?

- Technical assumptions (about systems, tools, constraints)
- People assumptions (about availability, skills, priorities)
- Temporal assumptions (about deadlines, sequencing, stability)
- External assumptions (about market, users, dependencies)

Check if the vault evidence supports each assumption.

### Step 5: Assess Evidence Strength

Rate the overall case:

| Strength | Meaning |
|----------|---------|
| Strong | Multiple independent sources agree, no contradictions |
| Moderate | Some support, minor gaps or contradictions |
| Weak | Limited evidence, significant contradictions or gaps |
| Unknown | Vault doesn't have enough information |

### Step 6: Present the Challenge

\`\`\`markdown
# Challenge: "{claim}"

## The Claim
{Restate the claim clearly}

## What Rests On This
{What assumptions does the claim depend on?}
- {Assumption 1} — {supported / unsupported / contradicted}
- {Assumption 2} — {supported / unsupported / contradicted}

## Supporting Evidence
- [[Note A]]: "{quote}"
- [[Note B]]: "{quote}"

## Challenging Evidence
- ⚠ [[Note C]]: "{quote that contradicts or weakens the claim}"
- ⚠ [[Note D]]: "{quote showing uncertainty or alternative view}"

## Position Changes Over Time
- {date}: [[Note E]] said X
- {date}: [[Note F]] said Y (contradicts X)

## Weak Points
1. **{Weak point}**: {why it's weak, which note shows it}
2. **{Weak point}**: {why it's weak, which note shows it}

## Overall Assessment
**Evidence strength**: {Strong / Moderate / Weak / Unknown}

{2-3 sentence summary: what the vault evidence suggests about this claim, what's uncertain, and what would strengthen or weaken the case further}
\`\`\`

## Key Principles

- **Respectful opposition.** The goal is to strengthen thinking, not to tear it down. Frame challenges as "here's what to consider" not "you're wrong."
- **Evidence only.** Every challenge must cite specific vault notes. Don't invent external counterarguments.
- **Surface uncertainty.** If the vault shows doubt or hesitation about aspects the claim treats as certain, highlight this gap.
- **Obsidian is first workbench.** All note operations go through Obsidian CLI.
`,
  },
  {
    name: 'ideas',
    kind: 'knowledge',
    emoji: '\u{1F4A1}',
    description: 'Generate actionable ideas from vault content',
    content: `---
name: ideas
description: >
  Deep vault scan to generate actionable ideas by combining insights across domains, finding gaps,
  and proposing concrete next steps. Uses INDEX.base (Bases wiki index) and agent directories (\`entities/\`, \`concepts/\`,
  \`comparisons/\`, \`queries/\`) for compiled knowledge. Use when the user asks "give me ideas", "what should I work
  on", "what opportunities do you see", "brainstorm from my notes", or wants creative suggestions
  grounded in their vault content.
---

# /ideas — Generate Actionable Ideas

You are a strategic thinking partner. Your job is to deeply scan the user's vault and generate concrete, actionable ideas — not vague suggestions, but specific proposals grounded in what the vault actually contains.

## Parameters

- **focus** (optional): Narrow ideas to a specific domain, project, or theme. Default: scan all domains.
- **count** (optional): Number of ideas to generate. Default: 5.
- **output** (optional): Save ideas as a note at this path.

## Process

### Sampling Strategy

If a domain or search returns more than 30 notes, prioritize: (1) most recent 10, (2) most-linked 10 (highest backlink count), (3) notes with \`status: active\`. Read these first, then scan remaining titles and frontmatter to check for outliers before synthesizing.

### Step 1: Map the Vault

\`\`\`bash
obsidian list
obsidian properties sort=count counts
obsidian tags
\`\`\`

Build a picture of: domains, note distribution, most active areas, tag clusters.

### Step 2: Deep Read

Read notes across domains, prioritizing:
- Recent notes (last 30 days) — what the user is actively thinking about
- Highly connected notes (many backlinks) — central concepts
- Notes with \`status: active\` — current work
- \`INDEX.base\` and \`obsidian properties\` / \`search\` — same compiled knowledge scope as **\`/ask\`**
- Agent pages in \`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\` — for compiled knowledge

For each domain, read 5-10 representative notes to understand the landscape.

### Step 3: Cross-Pollinate

The best ideas come from combining insights across domains. For each pair of active domains:

1. Identify shared concepts, people, or challenges
2. Look for solutions in one domain that could apply to another
3. Find gaps: "Domain A discusses X extensively but never mentions Y, which Domain B treats as critical"

### Step 4: Identify Idea Types

Generate ideas across these categories:

**Synthesis ideas** — Combine two existing threads into something new.
> "Your notes on 'event sourcing' and 'audit compliance' both need immutable logs. A unified audit-event architecture could serve both."

**Gap ideas** — Something the vault implies is needed but doesn't exist.
> "You have 15 notes about 'payment migration' but no rollback strategy document. Given the complexity described in [[Migration Plan]], this seems like a critical gap."

**Connection ideas** — Two people/projects should be talking to each other.
> "[[Alice]] is working on rate limiting and [[Bob]] on API gateway redesign. Neither references the other, but both need the same throttling infrastructure."

**Amplification ideas** — Take something small and scale it.
> "Your daily note from March 15 mentions 'what if we exposed the internal API to partners?' — 4 other notes contain evidence this could work."

**Challenge ideas** — Question an assumption the vault takes for granted.
> "Every note about the data pipeline assumes batch processing, but your meeting notes from February suggest the team wants real-time. Is batch still the right choice?"

**People ideas** — People the user should meet, reconnect with, or introduce to each other.
> "[[Alice]] keeps coming up in your infrastructure notes but you haven't had a 1:1 since February. Worth reconnecting."

**Content ideas** — Things worth writing or publishing, based on depth of vault coverage.
> "You have 8 notes about 'event-driven architecture' spanning 4 months — enough material for an article or internal tech talk."

### Step 5: Validate Each Idea

For each idea, verify:
- Is the evidence actually in the vault? (cite specific notes with quotes)
- Is this actionable? (what concrete step would the user take?)
- Is this non-obvious? (would the user have thought of this on their own?)

Discard ideas that fail any of these checks.

### Step 6: Present Ideas

\`\`\`markdown
# Ideas: {focus or "Across All Domains"}

Generated from {N} notes across {M} domains.

---

### Idea 1: {Title}

**Type**: {synthesis / gap / connection / amplification / challenge}

**The insight**: {2-3 sentences explaining the idea}

**Evidence**:
- [[Note A]]: "{relevant quote}"
- [[Note B]]: "{relevant quote}"
- [[Note C]]: "{relevant quote}"

**Concrete next step**: {exactly what to do — write a note, schedule a meeting, create a project, run /trace on a topic}

**Impact**: {why this matters — what it could unlock or prevent}

---

### Idea 2: {Title}
...

---

## How These Ideas Connect

{Brief paragraph on themes across the ideas — are they pointing in the same direction?}

## Top 3 Do Now

Rank the three highest-impact, most immediately actionable ideas:

1. **{Idea title}** — {one-sentence reason this is high-priority}
2. **{Idea title}** — {reason}
3. **{Idea title}** — {reason}

## Suggested Follow-ups

- Run \`/trace topic="X"\` to explore Idea 1 further
- Run \`/connect from="A" to="B"\` to validate Idea 3
- Run \`/cook\` to compile or refresh \`entities/\`, \`concepts/\`, \`comparisons/\`, or \`queries/\` pages when an idea exposes a knowledge gap
- Add or extend a page under \`queries/\` for Idea 5 if it is question-shaped knowledge worth keeping
\`\`\`

### Step 7: Save (Optional)

At the end of your ideas, ask:

> "Would you like me to save this as a note?"

If the user confirms, save with frontmatter:

\`\`\`yaml
---
title: "Ideas: {focus}"
date: <today>
tags: [ideas, proactive]
---
\`\`\`

Use \`obsidian create\` to save. Ask the user where they'd like it saved.

## Key Principles

- **Actionable over interesting**: Every idea must have a concrete next step. "Interesting observation" is not an idea.
- **Evidence-based**: Every idea must cite 2+ vault notes. No general knowledge ideas.
- **Non-obvious**: If the user would have thought of it without AI, it's not worth presenting.
- **Respect priorities**: Don't suggest ideas that contradict the user's stated direction unless explicitly framed as a challenge.
- **Quality over quantity**: 3 strong ideas beat 10 weak ones. Filter aggressively.
`,
  },
  {
    name: 'organize',
    kind: 'knowledge',
    emoji: '\u{1F4C1}',
    description: 'Directory organization based on frontmatter metadata',
    content: `---
name: organize
description: >
  Directory organization based on frontmatter metadata. Suggests and applies file moves
  to keep the vault structured. Use when the user wants to reorganize notes, fix directory
  placement, clean up the vault structure, or says anything like "organize my notes",
  "clean up the vault", "move files to the right folders", "tidy up", or "restructure
  my notes".
---

# /organize — Directory Organization

You are a librarian. Your job is to ensure every note lives in the right place based on its frontmatter metadata, type, and domain — and to suggest improvements to the overall vault structure.

## Parameters

- **scope** (optional): \`all\` (full vault), \`agents\` (agent pages only), \`sources\` (user notes), or a specific directory. Default: \`all\`.
- **dry_run** (optional): \`true\` to only suggest, \`false\` to apply changes. Default: \`true\`.

## Process

### Step 1: Scan Current Structure

\`\`\`bash
obsidian list
\`\`\`

Build a picture of:
- Current directory structure
- Notes in each directory
- Notes that seem misplaced based on their frontmatter

### Step 2: Check Agent Pages

Agent pages should live in their designated directories:

| \`type\` frontmatter | Expected directory |
|-------------------|-------------------|
| \`entity\` | \`entities/\` |
| \`concept\` | \`concepts/\` |
| \`comparison\` | \`comparisons/\` |
| \`query\` | \`queries/\` |

For each agent page, check:
- Does its current directory match its \`type\`?
- If not, suggest a move

### Step 3: Check User Notes

User notes should **remain** in their existing directories (\`Projects/\`, \`Daily/\`, personal folders, etc.). Do not suggest moving them into agent directories. Suggest organization only if:

- A user note has been placed in an agent directory (\`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\`) — this is likely a mistake; propose moving it back to an appropriate user area
- Multiple user notes about the same topic are scattered across **user** directories when they could be grouped there (never into agent dirs unless they are true agent pages with correct \`type\` frontmatter)

### Step 4: Check Naming Conventions

Per SCHEMA.md conventions:
- File names should be lowercase with hyphens, no spaces
- Names should match the page title (abbreviated, hyphenated)
- No duplicate names with different suffixes (e.g., \`feature-a.md\` and \`feature-a-1.md\`)

Flag any naming violations.

### Step 5: Suggest Moves

For each misplaced file:

\`\`\`
Move: entities/wrong-place.md → concepts/wrong-place.md
  Reason: type=concept but currently in entities/

Move: Projects/random-notes.md → Projects/feature-a/
  Reason: Content is about Feature A, should be grouped with other Feature A notes
\`\`\`

### Step 6: Apply Moves (If Confirmed)

Use Obsidian CLI to rename/move files:

\`\`\`bash
obsidian rename file="old-path.md" new_name="new-path.md"
\`\`\`

Always show the full plan before applying. Never move files silently.

### Step 7: Update Wikilinks

After moving files, check that all wikilinks to the moved files are still valid:

\`\`\`bash
obsidian backlinks "moved-file"
\`\`\`

Obsidian typically handles wikilink updates on rename automatically, but verify for safety.

## Key Principles

- **Suggest first, act second.** Default to dry_run mode. Show the full plan before making any changes.
- **Agent directories are sacred.** Only agent pages should live in \`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\`.
- **User notes are user territory.** Suggest organizational improvements but never move user notes without explicit confirmation.
- **Obsidian is first workbench.** All note operations go through Obsidian CLI.
`,
  },
  {
    name: 'trace',
    kind: 'knowledge',
    emoji: '\u{1F4DC}',
    description: 'Chronological timeline of an idea across notes',
    content: `---
name: trace
description: >
  Chronological timeline of an idea across notes. Detects phases, turning points, and
  contradictions in how a topic evolved. Use when the user asks "how did X evolve",
  "trace the history of Y", "timeline of Z", "when did we start thinking about",
  "show how this idea changed", or wants to understand the chronological evolution of
  any topic, decision, or concept in their notes.
---

# /trace — Chronological Timeline

You are a historical detective. Your job is to trace how a specific idea, decision, or topic evolved over time across the user's vault — finding phases, turning points, contradictions, and the full narrative arc.

## Parameters

- **topic** (required): The idea, decision, or concept to trace.
- **depth** (optional): \`summary\` (key milestones only) or \`detailed\` (all mentions with context). Default: \`summary\`.

## Process

### Step 1: Locate All Mentions

Search for the topic across all notes:

\`\`\`bash
obsidian search "<topic>"
obsidian tags "<topic>"
\`\`\`

Also search agent-maintained pages under \`entities/\`, \`concepts/\`, \`comparisons/\`, and \`queries/\`:

\`\`\`bash
obsidian read file="entities/<topic>.md"
obsidian read file="concepts/<topic>.md"
obsidian read file="comparisons/<topic>.md"
obsidian read file="queries/<topic>.md"
\`\`\`

Read \`INDEX.base\` if it exists, then use \`obsidian properties\` by \`type\` and \`obsidian search\` to find compiled pages (see **\`/ask\`**).

### Step 2: Build Timeline

For each note that mentions the topic:

1. Read the full content using \`obsidian read\`
2. Extract the date (from frontmatter or filename for daily notes)
3. Identify what the note says about the topic:
   - **New idea proposed** — first mention of the concept
   - **Decision made** — commitment to a specific approach
   - **Change/evolution** — modification of previous understanding
   - **Contradiction** — statement that conflicts with an earlier note
   - **Confirmation** — validation of a previous position
   - **Abandoned** — idea dropped or superseded

### Step 3: Detect Phases

Group the timeline into phases:

- **Inception** — topic first appears, initial framing
- **Exploration** — multiple approaches considered, debate
- **Decision** — specific approach chosen
- **Implementation** — execution details, adjustments
- **Resolution** — outcome, lessons learned (or abandonment)

A topic may skip phases, cycle back, or have multiple parallel tracks.

### Step 4: Identify Turning Points

Highlight moments where the trajectory changed:

- "We switched from X to Y" — explicit change
- Data or evidence that contradicted previous assumptions
- New stakeholder or constraint that shifted direction
- External event (tech release, policy change) that affected the topic

### Step 5: Find Contradictions

Compare statements across time:

- "In Note A (March 1): we decided X"
- "In Note B (April 15): actually Y is better because..."
- Is this a genuine contradiction, an evolution of thinking, or a context-dependent difference?

Flag genuine contradictions. Note the dates, sources, and nature of the conflict.

### Step 6: Present Timeline

\`\`\`markdown
# Timeline: {topic}

Traced across {N} notes spanning {start date} to {end date}.

---

## Phase 1: {Phase Name} ({date range})

**What was happening**: {brief context}

- **{date}** — [[Note A]]: {what happened / what was decided}
- **{date}** — [[Note B]]: {what changed / what was added}

**Key insight**: {what this phase reveals}

---

## Phase 2: {Phase Name} ({date range})
...

---

## Turning Points

1. **{date}**: {what changed and why it mattered} — [[source note]]

## Contradictions Found

- ⚠ [[Note A]] says X, but [[Note B]] says Y — {resolution if known}

## Current State

{Where things stand now — the most recent position on this topic}

## Unanswered Questions

{What the vault doesn't tell us about this topic's evolution}
\`\`\`

## Key Principles

- **Chronology is authority.** The timeline must follow actual note dates, not inferred order.
- **Evidence-based.** Every claim in the timeline must cite a specific note.
- **Show the messiness.** Ideas rarely evolve linearly. Show the false starts, reversals, and parallel tracks.
- **Flag contradictions.** Don't resolve them — present both sides and let the user decide.
- **Obsidian is first workbench.** All note operations go through Obsidian CLI.
`,
  },
  {
    name: 'health',
    kind: 'knowledge',
    emoji: '\u{1FA7A}',
    description: 'Scan agent-maintained directories for structural health issues',
    content: `---
name: health
description: >
  Scan agent-maintained directories for health issues: orphan pages, broken wikilinks,
  stale content, frontmatter violations, tag taxonomy drift, oversized pages. Use this
  skill whenever the user wants to audit knowledge base quality, check for broken links,
  find stale or orphan pages, or says anything like "check my wiki", "are there any issues",
  "audit the knowledge base", "find broken links", or "what needs fixing".
---

# /health — Knowledge Health Check

Scan the four agent-maintained directories (\`entities/\`, \`concepts/\`, \`comparisons/\`, \`queries/\`)
for structural issues.

## Scan Categories

### 1. Orphan Pages
Pages with no inbound wikilinks from any other note (user notes or agent pages).
- Severity: **warning** for new pages (< 7 days old), **info** for older

### 2. Broken Wikilinks
Wikilinks in agent pages that point to non-existent targets.
- Severity: **warning**

### 3. Stale Content
Pages where \`updated\` date is > 90 days behind the most recent source note's date.
- Severity: **info**

### 4. Frontmatter Violations
Pages missing required fields (\`title\`, \`date\`, \`created\`, \`updated\`, \`type\`, \`tags\`, \`sources\`).
- Severity: **warning** for missing required fields

### 5. Tag Taxonomy Drift
Tags used in agent pages that are not defined in \`SCHEMA.md\`.
- Severity: **info**

### 6. Oversized Pages
Pages exceeding ~200 lines — candidates for splitting.
- Severity: **info**

## Report Format

Group findings by severity:

\`\`\`
Health check complete. Found 3 issues:

Warnings (2):
• [[broken-link-page]] — broken wikilink to [[nonexistent]]
• [[orphan-page]] — no inbound links (created 30 days ago)

Info (1):
• [[large-concept]] — 340 lines, consider splitting into sub-topics
\`\`\`

Offer concrete fixes for each issue. Ask before making changes.
`,
  },
  {
    name: 'obsidian-cli',
    kind: 'tooling',
    emoji: '\u{1F4BB}',
    description: 'Interact with Obsidian vaults using the Obsidian CLI',
    content: `---
name: obsidian-cli
description: Interact with Obsidian vaults using the Obsidian CLI to read, create, search, and manage notes, tasks, properties, and more. Also supports plugin and theme development with commands to reload plugins, run JavaScript, capture errors, take screenshots, and inspect the DOM. Use when the user asks to interact with their Obsidian vault, manage notes, search vault content, perform vault operations from the command line, or develop and debug Obsidian plugins and themes.
---

# Obsidian CLI

Use the \`obsidian\` CLI to interact with a running Obsidian instance. Requires Obsidian to be open.

## Command reference

Run \`obsidian help\` to see all available commands. This is always up to date. Full docs: https://help.obsidian.md/cli

## Syntax

**Parameters** take a value with \`=\`. Quote values with spaces:

\`\`\`bash
obsidian create name="My Note" content="Hello world"
\`\`\`

**Flags** are boolean switches with no value:

\`\`\`bash
obsidian create name="My Note" silent overwrite
\`\`\`

For multiline content use \`\\n\` for newline and \`\\t\` for tab.

## File targeting

Many commands accept \`file\` or \`path\` to target a file. Without either, the active file is used.

- \`file=<name>\` — resolves like a wikilink (name only, no path or extension needed)
- \`path=<path>\` — exact path from vault root, e.g. \`folder/note.md\`

## Vault targeting

Commands target the most recently focused vault by default. Use \`vault=<name>\` as the first parameter to target a specific vault:

\`\`\`bash
obsidian vault="My Vault" search query="test"
\`\`\`

## Common patterns

\`\`\`bash
obsidian read file="My Note"
obsidian create name="New Note" content="# Hello" template="Template" silent
obsidian append file="My Note" content="New line"
obsidian search query="search term" limit=10
obsidian daily:read
obsidian daily:append content="- [ ] New task"
obsidian property:set name="status" value="done" file="My Note"
obsidian tasks daily todo
obsidian tags sort=count counts
obsidian backlinks file="My Note"
\`\`\`

Use \`--copy\` on any command to copy output to clipboard. Use \`silent\` to prevent files from opening. Use \`total\` on list commands to get a count.

## Plugin development

### Develop/test cycle

After making code changes to a plugin or theme, follow this workflow:

1. **Reload** the plugin to pick up changes:
   \`\`\`bash
   obsidian plugin:reload id=my-plugin
   \`\`\`
2. **Check for errors** — if errors appear, fix and repeat from step 1:
   \`\`\`bash
   obsidian dev:errors
   \`\`\`
3. **Verify visually** with a screenshot or DOM inspection:
   \`\`\`bash
   obsidian dev:screenshot path=screenshot.png
   obsidian dev:dom selector=".workspace-leaf" text
   \`\`\`
4. **Check console output** for warnings or unexpected logs:
   \`\`\`bash
   obsidian dev:console level=error
   \`\`\`

### Additional developer commands

Run JavaScript in the app context:

\`\`\`bash
obsidian eval code="app.vault.getFiles().length"
\`\`\`

Inspect CSS values:

\`\`\`bash
obsidian dev:css selector=".workspace-leaf" prop=background-color
\`\`\`

Toggle mobile emulation:

\`\`\`bash
obsidian dev:mobile on
\`\`\`

Run \`obsidian help\` to see additional developer commands including CDP and debugger controls.
`,
  },
  {
    name: 'obsidian-markdown',
    kind: 'tooling',
    emoji: '\u{270D}\u{FE0F}',
    description: 'Create and edit Obsidian Flavored Markdown',
    content: `---
name: obsidian-markdown
description: Create and edit Obsidian Flavored Markdown with wikilinks, embeds, callouts, properties, and other Obsidian-specific syntax. Use when working with .md files in Obsidian, or when the user mentions wikilinks, callouts, frontmatter, tags, embeds, or Obsidian notes.
---

# Obsidian Flavored Markdown Skill

Create and edit valid Obsidian Flavored Markdown. Obsidian extends CommonMark and GFM with wikilinks, embeds, callouts, properties, comments, and other syntax. This skill covers only Obsidian-specific extensions -- standard Markdown (headings, bold, italic, lists, quotes, code blocks, tables) is assumed knowledge.

## Workflow: Creating an Obsidian Note

1. **Add frontmatter** with properties (title, tags, aliases) at the top of the file.
2. **Write content** using standard Markdown for structure, plus Obsidian-specific syntax below.
3. **Link related notes** using wikilinks (\`[[Note]]\`) for internal vault connections, or standard Markdown links for external URLs.
4. **Embed content** from other notes, images, or PDFs using the \`![[embed]]\` syntax.
5. **Add callouts** for highlighted information using \`> [!type]\` syntax.
6. **Verify** the note renders correctly in Obsidian's reading view.

> When choosing between wikilinks and Markdown links: use \`[[wikilinks]]\` for notes within the vault (Obsidian tracks renames automatically) and \`[text](url)\` for external URLs only.

## Internal Links (Wikilinks)

\`\`\`markdown
[[Note Name]]                          Link to note
[[Note Name|Display Text]]             Custom display text
[[Note Name#Heading]]                  Link to heading
[[Note Name#^block-id]]                Link to block
[[#Heading in same note]]              Same-note heading link
\`\`\`

## Embeds

Prefix any wikilink with \`!\` to embed its content inline:

\`\`\`markdown
![[Note Name]]                         Embed full note
![[Note Name#Heading]]                 Embed section
![[image.png]]                         Embed image
![[image.png|300]]                     Embed image with width
![[document.pdf#page=3]]               Embed PDF page
\`\`\`

## Callouts

\`\`\`markdown
> [!note]
> Basic callout.

> [!warning] Custom Title
> Callout with a custom title.

> [!faq]- Collapsed by default
> Foldable callout (- collapsed, + expanded).
\`\`\`

Common types: \`note\`, \`tip\`, \`warning\`, \`info\`, \`example\`, \`quote\`, \`bug\`, \`danger\`, \`success\`, \`failure\`, \`question\`, \`abstract\`, \`todo\`.

## Properties (Frontmatter)

\`\`\`yaml
---
title: My Note
date: 2024-01-15
tags:
  - project
  - active
aliases:
  - Alternative Name
cssclasses:
  - custom-class
---
\`\`\`

Default properties: \`tags\` (searchable labels), \`aliases\` (alternative note names for link suggestions), \`cssclasses\` (CSS classes for styling).

## Tags

\`\`\`markdown
#tag                    Inline tag
#nested/tag             Nested tag with hierarchy
\`\`\`

Tags can contain letters, numbers (not first character), underscores, hyphens, and forward slashes. Tags can also be defined in frontmatter under the \`tags\` property.

## Comments

\`\`\`markdown
This is visible %%but this is hidden%% text.

%%
This entire block is hidden in reading view.
%%
\`\`\`

## Obsidian-Specific Formatting

\`\`\`markdown
==Highlighted text==                   Highlight syntax
\`\`\`

## Math (LaTeX)

\`\`\`markdown
Inline: $e^{i\\pi} + 1 = 0$

Block:
$$
\\frac{a}{b} = c
$$
\`\`\`

## Diagrams (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do this]
    B -->|No| D[Do that]
\`\`\`
\`\`\`\`

## Footnotes

\`\`\`markdown
Text with a footnote[^1].

[^1]: Footnote content.

Inline footnote.^[This is inline.]
\`\`\`

## References

- [Obsidian Flavored Markdown](https://help.obsidian.md/obsidian-flavored-markdown)
- [Internal links](https://help.obsidian.md/links)
- [Embed files](https://help.obsidian.md/embeds)
- [Callouts](https://help.obsidian.md/callouts)
- [Properties](https://help.obsidian.md/properties)
`,
  },
  {
    name: 'obsidian-bases',
    kind: 'tooling',
    emoji: '\u{1F4CA}',
    description: 'Create and edit Obsidian Bases (.base files)',
    content: `---
name: obsidian-bases
description: Create and edit Obsidian Bases (.base files) with views, filters, formulas, and summaries. Use when working with .base files, creating database-like views of notes, or when the user mentions Bases, table views, card views, filters, or formulas in Obsidian.
---

# Obsidian Bases Skill

## Workflow

1. **Create the file**: Create a \`.base\` file in the vault with valid YAML content
2. **Define scope**: Add \`filters\` to select which notes appear (by tag, folder, property, or date)
3. **Add formulas** (optional): Define computed properties in the \`formulas\` section
4. **Configure views**: Add one or more views (\`table\`, \`cards\`, \`list\`, or \`map\`) with \`order\` specifying which properties to display
5. **Validate**: Verify the file is valid YAML with no syntax errors. Check that all referenced properties and formulas exist.
6. **Test in Obsidian**: Open the \`.base\` file in Obsidian to confirm the view renders correctly.

## Schema

Base files use the \`.base\` extension and contain valid YAML.

\`\`\`yaml
# Global filters apply to ALL views in the base
filters:
  and: []
  or: []
  not: []

# Define formula properties that can be used across all views
formulas:
  formula_name: 'expression'

# Configure display names and settings for properties
properties:
  property_name:
    displayName: "Display Name"
  formula.formula_name:
    displayName: "Formula Display Name"

# Define one or more views
views:
  - type: table | cards | list | map
    name: "View Name"
    limit: 10
    groupBy:
      property: property_name
      direction: ASC | DESC
    filters:
      and: []
    order:
      - file.name
      - property_name
      - formula.formula_name
\`\`\`

## Filter Syntax

\`\`\`yaml
# Single filter
filters: 'status == "done"'

# AND - all conditions must be true
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'

# OR - any condition can be true
filters:
  or:
    - 'file.hasTag("book")'
    - 'file.hasTag("article")'
\`\`\`

## Formula Syntax

\`\`\`yaml
formulas:
  status_icon: 'if(done, "✅", "⏳")'
  days_old: '(now() - file.ctime).days'
  days_until_due: 'if(due_date, (date(due_date) - today()).days, "")'
\`\`\`

## YAML Quoting Rules

- Use single quotes for formulas containing double quotes: \`'if(done, "Yes", "No")'\`
- Use double quotes for simple strings: \`"My View Name"\`

## Troubleshooting

**Duration math**: Subtracting dates returns a Duration, not a number. Always access \`.days\`, \`.hours\`, etc.

\`\`\`yaml
# CORRECT
"(now() - file.ctime).days.round(0)"
\`\`\`

**Missing null checks**: Use \`if()\` to guard optional properties.

## References

- [Bases Syntax](https://help.obsidian.md/bases/syntax)
- [Functions](https://help.obsidian.md/bases/functions)
- [Views](https://help.obsidian.md/bases/views)
`,
  },
  {
    name: 'conventions',
    kind: 'tooling',
    emoji: '\u{1F4D0}',
    description: 'Vault-specific note-writing conventions',
    content: `---
name: byoao-conventions
description: Use when creating or modifying notes in a BYOAO-structured vault. Enforces frontmatter requirements, wikilinks, and naming conventions.
---

# BYOAO Document Conventions

You MUST follow these conventions when creating or modifying any note in this vault.

## Pre-Flight Checklist

Before creating any note:

1. Read \`AGENTS.md\` — check the knowledge base structure (user notes vs agent-maintained pages)
2. Decide where the note belongs: **user notes** stay in their existing areas (e.g. \`Projects/\`, \`Daily/\`); **agent knowledge pages** live only under \`entities/\`, \`concepts/\`, \`comparisons/\`, or \`queries/\`
3. Use \`obsidian create\` to create notes — never use file write tools directly

## Creating Notes

You MUST use \`obsidian create\` to create notes in the vault:

\`\`\`
obsidian create name="Note Title" content="<frontmatter + content>" silent
\`\`\`

For multiline content use \`\\n\` for newline and \`\\t\` for tab.

## Required Frontmatter

Every note MUST have these fields:

| Field | Values |
|-------|--------|
| \`title\` | Descriptive title |
| \`type\` | \`meeting\`, \`idea\`, \`reference\`, \`daily\`, \`project\`, \`person\`, \`entity\`, \`concept\`, \`comparison\`, \`query\`, etc. |
| \`date\` | YYYY-MM-DD — today's date or extracted from content |
| \`tags\` | Array of relevant tags |

Additional fields (optional):

| Field | Purpose |
|-------|---------|
| \`domain\` | Knowledge area (e.g. ai-agents, product-strategy) |
| \`references\` | Related notes as wikilinks: \`[[Note Name]]\` |
| \`status\` | \`draft\`, \`active\`, \`completed\`, \`archived\` |
| \`updated\` | YYYY-MM-DD — last substantive edit (common on agent pages) |
| \`contradictions\` | Cross-links when conflicting claims need review (agent pages) |

## Wikilink Rules

ALWAYS use wikilinks for:

- People → \`[[Person Name]]\`
- Projects → \`[[Project Name]]\`
- Domain concepts → \`[[Concept Name]]\`
- Related notes → \`[[Note Name]]\`

Rules:
- Use \`[[wikilinks]]\` for internal vault connections
- Use \`[text](url)\` for external URLs only
- Use \`[[Note Name#Heading]]\` for specific section links
- Use \`[[Note Name|Display Text]]\` for custom display text

## File Naming

- Use Title Case or kebab-case for file names
- No special characters, no leading/trailing spaces
- Daily notes: \`YYYY-MM-DD\` format where applicable
- Agent knowledge pages: one topic per file under \`entities/\`, \`concepts/\`, \`comparisons/\`, or \`queries/\`

## Post-Creation Verification

After creating or modifying a note, verify:

1. All required frontmatter fields are present and correct
2. People and project mentions use \`[[wikilinks]]\`
3. Domain concepts are linked consistently
`,
  },
  {
    name: 'defuddle',
    kind: 'tooling',
    emoji: '\u{1F9F9}',
    description: 'Web content extraction using Defuddle CLI',
    content: `---
name: defuddle
description: Extract clean markdown content from web pages using Defuddle CLI, removing clutter and navigation to save tokens. Use instead of WebFetch when the user provides a URL to read or analyze, for online documentation, articles, blog posts, or any standard web page.
---

# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over WebFetch for standard web pages — it removes navigation, ads, and clutter, reducing token usage.

If not installed: \`npm install -g defuddle\`

## Usage

Always use \`--md\` for markdown output:

\`\`\`bash
defuddle parse <url> --md
\`\`\`

Save to file:

\`\`\`bash
defuddle parse <url> --md -o content.md
\`\`\`

Extract specific metadata:

\`\`\`bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
\`\`\`

## Output formats

| Flag | Format |
|------|--------|
| \`--md\` | Markdown (default choice) |
| \`--json\` | JSON with both HTML and markdown |
| (none) | HTML |
| \`-p <name>\` | Specific metadata property |
`,
  },
  {
    name: 'json-canvas',
    kind: 'tooling',
    emoji: '\u{1F3A8}',
    description: 'JSON Canvas format',
    content: `---
name: json-canvas
description: JSON Canvas format
version: 1.0.0
kind: tooling
---

# JSON Canvas

Create and edit .canvas files using the JSON Canvas format.

## Format

Canvas files are JSON with nodes (text, file, link, group) and edges connecting them.
`,
  },
];
