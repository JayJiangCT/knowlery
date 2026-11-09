#!/usr/bin/env python3
"""Write the synthetic v1.2 CANDIDATE fixtures. All content is invented (an apiary
vault that does not exist). Deterministic: running it twice gives identical files.

    python3 -I -B v1.2/fixtures/generate_fixtures_v12.py            # writes fixtures
    python3 -I -B v1.2/aggregate_v12.py --summarize v1.2/fixtures/valid-v12.jsonl \
        --manifest v1.2/fixtures/manifest.json --out v1.2/fixtures/expected-summary.json

The expected summary is produced by the candidate code and then checked against
hand-derived counts in test_aggregate_v12.py (SummaryCounts), so it is not only
self-referential.
"""
import copy
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
T, F, U, NA = True, False, "unknown", "not_applicable"


def obs(value, reason=None, events=None):
    return {"value": value, "reason": reason, "events": events or []}


def reuse_na():
    return {"applicable": "no", "claim_ref": None, "source_ref": None, "source_version": None, "claim_position": NA, "temporal_scope": NA,
            "verification_event": NA, "digest_comparison": NA, "currentness": NA,
            "currentness_basis": None, "as_of": None, "value": NA, "reason": None, "events": []}


def reuse(claim_ref, position, scope, event, digest, currentness, value, reason, basis=None, as_of=None,
          source_ref="notes/hive-log-2040-03.md", source_version="sha256:fake0301"):
    return {"applicable": "yes", "claim_ref": claim_ref, "source_ref": source_ref, "source_version": source_version,
            "claim_position": position, "temporal_scope": scope,
            "verification_event": event, "digest_comparison": digest, "currentness": currentness,
            "currentness_basis": basis, "as_of": as_of, "value": value, "reason": reason, "events": [4]}


def fact(fid, *, read_gold=True, asserts="yes", support="yes", kind="source", vsr=None, proposed=None,
         compiled_reuse=None):
    gold = "notes/hive-log-2040-04.md"
    if read_gold:
        hit = obs(T, events=[2])
        opened = dict(obs(T, events=[2]), read_extent="full")
        lines = obs("yes", events=[2])
        reached = dict(obs(T, events=[2]), source_basis="gold", source_ref=gold)
    else:
        hit = obs(F)
        opened = dict(obs(F), read_extent="none")
        lines = obs("no")
        reached = dict(obs(F), source_basis="none", source_ref=None)
    if vsr is not None:
        reached = vsr
    if asserts == "yes" and support == "yes":
        fv = T
    elif asserts in ("no", "partial", "contradicts") or support == "no":
        fv = F
    else:
        fv = U
    reason = None if fv != U else ("ANSWER_AMBIGUOUS" if asserts == "unknown" else "SCOPE_OR_QUALIFIER_UNCLEAR")
    return {
        "fact_id": fid, "gold_path_hit": hit, "gold_path_opened": opened, "required_lines_delivered": lines,
        "valid_source_reached": reached, "proposed_equivalents": proposed or [],
        "fact_verified": dict(obs(fv, reason, [3]), answer_asserts=asserts, support_delivered=support,
                              support_kind=kind),
        "navigation_used_as_evidence": obs(F),
        "compiled_reuse": compiled_reuse or reuse_na(),
    }


def wcc(value, comp, reason=None, ref_id="ref-vault-syn", ver="v-fake-0001", gold=False, checked=T, as_of="2040-06-30"):
    o = {"value": value, "reason": reason, "events": [], "reference_id": ref_id, "reference_version": ver,
         "reference_completeness": comp}
    if comp in ("absent", NA):
        o["reference_id"] = o["reference_version"] = None
    if gold:
        o["as_of"] = as_of if comp != "absent" else None
        o["gold_currentness_checked"] = checked
    return o


def gold_ok(value=F):
    return wcc(value, "complete", ref_id="ref-gold-syn", ver="g-fake-0001", gold=True)


def vault_na():
    return wcc(NA, NA)


def claim(ref, position="current", read=F, hist="absent", digest="not_computed", step=F, f008=None):
    c = {"claim_ref": ref, "facts": ["F1"], "used_in_answer": "yes", "first_vault_source": "identified",
         "first_source_ref": "notes/hive-log-2040-03.md", "first_source_read": obs(read, events=[5] if read is T else []),
         "history_source_checked": hist, "source_digest_state": digest, "digest_step_observed": step,
         "claim_position": position}
    c["f008"] = f008
    return c


