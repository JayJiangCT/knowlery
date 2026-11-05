#!/usr/bin/env python3
"""CLI-002 Round 2, T1: validate evidence annotations and aggregate two or more annotators.

Standard library only. Python 3.8+.

    python3 -I aggregate.py --self-test
    python3 -I aggregate.py --validate ANNOTATIONS.jsonl [...]
    python3 -I aggregate.py --aggregate annotator-1.jsonl annotator-2.jsonl [--out FILE]
    python3 -I aggregate.py --trace-check TRACE.jsonl --path VAULT/REL/PATH [--quote TEXT]

--validate checks the JSON Schema subset (METRICS-SCHEMA.json) and the conditional
rules in METRICS.md section 6. --aggregate writes one aggregate record (sorted keys,
no timestamps, so identical input gives byte-identical output). --trace-check prints
the mechanical L1 observations for one path in one trace: a helper for annotators,
not a substitute for reading the trace.
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(HERE, "METRICS-SCHEMA.json")
FIXTURES = os.path.join(HERE, "fixtures")
SCHEMA_VERSION = "cli002-r2-t1/1"
ABSENT = "<absent>"


# --------------------------------------------------------------------------
# JSON Schema subset validator
# --------------------------------------------------------------------------

_TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
}

SUPPORTED_KEYWORDS = {
    "$schema", "$id", "$defs", "$ref", "title", "description", "type", "enum", "const",
    "required", "properties", "additionalProperties", "items", "minItems", "minimum",
    "pattern", "oneOf",
}


def _same(a, b):
    # JSON equality that keeps true and 1 apart.
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    return a == b


def _resolve(ref, root):
    if not ref.startswith("#/$defs/"):
        raise ValueError("unsupported $ref: " + ref)
    return root["$defs"][ref[len("#/$defs/"):]]


def schema_errors(value, schema, root, where="$"):
    """Return a list of 'where: message' strings. Empty list means valid."""
    errs = []
    unknown = set(schema) - SUPPORTED_KEYWORDS
    if unknown:
        raise ValueError("schema uses unsupported keywords at %s: %s" % (where, sorted(unknown)))
    if "$ref" in schema:
        return schema_errors(value, _resolve(schema["$ref"], root), root, where)
    if "oneOf" in schema:
        matches = [s for s in schema["oneOf"] if not schema_errors(value, s, root, where)]
        if len(matches) != 1:
            kind = value.get("record_kind") if isinstance(value, dict) else None
            detail = ""
            for s in schema["oneOf"]:
                target = _resolve(s["$ref"], root) if "$ref" in s else s
                const = target.get("properties", {}).get("record_kind", {}).get("const")
                if const is not None and const == kind:
                    detail = "; " + "; ".join(schema_errors(value, s, root, where)[:5])
            errs.append("%s: matches %d of oneOf (record_kind=%r)%s" % (where, len(matches), kind, detail))
            return errs
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_TYPES[t](value) for t in types):
            return ["%s: type %s expected, got %r" % (where, "/".join(types), value)]
    if "const" in schema and not _same(value, schema["const"]):
        errs.append("%s: must be %r" % (where, schema["const"]))
    if "enum" in schema and not any(_same(value, e) for e in schema["enum"]):
        errs.append("%s: %r not in enum" % (where, value))
    if isinstance(value, str) and "pattern" in schema and not re.search(schema["pattern"], value):
        errs.append("%s: %r does not match %s" % (where, value, schema["pattern"]))
    if _TYPES["number"](value) and "minimum" in schema and value < schema["minimum"]:
        errs.append("%s: %r below minimum %r" % (where, value, schema["minimum"]))
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errs.append("%s: fewer than %d items" % (where, schema["minItems"]))
        if "items" in schema:
            for i, item in enumerate(value):
                errs.extend(schema_errors(item, schema["items"], root, "%s[%d]" % (where, i)))
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errs.append("%s: missing required '%s'" % (where, key))
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key in sorted(value):
            sub = "%s.%s" % (where, key)
            if key in props:
                errs.extend(schema_errors(value[key], props[key], root, sub))
            elif extra is False:
                errs.append("%s: property not allowed" % sub)
            elif isinstance(extra, dict):
                errs.extend(schema_errors(value[key], extra, root, sub))
    return errs


def load_schema(path=SCHEMA_PATH):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------
# Derivations (deterministic rules from METRICS.md)
# --------------------------------------------------------------------------

def derive_read_state(r):
    """Inspect-style state of one delivered read. Precedence: unknown > error >
    version_stale > truncated > unverified > read."""
    if r["completeness"] == "unknown" or r["partial_cause"] == "unknown":
        return "unknown"
    if r["partial_cause"] == "tool_error":
        return "error"
    if r["version_check"] == "stale":
        return "version_stale"
    if r["completeness"] in ("partial", "none"):
        return "truncated"
    if r["version_check"] == "not_checked":
        return "unverified"
    return "read"


def derive_f008(c):
    """KF v1.0 F-008, applied mechanically. Returns (value, reason)."""
    if c["used_in_answer"] == "no":
        return "not_applicable", None
    if c["used_in_answer"] == "unknown":
        return "unknown", "F008_USE_UNCLEAR"
    if c["first_vault_source"] == "none":
        return "not_applicable", None
    if c["first_vault_source"] in ("ambiguous", "unknown"):
        return "unknown", "F008_FIRST_SOURCE_AMBIGUOUS"
    read = c["first_source_read"]["value"]
    if read is True:
        return "compliant", None
    if read == "unknown":
        return "unknown", c["first_source_read"]["reason"]
    hist = c["history_source_checked"]
    if hist in ("absent", "present_other_version"):
        return "non_compliant", None
    if hist == "unknown":
        return "unknown", "F008_HISTORY_NOT_DETERMINED"
    digest = c["source_digest_state"]
    if digest == "stale":
        return "non_compliant", None
    if digest != "match":
        return "unknown", "F008_DIGEST_NOT_COMPUTED"
    if c["digest_step_observed"] is True:
        return "compliant", None
    return "unknown", "F008_DIGEST_STEP_NOT_OBSERVED"


def derive_fact_verified(v):
    if v["answer_asserts"] == "yes" and v["support_delivered"] == "yes":
        return True
    if v["answer_asserts"] in ("no", "partial", "contradicts") or v["support_delivered"] == "no":
        return False
    return "unknown"


# --------------------------------------------------------------------------
# Semantic rules (METRICS.md section 6)
# --------------------------------------------------------------------------

def _unknown_rule(obj, unknown_values=("unknown",)):
    v, r = obj["value"], obj["reason"]
    is_unknown = isinstance(v, str) and v in unknown_values
    if is_unknown and r is None:
        return "value is unknown but reason is null"
    if not is_unknown and r is not None:
        return "reason %s given for a known value %r" % (r, v)
    if r == "OTHER" and not obj.get("note"):
        return "reason OTHER needs a note"
    return None


def semantic_errors(rec):
    """Return a list of (item, rule, detail). Assumes rec passed the schema."""
    out = []

    def check(item, rule, ok, detail):
        if not ok:
            out.append((item, rule, detail))

    if rec["record_kind"] != "annotation":
        return out
    msg = _unknown_rule(rec["trace_status"])
    check("trace", "S1-unknown-reason", msg is None, msg or "")

    seen = set()
    for f in rec["facts"]:
        fid = f["fact_id"]
        check(fid, "S10-unique", fid not in seen, "duplicate fact_id")
        seen.add(fid)
        for name in ("gold_path_hit", "gold_path_opened", "required_lines_delivered",
                     "valid_source_reached", "fact_verified", "navigation_used_as_evidence"):
            msg = _unknown_rule(f[name])
            check(fid, "S1-unknown-reason", msg is None, "%s: %s" % (name, msg))
        hit = f["gold_path_hit"]["value"]
        op = f["gold_path_opened"]
        lines = f["required_lines_delivered"]["value"]
        check(fid, "S2-opened-implies-hit", not (op["value"] is True and hit is not True),
              "gold_path_opened is true but gold_path_hit is %r" % (hit,))
        if op["value"] is True:
            check(fid, "S2-opened-extent", op["read_extent"] in ("full", "offset_limit", "grep_snippet", "preview_only"),
                  "opened with read_extent %s" % op["read_extent"])
        if op["value"] is False:
            check(fid, "S2-opened-extent", op["read_extent"] in ("listing_only", "none"),
                  "not opened but read_extent %s" % op["read_extent"])
        if hit is False:
            check(fid, "S3-no-hit", op["value"] is False and op["read_extent"] == "none" and lines == "no",
                  "gold_path_hit false requires opened false, read_extent none, lines no")
        if lines in ("yes", "partial"):
            check(fid, "S4-lines-imply-hit", hit is True, "required lines delivered but gold_path_hit is %r" % (hit,))
        vs = f["valid_source_reached"]
        if vs["value"] is True:
            check(fid, "S5-reached-basis", vs["source_basis"] in ("gold", "preadjudicated_equivalent") and vs["source_ref"],
                  "reached requires basis gold/preadjudicated_equivalent and a source_ref")
            if vs["source_basis"] == "gold":
                check(fid, "S5-gold-basis-lines", lines == "yes", "basis gold requires required_lines_delivered yes")
        if vs["value"] is False:
            check(fid, "S5-reached-basis", vs["source_basis"] == "none", "not reached requires basis none")
        accepted = [p for p in f["proposed_equivalents"] if p["annotator_decision"] == "accept"]
        check(fid, "S6-proposed-not-authority", not (accepted and vs["value"] is False),
              "an accepted proposed equivalent must leave valid_source_reached unknown (EQUIVALENCE_NOT_ADJUDICATED), not false")
        fv = f["fact_verified"]
        check(fid, "S7-verified-derivation", _same_value(fv["value"], derive_fact_verified(fv)),
              "fact_verified %r but components give %r" % (fv["value"], derive_fact_verified(fv)))
        if fv["support_delivered"] == "yes":
            check(fid, "S7-support-kind", fv["support_kind"] in ("source", "compiled_claim", "both"),
                  "support delivered but support_kind %s" % fv["support_kind"])
        if fv["support_delivered"] == "no":
            check(fid, "S7-support-kind", fv["support_kind"] == "none", "no support but support_kind %s" % fv["support_kind"])

    seen = set()
    for c in rec["compiled_claims"]:
        ref = c["claim_ref"]
        check(ref, "S10-unique", ref not in seen, "duplicate claim_ref")
        seen.add(ref)
        for name in ("first_source_read", "f008"):
            msg = _unknown_rule(c[name])
            check(ref, "S1-unknown-reason", msg is None, "%s: %s" % (name, msg))
        dv, dr = derive_f008(c)
        check(ref, "S8-f008-derivation", c["f008"]["value"] == dv,
              "f008 %s but components give %s" % (c["f008"]["value"], dv))
        if c["f008"]["value"] == "unknown" and dv == "unknown":
            check(ref, "S8-f008-reason", c["f008"]["reason"] == dr,
                  "f008 reason %s but derivation gives %s" % (c["f008"]["reason"], dr))
        check(ref, "S8-first-source-ref", (c["first_source_ref"] is not None) == (c["first_vault_source"] == "identified"),
              "first_source_ref must be set exactly when first_vault_source is identified")

    seen = set()
    for r in rec["evidence_reads"]:
        key = "%d:%s" % (r["event"], r["path_ref"])
        check(key, "S10-unique", key not in seen, "duplicate read")
        seen.add(key)
        check(key, "S9-read-state", r["state"] == derive_read_state(r),
              "state %s but components give %s" % (r["state"], derive_read_state(r)))
        if r["completeness"] == "full":
            check(key, "S9-read-cause", r["partial_cause"] == "none", "full read with partial_cause %s" % r["partial_cause"])
        if r["completeness"] == "partial":
            check(key, "S9-read-cause", r["partial_cause"] not in ("none", "tool_error"), "partial read needs a partial_cause")
        if r["completeness"] == "none":
            check(key, "S9-read-cause", r["partial_cause"] == "tool_error", "completeness none is only for tool errors")

    run = rec["run"]
    msg = _unknown_rule(run["proper_abstention"], ("unknown",))
    check("run", "S1-unknown-reason", msg is None, "proper_abstention: %s" % msg)
    msg = _unknown_rule(run["wrong_current_claim"])
    check("run", "S1-unknown-reason", msg is None, "wrong_current_claim: %s" % msg)
    return out


def _same_value(a, b):
    return _same(a, b)


def validate_records(records, schema):
    """records: list of (label, obj). Returns list of error strings."""
    errs = []
    for label, obj in records:
        for e in schema_errors(obj, schema, schema):
            errs.append("%s: schema: %s" % (label, e))
        if isinstance(obj, dict) and obj.get("record_kind") == "annotation" and not schema_errors(obj, schema, schema):
            for item, rule, detail in semantic_errors(obj):
                errs.append("%s: %s [%s] %s" % (label, rule, item, detail))
    return errs


def read_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if line.strip():
                out.append(("%s:%d" % (os.path.basename(path), n), json.loads(line)))
    return out


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

def _s(v):
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return "null"
    return str(v)


# (field name, section, getter for value, getter for reason or None)
FIELD_SPECS = [
    ("trace_status", "trace", lambda o: o["value"], lambda o: o["reason"]),
    ("gold_path_hit", "fact", lambda f: f["gold_path_hit"]["value"], lambda f: f["gold_path_hit"]["reason"]),
    ("gold_path_opened", "fact", lambda f: f["gold_path_opened"]["value"], lambda f: f["gold_path_opened"]["reason"]),
    ("gold_path_opened.read_extent", "fact", lambda f: f["gold_path_opened"]["read_extent"], None),
    ("required_lines_delivered", "fact", lambda f: f["required_lines_delivered"]["value"], lambda f: f["required_lines_delivered"]["reason"]),
    ("valid_source_reached", "fact", lambda f: f["valid_source_reached"]["value"], lambda f: f["valid_source_reached"]["reason"]),
    ("valid_source_reached.source_basis", "fact", lambda f: f["valid_source_reached"]["source_basis"], None),
    ("fact_verified", "fact", lambda f: f["fact_verified"]["value"], lambda f: f["fact_verified"]["reason"]),
    ("fact_verified.answer_asserts", "fact", lambda f: f["fact_verified"]["answer_asserts"], None),
    ("fact_verified.support_delivered", "fact", lambda f: f["fact_verified"]["support_delivered"], None),
    ("fact_verified.support_kind", "fact", lambda f: f["fact_verified"]["support_kind"], None),
    ("navigation_used_as_evidence", "fact", lambda f: f["navigation_used_as_evidence"]["value"], lambda f: f["navigation_used_as_evidence"]["reason"]),
    ("proposed_equivalent.annotator_decision", "proposed", lambda p: p["annotator_decision"], None),
    ("claim.used_in_answer", "claim", lambda c: c["used_in_answer"], None),
    ("claim.first_source_read", "claim", lambda c: c["first_source_read"]["value"], lambda c: c["first_source_read"]["reason"]),
    ("claim.f008", "claim", lambda c: c["f008"]["value"], lambda c: c["f008"]["reason"]),
    ("read.state", "read", lambda r: r["state"], None),
    ("run.answer_mode", "run", lambda r: r["answer_mode"], None),
    ("run.proper_abstention", "run", lambda r: r["proper_abstention"]["value"], lambda r: r["proper_abstention"]["reason"]),
    ("run.wrong_current_claim", "run", lambda r: r["wrong_current_claim"]["value"], lambda r: r["wrong_current_claim"]["reason"]),
]


def _items(rec, section):
    """Yield (item_key, object) for a section of one annotation record."""
    if section == "trace":
        yield "trace", rec["trace_status"]
    elif section == "fact":
        for f in rec["facts"]:
            yield f["fact_id"], f
    elif section == "proposed":
        for f in rec["facts"]:
            for p in f["proposed_equivalents"]:
                yield "%s:%s" % (f["fact_id"], p["candidate_ref"]), p
    elif section == "claim":
        for c in rec["compiled_claims"]:
            yield c["claim_ref"], c
    elif section == "read":
        for r in rec["evidence_reads"]:
            yield "%d:%s" % (r["event"], r["path_ref"]), r
    elif section == "run":
        yield "run", rec["run"]


def aggregate(records):
    """records: list of annotation dicts (already validated). Returns the aggregate dict."""
    by = {}
    for rec in records:
        key = (rec["annotator_id"], rec["packet_id"])
        if key in by:
            raise ValueError("duplicate record for %s / %s" % key)
        by[key] = rec
    annotators = sorted({a for a, _ in by})
    packets = sorted({p for _, p in by})
    missing = [{"annotator_id": a, "packet_id": p} for p in packets for a in annotators if (a, p) not in by]

    fields, disagreements = [], []
    for name, section, get_v, get_r in FIELD_SPECS:
        counts = {a: {} for a in annotators}
        unknown = {a: {} for a in annotators}
        compared = agree = 0
        for p in packets:
            per = {}
            for a in annotators:
                rec = by.get((a, p))
                per[a] = {} if rec is None else {k: o for k, o in _items(rec, section)}
                for k, o in per[a].items():
                    v = _s(get_v(o))
                    counts[a][v] = counts[a].get(v, 0) + 1
                    if get_r is not None and get_r(o) is not None:
                        r = get_r(o)
                        unknown[a][r] = unknown[a].get(r, 0) + 1
            keys = sorted(set().union(*[set(d) for d in per.values()])) if per else []
            for k in keys:
                vals = {a: (_s(get_v(per[a][k])) if k in per[a] else ABSENT) for a in annotators}
                compared += 1
                if len(set(vals.values())) == 1 and ABSENT not in vals.values():
                    agree += 1
                else:
                    disagreements.append({"packet_id": p, "item": k, "field": name, "values": vals})
        fields.append({
            "field": name, "compared": compared, "agree": agree,
            "agreement": "%d/%d" % (agree, compared), "counts": counts, "unknown_by_reason": unknown,
        })

    levels = {a: {} for a in annotators}
    semantic = []
    for (a, p) in sorted(by):
        rec = by[(a, p)]
        for f in rec["facts"]:
            key = "hit=%s|reached=%s|verified=%s" % (
                _s(f["gold_path_hit"]["value"]), _s(f["valid_source_reached"]["value"]), _s(f["fact_verified"]["value"]))
            levels[a][key] = levels[a].get(key, 0) + 1
        for item, rule, detail in semantic_errors(rec):
            semantic.append({"annotator_id": a, "packet_id": p, "item": item, "rule": rule, "detail": detail})

    disagreements.sort(key=lambda d: (d["packet_id"], d["field"], d["item"]))
    return {
        "schema_version": SCHEMA_VERSION,
        "record_kind": "aggregate",
        "annotators": annotators,
        "packets": packets,
        "fields": fields,
        "level_patterns": levels,
        "disagreements": disagreements,
        "semantic_errors": semantic,
        "missing": missing,
    }


def dumps(obj):
    return json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=True) + "\n"


# --------------------------------------------------------------------------
# Trace helpers (Round 1 harness JSONL format)
# --------------------------------------------------------------------------

def _result_text(block):
    c = block.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "\n".join(x.get("text", "") for x in c if isinstance(x, dict))
    return ""


def delivered_events(lines):
    """Pair each tool_use with its tool_result. 'Delivered' text is the tool_result
    content inside a user message: what the model actually received."""
    uses, out = {}, []
    for idx, line in enumerate(lines):
        if not line.strip():
            continue
        e = json.loads(line)
        msg = e.get("message") or {}
        content = msg.get("content") if isinstance(msg.get("content"), list) else []
        if e.get("type") == "assistant":
            for b in content:
                if b.get("type") == "tool_use":
                    uses[b["id"]] = (idx, b.get("name"), b.get("input") or {})
        elif e.get("type") == "user":
            for b in content:
                if b.get("type") == "tool_result":
                    u = uses.get(b.get("tool_use_id"), (None, None, {}))
                    out.append({
                        "use_event": u[0], "result_event": idx, "tool": u[1], "input": u[2],
                        "text": _result_text(b), "is_error": bool(b.get("is_error")),
                    })
    return out


_EXTENT_RANK = ["none", "listing_only", "preview_only", "grep_snippet", "offset_limit", "full"]


def _norm(s):
    return " ".join(s.split())


def _strip_prefixes(text, path):
    """Remove Read line numbers ('12\\t') and Grep prefixes ('path:12:' or '12:')."""
    out = []
    for ln in text.split("\n"):
        if ln.startswith(path + ":"):
            ln = ln[len(path) + 1:]
        m = re.match(r"^\s*\d+[\t:-]", ln)
        if m:
            ln = ln[m.end():]
        out.append(ln)
    return "\n".join(out)


VAULT_PLACEHOLDER = "<VAULT>/"


def _rel(p):
    """Packet traces replace the run's absolute vault root with '<VAULT>'; treat it as the vault root."""
    return p[len(VAULT_PLACEHOLDER):] if p.startswith(VAULT_PLACEHOLDER) else p


