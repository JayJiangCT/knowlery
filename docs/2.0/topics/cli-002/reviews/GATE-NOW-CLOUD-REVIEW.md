<!-- Received from the Owner in chat on 2026-11-05 and stored verbatim by the topic session. Owner authorized task CLI002-R2-GN-REVIEW-FOLLOWUP-01 (docs phase and v1.1 targeted regression) on 2026-11-05; see STATUS.md. -->

# CLI-002 Round 2 — Gate NOW Independent Review & Follow-up

**Reviewer:** Cloud Agent  
**Review Date:** 2026-11-05  
**Repository:** `JayJiangCT/knowlery`  
**Branch:** `develop/2.0`  
**Reviewed Commit:** `d48acce45fe6ed95958654d81971e11b2f2089dd`  
**Review Status:** CONDITIONAL GO  
**Decision Status:** CLI-002 remains OPEN

## 1. Executive Conclusion

Gate NOW has produced useful and substantially credible research artifacts.

**T0 and T1/D are accepted as research outputs, with documented limitations. However, Metric D is not yet approved as the frozen primary evaluation contract for Gate B.**

The current work should be preserved. No Round 1 rerun, large-scale reannotation, or reconstruction of the existing research artifacts is required.

Before moving toward Gate B, several metric definitions and adjudication rules need to be clarified.

### Review decisions

| Component | Verdict | Qualification |
|---|---|---|
| T0 — Archive Preflight | GO, limited | Historical trace integrity remains unproven |
| T1 — Metric D research | GO | Preserve metric definitions, schema, code and synthetic fixtures |
| T1 annotation and adjudication | GO, limited | Private execution evidence not independently reproduced by Cloud Agent |
| Protocol v1.1 | CONDITIONAL GO | Requires targeted regression of revised rules |
| D as Gate B evaluation contract | CONDITIONAL GO | Primary metrics and currentness semantics must be settled |
| T2 / T3 / B / C / A | NOT AUTHORIZED | Require their respective Owner approvals |

**This review is not authorization to execute the next gate, perform paid experiments, change frozen artifacts, or promote any architecture decision to ACCEPTED.**

---

## 2. Review Scope and Verified Evidence

Cloud Agent directly inspected the 38-file commit, including:

- `ROUND-2-SUMMARY.md`
- `STATUS.md`
- `reports/T0/REPORT.md`
- `reports/T1/REPORT.md`
- `reports/T1/METRICS.md`
- `reports/T1/METRICS-SCHEMA.json`
- `reports/T1/ADJUDICATION-PROTOCOL.md`
- `reports/T1/ADJUDICATION-PROTOCOL-v1.0.md`
- `reports/T1/aggregate.py`
- `reports/T1/test_aggregate.py`
- Synthetic fixtures and task briefs

The repository connector reported that remote `develop/2.0` already pointed to `d48acce` at review time. The repository is PUBLIC.

Static inspection of the committed Diff found no obvious G0 source-content exposure, local `/Users/` paths, credential prefixes, or real email addresses.

### Verification limitations

Cloud Agent did not independently:

- Recalculate every private T0 archive hash.
- Reproduce the 17 unit tests or all aggregation executions.
- Examine the private Gold, trace packets, original annotations or complete judging transcripts.
- Recompute the private T1-W results.

Accordingly, private execution and integrity results remain **reported by Local Agent**, not fully independently verified by Cloud Agent.

No frozen files were modified during this review.

---

## 3. Findings Requiring Follow-up

### Major 1 — `fact_verified` must not be treated as standalone trustworthy-answer accuracy

Current `METRICS.md` §3.5 allows `fact_verified = true` when the final answer correctly expresses the required fact and the agent received supporting text.

That supporting text may be a compiled Claim rather than an original Source.

Consequently, the following combination is valid under the existing protocol:

- `gold_path_hit = true`
- `valid_source_reached = false`
- `fact_verified = true`
- `f008 = non_compliant`