def record(pid, facts, *, answerable=True, claims=None, wg=None, wv=None, mode="answered"):
    return {
        "schema_version": "cli002-r2-t1/2", "record_kind": "annotation", "protocol_version": "1.2",
        "packet_id": pid, "annotator_id": "annotator-1",
        "trace_status": {"value": "complete", "reason": None},
        "facts": facts, "compiled_claims": claims or [], "evidence_reads": [],
        "run": {
            "answerable": answerable, "answer_mode": mode,
            "proper_abstention": _pa(answerable),
            "wcc_gold": wg or gold_ok(), "wcc_vault": wv or vault_na(),
            "graph": {"available": "no", "calls": 0, "returned_edges": 0, "read_from_edge": 0, "verified_use": 0},
        },
    }


def _pa(answerable):
    return {"value": NA, "reason": None} if answerable else {"value": T, "reason": None}


UNSURE = {"candidate_ref": "notes/hive-meeting-2040-05.md", "location": "line 7 (event 4)",
          "criteria": {"value": "same", "unit": "same", "scope": "same", "date": "not_stated",
                       "qualifier": "same", "knowledge_status": "same"},
          "annotator_decision": "unsure", "events": [4]}
REJECTED = dict(copy.deepcopy(UNSURE), annotator_decision="reject",
                criteria=dict(UNSURE["criteria"], qualifier="different"))
PAGE = "concepts/hive-inspection.md"


def valid_records():
    recs = []
    # SYN01 all facts true (baseline arm): P0 T, P1 T.
    recs.append(record("SYN01", [fact("F1"), fact("F2")]))
    # SYN02 T + U (equivalence not adjudicated): P0 U, P1 U. Compiled arm; complete empty vault list => false.
    f2 = fact("F2", read_gold=False, vsr=dict(obs(U, "EQUIVALENCE_NOT_ADJUDICATED", [4]), source_basis="unknown",
                                               source_ref=None), proposed=[UNSURE])
    recs.append(record("SYN02", [fact("F1"), f2],
                       wg=wcc(U, "complete", "GOLD_NOT_CURRENTNESS_CHECKED", "ref-gold-syn", "g-fake-0002", gold=True,
                              checked=F),
                       wv=wcc(F, "complete")))
    # SYN03 single fact true; vault reference shows a violation; gold reference absent.
    recs.append(record("SYN03", [fact("F1")], wg=wcc(U, "absent", "REFERENCE_MISSING", gold=True),
                       wv=wcc(T, "complete")))
    # SYN04 F + U: contradicted fact plus an ambiguous one => run F. Vault reference incomplete => unknown.
    # It also relies on a compiled claim whose first Source was never read: f008 non_compliant (O6 trigger).
    recs.append(record("SYN04", [fact("F1", asserts="contradicts"), fact("F2", asserts="unknown")],
                       claims=[claim(PAGE + "#^c5", f008={"value": "non_compliant", "reason": None})],
                       wv=wcc(U, "incomplete", "REFERENCE_INCOMPLETE")))
    # SYN05 verified compiled reuse: P0 F (no valid source), P1 T.
    cr = reuse(PAGE + "#^c3", "current", "current", "present_at_listed_version", "observed_match",
               "established_current", T, None, basis="ref-gold-syn@g-fake-0001", as_of="2040-06-30")
    recs.append(record("SYN05", [fact("F1", read_gold=False, kind="compiled_claim", compiled_reuse=cr)],
                       claims=[claim(PAGE + "#^c3", hist="present_at_listed_version", digest="match", step=T,
                                     f008={"value": "compliant", "reason": None})],
                       wv=wcc(F, "complete")))
    # SYN06 f008 compliant (first Source read) but no digest step observed: P1 U, not T.
    cr = reuse(PAGE + "#^c4", "current", "current", "present_at_listed_version", "not_observed",
               "not_established", U, "F008_DIGEST_STEP_NOT_OBSERVED")
    recs.append(record("SYN06", [fact("F1", read_gold=False, kind="compiled_claim", compiled_reuse=cr)],
                       claims=[claim(PAGE + "#^c4", read=T, hist="present_at_listed_version", digest="match",
                                     f008={"value": "compliant", "reason": None})],
                       wv=wcc(F, "complete")))
    # SYN07 Rule A current-state branch: superseded History entry relied on for a current question.
    cr = reuse(PAGE + "#^c1", "history_superseded", "current", "absent", "not_observed", "not_established", F, None)
    recs.append(record("SYN07", [fact("F1", read_gold=False, support="no", kind="none", compiled_reuse=cr)],
                       claims=[claim(PAGE + "#^c1", position="history_superseded",
                                     f008={"value": U, "reason": "F008_HISTORY_ENTRY_SCOPE_OPEN"})],
                       wv=wcc(T, "complete")))
    # SYN08 unanswerable, proper abstention: excluded from P0/P1.
    recs.append(record("SYN08", [], answerable=False, mode="abstained"))
    # SYN10 purely historical question: wcc_gold not_applicable from the manifest (O4); baseline arm.
    recs.append(record("SYN10", [fact("F1")], wg=wcc(NA, NA, gold=True)))
    recs[-1]["run"]["wcc_gold"]["as_of"] = None
    recs[-1]["run"]["wcc_gold"]["gold_currentness_checked"] = U
    # SYN09 rejected-only candidate: valid_source_reached false (v1.2 step 3), fact verified from source text
    # that is not a valid source => P0 F; no compiled path => P1 F.
    f1 = fact("F1", read_gold=False, kind="source", proposed=[REJECTED])
    recs.append(record("SYN09", [f1]))
    return recs