def _mentions(text, path):
    """The full vault-relative path, or its wikilink form without '.md'. A
    basename-only wikilink does not count (METRICS.md 3.1)."""
    if path in text:
        return True
    if path.endswith(".md") and ("[[" + path[:-3] + "]]" in text or "[[" + path[:-3] + "|" in text
                                 or "[[" + path[:-3] + "#" in text):
        return True
    return False


def trace_check(lines, path, quote=None):
    """Mechanical L1 observations for one vault-relative path."""
    hit_events, open_events, extent, quote_events = [], [], "none", []
    complete = False
    for line in lines:
        if line.strip() and json.loads(line).get("type") == "result":
            complete = True
    for ev in delivered_events(lines):
        if ev["is_error"]:
            continue
        inp, tool = ev["input"], ev["tool"]
        text = ev["text"].replace(VAULT_PLACEHOLDER, "")
        own = []  # text that came from this path
        this = "none"
        if tool == "Read" and _rel(inp.get("file_path", "")) == path:
            if text.lstrip().startswith("<persisted-output>"):
                this = "preview_only"
            elif "offset" in inp or "limit" in inp:
                this = "offset_limit"
            else:
                this = "full"
            own.append(text)
        elif tool == "Grep" and inp.get("output_mode") == "content":
            if _rel(inp.get("path", "")) == path:
                this, own = "grep_snippet", [text]
            else:
                mine = [ln for ln in text.split("\n") if ln.startswith(path + ":") or ln.startswith(path + "-")]
                if mine:
                    this, own = "grep_snippet", ["\n".join(mine)]
            if text.lstrip().startswith("<persisted-output>") and this != "none":
                this = "preview_only"
        if this != "none" or _mentions(text, path):
            hit_events.append(ev["result_event"])
            if this == "none":
                this = "listing_only"
        if this not in ("none", "listing_only"):
            open_events.append(ev["result_event"])
        if _EXTENT_RANK.index(this) > _EXTENT_RANK.index(extent):
            extent = this
        if quote and any(_norm(quote) in _norm(_strip_prefixes(t, path)) for t in own):
            quote_events.append(ev["result_event"])
    res = {
        "trace_complete": complete,
        "gold_path_hit": bool(hit_events), "hit_events": hit_events,
        "gold_path_opened": bool(open_events), "open_events": open_events,
        "read_extent": extent,
    }
    if quote is not None:
        res["quote_delivered"] = bool(quote_events)
        res["quote_events"] = quote_events
    return res