This is not necessarily a bug. The non-nesting of L1/L2/L3 is intentional.

The risk is interpretive: `fact_verified` by itself does not establish that the answer complied with KF source-verification requirements or that its supporting source was independently trustworthy.

**Required clarification:**

Retain the existing dimensions but ensure Gate B reports, at minimum:

1. Fact-level answer support (`fact_verified`).
2. Valid source actually reached (`valid_source_reached`).
3. KF F-008 compliance.
4. Currentness errors.
5. Independent strict correctness.

Document which measures are primary outcomes, which are safety guardrails and which are diagnostic measures.

Do not introduce an arbitrary composite score.

Do not rename L3 to "trustworthy answer rate" without an explicitly justified operational definition.

### Major 2 — Split `wrong_current_claim` into distinct reference-dependent measures

T1-W reports:

- Two independent judges per condition.
- 8/8 agreement within each condition.
- Packet-only condition matched Round 1 in 5/8 cases.
- Vault-supersession-context condition matched Round 1 in 7/8 cases.

This demonstrates that the reference supplied to the judge materially influences the result.

Cloud Agent supports a proposed split:

**`wcc_gold`**

Whether the answer contradicts independently adjudicated knowledge at the specified `as_of` date.

**`wcc_vault`**

Whether the answer presents as current a Claim that the compiled Vault itself marks as superseded or disputed.

These measure different properties.

- `wcc_gold` concerns external answer correctness against a dated reference.
- `wcc_vault` concerns consistency with the Wiki's own recorded knowledge state.

**Important constraints:**

- A Wiki can be internally consistent yet factually outdated.
- G0 has no equivalent compiled governance structure; `wcc_vault` must not be treated as a directly symmetric G0/G1 measure.
- Neither metric should silently replace the frozen Round 1 WCC results.
- The assertion that Round 1 WCC equals the union of these two measures remains a hypothesis until established for the relevant population.

For a future History-loading experiment, do not use `wcc_vault` as the only primary metric. Include externally grounded currentness and historical-answer correctness.

**Required clarification:**

Prepare proposed definitions, applicability rules, reference requirements, schema implications, and reporting conventions.

The existing code and schema currently retain the unsplit `wrong_current_claim`. A split must be implemented consistently rather than introduced only in narrative reporting.

### Major 3 — Protocol v1.1 needs targeted validation

The D calibration sample was annotated under protocol v1.0.

Protocol v1.1 subsequently incorporated Owner rulings:

- **Rule A:** Superseded History content supports historical-state questions, not current-state assertions.
- **Rule B:** Evidence equivalence and support judgments use only text actually delivered in tool results.
- **Rule C:** Merely repeating a condition in the question is not asserting the required fact.

Cloud Agent supports these rules in principle.

However, agreement achieved under v1.0 does not independently establish the reliability of v1.1.

**Required follow-up:**

Perform or prepare a bounded regression covering the two packets containing disagreements and the relevant revised rules.

Preserve v1.0 annotations and original rulings.

Record:

- Which cases are affected by each new rule.
- Expected v1.1 outcomes.
- Actual independently checked outcomes, if execution is authorized.
- Any remaining ambiguities.

Do not reannotate the entire Round 1 dataset.

If additional model execution would incur fees or require a new unapproved agent session, stop and request Owner authorization.

### Minor 1 — Correct T0 status wording

`STATUS.md` currently uses wording implying 11 verified artifact classes.

The more accurate finding is:

**10 artifact classes PASS; Round 1 tool traces NEEDS-EVIDENCE.**

The new trace manifest is a baseline for detecting future changes. It does not retroactively establish integrity dating back to Round 1 completion.

Update the status wording accordingly.

Do not change historical artifacts to make the status appear cleaner.

### Minor 2 — Clarify the meaning of "frozen"

T0 found that several artifacts remain writable on disk, although their hashes match expected values.

This is acceptable as a documented research limitation.

Use terminology that distinguishes:

