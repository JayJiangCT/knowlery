# Knowlery v0.3 Counter and Weekly Bake — Product Design

## 1. Goal

Shift Knowlery from a one-time vault setup utility into a warm personal knowledge review tool for AI power users, researchers, and creators.

The v0.3 release should prove one product hypothesis:

> Users will return to Knowlery if it helps them review what they have been thinking through with agents, notice what has not yet been captured, and gently turn that activity back into a healthier knowledge base.

This version focuses on two surfaces:

- `Counter`: the default Obsidian side-panel view for recent knowledge activity
- `Weekly Bake Report`: a manually generated local HTML report for deeper review

The release should not attempt to become a chat UI, real-time analytics platform, or full agent execution environment.

## 2. Product Positioning

Knowlery should not compete directly with AI chat plugins or general Obsidian graph tools.

Its role is the personal review layer between agent work and the user's long-term knowledge base:

1. The user works with Claude Code, Codex, OpenCode, Claudian, or another agent.
2. Agent-facing Knowlery rules ask the agent to write a lightweight activity record when meaningful work happens.
3. Knowlery reads those records and shows what themes, questions, and unfinished knowledge work are emerging.
4. The user generates a Weekly Bake Report when they want a deeper review.
5. The report suggests a small number of follow-up moves, such as `cook`, `challenge`, `explore`, update, merge, or archive.

The product voice should be warm, private, and reflective. It should feel like a quiet knowledge review space, not a productivity scoreboard.

## 3. Information Architecture

The v0.3 navigation direction is:

- `Counter`: daily glance surface, shown by default
- `Pantry`: skills, rules, templates, and capabilities
- `Inspection`: vault health, configuration, and maintenance checks

For v0.3, only `Counter` and report generation are in primary scope. `Pantry` and `Inspection` can keep most of the existing Skills, Config, and Health behavior until a later pass.

The current Skills tab should no longer be treated as the primary daily surface. For experienced users, it is closer to a manual or recipe shelf: useful when needed, but not something to display as the product's main value every day.

## 4. Counter

`Counter` is the default side-panel page. It should be quick to scan in a narrow Obsidian pane.

It should answer:

- What has been active in my knowledge work recently?
- Which themes keep coming back?
- What agent work happened recently?
- What looks worth baking into the vault?
- When did I last generate a deeper report?

### First-version sections

1. `Recurring Themes`
   - Shows themes that repeatedly appear in recent activity records.
   - Use gentle language like "recurring themes" rather than "top topics".
   - Include count or recency only when it helps interpretation.

2. `Recent Agent Work`
   - Shows recent activity summaries written by agents.
   - Keep each item short.
   - Prefer summaries over raw conversation logs.

3. `Unbaked Notes`
   - Shows discussions, conclusions, or open questions that appear valuable but do not look captured in the knowledge structure.
   - This is a prompt for review, not a task list with pressure.

4. `Weekly Bake`
   - Shows the latest generated report date.
   - Provides actions to generate a new report or open the latest report.

### Counter non-goals

Counter should not contain large charts, dense tables, long timelines, or full analytics. Those belong in the generated report.

## 5. Weekly Bake Report

The Weekly Bake Report is a manually generated local HTML snapshot. It is not a live dashboard.

Manual generation is intentional: it turns review into a ritual and avoids the feeling of surveillance.

Default output paths:

```text
.knowlery/reports/latest.html
.knowlery/reports/weekly/YYYY-Www.html
```

The report should be visually richer than the side panel, but still restrained. It should feel like a polished private analysis report, not a corporate BI dashboard.

### Report structure

1. `Opening Summary`
   - A 3-5 sentence overview of the week.
   - Tone: objective observation, warm interpretation, no hype.

2. `Recurring Themes`
   - Themes that appeared repeatedly.
   - Include frequency, representative summaries, and related files or activity records when available.

3. `Taste Profile`
   - A knowledge hexagon with fixed dimensions:
     - `Research`
     - `Creation`
     - `Building`
     - `Strategy`
     - `Reflection`
     - `Maintenance`
   - The hexagon shows distribution and preference, not a score.