# --------------------------------------------------------------------------
# Self-test on synthetic fixtures
# --------------------------------------------------------------------------

def _fixture(*parts):
    return os.path.join(FIXTURES, *parts)


def self_test():
    schema = load_schema()
    results = []

    def record(name, ok, detail=""):
        results.append((name, ok, detail))

    # 1. Every valid fixture passes schema and semantic rules.
    valid_files = ["annotations/annotator-1.jsonl", "annotations/annotator-2.jsonl"]
    all_recs = []
    for vf in valid_files:
        recs = read_jsonl(_fixture(vf))
        errs = validate_records(recs, schema)
        record("valid fixture %s (%d records)" % (vf, len(recs)), not errs, "; ".join(errs[:3]))
        all_recs.extend(r for _, r in recs)
    exp_path = _fixture("expected", "aggregate.json")
    with open(exp_path, encoding="utf-8") as fh:
        expected_text = fh.read()
    errs = validate_records([("expected/aggregate.json", json.loads(expected_text))], schema)
    record("expected aggregate validates", not errs, "; ".join(errs[:3]))

    # 2. Every invalid fixture is rejected for the stated reason.
    with open(_fixture("invalid", "cases.json"), encoding="utf-8") as fh:
        cases = json.load(fh)
    for case in cases:
        recs = read_jsonl(_fixture("invalid", case["file"]))
        errs = validate_records(recs, schema)
        ok = bool(errs) and any(case["expect"] in e for e in errs)
        record("invalid fixture %s rejected (%s)" % (case["file"], case["expect"]), ok, "; ".join(errs[:2]))

    # 3. Mechanical L1 checks on synthetic traces agree with the fixture packets.
    with open(_fixture("packets.json"), encoding="utf-8") as fh:
        packets = json.load(fh)
    for pk in packets:
        with open(_fixture("traces", pk["trace"]), encoding="utf-8") as fh:
            lines = fh.read().split("\n")
        for fact in pk["facts"]:
            got = trace_check(lines, fact["gold_path"], fact["quote"])
            exp = fact["expect_mechanical"]
            sub = {k: got[k] for k in exp}
            record("trace-check %s %s" % (pk["packet_id"], fact["fact_id"]), sub == exp,
                   "got %s expected %s" % (json.dumps(sub, sort_keys=True), json.dumps(exp, sort_keys=True)))

    # 4. Aggregation equals the expected record, byte for byte, twice.
    out1 = dumps(aggregate(all_recs))
    out2 = dumps(aggregate(list(reversed(all_recs))))
    record("aggregate equals fixtures/expected/aggregate.json", out1 == expected_text,
           "first differing char %d" % next((i for i, (x, y) in enumerate(zip(out1, expected_text)) if x != y), min(len(out1), len(expected_text))))
    record("aggregate independent of input order", out1 == out2)

    # 5. Derivation tables.
    record("derive_read_state precedence", [
        derive_read_state({"completeness": "partial", "partial_cause": "offset_limit", "version_check": "stale"}),
        derive_read_state({"completeness": "partial", "partial_cause": "persisted_preview", "version_check": "not_checked"}),
        derive_read_state({"completeness": "full", "partial_cause": "none", "version_check": "not_checked"}),
        derive_read_state({"completeness": "full", "partial_cause": "none", "version_check": "not_applicable"}),
        derive_read_state({"completeness": "none", "partial_cause": "tool_error", "version_check": "not_checked"}),
        derive_read_state({"completeness": "unknown", "partial_cause": "unknown", "version_check": "not_checked"}),
    ] == ["version_stale", "truncated", "unverified", "read", "error", "unknown"])

    lines = []
    passed = 0
    for name, ok, detail in results:
        passed += ok
        lines.append(("PASS " if ok else "FAIL ") + name + ("" if ok or not detail else " :: " + detail))
    lines.append("SELF-TEST %s %d/%d" % ("PASS" if passed == len(results) else "FAIL", passed, len(results)))
    return passed == len(results), "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--self-test", action="store_true")
    g.add_argument("--validate", nargs="+", metavar="JSONL")
    g.add_argument("--aggregate", nargs="+", metavar="JSONL")
    g.add_argument("--trace-check", metavar="TRACE")
    ap.add_argument("--path", help="vault-relative path for --trace-check")
    ap.add_argument("--quote", help="required quote for --trace-check")
    ap.add_argument("--out", help="write the aggregate here instead of stdout")
    a = ap.parse_args(argv)

    if a.self_test:
        ok, text = self_test()
        sys.stdout.write(text)
        return 0 if ok else 1
    schema = load_schema()
    if a.validate:
        recs = []
        for p in a.validate:
            recs.extend(read_jsonl(p))
        errs = validate_records(recs, schema)
        for e in errs:
            print(e)
        print("VALIDATE %s %d records, %d errors" % ("PASS" if not errs else "FAIL", len(recs), len(errs)))
        return 0 if not errs else 1
    if a.aggregate:
        recs = []
        for p in a.aggregate:
            recs.extend(read_jsonl(p))
        errs = [e for e in validate_records(recs, schema) if ": schema: " in e]
        if errs:
            for e in errs:
                print(e, file=sys.stderr)
            return 2
        text = dumps(aggregate([r for _, r in recs]))
        if a.out:
            with open(a.out, "w", encoding="utf-8") as fh:
                fh.write(text)
        else:
            sys.stdout.write(text)
        return 0
    if a.trace_check:
        if not a.path:
            ap.error("--trace-check needs --path")
        with open(a.trace_check, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
        sys.stdout.write(dumps(trace_check(lines, a.path, a.quote)))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
