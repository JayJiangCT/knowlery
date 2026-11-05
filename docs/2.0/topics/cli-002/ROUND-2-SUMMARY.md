# CLI-002 Round 2 — Gate NOW summary for the Cloud Agent

**Status:** READY FOR OWNER, 2026-11-05. This summary covers Gate NOW only: T0, T1, the D calibration review, and the Owner-approved T1-W check. Gates PILOT, v3, B, C and A are not started and need separate Owner approval. Nothing here is ACCEPTED.

## 1. Round and plan reference

- Topic CLI-002, Round 2. Plan: [PLAN.md](PLAN.md) (Revision 2, received 2026-11-04). Task states: [STATUS.md](STATUS.md).
- The Owner approved Gate NOW (T0 + T1/D) on 2026-11-04 and T1-W on 2026-11-05.
- No paid benchmark runs were made. Annotation and judging were done by fresh local agent sessions.
- All private material (packets, traces, labels, rulings, per-run results) stays in the approved private store. This file holds only aggregated, de-identified results.

## 2. Task table

| Id | Result | Verification | Report |
|---|---|---|---|
| T0 | Archive and privacy preflight. 10 of 11 artifact classes PASS; Round 1 tool traces NEEDS-EVIDENCE (no earlier manifest; new private baseline recorded) | Topic session re-ran the vault and E-1 archive checks | [reports/T0/REPORT.md](reports/T0/REPORT.md) |
| T1 | D metric contract, schema, annotation protocol, aggregation tool, synthetic fixtures; 10 private calibration packets | Self-test 24/24, deterministic; 17 unit tests pass; packets have no arm labels; privacy grep clean | [reports/T1/REPORT.md](reports/T1/REPORT.md) |
| T1-A1, T1-A2 | Two fresh, independent annotators; 10 records each | Both validate (10 records, 0 errors); isolation checked from transcripts; packets unchanged (30 of 30 file hashes match) | private |
| T1-R | Aggregate, disagreement review, Owner rulings, consensus file, join with Round 1 labels | Aggregate byte-identical on re-run; consensus validates and is hash-frozen; differs from each annotator only in the ruled rows | private |
| T1-W | Built a blind check of `wrong_current_claim`: 8 runs (4 Round 1 positives, 4 hard negatives), two conditions | 8 packets; leaked-word scan clean except one word from an answer's own text; manifest verifies | private (stub: [tasks/T1-W/BRIEF.md](tasks/T1-W/BRIEF.md)) |
| T1-W-J | Four fresh blind judges, two per condition | 4 × 8 verdicts; isolation checked from transcripts; materials unchanged after judging | private |

## 3. Findings

### Verified facts

1. **Frozen artifacts are intact** (T0). The baseline vault, compiled vault, benchmark, errata, all 450 answers, both score files and the E-1 archive match their recorded hashes. The private store is outside every public checkout and every synced folder.
2. **Frozen means hash-frozen, not write-protected** (T0). Most Round 1 artifacts are still writable on disk; integrity rests on hashes. One written record overstates protection: the Round 1 status file says all four E-1 files were set read-only, but one is still writable (its content is unchanged).
3. **Round 1 traces had no integrity record** (T0). Their counts match. A baseline is now recorded, so later changes can be detected, but changes before today cannot be ruled out.
4. **The D protocol is reproducible between annotators** (T1-R). Across 10 packets and 34 required facts, two independent annotators agreed fully on:
   - trace status;
   - whether the gold path was hit and opened, and how much of it was read;
   - whether the required lines were delivered;
   - the final `fact_verified` result (34/34);
   - all run-level fields.
   
   All 12 disagreements fell in 2 of the 10 packets, and none changed a `fact_verified` result. They were judgement and authority questions:
   - whether the answer asserts a fact (31/34 agree);
   - support kind (31/34);
   - whether support was delivered (33/34);
   - proposed equivalents (3/6);
   - whether a valid source was reached (33/34).
5. **The disagreements came from four unclear rules**, which both annotators also reported as protocol gaps. The Owner ruled on each, and the rulings are now protocol v1.1 rules A–C (section 6).
6. **Strict correctness is coarser than fact-level verification** (T1-R join). In the 10-run sample, two runs that Round 1 scored correct have unverified required facts (4 of 7 and 2 of 3 verified). The two runs scored partial each have 1 of 3 verified.
7. **The `wrong_current_claim` label depends on the reference the judge is given** (T1-W). Within each condition, the two judges agreed 8/8. Across conditions:
   - Packet-only judges, who compare against the benchmark's expected answer, matched Round 1 on 5 of 8.
   - Judges who also got the vault's own list of superseded claims matched Round 1 on 7 of 8.
   - The misses were opposite runs. One run conflicts only with the benchmark's current state; three conflict only with the vault's supersession records.
   - All four judges said no on all four negatives.
   - Round 1 judges had both references and counted either conflict. This explains the one Round 1 versus Round 2 conflict found in the D join.

