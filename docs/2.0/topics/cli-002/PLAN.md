# CLI-002 Round 2 plan (Cloud Agent, Revision 2)

Round 2. Received 2026-11-04 from the Owner. Copied verbatim from `CLI-002-Round2-Research-Plan-REV2-PROPOSED.md` (sha256 `d590e7cdf4fe56c394bee4a67e8e80e53dc6980055eb4b81cf332f9c10af1295`). Owner approved Gate NOW (T0 + T1) on 2026-11-04; nothing else is approved.

---

# Knowlery 2.0 — CLI-002 Round 2 Research Plan (Revision 2)

**Status**: PROPOSED / NOT EXECUTION-AUTHORIZED  
**Date**: 2026-11-04  
**Authority**: `CLOUD-PROMPT-ROUND2.md` and current approved repository decisions (GR-001–GR-010, CLI-001, KF v1.0); this revision responds to Local Agent's four review findings.  
**Research boundary**: Research design, architecture analysis, independent review only. No question/Gold drafting in this session; no paid experiment; no frozen-artifact modification; no ACCEPTED promotion.

## Executive Decision

1. **Round 1 is closed**: Completed — Core Hypothesis Inconclusive; CLI-002 OPEN. Preserve G0, G1, benchmark v2, Round 1 answers, `SCORES.md`, E-1 archive byte-for-byte.
2. **Rev 1 is superseded as an execution plan** because its generic repository output directory could expose private G0-derived content. Retain as historical proposed material; do not implement its output paths.
3. **Phase order is D → B → C → A (conditional)**, but B has two prerequisites: a functional read-only `search / explore / inspect` Pilot and pre-freeze difficulty calibration. These prerequisites do not authorize CLI production implementation.
4. **Immediate authorization recommended for Owner consideration**: T0 (archive/privacy preflight) and T1 (D metrics/rules), using only existing read-only evidence and no paid model runs. Owner forwarding a Local Agent recommendation is not by itself explicit execution authorization.
5. **B, C, A require separate Owner approvals** for scope, private-data access, roles, and spending. No architecture/CLI implementation is ACCEPTED by research approval.

## 1. Confirmed evidence and open hypotheses

**Recorded / independently cross-checked against the repository's `develop/2.0` `VALIDATION.md`:** Round 1: G0/G1-A/G1-B strict correctness 150/149/147 out of 150; E-1 targeted claim-level coverage 126/127/128 out of 129; graph-opened files across G1-B: 5 in 150 runs. Q13 compiled knowledge omitted some rationale and retrieval failed to read enough source; Q21 later design decision lacked a direct Topic link, though an indirect path existed and retrieval failed to follow it. Not proof of general superiority.

**Repository evidence**: the connected `JayJiangCT/knowlery` repository currently reports `visibility=public`; `docs/2.0/VALIDATION.md` and `CLOUD-PROMPT-ROUND2.md` both state the purported SHA-256 of `E1-ARCHIVE.sha256` as `98d1d418e09392f9d2b7404a864fcbe52e8f195571751340055a7911fad9f6e2`. This is **a written claim, not an independent cryptographic verification**. The actual archive file and all members must be checked locally in T0.

**Hypotheses, not findings:** compiled Wiki may raise reliably verified answers on harder tasks; active KF-aware graph operations may improve relationship questions; new Records may be propagated safely to affected claims. All may fail or remain inconclusive.

## 2. Hard privacy and artifact-boundary policy (BLOCKER resolved at design level)

### PUBLIC_ROOT — public repository (publish only after inspection)

`evals/experiments/cli-002-round2/` may contain ONLY:

- Research protocol and run-design documentation with abstract examples only.
- Metric definitions, JSON Schema and **synthetic fixtures only**.
- A vetted, aggregated, de-identified findings report; no row-level traces, question text, private filenames, internal links, source excerpts, user-identifying fields, original hashes or identifying metadata.
- A sanitized provenance statement indicating evidence is in a private archive, without disclosing the location or identifiers.

### PRIVATE_ROOT — separate, approved access-controlled storage outside *all* public Git worktrees

