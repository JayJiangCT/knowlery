# CLI-002 Round 2 — Metric D v1.2: Owner decision packet

**Task:** CLI002-R2-D-V12-CONTRACT-01. **Date:** 2026-11-05. **Baseline:** `develop/2.0` at `b40bb91`.

## Read this first: what has and has not been decided

| Statement | Status |
|---|---|
| Wiki-first answers, reuse of verified compiled knowledge, WCC split, lifecycle as a separate topic | **Principle-level ALIGNED / PROPOSED** between Owner and Cloud Agent (alignment review). **Not ACCEPTED.** It accepts no endpoint, schema, protocol or KF change |
| Metric D v1.2 contract (every rule in the companion files) | **PROPOSED candidate.** Nothing is ACCEPTED. `docs/2.0/DECISIONS.md` is not edited |
| Metric D as Gate B's frozen contract | **NOT READY** (section 3 gives the exact gate) |
| Gate B, T2, T3, C, A, paid runs, new private review sessions | **NOT AUTHORIZED** by anything in this packet |
| Existing contract files, Round 1 results, `wrong_current_claim`, consensus annotation, v1.0/v1.1 protocols, v1.1 regression | **Unchanged** (36/36 freeze-manifest lines verified, see [`V12-REPORT.md`](V12-REPORT.md)) |

A decision below becomes binding only when the Owner states it and it is recorded under the decision discipline of `docs/2.0/README.md`. Agreeing with a recommendation in conversation is not the same as ACCEPTED.

## 1. Decisions needed

Each item: options, recommendation, evidence, and what would change the recommendation.

### O-1 — Gate B primary endpoint

| Option | Meaning |
|---|---|
| **(a) — recommended** | P0 stays the preregistered primary; P1 is pre-registered as a secondary measure of compiled-verification reuse; all P0 diagnostics kept |
| (b) | Amend Plan §5 so P1 is primary; P0 becomes a co-primary diagnostic |

- **Evidence:** on every existing trace P1 cannot be `true` where P0 is not, because no digest step was observable; the synthetic tests show this mechanically. P0 is arm-symmetric; P1 is not (baseline P1 ≡ P0). Details: [proposal §1–3](V12-CONTRACT-PROPOSAL.md).
- **Would change it:** an approved currentness basis (O-2), a calibration run showing the Gate B harness exposes the digest step, and a blind-scoring procedure for the compiled path. With all three before freeze, (b) becomes feasible.

### O-2 — Admissible currentness basis for the P1 compiled path

| Option | Meaning |
|---|---|
| **(i) — recommended if P1 is kept** | Only a dated, independently adjudicated gold reference (the same standard as `wcc_gold`, O-4) can establish currentness for P1 |
| (ii) | Also accept an agent-observed supersession check in the trace (the agent searched for later material) |
| (iii) | Also accept the compiled vault's own verification markers |
| Defer | Keep `currentness = not_established` everywhere; P1's compiled path is then never `true` |

- **Evidence:** a matching digest shows the cited Source is unchanged, not that no newer document superseded the claim (alignment review §3). (iii) would let the vault certify itself, which the D3 principle warns against.
- **Would change it:** a validated agent-side supersession check with known recall would make (ii) defensible.

### O-3 — WCC split implementation

Approve, reject or modify: `wcc_gold` (all arms) and `wcc_vault` (compiled arms only) as separate fields judged in separate passes with separate references; `not_applicable` applied from the arm manifest, never by a judge; complete-and-empty compiled reference ⇒ `false`; absent / incomplete / version-mismatched reference ⇒ `unknown` with a reason; legacy `wrong_current_claim` kept, never mapped. [Tables §2](V12-DECISION-TABLES.md).

- **Recommendation:** approve as drafted. Sub-choice: count `wcc_*` over all validly annotated runs (as drafted) or answerable runs only.
- **Evidence:** T1-W (aggregated): the two references gave different verdicts on different runs; a vault-reference verdict on a baseline-arm run measured the compiled vault's markers, not the baseline arm.
- **Would change it:** if the Owner prefers a single field, it must name one reference and give judges exactly that reference.

### O-4 — Dated gold for `wcc_gold` (and, if O-2(i), for P1)

- Minimum content: `as_of`, state kind, supporting evidence, supersession check against later material, uncertainty. A gold without a supersession check gives `wcc_gold = unknown` (`GOLD_NOT_CURRENTNESS_CHECKED`).
- Scope question: does `wcc_gold` apply to questions that ask only about an earlier state? Options: (1) no, add a `not_applicable` scope rule from the manifest; (2) yes, the dated gold must also state the current state. **Recommendation:** (1), because a currentness error needs a current-state claim to contradict.
- Authoring a v3 gold is not authorized by this packet. A PROPOSED benchmark errata entry owned by another session is untouched.

