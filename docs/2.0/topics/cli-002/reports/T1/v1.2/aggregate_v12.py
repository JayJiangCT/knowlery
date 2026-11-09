#!/usr/bin/env python3
"""CLI-002 Round 2, Metric D v1.2 CANDIDATE: validator and endpoint summarizer.

Status: PROPOSED. Not ACCEPTED, not in use for any scoring. It imports the v1
module (../aggregate.py) read-only and never changes it. Standard library only.

    python3 -I -B v1.2/aggregate_v12.py --self-test
    python3 -I -B v1.2/aggregate_v12.py --validate RECORDS.jsonl [...]
    python3 -I -B v1.2/aggregate_v12.py --summarize RECORDS.jsonl [...] [--manifest M.json] [--out FILE]

Records with schema_version cli002-r2-t1/1 are checked with the v1 schema and v1
rules, unchanged. Records with cli002-r2-t1/2 are checked with
METRICS-SCHEMA-v1.2.json, the v1 rules (shimmed where v1.2 changes a field) and
the v1.2 rules listed in V12-DECISION-TABLES.md.

--summarize computes, per annotator, the candidate endpoints P0 and P1 with
three-valued logic, both denominators, wcc counts and the legacy
wrong_current_claim counts. It prints counts only: no rates, no thresholds.
An invalid or missing record is a validation failure (exit 2), never a `false`.
"""

