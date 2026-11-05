"""Generate the synthetic T1 fixtures. Everything here is invented (a pottery-studio vault).

Usage: python3 -I -B fixtures/generate_fixtures.py fixtures/   then regenerate expected/aggregate.json with
aggregate.py --aggregate fixtures/annotations/annotator-1.jsonl fixtures/annotations/annotator-2.jsonl --out fixtures/expected/aggregate.json
"""
import json, os, sys

OUT = sys.argv[1]
for d in ("traces", "annotations", "expected", "invalid"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def j(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=True)


# ---------------------------------------------------------------- traces
class T:
    def __init__(self):
        self.lines = [{"type": "system", "subtype": "init", "tools": ["Glob", "Grep", "Read", "StructuredOutput"],
                       "note": "SYNTHETIC FIXTURE - invented vault, not a real trace"}]
        self.n = 0

    def call(self, name, inp, result, is_error=False):
        self.n += 1
        tid = "tu_fake_%02d" % self.n
        self.lines.append({"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "id": tid, "name": name, "input": inp}]}})
        use = len(self.lines) - 1
        blk = {"type": "tool_result", "tool_use_id": tid, "content": result}
        if is_error:
            blk["is_error"] = True
        self.lines.append({"type": "user", "message": {"role": "user", "content": [blk]}})
        return use, len(self.lines) - 1

    def answer(self, text, evidence):
        return self.call("StructuredOutput", {"final_answer": text, "refused": False, "evidence": evidence},
                         "Structured output provided successfully")

    def finish(self):
        self.lines.append({"type": "result", "subtype": "success", "num_turns": self.n})

    def write(self, name):
        with open(os.path.join(OUT, "traces", name), "w") as fh:
            for l in self.lines:
                fh.write(j(l) + "\n")


def numbered(*rows):
    return "".join("%d\t%s\n" % (i + 1, r) for i, r in enumerate(rows))


KILN_LOG = "notes/kiln-log-2031-03.md"
KILN_EXPORT = "notes/kiln-log-export-2031-03.md"
KILN_PAGE = "concepts/kiln.md"
GLAZE_SRC = "notes/glaze-trials-2031-01.md"
GLAZE_PAGE = "concepts/glaze.md"
VENDOR = "notes/kiln-vendor-call-2031-04.md"
SUMMARY = "notes/firing-summary-2031.md"

kiln_page = numbered(
    "---", "type: concept", "title: Kiln", "---", "# Kiln", "", "## Current",
    "- Firing temperature is 1180 C (src: s1) ^c2", "", "## Sources",
    "- s1 · [[notes/kiln-log-2031-03]] · sha256:fake0002 · source", "", "## Related",
    "- [[notes/kiln-vendor-call-2031-04]] — vendor call about the warranty")
kiln_log = numbered("# Kiln log, March 2031", "", "Kiln moved to bay 2.", "Firing temperature set to 1180 C.")

# FX01: clean positive
t = T()
t.call("Read", {"file_path": KILN_LOG}, kiln_log)
t.answer("The firing temperature is 1180 C.", [{"path": KILN_LOG, "anchor": "line 4"}])
t.finish(); t.write("fx01-positive.jsonl")

# FX02: gold path shown in a listing and a Sources line, never opened; answered from the compiled claim
t = T()
t.call("Glob", {"pattern": "notes/**"}, "notes/firing-summary-2031.md\nnotes/kiln-log-2031-03.md\nnotes/glaze-trials-2031-01.md")
t.call("Read", {"file_path": KILN_PAGE}, kiln_page)
t.answer("The firing temperature is 1180 C.", [{"path": KILN_PAGE, "anchor": "^c2"}])
t.finish(); t.write("fx02-shown-not-opened.jsonl")

# FX03: truncated read (persisted-output preview); required line not in the preview
t = T()
t.call("Grep", {"pattern": "kiln|glaze", "path": "notes", "output_mode": "content"},
       "<persisted-output>\nOutput too large (40.1KB). Full output saved to: <harness-tool-results>/tu_fake_01.txt\n\n"
       "Preview (first 2KB):\nnotes/kiln-log-2031-03.md:3:Kiln moved to bay 2.\nnotes/glaze-trials-2031-01.md:2:Trial batch A.\n...\n</persisted-output>")
t.answer("Glaze cure time is 48 hours.", [{"path": GLAZE_SRC, "anchor": "line 41"}])
t.finish(); t.write("fx03-truncated-read.jsonl")

# FX04: stale digest; the agent runs a digest step, sees a mismatch, still answers from the claim
glaze_page = numbered(
    "---", "type: concept", "title: Glaze", "---", "# Glaze", "", "## Current",
    "- Glaze cure time is 36 hours (src: s1) ^c3", "", "## Sources",
    "- s1 · [[notes/glaze-trials-2031-01]] · sha256:fake0004a · source", "", "## History",
    "- 2031-02-01 · [[#^c3]] source-checked · s1@sha256:fake0004a · by human:example")
t = T()
t.call("Read", {"file_path": GLAZE_PAGE}, glaze_page)
t.call("Digest", {"path": GLAZE_SRC, "note": "synthetic shell digest step"}, "sha256:fake0004b")
t.answer("Glaze cure time is 36 hours.", [{"path": GLAZE_PAGE, "anchor": "^c3"}])
t.finish(); t.write("fx04-stale-digest.jsonl")

# FX05: a Related link used as evidence; the linked note is never opened
t = T()
t.call("Read", {"file_path": KILN_PAGE}, kiln_page)
t.answer("The kiln warranty is 5 years, per the vendor call.", [{"path": VENDOR, "anchor": "Related link on concepts/kiln.md"}])
t.finish(); t.write("fx05-related-as-evidence.jsonl")

# FX06: pre-adjudicated equivalent read in full; the gold path never appears
t = T()
t.call("Read", {"file_path": KILN_EXPORT}, numbered("# Kiln log (export)", "", "Firing temperature set to 1180 C."))
t.answer("The firing temperature is 1180 C.", [{"path": KILN_EXPORT, "anchor": "line 3"}])
t.finish(); t.write("fx06-equivalent-no-gold-hit.jsonl")

# FX07: a candidate equivalent that nobody has adjudicated
t = T()
t.call("Read", {"file_path": SUMMARY}, numbered("# Firing summary 2031", "", "Standard firing at 1180 C since March 2031."))
t.answer("The firing temperature is 1180 C.", [{"path": SUMMARY, "anchor": "line 3"}])
t.finish(); t.write("fx07-unadjudicated-equivalent.jsonl")

# FX08: trace ends before any answer or result event
t = T()
t.call("Read", {"file_path": KILN_LOG}, kiln_log)
t.lines.append({"type": "assistant", "message": {"role": "assistant", "content": [
    {"type": "tool_use", "id": "tu_fake_99", "name": "Read", "input": {"file_path": KILN_PAGE}}]}})
t.write("fx08-trace-incomplete.jsonl")

# ---------------------------------------------------------------- packets (synthetic gold)
TEMP_Q = "Firing temperature set to 1180 C."
CURE_Q = "Glaze cure time is 48 hours."
WARR_Q = "Warranty extended to 5 years."


def mech(hit, opened, extent, quote, complete=True):
    return {"trace_complete": complete, "gold_path_hit": hit, "gold_path_opened": opened,
            "read_extent": extent, "quote_delivered": quote}


packets = [
    {"packet_id": "FX01", "trace": "fx01-positive.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": KILN_LOG, "quote": TEMP_Q, "expect_mechanical": mech(True, True, "full", True)}]},
    {"packet_id": "FX02", "trace": "fx02-shown-not-opened.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": KILN_LOG, "quote": TEMP_Q, "expect_mechanical": mech(True, False, "listing_only", False)}]},
    {"packet_id": "FX03", "trace": "fx03-truncated-read.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": GLAZE_SRC, "quote": CURE_Q, "expect_mechanical": mech(True, True, "preview_only", False)}]},
    {"packet_id": "FX04", "trace": "fx04-stale-digest.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": GLAZE_SRC, "quote": CURE_Q, "expect_mechanical": mech(True, False, "listing_only", False)}]},
    {"packet_id": "FX05", "trace": "fx05-related-as-evidence.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": VENDOR, "quote": WARR_Q, "expect_mechanical": mech(True, False, "listing_only", False)}]},
    {"packet_id": "FX06", "trace": "fx06-equivalent-no-gold-hit.jsonl", "preadjudicated_equivalents": [KILN_EXPORT], "facts": [
        {"fact_id": "F1", "gold_path": KILN_LOG, "quote": TEMP_Q, "expect_mechanical": mech(False, False, "none", False)}]},
    {"packet_id": "FX07", "trace": "fx07-unadjudicated-equivalent.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": KILN_LOG, "quote": TEMP_Q, "expect_mechanical": mech(False, False, "none", False)}]},
    {"packet_id": "FX08", "trace": "fx08-trace-incomplete.jsonl", "facts": [
        {"fact_id": "F1", "gold_path": KILN_LOG, "quote": TEMP_Q, "expect_mechanical": mech(True, True, "full", True, complete=False)}]},
]
with open(os.path.join(OUT, "packets.json"), "w") as fh:
    fh.write(json.dumps(packets, sort_keys=True, indent=2) + "\n")

