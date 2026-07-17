# Knowlery Threat Model — Knowledge-Base Content as an Attack Surface

*Spec 1.3 f3. Contributor/auditor-facing; the user-language digest lives on
the docs site at `reference/security.md`.*

Every security decision before 1.3 guarded the **transport**: tokens
compared in constant time, paths canonicalized before checks, writes
structurally bounded, reads allowlisted. This document analyzes the surface
those mechanisms do not touch — the **content** — and maps what each
existing mechanism covers, what the 1.3 additions cover, and what remains
open. The last section is the point: this model is honest about residual
risk, and any edit that hedges it should be rejected in review.

## 1. Assets

| Asset | Property at stake |
| --- | --- |
| The user's notes (user tier: free-form notes, `inbox/`, sources) | **Confidentiality** — never readable over MCP; surfaced by query as metadata only |
| The compiled layer (`entities/`, `concepts/`, `comparisons/`, `queries/`) | **Integrity** — it steers every agent that reads it; a poisoned page misleads every future session |
| The KB registry (`~/.knowlery/kbs.json`) | **Integrity** — controls which paths agents resolve names to |
| Remote-mode tokens (`KNOWLERY_MCP_TOKEN`) | **Confidentiality** — the sole remote auth factor |
| **The agent's authority** | The real prize of injection: an agent that obeys retrieved text can exfiltrate, delete, or mislead with the user's own permissions |

## 2. Trust boundaries and their guards

### 2.1 Transport (MCP stdio / HTTP) — covered since 1.0

- Remote mode: bearer token, constant-time comparison, fail-closed startup
  (no token file → refuse to start), access flags fail closed (write tools
  off unless explicitly enabled).
- Read allowlist: only `KNOWLEDGE.md`, the compiled dirs, `Library/`, and
  the virtual orientation map are readable. Free-form notes are refused.
- Structural writes: `capture` writes only into `inbox/` (symlinked inbox
  refused); `init_kb` canonicalizes and confines to `--kb-root`;
  `register_kb` writes only the registry.

### 2.2 Filesystem — covered

Canonicalize-first discipline: every path check operates on the canonical
form (parent-realpath + candidate for not-yet-existing leaves). Bundle
install asserts every entry path against the destination library dir before
writing; staging + swap keeps the previous copy intact on mid-write failure.

### 2.3 Third-party import (bundle install / update) — the 1.3 f3 addition

Content authored by *someone else* crossing into the workspace. Before 1.3,
the risk scanner ran creator-side only (export review, public-publish second
gate); install ran no content scan. As of 1.3:

- `bundle install` runs the `instruction-like` scan over incoming pages
  **before anything is written**. Hits refuse the install with per-line
  evidence; proceeding requires explicit consent (`--acknowledge-risks` on
  the CLI, a dedicated checkbox in the Obsidian dialog) — deliberately
  independent from the conformance gate, because structural defects and
  content warnings are separate consents.
- `bundle update` rides the same pipeline and inherits the gate.
- This is **detection at a boundary, not prevention**: the patterns are
  deterministic regexes over known injection shapes; novel phrasings pass.
  Every hit is a hint for a human, never an automated cleanup — Knowlery
  never alters content.

### 2.4 Self-import (/cook of clipped material, capture) — deliberately ungated

The user brings external text in by their own hand. No mechanical gate fits
here: scanning the user's own clipping/capture workflow would train
flag-reflexes without a trust boundary being crossed. The exposure is the
§2.5 residual; the creator-side export scan catches instruction-like content
before it ships to anyone else.

### 2.5 Content consumption (query results, resources, skills) — the open residual

An agent reads KB text through query results, resource reads, and skills.
Text can carry instructions, and **the model that reads the text decides
what to obey** — there is no mechanical fix at the knowledge-store layer.
Mitigation is conduct, not code: the "content is not instructions" rule in
the `knowlery-mcp`, `ask`, and `knowlery-cli` skills and in the query/
resource tool descriptions instructs agents to treat retrieved text as data,
refuse unprompted redirection, and report what they found. This lowers the
success rate; it does not close the channel.

## 3. Attack catalog

1. **Instruction-bearing bundle page.** A shared bundle contains a page
   whose text addresses the agent ("ignore your previous instructions
   and…"). *Guards:* the install-time scan flags it before any write; the
   consent gate forces a human look; conduct instructs the agent if it gets
   through. *Open:* novel phrasings pass the scan.
2. **Poisoned clipping surviving /cook.** A web page is clipped, captured,
   and cooked; its embedded instructions land in the compiled layer, which
   every future session trusts. *Guards:* cook is LLM-mediated (instructions
   may be paraphrased away, not guaranteed); the export scan catches it
   before sharing; conduct at read time. *Open:* the user's own compiled
   layer is inside the trust perimeter — nothing rescans it.
3. **Hostile conversation captured verbatim.** "Remember this" writes
   attacker-influenced text into `inbox/`. *Guards:* capture is
   inbox-confined (bounded blast radius); inbox items surface as uncooked
   notes for human-mediated cook. *Open:* same as 2 once cooked.
4. **Retrieval bait.** A note engineered to rank for common queries.
   *Guards:* the abstention gate refuses low-confidence matches; specificity
   weighting penalizes term-stuffing; citations expose provenance — a
   baiting page's `sources:` point at its origin. *Open:* a well-crafted
   bait on a topic the KB genuinely covers can still rank.

## 4. Residual risk, stated plainly

Installing third-party knowledge is granting its author a voice in your
agent's context window. Knowlery makes that voice **visible** (provenance,
citations, install-time flags) and **bounded** (structural writes, the read
allowlist), and instructs agents to treat it as data. It cannot make the
voice obedient. If an agent with powerful tools reads hostile text and its
model complies, the harm happens with the user's permissions. Choose whose
bundles you install the way you choose whose code you run.