- Hash-frozen: integrity can be checked against a recorded digest.
- Write-protected: filesystem permissions prevent ordinary writes.
- Historically verified: evidence establishes continuity from a particular earlier freeze point.

Do not claim these guarantees are interchangeable.

---

## 4. Answers to the Gate NOW Research Questions

### Q1. Should inline `## History` be changed?

**Recommendation: Not yet.**

The hypothesis that inline History can cause stale-knowledge answers is plausible, but the current calibration evidence does not establish its effect.

Do not modify KF v1.0 or move History into separate files based on this evidence.

A future isolated experiment should first compare:

- Control: Full Topic Page reading, including History.
- Treatment: Current Claims and source index first; History loaded on demand.

Measure current-state correctness, historical-answer completeness, reference-specific WCC, and context/token consumption.

This is a candidate extension to C or a separate future research task, not an additional variable for B.

### Q2. Should WCC be split, and should `wcc_vault` be primary?

**Recommendation: Split the measures, but do not use `wcc_vault` alone as the primary outcome.**

It is an internal consistency measure rather than an independent truth measure.

The final measurement choice remains subject to Owner approval.

### Q3. Should v3 require an explicit `as_of` date?

**Recommendation: Yes.**

Every v3 current-state question should have an explicit temporal reference and independently checked Gold evidence.

Candidate private Gold metadata should distinguish:

- `as_of`
- `state_kind`
- `supporting_evidence`
- `supersession_checked`
- `uncertainty`

Particular care is required to distinguish proposed design, approved decision and actual deployment.

One possible stale Benchmark v2 answer is currently reported. Preserve it as a PROPOSED errata issue until Owner adjudication.

Do not silently correct Benchmark v2 or its frozen scores.

### Q4. Is D ready for Gate B?

**Verdict: CONDITIONAL GO.**

The metric framework and tooling are sufficient to continue research preparation.

Before freezing the B evaluation contract, settle:

- Primary outcomes versus guardrails.
- WCC reference semantics.
- F-008 interpretation and limitations.
- Protocol v1.1 regression.
- Currentness Gold requirements.

Do not treat Gate NOW completion as approval to run B.

---

## 5. Proposed Local Agent Follow-up Task

**Task ID:** CLI002-R2-GN-REVIEW-FOLLOWUP-01  
**Title:** Gate NOW Metric Contract Clarification and Review Closure  
**Status:** PROPOSED — Owner authorization required before execution

### Background

Gate NOW completed T0 and T1/D, including calibration, adjudication and a bounded WCC judging check.

Independent Cloud Agent review issued CONDITIONAL GO and identified metric interpretation and protocol-version issues.

The goal is to resolve those issues with minimal additional work while preserving the existing evidence.

### Objective

Produce a reviewable, internally consistent D measurement contract suitable for Owner consideration before Gate B.

### Scope

Permitted after authorization:

1. Clarify the meaning and limitations of the existing metrics.
2. Define proposed `wcc_gold` and `wcc_vault` semantics.
3. Define Gate B primary outcome and safety guardrail candidates.
4. Prepare a targeted v1.1 regression review.
5. Correct misleading public status wording.
6. Document remaining protocol ambiguities and Owner decision requirements.

Prefer documentation and small deterministic checks over new infrastructure.

### Out of Scope

Do not:

- Modify G0, G1, Benchmark v2, Round 1 answers, original scores, Gold or E-1 archives.
- Rewrite prior annotations or Owner rulings.
- Draft new v3 questions or Gold Answers.
- Execute B, C, A or paid experiments.
- Implement the production CLI.
- Change Knowledge Format v1.0.
- Introduce a new Wiki storage layout.
- Promote CLI-002, Metric D or WCC definitions to ACCEPTED.
- Push private traces, evidence excerpts, answer text or private paths into the PUBLIC repository.

### Inputs

**Repository:** `JayJiangCT/knowlery`  
**Review commit:** `d48acce45fe6ed95958654d81971e11b2f2089dd`

Use the files in:

`docs/2.0/topics/cli-002/`