# ---------------------------------------------------------------- annotations


def ob(value, events=(), reason=None, note=None):
    o = {"value": value, "reason": reason, "events": list(events)}
    if note:
        o["note"] = note
    return o


def opened(value, extent, events=(), reason=None):
    o = ob(value, events, reason)
    o["read_extent"] = extent
    return o


def reached(value, basis, ref, events=(), reason=None):
    o = ob(value, events, reason)
    o.update({"source_basis": basis, "source_ref": ref})
    return o


def verified(value, asserts, support, kind, events=(), reason=None):
    o = ob(value, events, reason)
    o.update({"answer_asserts": asserts, "support_delivered": support, "support_kind": kind})
    return o


def fact(hit, op, lines, reach, ver, nav=None, proposed=()):
    return {"fact_id": "F1", "gold_path_hit": hit, "gold_path_opened": op, "required_lines_delivered": lines,
            "valid_source_reached": reach, "proposed_equivalents": list(proposed), "fact_verified": ver,
            "navigation_used_as_evidence": nav or ob(False)}


def read(event, ref, role, comp, cause, vc, state, note=None):
    r = {"event": event, "path_ref": ref, "role": role, "completeness": comp, "partial_cause": cause,
         "version_check": vc, "state": state}
    if note:
        r["note"] = note
    return r


