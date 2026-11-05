# T1 report — D metric contract, annotation protocol and packets

**Task:** CLI-002 Round 2, T1 (plan §3 and §9). **Date:** 2026-11-04. **Status:** outputs written, not committed. Annotation has **not** started; it is two later, separate sessions.

Round 1 stays Completed — Core Hypothesis Inconclusive, and CLI-002 stays OPEN. No Round 1 score, verdict, gold label or E-1 decision was changed or re-judged. No paid model run was made. This folder contains only synthetic examples.

## 1. What was produced

**Public (this folder):**

| File | Purpose |
|---|---|
| [`METRICS.md`](METRICS.md) | Field definitions, the trace event that sets each one, allowed values, `unknown` reason codes, the non-nesting of L1/L2/L3, the F-008 derivation table, the evidence-read (`inspect`) states, and how the fields differ from Round 1's direct, claim and page tiers |
| [`METRICS-SCHEMA.json`](METRICS-SCHEMA.json) | JSON Schema (draft 2020-12 subset) for one annotation record and one aggregate record. Records only; not a CLI output schema |
| [`ADJUDICATION-PROTOCOL.md`](ADJUDICATION-PROTOCOL.md) | Step-by-step instructions for an annotator holding only the protocol and a packet; the six-criterion equivalence standard; disagreement recording and resolution without touching Round 1 |
| [`aggregate.py`](aggregate.py) | Stdlib-only validator (schema subset plus rules S1–S10), deterministic aggregator, mechanical trace helper, `--self-test` |
| [`test_aggregate.py`](test_aggregate.py) | Unit tests (17) |
| `fixtures/` | Synthetic traces (8), synthetic packet gold (`packets.json`), two synthetic annotators (8 records each, two seeded disagreements), the expected aggregate, 10 invalid records with the rule each must trip, and `generate_fixtures.py`, which regenerates all of them |

**Private (approved store, `D-review/`):** the trace sample with seed and rule, ten self-contained packets, the annotation template, a README for the annotators and the topic session, the packet builder, and check logs. Their paths are listed in the private README and in this task's hand-over message, not here.

## 2. Design decisions inside the brief (for review)

1. **"Delivered" means tool-result text only.** Tool inputs, the agent's own text, harness sidecar fields and the answer's self-reported evidence list are not delivery. This single rule settles every L1 edge case and is the main difference from Round 1, which measured the self-reported list.
2. **Unit is the required fact,** one gold `required_evidence` entry, not the file. This lets the metric see the Round 1 pattern where a file was opened through a narrow search window and the fact-bearing line was never delivered.
3. **L2 counts only pre-adjudicated sources.** Gold, or an Owner-approved E-1 accepted equivalent. An annotator's own accepted candidate makes L2 `unknown` (`EQUIVALENCE_NOT_ADJUDICATED`), never `true`. This keeps equivalence authority with the Owner, as the plan requires, and still records the candidate with the six criteria.
4. **L3 is independent of source authority.** Support may be a compiled claim; F-008 compliance is a separate field. That is why the three levels do not nest; the aggregate reports their joint pattern.
5. **F-008 is applied as a derivation table, and three ambiguities are marked `unknown` rather than resolved:** a matching digest that the agent never compared; the order of "first" when claim order and Sources order differ; and whether a Record or a `derived` entry counts as the "first vault-file Source". These are KF questions, outside T1.
6. **`inspect` states are derived mechanically** from completeness, partial cause and version check (precedence `unknown` > `error` > `version_stale` > `truncated` > `unverified` > `read`), and are documented as never certifying truth (GR-008).
7. **Round 1 limits are stated, not papered over:** no digest step and no graph tool existed, so `version_stale` appears only in synthetic fixtures and graph call counts are `NOT_OBSERVABLE_IN_ROUND1`.

## 3. The sample (described without private detail)

Ten Round 1 runs: six fixed case studies from the plan and the Round 1 findings, named by run before any draw, and four seeded draws (one from the non-correct runs not already fixed, one correct run per arm from the questions outside the case studies). The seed, rule, pool sizes, per-file hashes and the Round 1 labels are recorded privately. Packet numbers are a seeded shuffle, so they reveal neither selection route nor arm.