Every real or potentially revealing artifact MUST be under a locally configured `${PRIVATE_ROOT}/cli-002-round2/`, including:

- G0/G1 vaults, any copies/snapshots, new Records, C diffs, preflight file inventories, absolute paths and SHA manifests.
- Benchmarks, question text, gold labels, equivalent-evidence lists, human annotation records and grading details.
- Model/Harness I/O, agent prompts containing private material, stdout/stderr, tool traces, raw telemetry, cost logs joined to runs, crash logs, screenshots and intermediate cache/export files.
- Anonymous row-level grading and output even when a person believes they are redacted (can retain private text or identifying patterns).

**Operational gates**:

- Validate canonical `realpath(PRIVATE_ROOT)` outside the repository and its worktrees; reject symlinks/bind mounts that resolve into a public checkout. No automatic cloud sync/public Git/PR attachments unless explicitly approved for that environment.
- Restrict owner/group permissions (recommended `umask 077`); prevent model log streaming to public CI/telemetry or public issue bodies.
- Only synthetic tests in the repository; no private manifests, paths, source quotations, real filenames, snippets, private hashes or traces in tracked files.
- Before any `git add`, run staged-file content/DLP review and explicit Owner/authorized human release review of summary. `.gitignore` is defense-in-depth, NOT the security boundary. If private content is committed, stopping and following a separate incident remediation protocol is required; deletion from HEAD alone is insufficient.
- If storage access, privacy classification or separation is uncertain, **STOP/ASK** before reading/exporting private content into a new environment.

**Path convention (illustrative only; no assumption that directories exist):**

- PUBLIC: `evals/experiments/cli-002-round2/{PROTOCOL.md,METRICS.md,METRICS-SCHEMA.json,RESEARCH-FINDINGS-SANITIZED.md}`.
- PRIVATE: `${PRIVATE_ROOT}/cli-002-round2/{preflight,D-review,pilot,v3,calibration,B,C,A}/...`.

## 3. D — Evidence measurement contract (T1; no paid runs)

Define separate observable fields:

- `gold_path_hit`: the specific predesignated Gold path appeared in tool output actually delivered to the Agent; `gold_path_opened` separately records reading it.
- `valid_source_reached`: actual retrieved content of a valid, pre-adjudicated source was accessible to Agent; can be true even if `gold_path_hit` is false.
- `fact_verified`: semantic completeness and proper time/scope/units validated by reviewer using source trace; additionally report separate KF F-008 compliance for compiled claims. The CLI `inspect` cannot by itself certify semantic truth.
- `unknown / indeterminate`: insufficient trace to confirm stage, not automatically false or true. Cite exact reason privately.

Additional measures: final strict correctness, proper abstention, wrong-current-claim, essential-fact coverage, source version validity, output truncation status, graph availability/call/returned-edge/read-from-edge/verified-use, call counts, context consumption, and total cost. `L1→L2→L3` is a conceptual workflow, NOT a mathematical nesting guarantee, because equivalent sources can bypass the exact Gold path.

**D method:** Two independent reviewers blind-annotate ~10 already archived trajectories in the approved private environment, resolve disagreements without changing frozen Round 1 scores, use synthetic fixtures for machine schema/aggregator validation. If full traces are not available, label `unknown`; no unverifiable claims of independent replay.

**D success:** public metric definitions and valid schema; private case-level adjudication evidence; independent reviewer disagreements documented; deterministic aggregator passes synthetic tests; no old gold/results edits. **Failure:** source-equivalence authority conflict, insufficient observable events, or privacy risk → stop/ask rather than assuming completeness.

## 4. B prerequisites: T2 functional Pilot, T3 difficulty calibration and benchmark authorship

### T2 — Minimal CLI-002 Retrieval Pilot (separately authorized research prototype)

**Question:** Does B test the actual intended deterministic `search`, `explore`, `inspect` operations, rather than only Wiki + prompting?

**Research-grade functional requirements (proposed):**