def claim(ref, first_ref, read_obs, hist, digest, observed, f008, reason=None, used="yes"):
    return {"claim_ref": ref, "facts": ["F1"], "used_in_answer": used,
            "first_vault_source": "identified" if first_ref else "none", "first_source_ref": first_ref,
            "first_source_read": read_obs, "history_source_checked": hist, "source_digest_state": digest,
            "digest_step_observed": observed, "f008": {"value": f008, "reason": reason}}


def run(mode="answered", wcc=None, graph=None, abst=None):
    return {"answer_mode": mode, "proper_abstention": abst or {"value": "not_applicable", "reason": None},
            "wrong_current_claim": wcc or ob(False),
            "graph": graph or {"available": "no", "calls": 0, "returned_edges": 0, "read_from_edge": 0, "verified_use": 0}}


def rec(pid, annot, facts, claims=(), reads=(), r=None, trace=None, gaps=None):
    o = {"schema_version": "cli002-r2-t1/1", "record_kind": "annotation", "protocol_version": "1.0",
         "packet_id": pid, "annotator_id": annot, "trace_status": trace or {"value": "complete", "reason": None},
         "facts": facts, "compiled_claims": list(claims), "evidence_reads": list(reads), "run": r or run()}
    if gaps:
        o["protocol_gaps"] = gaps
    return o