- All three arms are present, and both correct and non-correct runs. The sample is G1-heavy (one baseline-arm run), because the fixed case studies are all G1 runs. It is a calibration sample for the protocol, not a representative estimate.
- One draw is an unanswerable question, so the abstention fields get one real case.
- **Blinding is partial.** The two G1 arms are indistinguishable in the packets. The baseline arm versus G1 cannot be hidden: the vault root and compiled-page paths reveal it.
- Packets carry the question, expected answer, required facts, optional evidence, pre-adjudicated equivalents for that question (accepted and rejected), the trace and the self-reported answer. They carry no arm label, no Round 1 verdict, and no session or machine path. Traces keep their line numbers.

## 4. Limitations and open items

- **No annotation yet.** The plan's done criterion "two reviewers annotate ~10 permitted traces" and "disagreements auditable" are prepared, not met. They need the two annotator sessions and the T1-R review.
- **The expected aggregate was generated by the code under test**, then checked by hand against the fixture design (every field, the seven disagreement rows, the joint L1/L2/L3 patterns). The invalid fixtures and unit tests check the rules independently of that file.
- **Real-trace check was limited.** The trace helper was run on one private packet to confirm it parses the real format; its line-level result matched the Round 1 hand audit for that run. Nothing from that run is recorded in the packets.
- **Integrity was not re-verified here.** T0 was verifying the frozen archives in parallel. The sample records the sha256 of every source trace and answer so T0's manifest can be compared afterwards.
- **Gold errata were not used.** They are outside T1's allowed paths; packets use the frozen v2 gold and the E-1 decisions only.
- **Run-level mechanical measures** (call counts, context, cost) and the join of Round 1 strict correctness are defined but left to the topic session, after annotation.

## 5. Verification

All commands were run from this folder with Python 3.12.8 on macOS on 2026-11-04. `$PRIVATE_ROOT` is the approved private store.

**Ran, passed:**

| Check | Command | Result |
|---|---|---|
| Self-test | `python3 -I -B aggregate.py --self-test` | `SELF-TEST PASS 24/24`, exit 0 |
| Self-test is byte-identical | the same command twice, outputs compared with `cmp` | identical |
| Unit tests | `python3 -I -B -m unittest discover -s . -p 'test_*.py'` | 17 tests OK |
| Every valid fixture validates (schema subset + S1–S10) | `python3 -I -B aggregate.py --validate fixtures/annotations/*.jsonl` | `VALIDATE PASS 16 records, 0 errors`; the expected aggregate also validates (inside self-test) |
| Every invalid fixture is rejected for its stated rule | inside self-test, from `fixtures/invalid/cases.json` | 10/10 |
| Fixtures reproduce | `generate_fixtures.py` into a scratch folder, re-aggregated, `diff -r` against `fixtures/` | identical |
| Sample size and existence | private check script over `SAMPLE.json` | 10 entries; each trace exists in Round 1 `results/raw/`, its sha256 matches the recorded value, its line count equals the packet copy; all packet file hashes match |
| Packet build is deterministic | rebuild, then `cmp` of `SAMPLE.json` and the template | identical |
| Packets carry no arm label or verdict | `grep` over every packet trace and answer for arm names, the eval folder, home-directory paths and verdict words | no arm, path or verdict hits (two content-word hits, both vault text) |
| Public privacy grep (the brief's done criterion: home-directory prefix or any 64-hex string) | the brief's `grep -rE` command over this folder | no matches (exit 1) |
| Public vocabulary grep (extra) | `grep -rniE` for real project, ticket, person and question-id terms | no matches |
| Repository changes | `git -C <repo> status --short --untracked-files=all`; `git diff --stat HEAD` | new files only under `docs/2.0/topics/cli-002/reports/T1/`, plus four untracked files that existed before this task started (`STATUS.md`, `reports/T0/REPORT.md`, `tasks/T0/BRIEF.md`, `tasks/T1/BRIEF.md`); no tracked file changed |

The schema uses only `type`, `enum`, `const`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `minimum`, `pattern`, local `$ref` and `oneOf`. `aggregate.py` refuses any other keyword, and a unit test walks every definition to confirm it. A standard validator can also read the file; that was not run (stdlib only).

**Not run:**

- The annotation itself (two separate sessions, later), the aggregate of real annotations, and `REVIEW-DISAGREEMENTS.md`.
- Any validation of real annotation records, since none exist.
- A third-party JSON Schema validator.
- Archive and integrity verification (T0's task).
- Any commit. Nothing was staged or committed, and no branch was switched.