### O-5 — KF v1.0 questions (route to KF governance, not to this protocol)

1. Is a superseded `## History` entry relied on for an earlier-state answer a claim "given as an answer" under F-008 (§7.0)?
2. If yes, what is its "first vault-file Source", given that the History line's `src:` follows the supersession note (§7.1)?
3. Is a compiled vault's Record (no claim anchors) a source or compiled support for `support_kind`?

- **Recommendation:** send 1–2 to KF governance; until decided, keep History rows visible with `f008 = unknown` (`F008_HISTORY_ENTRY_SCOPE_OPEN`). For 3, decide `compiled_claim` for Records produced by the compile workflow, because they are compile output; this is an evaluation choice, not a KF change, and is reversible.
- **Would change it:** a KF governance ruling on any of the three.

### O-6 — Role of F-008 in Gate B decisions

| Option | Logic |
|---|---|
| G-a | Reported only |
| **G-b — recommended (or G-c)** | Decision-blocking: a compiled arm cannot be GO while its answers rely on `non_compliant` claims, unless a pre-registered review accepts those cases. `unknown` never counts as `compliant` |
| G-c | Review trigger: every `non_compliant` case goes to pre-registered adverse-case review; the gate is decided on the primary |

No threshold (how many cases block) is proposed; that is a later Owner decision made before Gate B data exist.

### O-7 — Adjudication rules that change pass/fail

Approve or modify each ([tables §1 and §4](V12-DECISION-TABLES.md)):

| Rule | Recommendation |
|---|---|
| Conjunction: `false` wins over `unknown` (reverses clarifications §1.2 rule 2) | Approve (both Cloud reviews agree) |
| Answerable item with zero required facts is invalid | Approve; exceptions only by Owner list |
| 1 Partial support: `no` when trace complete | Approve (writes down ruling R5) |
| 2c Rejected-only candidate ⇒ L2 `false` (METRICS §3.4 governs over protocol step 3) | Approve |
| 2e Propose a candidate only if delivered text states the value | Approve |
| 3c Evolution questions: judge each fact by the state it describes | Approve |
| 6 `version_check`: protocol step 7 governs | Approve (diagnostic only) |
| 7 Dates judged only under their own required fact | Approve, with regression item R-D1 |

### O-8 — Targeted v1.2 regression

- Approve up to two new private annotator sessions under [`V12-REGRESSION-PLAN.md`](V12-REGRESSION-PLAN.md). Not started; needs this approval.
- Choose how to cover Rule A's current-state branch: (i) search other calibration packets, (ii) one invented synthetic packet, (iii) leave untested as a residual risk. **Recommendation:** (i), then (ii).

## 2. What is ready and what is unproven

| Ready (verified locally, synthetic) | Unproven |
|---|---|
| Three-valued logic, both denominators, missing/invalid ⇒ validation failure, zero-facts rule | Whether the v1.2 **wording** settles partial support, rejected candidates, proposal uniformity and dates for fresh annotators (regression not run) |
| WCC field semantics, reference completeness, manifest-based applicability | Rule A current-state branch with real annotators (never exercised) |
| P1 derivation shape; F-008 not an input; legacy traces give P1 `unknown`, never `true` | Any admissible currentness basis (O-2); any Gate B harness exposing a digest step |
| v1 records still validate under the v1.2 dispatcher (16 synthetic; the private consensus file also validates, counts only) | KF answers to O-5 |
| Existing suite unchanged (24/24 self-test, 17 unit tests, 16 records) | Independent reproduction by the Cloud Agent (all results here are Local Agent-reported) |

## 3. Exact freeze gate for Metric D (Gate B contract)

The Owner may be asked to freeze Metric D only when **all** hold:

1. O-1, O-3, O-6 and O-7 are decided and recorded; if O-1 = (b), O-2 is also decided and the harness check has passed.
2. O-4 is decided for any reference Gate B will use; O-5 is either ruled by KF governance or explicitly carried as `unknown` with its reporting rule.
3. The candidate schema, protocol, validator and tests are revised to the decisions, are coherent, and pass; v1 records still validate; all commands and exit codes are recorded.
4. The v1.2 regression has run under a frozen preregistration and its verdict is recorded (PASS, or an Owner-accepted INCONCLUSIVE with named residual risks). Rule A's current-state branch is either covered or named as a residual risk.
5. A public privacy check passes.
6. The Cloud Agent has given an independent freeze-readiness review.

Then the Owner decides ACCEPTED or not. Nothing in this packet performs that step.