def manifest():
    arms = {"SYN01": "baseline", "SYN02": "compiled", "SYN03": "compiled", "SYN04": "compiled",
            "SYN05": "compiled", "SYN06": "compiled", "SYN07": "compiled", "SYN08": "baseline",
            "SYN09": "baseline", "SYN10": "baseline"}
    pk = {}
    for pid, arm in sorted(arms.items()):
        pk[pid] = {"answerable": pid != "SYN08", "arm_kind": arm,
                   "wcc_gold_scope": "historical_only" if pid == "SYN10" else "current"}
        if pid != "SYN10":
            pk[pid]["wcc_gold_reference"] = {"id": "ref-gold-syn",
                                             "version": "g-fake-0002" if pid == "SYN02" else "g-fake-0001"}
        if arm == "compiled":
            pk[pid]["wcc_vault_reference"] = {"id": "ref-vault-syn", "version": "v-fake-0001"}
    return {"note": "Synthetic manifest. arm_kind and wcc_gold_scope decide applicability; judges never choose "
                    "not_applicable. The one approved currentness reference is invented to exercise the M1 "
                    "binding; no real approved reference exists.",
            "packets": pk,
            "approved_currentness_references": [
                {"claim_ref": PAGE + "#^c3", "source_ref": "notes/hive-log-2040-03.md",
                 "source_version": "sha256:fake0301", "reference_id": "ref-gold-syn",
                 "reference_version": "g-fake-0001", "as_of": "2040-06-30"}]}


def bad_manifests():
    """Malformed manifests for the M2 CLI and API tests."""
    good = manifest()
    out = {}
    m = copy.deepcopy(good); del m["packets"]["SYN03"]["wcc_vault_reference"]
    out["missing-vault-binding.json"] = m
    m = copy.deepcopy(good); m["packets"]["SYN03"]["arm_kind"] = "compiled-ish"
    out["bad-arm-kind.json"] = m
    m = copy.deepcopy(good); del m["packets"]["SYN01"]["wcc_gold_reference"]
    out["missing-gold-binding.json"] = m
    m = copy.deepcopy(good); m["packets"] = {}
    out["empty-packets.json"] = m
    m = copy.deepcopy(good); m["approved_currentness_references"][0]["as_of"] = ""
    out["malformed-approved-reference.json"] = m
    return out


def legacy_answerability_unknown():
    """Closure m2: a v1-schema record whose answerability cannot be read (invented)."""
    rec = record("SYN11", [fact("F1")])
    rec["schema_version"] = "cli002-r2-t1/1"
    rec["protocol_version"] = "1.1"
    for f in rec["facts"]:
        del f["compiled_reuse"]
    run = rec["run"]
    run["proper_abstention"] = {"value": U, "reason": "TRACE_INCOMPLETE"}
    run["wrong_current_claim"] = obs(F)
    for k in ("answerable", "wcc_gold", "wcc_vault"):
        del run[k]
    return rec