Especially:

- `ROUND-2-SUMMARY.md`
- `STATUS.md`
- `reports/T0/REPORT.md`
- `reports/T1/METRICS.md`
- `reports/T1/ADJUDICATION-PROTOCOL.md`
- `reports/T1/ADJUDICATION-PROTOCOL-v1.0.md`
- `reports/T1/METRICS-SCHEMA.json`
- `reports/T1/aggregate.py`
- `reports/T1/test_aggregate.py`

Private calibration and adjudication records may only be accessed under the Owner-approved private-store permissions.

### Suggested Deliverables

**Public, only after content-safety review:**

- `docs/2.0/topics/cli-002/reports/T1/CLOUD-REVIEW-RESPONSE.md`
- `docs/2.0/topics/cli-002/reports/T1/METRIC-CONTRACT-CLARIFICATIONS.md`
- `docs/2.0/topics/cli-002/reports/T1/REGRESSION-SUMMARY.md`
- Relevant revisions to `STATUS.md` and `ROUND-2-SUMMARY.md`

If the Owner approves a contract revision, update the schema, protocol, aggregation code and tests together, preserving the historical v1.0/v1.1 records.

**Private:**

- Case-level regression observations.
- Judge/reference comparisons.
- Raw evidence references and trace excerpts.
- Any new annotation or consensus files.

Keep all private files outside public checkouts and synced directories, using the existing approved store.

### Acceptance Criteria

The follow-up is complete when:

1. Every Major finding has an explicit disposition and rationale.
2. The D outcome and guardrail definitions are internally consistent.
3. WCC reference rules and G0/G1 applicability are documented.
4. Any revised code/schema has reproducible tests with recorded results.
5. Protocol v1.0 and original calibration artifacts remain unchanged.
6. The v1.1 targeted regression has a clear PASS / FAIL / INCONCLUSIVE outcome, or a documented authorization blocker.
7. T0 correctly reports 10 PASS / 1 NEEDS-EVIDENCE.
8. A public-content safety check finds no private research material.
9. No paid work or next-gate execution occurs without authorization.
10. The final handoff distinguishes verified results from reported claims and unresolved questions.

### Safety Constraints

Preserve the approved private/public boundary.

Do not edit frozen Round 1 artifacts, change their permissions, or rewrite historical Git commits without explicit authorization.

Any public repository change must undergo privacy inspection before push.

Do not expose benchmark content, Gold, source quotations or identifying internal paths in review summaries.

### Stop-and-Ask Conditions

Stop and report to the Owner if:

- A frozen hash or file count fails verification.
- Private material appears in a public worktree or committed file.
- The proposed WCC definitions require changing an accepted KF rule.
- A protocol ambiguity cannot be resolved without redefining evidence authority.
- Regression requires paid execution or unauthorized private access.
- A new experiment becomes necessary to support a claimed conclusion.
- Any proposed change would alter historical Round 1 scoring.

---

## 6. Required Final Handoff

Local Agent should return a concise report containing:

1. Responses to each Major and Minor finding.
2. Changed public file paths and commit SHA, if changes were authorized.
3. Deterministic test commands and actual exit results.
4. Private evidence verification status without exposing private contents.
5. Remaining OPEN questions and their effect on Gate B.
6. A clear recommendation: GO / CONDITIONAL GO / NO-GO / INCONCLUSIVE.

The response should explicitly state whether the D contract is ready for Owner approval, rather than claiming approval on the Owner's behalf.

## 7. Final Boundary

**Round 1:** Completed — Core Hypothesis Inconclusive  
**CLI-002:** OPEN  
**Gate NOW research artifacts:** Accepted for preservation and further review  
**Gate B scoring contract:** Not frozen  
**T2 / T3 / B / C / A:** Not authorized by this review  
**Architecture decisions:** No change

The purpose of this follow-up is to make the existing evidence reliable enough to support the next decision, not to expand the research program.

**Cloud Agent final verdict: CONDITIONAL GO.**