- A **real, executable, read-only** CLI Pilot (not stubbed responses or prompt instructions alone); internally it may reuse file-search/Obsidian tools, but exposes the three composed operations and their measured behavior.
- `search`: find bounded, addressable candidate entries, including unlinked Raw Notes.
- `explore`: return typed semantic KF evidence/evolution edges and exploratory wikilink/backlink edges as navigational metadata without bulk reading all linked content.
- `inspect`: read located Claim/Record/Source, present version/partiality/failure states, support source checks and stateless continuation where the pilot claims to support it. Never mark insufficient or truncated content as verified.
- Predefine and record tool calls and the result each returned, follow-on `inspect` calls, provenance, and evidence. **Functional observation**, not synthetic graph-success counters.
- G1-A and G1-B run on identical G1 assets, answering models, backend and budget; graph enablement is isolated. G0 uses the same available `search/inspect` interface. The difference in tool availability/prompt should be documented as a causal treatment limitation.
- Test on synthetic fixtures and read-only sanctioned vault copies. No gold exposure. Do not treat this minimal prototype as approved production API, schemas, caching design or backend superiority.

**Go gate:** all three operations execute, obey basic limits/partial-state semantics, return versioned observable evidence, pass negative-path synthetic tests, and demonstrate a graph event can lead to an actually opened source in a neutral non-v3 fixture. Independently reviewed. If not, label any subsequent B as **Wiki/Prompt research only; NOT CLI-002 validation** and seek Owner direction.

### T3 — v3 design and difficulty calibration (independent author; no paid runs before separate approval)

- Independent new author with access to approved source data only; no Round 1 gold/answers/scoring, no generated G1 as an authoring shortcut; independent gold reviewer, scorer and blinded answerers.
- Prefer an initial **40-question candidate set** (e.g. 12 relationship + 12 current-vs-history + 12 rationale + 4 unanswerable). Consider increasing to ~48 before freeze if power/coverage requirements and budget allow. These are proposals, not approved counts.
- Create **8–12 separate calibration-only questions** in a private environment (not part of final v3, no reuse of wording/required facts). Run G0 with the proposed fixed answer model, true Pilot tool interface and budget, using a separate small **paid calibration approval**; review baseline difficulty and failure modes. Target roughly 50–70% on answerable pilot questions as a practical warning zone, not a hard selection algorithm. Do not tweak v3 for G1-specific advantages.
- A small calibration set has wide uncertainty; it cannot establish that all v3 questions will yield a 50–70% baseline. Also inspect task distribution, evidence complexity and ambiguity, and prevent authoring from exploiting G0 failures. Require Gold semantic review *before* freezing.
- Frozen v3 receives a private exact manifest of questions, gold/equivalent evidence, model/harness/tool versions, score rules, case exclusions, randomization seeds and budget. No real question/Gold content in the PUBLIC repo.

**Pre-freeze gate:** calibration report exists and is private; pilot operational; no question leakage or reuse; author/grader segregation; independent gold review complete; one designated Owner freeze approval.

## 5. B main experiment (not yet approved)

**Hypotheses:** G1-A vs G0 isolates compiled-asset utility *as far as possible* when using the same tool interface. G1-B vs G1-A examines actual `explore` access and its consequences, not just wording changes. Track implementation, content, and prompt effects separately.

**Candidate sample:** 40 questions × 3 arms × 2 runs = **240** main runs, plus optional guided graph diagnostics on 12 relationship questions × 2 runs = **24**, total **264 paid answer runs**; calibration calls are separate. If 48 are selected, recompute budget before Owner approval. Runs share questions: infer uncertainty clustered/paired at the question level, not 264 independent facts.

**Primary endpoint:** proportion of answerable questions/runs with complete *and* source-verified correct answer under appropriate F-008 checks. Non-answerables have separate abstention/safety endpoints; do not inflate the primary metric with them.

**Secondary:** strict correctness, L1/L2/L3, wrong-current-claim, source reach, graph adoption and evidence-use rates, unknown/truncated status, tokens/calls/latency and cost. Separate natural graph availability vs guided diagnostic. Graph used `at all` ≠ graph improved answer; trace actual causal pathway.