def invalid_cases():
    base = valid_records()
    by = {r["packet_id"]: r for r in base}
    cases = []

    def add(name, rec, expect, why):
        cases.append((name, rec, expect, why))

    r = copy.deepcopy(by["SYN01"]); r["facts"] = []
    add("zero-facts-answerable.jsonl", r, "Z1-answerable-has-facts", "answerable record with no required facts")
    r = copy.deepcopy(by["SYN01"]); r["run"]["proper_abstention"] = {"value": T, "reason": None}
    add("abstention-mismatch.jsonl", r, "Z2-abstention-matches-answerable", "answerable but abstention judged")
    r = copy.deepcopy(by["SYN09"])
    r["facts"][0]["valid_source_reached"] = dict(obs(U, "EQUIVALENCE_NOT_ADJUDICATED"), source_basis="unknown", source_ref=None)
    add("rejected-only-unknown.jsonl", r, "E1-unadjudicated-needs-live-candidate", "only a rejected candidate, recorded unknown")
    r = copy.deepcopy(by["SYN06"]); r["facts"][0]["compiled_reuse"]["value"] = T; r["facts"][0]["compiled_reuse"]["reason"] = None
    add("f008-compliant-claimed-as-reuse.jsonl", r, "R1-compiled-reuse-derivation", "P1 path set true from f008 alone")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["currentness_basis"] = None
    add("currentness-without-basis.jsonl", r, "R3-currentness-basis", "currentness established with no basis")
    r = copy.deepcopy(by["SYN04"]); r["run"]["wcc_vault"] = wcc(F, "incomplete")
    add("wcc-false-on-incomplete-reference.jsonl", r, "W2-determinate-needs-complete-reference", "false from an incomplete list")
    r = copy.deepcopy(by["SYN03"]); r["run"]["wcc_gold"]["reason"] = "OTHER"; r["run"]["wcc_gold"]["note"] = "x"
    add("wcc-absent-reference-wrong-reason.jsonl", r, "W3-reference-state-reason", "absent reference without REFERENCE_MISSING")
    r = copy.deepcopy(by["SYN03"]); r["run"]["wcc_vault"] = wcc(NA, "complete")
    add("wcc-vault-na-with-reference.jsonl", r, "W4-not-applicable-pairing", "not_applicable while a complete reference exists")
    r = copy.deepcopy(by["SYN02"]); r["run"]["wcc_gold"]["value"] = F; r["run"]["wcc_gold"]["reason"] = None
    add("wcc-gold-unchecked-determinate.jsonl", r, "W5-gold-currentness", "determinate wcc_gold from an unchecked gold")
    r = copy.deepcopy(by["SYN07"]); r["compiled_claims"][0]["f008"] = {"value": "non_compliant", "reason": None}
    add("history-row-f008-decided.jsonl", r, "H1-f008-derivation-v12", "History row given a decided f008")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["claim_ref"] = None
    add("reuse-true-null-claim-ref.jsonl", r, "R5-positive-reuse-binding", "positive reuse with no claim")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["events"] = []
    add("reuse-true-no-events.jsonl", r, "R5-positive-reuse-binding", "positive reuse with no trace events")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["source_version"] = None
    add("reuse-true-no-source-version.jsonl", r, "R5-positive-reuse-binding", "positive reuse with no source version")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["claim_ref"] = "records/hive-readout-2040-05.md"
    add("reuse-true-unanchored-claim.jsonl", r, "R5-positive-reuse-binding", "positive reuse from a page without a claim anchor")
    r = copy.deepcopy(by["SYN05"]); r["facts"][0]["compiled_reuse"]["claim_position"] = "record_unanchored"
    add("reuse-true-from-record.jsonl", r, "R1-compiled-reuse-derivation", "Record treated as a positive reuse path (O5)")
    r = copy.deepcopy(by["SYN01"]); del r["facts"][0]["fact_verified"]
    add("missing-fact-field.jsonl", r, "missing required 'fact_verified'", "record missing a required observation")
    r = copy.deepcopy(by["SYN01"]); r["schema_version"] = "cli002-r2-t1/9"
    add("unknown-schema-version.jsonl", r, "unknown schema_version", "unrecognised schema version")
    r = copy.deepcopy(by["SYN01"]); r["protocol_version"] = "1.1"
    add("v12-record-with-v11-protocol.jsonl", r, "does not match", "v1.2 schema with a 1.1 protocol label")
    return cases


def dump(path, obj_lines):
    with open(path, "w", encoding="utf-8") as fh:
        for o in obj_lines:
            fh.write(json.dumps(o, sort_keys=True, ensure_ascii=True) + "\n")


def main():
    os.makedirs(os.path.join(HERE, "invalid"), exist_ok=True)
    dump(os.path.join(HERE, "valid-v12.jsonl"), valid_records())
    with open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8") as fh:
        fh.write(json.dumps(manifest(), sort_keys=True, indent=2, ensure_ascii=True) + "\n")
    index = []
    for name, rec, expect, why in invalid_cases():
        dump(os.path.join(HERE, "invalid", name), [rec])
        index.append({"file": name, "expect": expect, "why": why})
    with open(os.path.join(HERE, "invalid", "cases.json"), "w", encoding="utf-8") as fh:
        fh.write(json.dumps(index, sort_keys=True, indent=2, ensure_ascii=True) + "\n")
    os.makedirs(os.path.join(HERE, "manifests"), exist_ok=True)
    for name, m in sorted(bad_manifests().items()):
        with open(os.path.join(HERE, "manifests", name), "w", encoding="utf-8") as fh:
            fh.write(json.dumps(m, sort_keys=True, indent=2, ensure_ascii=True) + "\n")
    with open(os.path.join(HERE, "manifests", "not-json.json"), "w", encoding="utf-8") as fh:
        fh.write("{not json\n")
    dump(os.path.join(HERE, "legacy-answerability-unknown.jsonl"), [legacy_answerability_unknown()])


if __name__ == "__main__":
    main()