def crit(**kw):
    base = {k: "same" for k in ("value", "unit", "scope", "date", "qualifier", "knowledge_status")}
    base.update(kw)
    return base


def build(annot):
    a2 = annot == "annotator-2"
    out = []
    # FX01
    out.append(rec("FX01", annot,
                   [fact(ob(True, [2]), opened(True, "full", [2]), ob("yes", [2]), reached(True, "gold", KILN_LOG, [2]),
                         verified(True, "yes", "yes", "source", [2, 3]))],
                   reads=[read(2, KILN_LOG, "gold", "full", "none", "not_applicable", "read")]))
    # FX02
    out.append(rec("FX02", annot,
                   [fact(ob(True, [2, 4]), opened(False, "listing_only"), ob("no"), reached(False, "none", None),
                         verified(True, "yes", "yes", "compiled_claim", [4]))],
                   claims=[claim(KILN_PAGE + "#^c2", KILN_LOG, ob(False), "absent", "not_computed", False, "non_compliant")],
                   reads=[read(4, KILN_PAGE, "compiled_page", "full", "none", "not_applicable", "read")]))
    # FX03
    if not a2:
        f3 = fact(ob(True, [2]), opened(True, "preview_only", [2]), ob("no", [2]), reached(False, "none", None),
                  verified(False, "yes", "no", "none", [2, 3]))
    else:
        f3 = fact(ob(True, [2]), opened(True, "preview_only", [2]), ob("unknown", [2], "PERSISTED_OUTPUT_NOT_IN_TRACE"),
                  reached("unknown", "unknown", None, [2], "PERSISTED_OUTPUT_NOT_IN_TRACE"),
                  verified("unknown", "yes", "unknown", "unknown", [2, 3], "PERSISTED_OUTPUT_NOT_IN_TRACE"))
    out.append(rec("FX03", annot, [f3],
                   reads=[read(2, GLAZE_SRC, "gold", "partial", "persisted_preview", "not_applicable", "truncated")]))
    # FX04
    out.append(rec("FX04", annot,
                   [fact(ob(True, [2]), opened(False, "listing_only"), ob("no"), reached(False, "none", None),
                         verified(False, "contradicts", "no", "none", [2, 4, 5]))],
                   claims=[claim(GLAZE_PAGE + "#^c3", GLAZE_SRC, ob(False), "present_at_listed_version", "stale", True,
                                 "non_compliant")],
                   reads=[read(2, GLAZE_PAGE, "compiled_page", "full", "none", "stale", "version_stale",
                               note="digest step at event 4 differs from the version listed for s1")]))
    # FX05
    out.append(rec("FX05", annot,
                   [fact(ob(True, [2]), opened(False, "listing_only"), ob("no"), reached(False, "none", None),
                         verified(False, "yes", "no", "none", [2, 3]), nav=ob(True, [2, 3]))],
                   reads=[read(2, KILN_PAGE, "compiled_page", "full", "none", "not_applicable", "read")],
                   r=run(graph={"available": "no", "calls": "NOT_OBSERVABLE_IN_ROUND1", "returned_edges": "NOT_OBSERVABLE_IN_ROUND1",
                                "read_from_edge": 0, "verified_use": 0})))
    # FX06
    out.append(rec("FX06", annot,
                   [fact(ob(False), opened(False, "none"), ob("no"), reached(True, "preadjudicated_equivalent", KILN_EXPORT, [2]),
                         verified(True, "yes", "yes", "source", [2, 3]))],
                   reads=[read(2, KILN_EXPORT, "preadjudicated_equivalent", "full", "none", "not_applicable", "read")]))
    # FX07
    prop = {"candidate_ref": SUMMARY, "location": "line 3", "events": [2],
            "criteria": crit(date="unknown") if a2 else crit(),
            "annotator_decision": "unsure" if a2 else "accept"}
    if a2:
        prop["note"] = "candidate says 'since March 2031'; the required entry is dated March 2031 only"
    out.append(rec("FX07", annot,
                   [fact(ob(False), opened(False, "none"), ob("no"),
                         reached("unknown", "unknown", None, [2], "EQUIVALENCE_NOT_ADJUDICATED"),
                         verified(True, "yes", "yes", "source", [2, 3]), proposed=[prop])],
                   reads=[read(2, SUMMARY, "proposed_equivalent", "full", "none", "not_applicable", "read")]))
    # FX08
    out.append(rec("FX08", annot,
                   [fact(ob(True, [2]), opened(True, "full", [2]), ob("yes", [2]), reached(True, "gold", KILN_LOG, [2]),
                         verified("unknown", "unknown", "yes", "source", [2], "TRACE_INCOMPLETE"))],
                   reads=[read(2, KILN_LOG, "gold", "full", "none", "not_applicable", "read")],
                   trace={"value": "incomplete", "reason": None, "note": "no final answer and no result event"},
                   r=run(mode="unknown", wcc=ob("unknown", reason="TRACE_INCOMPLETE"),
                         abst={"value": "unknown", "reason": "TRACE_INCOMPLETE"})))
    return out