**Evaluation proposal:** Paired item-level effects, prespecified clustering by question and knowledge cluster, interval and descriptive comparisons; review statistical power/MCID with a statistician or reproducible simulation **before** final sample freeze. Previous 10pp plus 90% CI positive rule is a **candidate screening signal only**, not a guaranteed achievable criterion or architecture GO gate. Explicitly allow INCONCLUSIVE despite more samples. Correctness, evidence traceability and unsafe claims remain guardrails. Reviewer audit of a prespecified random + disagreement + adverse-case sample, across all arms.

**Cost model:** Round 1 observed (per Local Agent report) $60.88/450 ≈ $0.135/run; harder items could cost more. 264 runs cost ~$35.7 at $0.135 or $52.8 at $0.20, excluding calibrations, grading and setup; **candidate answer-run cap $60** retained but must verify sufficiency after calibration. No spend unless Owner separately authorizes B with a monitored hard cap and stop-before-exceed control. If 48-item plan, higher cost or separate cap must be approved rather than assumed.

**B success/failure:** (a) tools genuinely observed and arm contrast valid; (b) independently adjudicated required facts and adequate source checks; (c) quality/cost tradeoff evaluated with clustered uncertainty and safety outcomes; (d) either supported mechanism, negative signal or INCONCLUSIVE documented. None automatically accepts CLI architecture or publishes a versioned command contract.

## 6. C knowledge-evolution study (separate approval)

Use six candidate distinct change classes, each on an isolated, writable **private** G1 derivative with a read-only C0 counterpart; C1 runs proposed maintenance behavior. Validity/authority rules and gold states independently reviewed. Distinguish *change discovered*, *current state correctly interpreted*, *targeted updates made*, *historical data preserved*, *conflict escalated*, and *unrelated assets untouched*. `flag for review` can be safe but cannot count as `updated correctly`.

No modifications to frozen G1, Work Vault, benchmark artifacts, or B materials. Keep real diffs, source excerpts, path manifests, run traces and grader records PRIVATE. Public findings only if sanitized/reviewed. Candidate six scenarios and $30 cap require independent Owner approval. If no controlled write-safety mechanism exists, perform read-only detection/plan-only C0 first; do not confuse proposed change plan with executed evolution.

## 7. A restricted-budget rerun (conditional)

Retain frozen v2 and original gold/equivalence limitations; 50 questions × 3 arms × 1 run if separately approved. Change **only one** budget dimension (prefer tool-call cap 8–10 at fixed model) and record the restriction's effects; cannot claim a general CLI success from legacy generic-file tooling. Reuse new Pilot only if doing so keeps the exact treatment definition clear and label it a new non-comparable condition. Proposed ~$20 estimate/$25 cap is a gate proposal, not authorization. Default **NOGO** absent an unexplained B budget-sensitivity question.

## 8. Role separation and privacy governance

| Role | Authorized context | Prohibited context/actions |
|---|---|---|
| T0 archive auditor | existing frozen archives in private read-only location | mutate archives, upload raw data |
| D annotators | approved private historical traces, metric rules | modify original scores or publish row traces |
| Pilot developer | KF/GR specifications + sanitized synthetic fixtures; controlled read-only local dataset only as approved | Gold/score labels, production Vault edits |
| v3 author | authorized G0 sources; independent authoring brief | R1 Gold/answers/scoring, G1 shortcut, answer/grading sessions |
| independent gold reviewer | v3 candidate/private G0 references | run B answers, change post-unblinding gold opportunistically |
| B answer agents | question text + assigned read-only Vault + Pilot tools | Gold, score outputs, other arms' answers, mutation |
| B independent graders | anonymous arm-blind responses, private trace and pre-frozen gold | author questions, see treatment identity before first pass |
| C scenario/runner | private mutable copies approved for C only | any frozen/B Vault mutation |
| Owner | decision record and final reporting | no implied approval from forwarding commentary |

Session isolation includes file permissions, process mounts, session instructions, model version records, redacted public logs and audit trails. Same model family for author/answer/scoring creates correlated errors; mitigation: independent human source review and randomized audit (not claims of perfect independence).