### Interpretations

- Metric D can be annotated consistently once a few judgement rules are fixed. Its file-level fields are close to mechanical.
- Round 1's `wrong_current_claim` is the union of two different measures. It should not be compared with a measure that uses only one reference.

### Open questions

- **One benchmark question's expected answer may be outdated.** It describes a plan as current, but the baseline vault records that plan as superseded at a later date. A PROPOSED errata entry is waiting for the Owner. Round 1 scores are unchanged. This matters for any measure that uses the benchmark as its reference for "current".
- In the sample, three proposed equivalent sources stay "unsure" by Owner decision, so `valid_source_reached` remains `unknown` for those facts.
- For one benchmark question, the compiled vault's supersession records do not contain a later decision that the expected answer uses. Whether that is a compile gap or a source gap is not established.

## 4. Deviations

1. **T1-W ran outside Gate NOW.** The Owner approved it on 2026-11-05 to explain the one conflict found in the D join. It made no paid benchmark runs.
2. **Public outputs are in `reports/<id>/`** in this topic folder, not in `evals/experiments/cli-002-round2/`, following this repository's topic layout.
3. **Full task briefs are private** because they name private paths and hashes. Public briefs are stubs.
4. **The Owner moved the sample key out of the annotators' folder** before annotation, so annotators could not see it. The packet-hash check ran after the Owner gave its location.
5. **The annotation protocol changed during the round.** The sample was annotated under v1.0; v1.1 adds the Owner's rulings. Both versions are kept.
6. **T0 found the tool traces had no prior manifest.** A new baseline was recorded instead of a verification.
7. **Calibration only.** The D sample is 10 runs with only one baseline-arm run. T1-W is 8 runs. Neither estimates a rate.

## 5. Questions for the Cloud Agent

1. **Stale `## History` content in compiled pages (Owner's question, 2026-11-05).** Superseded History entries stay inline on compiled pages. They use context window and may sway the model toward an outdated state. The D calibration review led to a protocol rule (v1.1 rule A): a History entry counts as support only for questions about the earlier state; relying on it for a current-state question is `wrong_current_claim`. The 10-run calibration sample recorded no `wrong_current_claim` under Round 2 annotation, which is not evidence of no effect. Candidate experiment: compiled pages with History inline versus History moved to a separate file or loaded on demand; compare the `wrong_current_claim` rate and tokens read. Should this enter the Round 2 or Round 3 plan, and at what scale?

2. **Split `wrong_current_claim` into two measures (Owner's preferred direction, 2026-11-05; a proposal, not ACCEPTED).** A blind judging check (T1-W: 8 runs, 2 conditions, 2 fresh judges each) found full agreement inside each condition. Across conditions the verdict flipped with the reference the judges were given. With only the packet, judges compared against the benchmark's expected answer. With a list of the claims the vault itself marks as superseded, judges compared against the vault. Round 1 judges had both references and counted either conflict. Proposal: `wcc_gold` (answer conflicts with the benchmark's current state) and `wcc_vault` (answer presents as current a claim the vault marks as superseded or disputed). Each is judged with only its own reference and reported separately. Round 1's wcc stays unchanged and is described as the union of the two. Question: do you agree, and should `wcc_vault` be the primary measure for the History experiment in question 1?

3. **Benchmark staleness for "current state" questions.** One expected answer appears to predate a later supersession in the vault. Should v3 authoring require every "current state" gold answer to be checked against the vault's latest supersession records, with an explicit as-of date?

4. **Next gate.** Given the results above, is metric D ready to serve as a primary measure for Gate B? And should the wcc split and protocol v1.1 be settled before T2/T3 start?

## 6. Candidate decisions (proposals with evidence; none ACCEPTED)

1. **Adopt annotation protocol v1.1 for Round 2 D measurement.** Evidence: 4 above. Rules:
   - **A:** a superseded History entry counts as compiled support only for questions about the earlier state; relying on it for a current-state question is `wrong_current_claim`.
   - **B:** equivalence criteria and support judgements use only text delivered in the trace; undelivered content is `not_stated`.
   - **C:** information that only restates the question asserts nothing.
   
   [Protocol](reports/T1/ADJUDICATION-PROTOCOL.md), with [v1.0](reports/T1/ADJUDICATION-PROTOCOL-v1.0.md) kept.
2. **Split `wrong_current_claim` into `wcc_gold` and `wcc_vault`.** Each is judged with only its own reference; Round 1's value is described as their union. Evidence: finding 7.
3. **Keep the D aggregation contract as built.** It covers the fields, the aggregation tool and the rule that an annotator's own equivalent is `unknown`, never `true`. Evidence: finding 4. The tool reproduced byte-identical output, and the disagreements were all in judgement fields, not in the mechanical ones.
4. **Require hash manifests for every frozen artifact class, including traces, when it is frozen.** Evidence: findings 2 and 3.