for annot in ("annotator-1", "annotator-2"):
    with open(os.path.join(OUT, "annotations", annot + ".jsonl"), "w") as fh:
        for r in build(annot):
            fh.write(j(r) + "\n")

# ---------------------------------------------------------------- invalid cases
base = build("annotator-1")[0]


def mutate(fn):
    o = json.loads(j(base))
    fn(o)
    return o


cases = []


def bad(name, expect, fn):
    with open(os.path.join(OUT, "invalid", name), "w") as fh:
        fh.write(j(mutate(fn)) + "\n")
    cases.append({"file": name, "expect": expect})


bad("unknown-without-reason.jsonl", "S1-unknown-reason",
    lambda o: o["facts"][0]["gold_path_hit"].update({"value": "unknown"}))
bad("reason-on-known-value.jsonl", "S1-unknown-reason",
    lambda o: o["facts"][0]["gold_path_hit"].update({"reason": "TRACE_INCOMPLETE"}))
bad("opened-without-hit.jsonl", "S2-opened-implies-hit",
    lambda o: o["facts"][0]["gold_path_hit"].update({"value": False}))
bad("reached-without-basis.jsonl", "S5-reached-basis",
    lambda o: o["facts"][0]["valid_source_reached"].update({"source_basis": "none"}))
bad("verified-without-support.jsonl", "S7-verified-derivation",
    lambda o: o["facts"][0]["fact_verified"].update({"support_delivered": "no", "support_kind": "none"}))
bad("read-state-mismatch.jsonl", "S9-read-state",
    lambda o: o["evidence_reads"][0].update({"completeness": "partial", "partial_cause": "offset_limit"}))
bad("bad-enum.jsonl", "not in enum",
    lambda o: o["facts"][0]["gold_path_opened"].update({"read_extent": "skimmed"}))
bad("absolute-path-ref.jsonl", "does not match",
    lambda o: o["evidence_reads"][0].update({"path_ref": "/home/example/vault/notes/x.md"}))
bad("extra-property.jsonl", "property not allowed",
    lambda o: o.update({"round1_verdict": "correct"}))


def f008_case(o):
    o["compiled_claims"] = [claim(KILN_PAGE + "#^c2", KILN_LOG, ob(False), "present_at_listed_version", "match", False, "compliant")]


bad("f008-event-without-digest-step.jsonl", "S8-f008-derivation", f008_case)
with open(os.path.join(OUT, "invalid", "cases.json"), "w") as fh:
    fh.write(json.dumps(cases, sort_keys=True, indent=2) + "\n")
print("ok")