## 9. Bounded Local Agent task contracts

All paths are *planned* and must be resolved in an approved environment. `PUBLIC_ROOT` is a Git worktree; `PRIVATE_ROOT` is not. No tasks herein have been dispatched or executed.

### T0 — Archive + privacy preflight (suggest authorize now, no paid calls)
- **Objective**: Locate and verify Round 1 sources and strict private/public output separation.
- **Inputs**: official Prompt, current repository `VALIDATION.md`/`DECISIONS.md`, Owner-approved local archives, expected archive SHA from written records.
- **Scope**: read-only file inspection, hash verification, privacy/path checks; no edits to archives.
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/preflight/INPUT-MANIFEST.json`, `E1-HASH-VERIFY.txt`, `ARCHIVE-AUDIT.md`, `PATH-ISOLATION.txt`.
- **Public output**: sanitized `evals/experiments/cli-002-round2/PREFLIGHT-STATUS.md` with only PASS/FAIL/NEEDS-EVIDENCE and non-sensitive explanation, after review.
- **Done**: prove expected `sha256sum E1-ARCHIVE.sha256`, independently verify archive-listed member hashes, all frozen inputs' versions and immutable states, canonical private path outside any public checkout, and zero changes to frozen paths; distinguish verified from written-only claims.
- **Stop/ask**: missing archive, mismatch, noncanonical/symlink escape, unauthorized private Vault access, leaked content in public destination. If some archives are inaccessible, mark NEEDS-EVIDENCE rather than fabrication; D may proceed with documented limitations, but paid B is blocked.

### T1 — D metric contract and annotation protocol (suggest authorize now, no paid calls)
- **Objective**: Define and test L1/L2/L3, source-equivalence and `inspect` state semantics without altering R1 scoring.
- **Inputs**: GR-010/GR-008, KF F-008, R1 limited audit in approved private setting, E-1 distinction.
- **Public outputs**: `evals/experiments/cli-002-round2/METRICS.md`, `METRICS-SCHEMA.json`, `ADJUDICATION-PROTOCOL.md` (abstract/synthetic only).
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/D-review/ANNOTATIONS.jsonl`, `REVIEW-DISAGREEMENTS.md`, raw validator logs.
- **Done**: schema parse/validation, fixture tests deterministic, two reviewers annotate ~10 permitted traces, unknown events not guessed, disagreements auditable; no private text in public outputs.
- **Stop/ask**: unclear source authority, unverifiable actual reads, any need to revise accepted KF/GR contracts or original scores, content privacy failure.

### T2 — Read-only CLI Pilot feasibility (later separate authorization; NOT production implementation)
- **Objective**: Produce actual observable `search/explore/inspect` behavior on synthetic tests and authorized read-only copies.
- **Inputs**: approved three-operation pilot scope; GR-001–GR-010, KF v1.0, T1 metric state contract.
- **Public outputs**: sanitized `PILOT-OPERATION-CONTRACT-PROPOSED.md`, synthetic conformance fixtures and test summary.
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/pilot/TRACE.jsonl`, `FEASIBILITY-AUDIT.md`, local configs/outputs.
- **Done**: executable, non-stubbed, read-only pilot; explicit tool telemetry; search discovers unlinked fixture; explore typed edges; inspect located source + version/partial-state handling; at least one fixture edge→inspect evidence route demonstrated; no writes to frozen files.
- **Stop/ask**: it requires Gold access or undocumented manual lookup; attempts to modify user data; cannot isolate graph toggle; no meaningful inspect evidence path.

### T3 — v3 authoring design, role audit, calibration gate (later separate authorization)
- **Objective**: Design a genuinely discriminating, independently authored and reviewed v3; calibrate before freeze.
- **Inputs**: T0/T1/T2 findings, approved Raw G0 access, authorized author/reviewer roles.
- **Public outputs**: sanitized `BENCHMARK-V3-DESIGN.md` and sampling/statistics plan (no real question text).
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/v3/{QUESTIONS,GOLD,EQUIVALENCE,ACCESS-AUDIT}.json` (exact structure TBD), `calibration/CALIBRATION-RESULTS.md` and raw traces.
- **Done**: author and grader conflict checks, 8–12 calibration questions never reused, independently reviewed Gold for all final questions, difficulty/profile recorded, pre-frozen exact schema/model/harness/budget/random seed, Owner freeze authorization.
- **Stop/ask**: author exposed to R1 Gold, G1 compilation or grading; G0 still near ceiling or ambiguity/Gold defects unresolved; calibration would incur unapproved fees; private records in public repo.

