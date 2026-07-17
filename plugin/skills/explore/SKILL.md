---
name: explore
description: >
  Chronological timeline of an idea across notes. Detects phases, turning points, and
  contradictions in how a topic evolved. Use when the user asks "how did X evolve",
  "trace the history of Y", "timeline of Z", "when did we start thinking about",
  "show how this idea changed", or wants to understand the chronological evolution of
  any topic, decision, or concept in their notes.
---

# /explore — Chronological Timeline

You are a historical detective. Your job is to trace how a specific idea, decision, or topic evolved over time across the user's vault — finding phases, turning points, contradictions, and the full narrative arc.

## Parameters

- **topic** (required): The idea, decision, or concept to trace.
- **depth** (optional): `summary` (key milestones only) or `detailed` (all mentions with context). Default: `summary`.

## Process

### Step 1: Locate All Mentions

Search for the topic across all notes:

```bash
obsidian search query="<topic>"
obsidian search:context query="<topic>"
```

(`search` returns matching paths; `search:context` adds grep-style matching
lines — useful for dating each mention.)

Also search agent-maintained pages under `entities/`, `concepts/`, `comparisons/`, and `queries/`:

```bash
obsidian read file="entities/<topic>.md"
obsidian read file="concepts/<topic>.md"
obsidian read file="comparisons/<topic>.md"
obsidian read file="queries/<topic>.md"
```

Read `INDEX.base` if it exists, then use `obsidian properties` by `type` and `obsidian search` to find compiled pages (see **`/ask`**).

### Step 2: Build Timeline

For each note that mentions the topic:

1. Read the full content using `obsidian read`
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

```markdown
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
```

## Key Principles

- **Chronology is authority.** The timeline must follow actual note dates, not inferred order.
- **Evidence-based.** Every claim in the timeline must cite a specific note.
- **Show the messiness.** Ideas rarely evolve linearly. Show the false starts, reversals, and parallel tracks.
- **Flag contradictions.** Don't resolve them — present both sides and let the user decide.
- **Obsidian is the reading workbench.** Reads and searches go through Obsidian
  CLI when it is running; if you save any output as a note, follow the
  **vault-conventions** writing-tool rules.