import argparse
import copy
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
for _p in (HERE, PARENT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import aggregate as v1  # noqa: E402  (the frozen v1 module; read-only use)

SCHEMA_V12_PATH = os.path.join(HERE, "METRICS-SCHEMA-v1.2.json")
FIXTURES = os.path.join(HERE, "fixtures")
V1 = "cli002-r2-t1/1"
V12 = "cli002-r2-t1/2"
T, F, U, NA = True, False, "unknown", "not_applicable"


# --------------------------------------------------------------------------
# Three-valued logic (Kleene). Only True, False and "unknown" are inputs.
# --------------------------------------------------------------------------

def tri_and(values):
    """false if any false; true if all true; otherwise unknown. Empty input is an error."""
    values = [_tri(v) for v in values]
    if not values:
        raise ValueError("tri_and of nothing: a conjunction needs at least one component")
    if any(v is F for v in values):
        return F
    if all(v is T for v in values):
        return T
    return U


def tri_or(values):
    """true if any true; false if all false; otherwise unknown."""
    values = [_tri(v) for v in values]
    if not values:
        raise ValueError("tri_or of nothing")
    if any(v is T for v in values):
        return T
    if all(v is F for v in values):
        return F
    return U


def _tri(v):
    """Accept only True, False or "unknown"; not_applicable and anything else is an error."""
    if v is T or v is F or (isinstance(v, str) and v == U):
        return v
    raise ValueError("not a three-valued input: %r" % (v,))


# --------------------------------------------------------------------------
# Derivations
# --------------------------------------------------------------------------

def derive_compiled_reuse(c):
    """P1 candidate evidence path through a reused compiled claim. Returns (value, reason).

    true only when every condition is observed: a source-checked event at the listed
    version, a digest comparison at query time that matched, currentness established
    by an approved basis, and a claim position valid for the question's time scope.
    f008 is deliberately not an input: procedural compliance is not evidence validity.
    """
    if c["applicable"] == "no":
        return NA, None
    if c["applicable"] == "unknown":
        return U, "F008_USE_UNCLEAR"
    pos, scope = c["claim_position"], c["temporal_scope"]
    if pos == "record_unanchored":
        return U, "RECORD_WITHOUT_CLAIM_ANCHOR"  # O5: a Record is never a P1 path
    # Definite failures first (false wins over unknown).
    if pos == "disputed":
        return F, None
    if pos == "history_superseded" and scope == "current":
        return F, None  # Rule A, current-state branch
    if c["verification_event"] in ("absent", "present_other_version"):
        return F, None
    if c["digest_comparison"] == "observed_stale":
        return F, None
    if c["currentness"] == "established_not_current":
        return F, None
    # Then anything not established is unknown, with the first missing condition.
    if pos == "unknown" or (pos == "history_superseded" and scope != "historical"):
        return U, "SCOPE_OR_QUALIFIER_UNCLEAR"
    if c["verification_event"] != "present_at_listed_version":
        return U, "F008_HISTORY_NOT_DETERMINED"
    if c["digest_comparison"] == "not_observed":
        return U, "F008_DIGEST_STEP_NOT_OBSERVED"
    if c["digest_comparison"] != "observed_match":
        return U, "EVIDENCE_PATH_NOT_OBSERVED"
    if c["currentness"] != "established_current":
        return U, "CURRENTNESS_NOT_ESTABLISHED"
    return T, None


def derive_f008_v12(c):
    """v1 F-008 derivation, except that a superseded History row is left unknown:
    KF v1.0 does not settle whether such a row is a claim 'given as an answer'."""
    if c.get("claim_position") == "history_superseded" and c["used_in_answer"] != "no":
        return U, "F008_HISTORY_ENTRY_SCOPE_OPEN"
    return v1.derive_f008(c)


def fact_p0(f):
    """P0 per fact: fact_verified AND valid_source_reached (both existing v1 fields)."""
    return tri_and([_tri(f["fact_verified"]["value"]), _tri(f["valid_source_reached"]["value"])])


def reuse_binding(cr):
    """The claim / source / version / currentness reference a compiled-reuse `true` rests on."""
    return (cr["claim_ref"], cr["source_ref"], cr["source_version"], cr["currentness_basis"], cr["as_of"])


def approved_bindings(manifest):
    """Bindings from a validated manifest's approved, dated currentness references (O2).
    None approved today, so a real manifest gives an empty set."""
    out = set()
    for a in (manifest or {}).get("approved_currentness_references", []):
        out.add((a["claim_ref"], a["source_ref"], a["source_version"],
                 "%s@%s" % (a["reference_id"], a["reference_version"]), a["as_of"]))
    return out


def compiled_path(f, approved=frozenset()):
    """The compiled-reuse disjunct of P1, as a three-valued input.

    v1.2 records carry compiled_reuse. A recorded `true` counts only if its exact
    claim/source/version/reference binding is in `approved` (closure M1); otherwise it
    is unknown, never true. Legacy v1 records carry nothing: compiled support gives
    unknown, source-only support gives false (the path does not apply).
    """
    cr = f.get("compiled_reuse")
    if cr is None:
        kind = f["fact_verified"]["support_kind"]
        if kind in ("compiled_claim", "both", "unknown"):
            return U
        return F
    v = cr["value"]
    if v == NA:
        return F
    if v is T and reuse_binding(cr) not in approved:
        return U
    return _tri(v)


def fact_p1(f, approved=frozenset()):
    """P1 per fact: fact_verified AND (valid_source_reached OR compiled_path). Exploratory."""
    return tri_and([_tri(f["fact_verified"]["value"]),
                    tri_or([_tri(f["valid_source_reached"]["value"]), compiled_path(f, approved)])])


def record_answerable(rec):
    """v1.2 records state it. v1 records: protocol step 8 sets proper_abstention to
    not_applicable exactly for answerable questions, so that is the inverse."""
    if rec["schema_version"] == V12:
        return rec["run"]["answerable"]
    pa = rec["run"]["proper_abstention"]["value"]
    if pa == NA:
        return T
    if pa is T or pa is F:
        return F
    return U


def run_endpoint(rec, per_fact):
    """Run-level value of an endpoint. Unanswerable runs are excluded (None)."""
    ans = record_answerable(rec)
    if ans is F:
        return None
    if ans == U:
        return "answerability_unknown"
    if not rec["facts"]:
        raise ValueError("answerable record %s has no required facts" % rec["packet_id"])
    return tri_and([per_fact(f) for f in rec["facts"]])


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

_LEGACY_PLACEHOLDER = {"value": False, "reason": None, "events": []}
_REF_REASON = {"absent": "REFERENCE_MISSING", "incomplete": "REFERENCE_INCOMPLETE",
               "version_mismatch": "REFERENCE_VERSION_MISMATCH"}


def load_schema_v12(path=SCHEMA_V12_PATH):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _wcc_errors(name, w):
    out = []
    v, comp = w["value"], w["reference_completeness"]
    msg = v1._unknown_rule(w)  # reason exactly when unknown; not_applicable carries none
    if msg:
        out.append(("W1-unknown-reason", "%s: %s" % (name, msg)))
    if v is T or v is F:
        if comp != "complete" or not w["reference_id"] or not w["reference_version"]:
            out.append(("W2-determinate-needs-complete-reference",
                        "%s %r needs reference_completeness complete with reference_id and reference_version" % (name, v)))
    if comp in _REF_REASON and not (v == U and w["reason"] == _REF_REASON[comp]):
        out.append(("W3-reference-state-reason",
                    "%s reference %s requires value unknown with %s" % (name, comp, _REF_REASON[comp])))
    if (v == NA) != (comp == NA):
        out.append(("W4-not-applicable-pairing", "%s: value not_applicable exactly when reference_completeness not_applicable" % name))
    if v == NA and (w["reference_id"] or w["reference_version"]):
        out.append(("W4-not-applicable-pairing", "%s: not_applicable carries no reference" % name))
    return out


def semantic_errors_v12(rec):
    """v1 rules (on a shim where v1.2 changed a field) plus the v1.2 rules."""
    shim = copy.deepcopy(rec)
    if "wrong_current_claim" not in shim["run"]:
        shim["run"]["wrong_current_claim"] = dict(_LEGACY_PLACEHOLDER)
    history_rows = {c["claim_ref"] for c in rec["compiled_claims"] if c["claim_position"] == "history_superseded"}
    out = [(i, r, d) for (i, r, d) in v1.semantic_errors(shim)
           if not (r.startswith("S8-f008") and i in history_rows)]

    def check(item, rule, ok, detail):
        if not ok:
            out.append((item, rule, detail))

    run = rec["run"]
    ans = run["answerable"]
    # Z: answerability and required facts.
    check("run", "Z1-answerable-has-facts", not (ans is True and not rec["facts"]),
          "an answerable record needs at least one required fact")
    check("run", "Z2-abstention-matches-answerable",
          (run["proper_abstention"]["value"] == NA) == (ans is True),
          "proper_abstention is not_applicable exactly when answerable is true")
    for f in rec["facts"]:
        fid = f["fact_id"]
        vs = f["valid_source_reached"]
        # E1: rejected-only candidates do not create unknown (v1.2 step 3 wording).
        if vs["value"] == U and vs["reason"] == "EQUIVALENCE_NOT_ADJUDICATED":
            live = [p for p in f["proposed_equivalents"] if p["annotator_decision"] in ("accept", "unsure")]
            check(fid, "E1-unadjudicated-needs-live-candidate", bool(live),
                  "EQUIVALENCE_NOT_ADJUDICATED needs a proposed candidate decided accept or unsure; "
                  "rejected-only candidates leave valid_source_reached false")
        cr = f["compiled_reuse"]
        dv, dr = derive_compiled_reuse(cr)
        check(fid, "R1-compiled-reuse-derivation", v1._same(cr["value"], dv) and cr["reason"] == dr,
              "compiled_reuse %r/%s but components give %r/%s" % (cr["value"], cr["reason"], dv, dr))
        if cr["applicable"] == "no":
            check(fid, "R2-not-applicable-components",
                  cr["claim_ref"] is None and all(cr[k] == NA for k in (
                      "claim_position", "temporal_scope", "verification_event", "digest_comparison", "currentness")),
                  "applicable no requires claim_ref null and every component not_applicable")
        else:
            check(fid, "R2-not-applicable-components",
                  all(cr[k] != NA for k in ("claim_position", "temporal_scope", "verification_event",
                                             "digest_comparison", "currentness")),
                  "applicable yes/unknown requires every component to be observed or unknown, not not_applicable")
        if cr["currentness"] in ("established_current", "established_not_current"):
            check(fid, "R3-currentness-basis", bool(cr["currentness_basis"]) and bool(cr["as_of"]),
                  "established currentness needs currentness_basis and as_of")
        if cr["value"] is T:
            # Closure M1: a positive path must name an anchored claim, its Source and version,
            # the trace events, and a dated reference. Binding to an approved reference is
            # checked against the manifest by summarize().
            check(fid, "R5-positive-reuse-binding",
                  bool(cr["claim_ref"]) and re.search(r"#\^c[0-9]+$", cr["claim_ref"]) is not None
                  and bool(cr["source_ref"]) and bool(cr["source_version"]) and bool(cr["events"])
                  and bool(cr["currentness_basis"]) and bool(cr["as_of"]),
                  "compiled_reuse true needs an anchored claim_ref, source_ref, source_version, events, "
                  "currentness_basis and as_of")
        if cr["applicable"] == "no":
            check(fid, "R2-source-binding-empty", cr["source_ref"] is None and cr["source_version"] is None,
                  "applicable no requires source_ref and source_version null")
        if cr["applicable"] == "yes" and cr["claim_position"] not in ("history_superseded", "record_unanchored"):
            # A superseded History entry relied on for a current-state question is not support
            # (Rule A), so support_kind may be none there; everywhere else reuse implies compiled support.
            check(fid, "R4-reuse-needs-compiled-support",
                  f["fact_verified"]["support_kind"] in ("compiled_claim", "both", "unknown"),
                  "compiled reuse applies only when support_kind involves a compiled claim")
    for c in rec["compiled_claims"]:
        dv, dr = derive_f008_v12(c)
        check(c["claim_ref"], "H1-f008-derivation-v12", c["f008"]["value"] == dv and
              (dv != U or c["f008"]["reason"] == dr),
              "f008 %s/%s but v1.2 derivation gives %s/%s" % (c["f008"]["value"], c["f008"]["reason"], dv, dr))
    for name in ("wcc_gold", "wcc_vault"):
        for rule, detail in _wcc_errors(name, run[name]):
            check("run", rule, False, detail)
    g = run["wcc_gold"]
    if g["value"] is T or g["value"] is F:
        check("run", "W5-gold-currentness", g["gold_currentness_checked"] is True and bool(g["as_of"]),
              "wcc_gold true/false needs a currentness-checked gold with as_of")
    if g["gold_currentness_checked"] is False:
        check("run", "W5-gold-currentness", g["value"] == U and g["reason"] == "GOLD_NOT_CURRENTNESS_CHECKED",
              "a gold without a currentness check gives wcc_gold unknown with GOLD_NOT_CURRENTNESS_CHECKED")
    return out


def validate_any(records, schema_v1=None, schema_v12=None):
    """records: list of (label, obj). Dispatch on schema_version. Returns error strings."""
    schema_v1 = schema_v1 or v1.load_schema()
    schema_v12 = schema_v12 or load_schema_v12()
    errs = []
    for label, obj in records:
        sv = obj.get("schema_version") if isinstance(obj, dict) else None
        if sv == V1:
            errs.extend(v1.validate_records([(label, obj)], schema_v1))
            continue
        if sv != V12:
            errs.append("%s: schema: unknown schema_version %r" % (label, sv))
            continue
        s_errs = v1.schema_errors(obj, schema_v12, schema_v12)
        errs.extend("%s: schema: %s" % (label, e) for e in s_errs)
        if not s_errs and obj.get("record_kind") == "annotation":
            errs.extend("%s: %s [%s] %s" % (label, r, i, d) for i, r, d in semantic_errors_v12(obj))
    return errs


# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------

def _bump(d, k, n=1):
    d[k] = d.get(k, 0) + n


def _endpoint_block():
    return {"true": 0, "false": 0, "unknown": 0, "answerability_unknown": 0}


def _finish(block):
    total = block["true"] + block["false"] + block["unknown"]
    det = block["true"] + block["false"]
    block["denominator_answerable_total"] = total
    block["denominator_determinate_only"] = det
    block["pass_over_answerable_total"] = "%d/%d" % (block["true"], total)
    # Closure m1: a rate among determinate runs only. It assumes nothing about the
    # unknown runs, which may differ systematically; read it beside unknown_share.
    block["pass_conditional_on_determinate"] = "%d/%d" % (block["true"], det)
    block["unknown_share"] = "%d/%d" % (block["unknown"], total)
    return block


_MANIFEST_TOP = {"note", "packets", "approved_currentness_references"}
_PACKET_KEYS = {"answerable", "arm_kind", "wcc_gold_scope", "wcc_gold_reference", "wcc_vault_reference"}
_APPROVED_KEYS = {"claim_ref", "source_ref", "source_version", "reference_id", "reference_version", "as_of"}


def _is_ref(o):
    return isinstance(o, dict) and set(o) == {"id", "version"} and \
        all(isinstance(o[k], str) and o[k] for k in ("id", "version"))


def validate_manifest(m):
    """Closure M2: structural checks on a packet manifest. Returns error strings."""
    errs = []
    if not isinstance(m, dict) or not isinstance(m.get("packets"), dict) or not m["packets"]:
        return ["manifest: needs a non-empty 'packets' object"]
    extra = set(m) - _MANIFEST_TOP
    if extra:
        errs.append("manifest: unknown top-level keys %s" % sorted(extra))
    for pid, p in sorted(m["packets"].items()):
        w = "manifest packet %s" % pid
        if not isinstance(p, dict):
            errs.append("%s: not an object" % w)
            continue
        if set(p) - _PACKET_KEYS:
            errs.append("%s: unknown keys %s" % (w, sorted(set(p) - _PACKET_KEYS)))
        if not isinstance(p.get("answerable"), bool):
            errs.append("%s: answerable must be true or false" % w)
        arm = p.get("arm_kind")
        if arm not in ("baseline", "compiled"):
            errs.append("%s: arm_kind must be baseline or compiled" % w)
        scope = p.get("wcc_gold_scope")
        if scope not in ("current", "historical_only"):
            errs.append("%s: wcc_gold_scope must be current or historical_only" % w)
        if scope == "current" and not _is_ref(p.get("wcc_gold_reference")):
            errs.append("%s: missing or malformed wcc_gold_reference binding" % w)
        if scope == "historical_only" and "wcc_gold_reference" in p:
            errs.append("%s: historical_only packet must not bind a wcc_gold_reference" % w)
        if arm == "compiled" and not _is_ref(p.get("wcc_vault_reference")):
            errs.append("%s: missing or malformed wcc_vault_reference binding" % w)
        if arm == "baseline" and "wcc_vault_reference" in p:
            errs.append("%s: baseline packet must not bind a wcc_vault_reference" % w)
    approved = m.get("approved_currentness_references", [])
    if not isinstance(approved, list):
        errs.append("manifest: approved_currentness_references must be a list")
    else:
        for i, a in enumerate(approved):
            if not isinstance(a, dict) or set(a) != _APPROVED_KEYS or \
                    not all(isinstance(a[k], str) and a[k] for k in _APPROVED_KEYS):
                errs.append("manifest: approved_currentness_references[%d] malformed" % i)
    return errs


def _manifest_errors(by, manifest):
    errs = []
    expected = manifest["packets"]
    approved = approved_bindings(manifest)
    annotators = sorted({a for a, _ in by})
    for pid in sorted(expected):
        for a in annotators:
            if (a, pid) not in by:
                errs.append("missing record: %s / %s (validation failure, not counted as false)" % (a, pid))
    for (a, pid), rec in sorted(by.items()):
        m = expected.get(pid)
        if m is None:
            errs.append("record not in manifest: %s / %s" % (a, pid))
            continue
        if rec["schema_version"] != V12:
            continue
        run = rec["run"]
        if run["answerable"] != m["answerable"]:
            errs.append("answerable differs from manifest: %s / %s" % (a, pid))
        applicable = {"wcc_gold": m["wcc_gold_scope"] == "current", "wcc_vault": m["arm_kind"] == "compiled"}
        for name in ("wcc_gold", "wcc_vault"):
            w = run[name]
            if not applicable[name]:
                if w["value"] != NA:
                    errs.append("%s judged where the manifest says not applicable (%s): %s / %s" % (
                        name, "baseline-arm" if name == "wcc_vault" else "historical-only", a, pid))
                continue
            if w["value"] == NA:
                errs.append("%s not_applicable where the manifest says applicable (%s): %s / %s" % (
                    name, "compiled-arm" if name == "wcc_vault" else "current-state", a, pid))
                continue
            ref = m[name + "_reference"]
            if w["reference_id"] is not None or w["reference_version"] is not None:
                if (w["reference_id"], w["reference_version"]) != (ref["id"], ref["version"]):
                    errs.append("%s reference differs from manifest: %s / %s" % (name, a, pid))
        for f in rec["facts"]:
            cr = f["compiled_reuse"]
            if cr["value"] is T and reuse_binding(cr) not in approved:
                errs.append("compiled_reuse true without an approved currentness binding: %s / %s %s" % (
                    a, pid, f["fact_id"]))
    return errs


def summarize(records, manifest=None):
    """records: validated annotation dicts. Returns (summary, errors).

    With a manifest, the manifest is validated first and the summary is authoritative.
    Without one, the summary is provisional: WCC counts carry no decision weight and
    every compiled-reuse `true` is counted as unknown (closure M1, M2).
    """
    by = {}
    errs = []
    for rec in records:
        key = (rec["annotator_id"], rec["packet_id"])
        if key in by:
            errs.append("duplicate record: %s / %s" % key)
        by[key] = rec
    if manifest is not None:
        merr = validate_manifest(manifest)
        if merr:
            return None, merr
        errs.extend(_manifest_errors(by, manifest))
    approved = approved_bindings(manifest) if manifest is not None else frozenset()
    packets = (manifest or {}).get("packets", {})
    per = {}
    for (a, pid) in sorted(by):
        rec = by[(a, pid)]
        s = per.setdefault(a, {
            "records": 0, "records_by_schema": {}, "unanswerable_excluded": 0,
            "P0": _endpoint_block(), "P1_exploratory": _endpoint_block(),
            "fact_P0": {}, "fact_P1_exploratory": {}, "P1_minus_P0_runs": {},
            "compiled_reuse_true_unbound": 0,
            "wcc_gold": {}, "wcc_vault": {}, "legacy_wrong_current_claim": {},
            "proper_abstention": {}, "f008": {}, "f008_review_trigger": [],
        })
        s["records"] += 1
        _bump(s["records_by_schema"], rec["schema_version"])

        def p1(f):
            return fact_p1(f, approved)
        try:
            r0, r1 = run_endpoint(rec, fact_p0), run_endpoint(rec, p1)
        except ValueError as e:
            errs.append(str(e))
            continue
        if r0 is None:
            s["unanswerable_excluded"] += 1
            _bump(s["proper_abstention"], v1._s(rec["run"]["proper_abstention"]["value"]))
        else:
            _bump(s["P0"], v1._s(r0) if r0 != "answerability_unknown" else r0)
            _bump(s["P1_exploratory"], v1._s(r1) if r1 != "answerability_unknown" else r1)
            if r0 != "answerability_unknown":
                _bump(s["P1_minus_P0_runs"], "P0=%s|P1=%s" % (v1._s(r0), v1._s(r1)))
                for f in rec["facts"]:
                    _bump(s["fact_P0"], v1._s(fact_p0(f)))
                    _bump(s["fact_P1_exploratory"], v1._s(fact_p1(f, approved)))
        for f in rec["facts"]:
            cr = f.get("compiled_reuse")
            if cr is not None and cr["value"] is T and reuse_binding(cr) not in approved:
                s["compiled_reuse_true_unbound"] += 1
        # O6 (G-c): every non_compliant claim goes to the pre-registered adverse-case review.
        for c in rec["compiled_claims"]:
            _bump(s["f008"], c["f008"]["value"])
            if c["f008"]["value"] == "non_compliant":
                s["f008_review_trigger"].append("%s %s" % (pid, c["claim_ref"]))
        run = rec["run"]
        if rec["schema_version"] == V12:
            _bump(s["wcc_gold"], v1._s(run["wcc_gold"]["value"]))
            arm = packets.get(pid, {}).get("arm_kind")
            _bump(s["wcc_vault"], v1._s(NA if arm == "baseline" else run["wcc_vault"]["value"]))
        if "wrong_current_claim" in run:
            _bump(s["legacy_wrong_current_claim"], v1._s(run["wrong_current_claim"]["value"]))
    for s in per.values():
        _finish(s["P0"])
        _finish(s["P1_exploratory"])
        s["f008_review_trigger"].sort()
    summary = {
        "schema_version": V12, "record_kind": "endpoint_summary",
        "mode": "authoritative" if manifest is not None else "provisional",
        "per_annotator": per,
    }
    return summary, errs

# --------------------------------------------------------------------------
# Self-test (deterministic; no timings in the output)
# --------------------------------------------------------------------------

def _fx(*parts):
    return os.path.join(FIXTURES, *parts)


def self_test():
    results = []

    def record(name, ok, detail=""):
        results.append((name, ok, detail))

    s1, s12 = v1.load_schema(), load_schema_v12()

    # 1. Tri-state truth tables.
    record("tri_and F+U => F", tri_and([F, U]) is F)
    record("tri_and T+U => U", tri_and([T, U]) == U)
    record("tri_and all T => T", tri_and([T, T, T]) is T)
    record("tri_and all U => U", tri_and([U, U]) == U)
    record("tri_and F+T => F", tri_and([F, T]) is F)
    try:
        tri_and([])
        record("tri_and of nothing is an error", False)
    except ValueError:
        record("tri_and of nothing is an error", True)
    record("tri_or T+U => T, F+U => U, F+F => F",
           (tri_or([T, U]), tri_or([F, U]), tri_or([F, F])) == (T, U, F))

    # 2. Valid v1.2 fixtures and legacy v1 fixtures pass.
    v12_recs = v1.read_jsonl(_fx("valid-v12.jsonl"))
    e = validate_any(v12_recs, s1, s12)
    record("valid v1.2 fixture (%d records)" % len(v12_recs), not e, "; ".join(e[:3]))
    legacy = []
    for name in ("annotator-1.jsonl", "annotator-2.jsonl"):
        legacy.extend(v1.read_jsonl(os.path.join(PARENT, "fixtures", "annotations", name)))
    e = validate_any(legacy, s1, s12)
    record("v1 fixtures still validate under v1.2 dispatcher (%d records)" % len(legacy), not e, "; ".join(e[:3]))

    # 3. Invalid v1.2 fixtures fail for the stated rule.
    with open(_fx("invalid", "cases.json"), encoding="utf-8") as fh:
        cases = json.load(fh)
    for case in cases:
        recs = v1.read_jsonl(_fx("invalid", case["file"]))
        e = validate_any(recs, s1, s12)
        record("invalid %s rejected (%s)" % (case["file"], case["expect"]),
               bool(e) and any(case["expect"] in x for x in e), "; ".join(e[:2]))

    # 4. Endpoint summary equals the expected file, byte for byte, and is order-independent.
    with open(_fx("manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    objs = [o for _, o in v12_recs]
    summ, errs = summarize(objs, manifest)
    out1 = v1.dumps(summ)
    out2 = v1.dumps(summarize(list(reversed(objs)), manifest)[0])
    with open(_fx("expected-summary.json"), encoding="utf-8") as fh:
        expected = fh.read()
    record("summary has no manifest errors", not errs, "; ".join(errs[:3]))
    record("summary equals fixtures/expected-summary.json", out1 == expected)
    record("summary independent of input order", out1 == out2)
    se = v1.schema_errors(summ, s12, s12)
    record("summary validates against v1.2 schema", not se, "; ".join(se[:3]))

    # 4b. Closure M2: malformed manifests are rejected; no manifest gives a provisional summary.
    for name in sorted(os.listdir(_fx("manifests"))):
        try:
            with open(_fx("manifests", name), encoding="utf-8") as fh:
                bad = json.load(fh)
        except ValueError:
            continue  # unreadable JSON is a CLI-level case, tested in test_aggregate_v12.py
        bs, be = summarize(objs, bad)
        record("malformed manifest %s rejected" % name, bs is None and bool(be), "; ".join(be[:2]))
    psum, perr = summarize(objs)
    record("no manifest => provisional mode", psum["mode"] == "provisional" and not perr)
    record("no manifest => compiled-reuse true not counted true",
           psum["per_annotator"]["annotator-1"]["compiled_reuse_true_unbound"] == 1 and
           psum["per_annotator"]["annotator-1"]["P1_exploratory"]["true"] ==
           summ["per_annotator"]["annotator-1"]["P1_exploratory"]["true"] - 1)

    # 5. A missing record is a validation failure, not a false.
    short = [o for o in objs if o["packet_id"] != "SYN03"]
    summ2, errs2 = summarize(short, manifest)
    record("missing record => manifest error", any("missing record" in x for x in errs2))
    full_a1 = summ["per_annotator"]["annotator-1"]["P0"]
    short_a1 = summ2["per_annotator"]["annotator-1"]["P0"]
    record("missing record not imputed (answerable total drops by one, false count unchanged)",
           short_a1["denominator_answerable_total"] == full_a1["denominator_answerable_total"] - 1
           and short_a1["false"] == full_a1["false"])

    # 6. Legacy wrong_current_claim passes through unchanged and is never mapped.
    lsum, _ = summarize([o for _, o in legacy])
    want = {}
    for _, o in legacy:
        if o["annotator_id"] == "annotator-1":
            _bump(want, v1._s(o["run"]["wrong_current_claim"]["value"]))
    a1 = lsum["per_annotator"]["annotator-1"]
    record("legacy wrong_current_claim counts unchanged", a1["legacy_wrong_current_claim"] == want)
    record("legacy records produce no wcc_gold/wcc_vault", a1["wcc_gold"] == {} and a1["wcc_vault"] == {})

    lines = []
    passed = 0
    for name, ok, detail in results:
        passed += ok
        lines.append(("PASS " if ok else "FAIL ") + name + ("" if ok or not detail else " :: " + detail))
    lines.append("SELF-TEST-V12 %s %d/%d" % ("PASS" if passed == len(results) else "FAIL", passed, len(results)))
    return passed == len(results), "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--self-test", action="store_true")
    g.add_argument("--validate", nargs="+", metavar="JSONL")
    g.add_argument("--summarize", nargs="+", metavar="JSONL")
    ap.add_argument("--manifest", help="validated packet manifest (answerable, arm_kind, wcc_gold_scope, reference bindings, approved currentness references). Without it the summary is provisional.")
    ap.add_argument("--out", help="write the summary here instead of stdout")
    a = ap.parse_args(argv)
    if a.self_test:
        ok, text = self_test()
        sys.stdout.write(text)
        return 0 if ok else 1
    recs = []
    for p in (a.validate or a.summarize):
        recs.extend(v1.read_jsonl(p))
    errs = validate_any(recs)
    if a.validate:
        for e in errs:
            print(e)
        print("VALIDATE-V12 %s %d records, %d errors" % ("PASS" if not errs else "FAIL", len(recs), len(errs)))
        return 0 if not errs else 1
    if errs:
        for e in errs:
            print(e, file=sys.stderr)
        print("SUMMARIZE refused: %d validation errors" % len(errs), file=sys.stderr)
        return 2
    manifest = None
    if a.manifest:
        try:
            with open(a.manifest, encoding="utf-8") as fh:
                manifest = json.load(fh)
        except (OSError, ValueError) as e:
            print("SUMMARIZE refused: manifest unreadable: %s" % e, file=sys.stderr)
            return 2
    else:
        print("SUMMARIZE provisional: no --manifest; WCC and P1 compiled-path counts carry no decision weight",
              file=sys.stderr)
    summ, merrs = summarize([o for _, o in recs], manifest)
    if merrs:
        for e in merrs:
            print(e, file=sys.stderr)
        print("SUMMARIZE refused: %d manifest errors" % len(merrs), file=sys.stderr)
        return 2
    text = v1.dumps(summ)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
