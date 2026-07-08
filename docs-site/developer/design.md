# Design Decisions

The load-bearing decisions behind Knowlery, with the reasoning that produced
them. Architecture says what the pieces are; this page says why they have the
shape they do.

## Determinism over prompting

The earliest versions retrieved knowledge by instructing agents through
prompts — a waterfall of "first check X, then grep Y". It worked when the
model felt like it. The 0.6 rewrite moved retrieval into code: a deterministic
engine with measured quality, called *by* agents instead of performed by them.

The dividing rule that stuck: **agents exercise judgment; code guarantees
mechanics.** Compiling knowledge (`/cook`) is judgment — it stays a skill.
Finding candidates, detecting staleness, checking health, packaging bundles —
those are mechanics, and every one of them moved into code with tests. When a
behavior matters, the question is never "how do we prompt this better" but
"can this be a function".

## Abstention as a first-class answer

A retrieval system that always returns *something* trains its callers to
distrust it. The engine's confidence gate exists so that `no-confident-match`
is a real, common verdict — the top candidate must clear specificity-weighted
term coverage or source-graph evidence, not merely score highest.

This propagates outward as a product stance: the CLI exits 0 on abstention
(it's a result, not an error), the MCP tool descriptions instruct agents to
relay it rather than retry, and the eval harness holds unanswerable-question
accuracy at 100% alongside recall floors — refusing to trade one for the
other silently.

## Findings are data; only broken calls are errors

Every reporting surface distinguishes *the report contains bad news* from
*the operation failed*. An unhealthy `health`, a long `stale` list, an
abstaining `query` — all successful results carrying findings. Errors are
reserved for calls that couldn't do what was asked: unknown KB names,
malformed input, the sync downgrade guard (whose point is the write it
refused to make).

The line matters most for agents: an agent that treats bad news as failure
retries, and an agent that retries a truthful answer eventually hallucinates
a better-sounding one.

## Safety arguments must be structural

Wherever Knowlery makes a safety promise, the preferred design makes the
violation *impossible* rather than *checked for*:

- `capture` has no path parameter — filenames are constructed from timestamp
  + slug, so traversal cannot be expressed. The write uses the `wx` flag, so
  overwriting cannot happen at the syscall level. The inbox is `lstat`-verified
  to be a real directory, so a symlinked inbox cannot redirect writes.
- Remote access flags decide which tools are *registered* — a disallowed
  write is absent from `tools/list`, not present-but-refusing. There is no
  permission check to get wrong.
- `init_kb` canonicalizes before every check (parent realpath + candidate
  join), creates at most one leaf directory, and refuses non-empty targets —
  the blast radius is bounded by construction.
- Bundle approval records content hashes, so editing an approved page
  automatically re-invalidates the approval.

The pattern: when a review finds a boundary that is merely *filtered*, the
fix is to redesign it so the bad state has no representation.

## Review gates with no bulk bypass

Nothing leaves a vault unreviewed: export requires an explicit approve/flag
decision per item, and there is deliberately **no approve-all flag**. Where an
agent mediates, conduct rules (written into the skills themselves) require
presenting the full checklist verbatim and acting only on the user's stated
decisions. Public publishing adds a second gate: re-acknowledging every risk
item, because a public release is permanent.

The same philosophy gates the other direction — MCP write tools act on the
user's words, never agent initiative — and the compiled knowledge layer is
writable only through `/cook`'s reviewed pipeline, on every transport.

## No caches, no indexes

Every query, staleness report, and health check is a live scan. This was
measured before it was chosen: vault-scale corpora scan in milliseconds, so a
cache would buy nothing and cost an invalidation protocol, a staleness bug
class, and cross-shell coherence problems (three shells would share stale
state). The decision has paid unexpected dividends: MCP statelessness and
restart-safety fell out for free, and `kb add` needs no reindexing step.

## One core, shells as transports

Every feature lands in the platform-agnostic core first; shells only adapt
I/O. This is enforced, not aspirational — the purity test fails any core
module that imports Obsidian as a value, and the smoke test proves the built
CLI artifact runs the full lifecycle with plain node.

The discipline compounds: the CLI (0.7) forced the `VaultFs` inversion; the
MCP server (1.0) reused the inverted core untouched; the HTTP transport (1.0)
reused the MCP handlers untouched. Each new shell has been cheaper than the
last, and a future hosted platform is designed to be "a second host, not a
redesign".

## Versions are contracts

- The manifest records which version last synced a workspace; an older shell
  refuses to sync rather than downgrade content a newer one wrote.
- Bundle updates require version increases and refuse to overwrite local
  modifications (hash-detected) without `--force`.
- Publishing is idempotent — republishing an existing version skips green
  instead of clobbering.
- At 1.0, the workspace format, CLI flags/JSON shapes, and MCP tool contracts
  freeze under semver; renames after the freeze need an explicit decision,
  not a refactor.

## Credentials are never Knowlery's

Knowlery verifies; it does not manage. Private bundle access delegates to the
user's `gh` login. npm publishing uses OIDC trusted publishing instead of
long-lived tokens. The MCP remote token is generated by the operator, read
from env or file (never argv), compared in constant time, and stored nowhere.
Every one of these chose "integrate with existing credential ownership" over
"hold a secret ourselves".

## Measured quality, frozen floors

The eval harness is the reason retrieval changes are shippable: golden
questions with expected pages, recall@10 and MRR computed per run, and a CI
baseline that any regression fails against. When behavior intentionally
changes, the floor is re-frozen in the same PR — quality moves are explicit,
never drive-by. The same idea governs the abstention gate (unanswerable-set
accuracy is part of the baseline) and, at 1.0, the contract freeze (schema
assertions in tests are the floor for interfaces).

## Spec-driven development

Every feature ships as: spec PR → maintainer review (often multiple rounds,
findings fixed in the spec) → implementation → maintainer acceptance with
real-world testing → status flip. The specs live in `specs/<version>/` and
read as the project's decision log — including the findings that changed
designs (the stateless-lifecycle contract, the symlinked-inbox refusal, the
canonical-candidate algorithm all came from review rounds). Safety properties
are written *as tests* in the spec before implementation begins.
