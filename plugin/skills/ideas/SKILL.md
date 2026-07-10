---
name: ideas
description: >
  Deep vault scan to generate actionable ideas by combining insights across domains, finding gaps,
  and proposing concrete next steps. Uses INDEX.base (Bases wiki index) and agent directories (`entities/`, `concepts/`,
  `comparisons/`, `queries/`) for compiled knowledge. Use when the user asks "give me ideas", "what should I work
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

If a domain or search returns more than 30 notes, prioritize: (1) most recent 10, (2) most-linked 10 (highest backlink count), (3) notes with `status: active`. Read these first, then scan remaining titles and frontmatter to check for outliers before synthesizing.

### Step 1: Map the Vault

Start from the orientation map — it is exactly this step, precomputed:

```bash
knowlery index    # compiled pages by directory, domains, bundles, stale/uncooked counts
```

(Or read the MCP `knowlery://<kb>/index` resource.) Then deepen with:

```bash
obsidian list
obsidian properties sort=count counts
obsidian tags
```

Build a picture of: domains, note distribution, most active areas, tag clusters.

### Step 2: Deep Read

Read notes across domains, prioritizing:
- Recent notes (last 30 days) — what the user is actively thinking about
- Highly connected notes (many backlinks) — central concepts
- Notes with `status: active` — current work
- `INDEX.base` and `obsidian properties` / `search` — same compiled knowledge scope as **`/ask`**
- Agent pages in `entities/`, `concepts/`, `comparisons/`, `queries/` — for compiled knowledge

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

```markdown
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

- Run `/trace topic="X"` to explore Idea 1 further
- Run `/connect from="A" to="B"` to validate Idea 3
- Run `/cook` to compile or refresh `entities/`, `concepts/`, `comparisons/`, or `queries/` pages when an idea exposes a knowledge gap
- Add or extend a page under `queries/` for Idea 5 if it is question-shaped knowledge worth keeping
```

### Step 7: Save (Optional)

At the end of your ideas, ask:

> "Would you like me to save this as a note?"

If the user confirms, save with frontmatter:

```yaml
---
title: "Ideas: {focus}"
date: <today>
tags: [ideas, proactive]
---
```

Use `obsidian create` to save. Ask the user where they'd like it saved.

## Key Principles

- **Actionable over interesting**: Every idea must have a concrete next step. "Interesting observation" is not an idea.
- **Evidence-based**: Every idea must cite 2+ vault notes. No general knowledge ideas.
- **Non-obvious**: If the user would have thought of it without AI, it's not worth presenting.
- **Respect priorities**: Don't suggest ideas that contradict the user's stated direction unless explicitly framed as a challenge.
- **Quality over quantity**: 3 strong ideas beat 10 weak ones. Filter aggressively.
