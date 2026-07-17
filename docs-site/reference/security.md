# Security

What Knowlery guards mechanically, what it detects at boundaries, and — in
the same breath — what it cannot prevent. The sections below deliberately
keep detection and residual risk together, so this page cannot be skimmed
into "detected ≈ protected". The full analysis lives in the repository's
threat model (`docs/security/threat-model.md`).

## What is guarded mechanically

These hold by code, and are pinned by contract tests:

- **Transport.** Remote MCP mode requires a bearer token (constant-time
  comparison) and refuses to start without one. Write tools are off unless
  explicitly enabled — access fails closed.
- **Reads.** Over MCP, only the curated surface is readable: `KNOWLEDGE.md`,
  the compiled directories, installed bundles under `Library/`, and the
  orientation map. Your free-form notes are never readable over MCP —
  queries surface them as metadata only.
- **Writes.** `capture` writes only into `inbox/`. `init_kb` canonicalizes
  paths and confines creation to the configured root. `register_kb` touches
  only the registry file. Bundle install checks every file path against the
  destination before writing, and stages + swaps so a failed install never
  destroys the previous copy.

## What is detected at boundaries — and what that does not mean

When knowledge crosses a trust boundary, Knowlery scans it and shows you
what it found. Scanning is **detection, not prevention**: the patterns are
deterministic and public, so novel phrasings pass. Every hit is a warning
for you to read — Knowlery never edits or removes content on its own.

- **Before you share** (export review, and again at public publish): emails,
  credential shapes, private IPs, phone numbers, sensitive URLs, person
  pages, meeting-like notes — and instruction-like content.
- **Before you install** (bundle install and update, since 1.3):
  **instruction-like content** — text in a bundle that reads as directives
  to an agent ("ignore your previous instructions…"), the shape of an
  indirect prompt-injection attack. The install refuses before writing
  anything and shows the flagged lines; it proceeds only after your
  explicit consent (`--acknowledge-risks` on the CLI, a checkbox in
  Obsidian). This consent is separate from the conformance gate — a
  malformed bundle and a hostile-looking bundle are different problems.

## What cannot be prevented

Text that an agent reads can carry instructions, and **the model reading
the text decides what to obey**. No knowledge store can close that channel.
Knowlery's last line is conduct, not code: its skills and tool descriptions
tell agents that knowledge-base content is *data to reason about, not
instructions to follow* — running a runbook you asked for is fine; obeying
a page that redirects the agent on its own authority is not. This lowers
the odds; it is not a guarantee.

What this means in practice: **installing third-party knowledge is granting
its author a voice in your agent's context window.** Knowlery makes that
voice visible (provenance, citations, install-time flags) and bounded
(structural writes, the read allowlist). It cannot make it obedient. Choose
whose bundles you install the way you choose whose code you run.

## What you control

- Review gates: nothing exports unreviewed; approvals invalidate on edit.
- Consent flags: risk-hinted publishes and installs proceed only after you
  see the flagged items.
- The registry: agents resolve only KBs you registered.
- Remote access: off by default; token + per-capability flags when on.