### T4 — B execution and independent scoring (later separate spending approval)
- **Objective**: Test compiled knowledge and graph contribution **using functional CLI Pilot**; report robustly negative/inconclusive results.
- **Inputs**: frozen v3, approved protocol, frozen G0/G1, pinned Pilot, signed role separations, authorized budget.
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/B/{RUN-CONFIG.json,ANSWER-TRACE.jsonl,SCORES-PER-RUN.json,GRAPH-TELEMETRY.jsonl,COSTS.csv,REVIEW.md}`.
- **Public output**: vetted `RESEARCH-FINDINGS-SANITIZED.md` only after review.
- **Done**: exact planned run count; preserved actual event trace; zero Gold leak; question-level uncertainty analysis; tracked spend under approval; blinded grading + human audit; no false claim of code/CLI production validation.
- **Stop/ask**: cost overrun forecast, tool failure, Gold leak, sample/arm contamination, unexpected source mutation, grading-rule post-hoc drift.

### T5 — C evolution research (later separate approval)
- **Objective**: Evaluate change detection/propagation/safety on distinct writable private derivatives.
- **Inputs**: frozen G1 read-only source for copying, KF v1.0, approved private C scenario plan.
- **Private outputs**: `${PRIVATE_ROOT}/cli-002-round2/C/{COPY-MANIFEST.json,DIFF-REVIEW.md,EVOLUTION-TRACE.jsonl,PROVENANCE-AUDIT.json}` and all modified Vault copies.
- **Public output**: synthesized findings only after review.
- **Done**: independent C0/C1 input equivalence; each case records impacted/missed/unnecessary changes; no frozen/G0/B modifications; historical facts and governance states preserved, failed or uncertain outcomes not hidden.
- **Stop/ask**: unsafe writes, data identity confusion, need for new accepted format contract, loss of source recoverability.

### T6 — A conditional rerun decision (paper-only unless later authorized)
- **Objective**: Determine if B leaves a budget-specific causal question that v2 can meaningfully probe.
- **Inputs**: B/C summaries and frozen v2 limitations.
- **Public output**: sanitized `A-GO-NOGO.md`; **private** any future actual run data.
- **Done**: explicit value of information, single-variable intervention, identifiable comparison, maximum cost and authorization status; NOGO means no runs.
- **Stop/ask**: simultaneous model/tool changes; Gold rewriting; no unique research value; fees not approved.

## 10. Owner decision gates

**Gate NOW (recommended)**: authorize T0 + T1/D *only*, in a trusted private environment; confirm approved PRIVATE_ROOT and reviewers. No model execution, no new questions/Gold, no source edits, no release to public repo without sanitization check.

**Gate PILOT**: separately authorize limited research prototype T2, no product CLI acceptance or production rollout.

**Gate v3 authoring/calibration**: separately authorize role allocation, private G0 access, question authoring by a new isolated session, independent reviewer, paid G0 calibration runs and freeze after review.

**Gate B**: approve final number of questions/repeats, actual calibration outcome, pinned Pilot, statistical plan and hard spending ceiling (candidate $60 for 40-question design; revisit if cost estimate exceeds cap).

**Gate C**: separate approval for writable copies and spending (candidate $30).

**Gate A**: default no-go; approve only on a specific unresolved reason and isolated budget (candidate $25).

**Decision integrity:** No change to CLI-002 OPEN, KF v1.0 ACCEPTED rules, GR-010 ACCEPTED FOR PILOT scope, or official command names/JSON Schema. Research results may recommend a new ADR/RFC, but do not confer ACCEPTED status.
