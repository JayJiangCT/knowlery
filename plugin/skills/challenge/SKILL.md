---
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
- **scope** (optional): `all` (full vault) or a specific directory/page. Default: `all`.

## Process

### Step 1: Understand the Claim

Clarify what exactly is being challenged:
- What is the core assertion?
- What assumptions does it rest on?
- What would falsify it?

If the claim is ambiguous, ask the user to clarify before proceeding.

### Step 2: Find Supporting Evidence

```bash
obsidian search query="<key terms from claim>"
```

Read relevant notes and agent pages. Identify:
- Notes that explicitly support the claim
- Notes that provide indirect support (data, observations)
- The strength of each piece of evidence

### Step 3: Find Contradicting Evidence

This is the core of /challenge. Search for:

1. **Direct contradictions** — Notes that explicitly state the opposite.
   The CLI has no OR operator — run one search per phrasing:
   ```bash
   obsidian search query="not <term>"
   obsidian search query="instead of <term>"
   obsidian search query="changed from <term>"
   ```

2. **Implicit contradictions** — Notes that describe a situation incompatible with the claim
   - Read pages with shared tags but different conclusions
   - On related `entities/` and `concepts/` pages, check optional `contradictions` frontmatter (v2: YAML list of other agent page names documenting conflicting claims — see `/cook` Contradiction Handling)

3. **Position changes over time** — Notes that show the user changed their mind
   (one search per marker word):
   ```bash
   obsidian search query="actually"
   obsidian search query="turns out"
   obsidian search query="reconsidered"
   obsidian search query="reversed"
   ```

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

```markdown
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
```

## Key Principles

- **Respectful opposition.** The goal is to strengthen thinking, not to tear it down. Frame challenges as "here's what to consider" not "you're wrong."
- **Evidence only.** Every challenge must cite specific vault notes. Don't invent external counterarguments.
- **Surface uncertainty.** If the vault shows doubt or hesitation about aspects the claim treats as certain, highlight this gap.
- **Obsidian is the reading workbench.** Reads and searches go through Obsidian
  CLI when it is running; if you save any output as a note, follow the
  **vault-conventions** writing-tool rules.