4. `Momentum`
   - Topics gaining attention, cooling down, or staying unresolved.
   - This should help the user see what they are circling around.

5. `Shelf Check`
   - Knowledge maintenance observations:
     - valuable discussions not yet captured
     - missing entity or concept pages
     - weakly sourced conclusions
     - broken links or orphaned notes
     - possible outdated or drifting areas

6. `Next Batch`
   - 3-5 suggested follow-up actions.
   - Each suggestion should explain why it is worth doing.
   - Suggestions should feel like invitations, not assignments.

## 6. Activity Ledger

The Activity Ledger is the source of the Counter and Weekly Bake Report.

It should be local, private, lightweight, and understandable by the user.

Default path:

```text
.knowlery/activity/YYYY-MM-DD.jsonl
```

Each line is a structured activity record.

### First-version record shape

```json
{
  "time": "2026-05-01T14:20:00Z",
  "agent": "codex",
  "type": "discussion",
  "topics": ["Knowlery", "Obsidian plugin", "Knowledge Ops"],
  "summary": "Discussed shifting Knowlery from setup tool to personal knowledge review surface.",
  "dimensions": ["strategy", "reflection"],
  "followups": [
    "Define Activity Ledger schema",
    "Design Counter and Weekly Bake surfaces"
  ],
  "relatedFiles": [],
  "captureState": "unbaked",
  "source": {
    "kind": "agent-session",
    "visibility": "private-summary"
  }
}
```

### Privacy principles

- Do not store full conversations by default.
- Store summaries, topics, dimensions, and follow-up hints.
- Make the storage location visible in the UI.
- Provide a clear way to disable activity logging.
- Provide a clear way to delete activity records.
- Treat agent logging as best-effort. The product must remain usable when records are incomplete.

## 7. Product Language

The product should lean into the Knowledge Barkery theme without becoming cute or noisy.

Preferred names:

- `Counter`: the daily side-panel surface
- `Pantry`: skills, rules, templates, and capabilities
- `Inspection`: health and configuration
- `Weekly Bake`: the generated report
- `Taste Profile`: knowledge preference distribution
- `Shelf Check`: knowledge base maintenance review
- `Next Batch`: suggested next moves

Avoid:

- productivity scores
- leaderboard language
- gamified badges
- "top topics" as the main framing
- motivational copy that feels performative

Good tone example:

> Your attention this week clustered around product direction, agent workflows, and knowledge review design. The strongest unresolved thread is how Knowlery should record agent activity without feeling like surveillance.

## 8. Product Boundaries

### In scope for v0.3

- Add Counter as the default daily surface
- Define and read local Activity Ledger records
- Add agent-facing logging rule or skill guidance
- Generate a manually triggered Weekly Bake HTML report
- Show a fixed six-dimension Taste Profile
- Surface a small number of Next Batch suggestions

### Out of scope for v0.3

- Real-time dashboard updates
- Full analytics platform
- Custom hexagon dimensions
- Chat UI
- Built-in agent runner
- Automatic background monitoring
- Scoring the user or the vault
- Major redesign of Pantry and Inspection

## 9. Success Criteria

v0.3 succeeds if a returning user can say:

- "Knowlery shows what I have been thinking about recently."
- "The weekly report feels like a useful private review, not a generic dashboard."
- "I can see which agent conversations are worth turning into notes."
- "The suggested next actions help me maintain my knowledge base."

The release does not need perfect analytics. It needs a credible and emotionally right product loop.

## 10. Implementation Notes for Later Planning

The next implementation plan should decide:

- how agent rules are updated to request activity logging
- how records are validated and repaired when partially malformed
- how Counter aggregates recent records
- whether report HTML is handwritten, template-based, or generated from React-rendered static markup
- how report generation works without requiring a persistent local server
- how the user opens local report files from Obsidian
- how privacy controls are exposed

No implementation should begin until the Activity Ledger schema and Counter first-version layout are reviewed.
