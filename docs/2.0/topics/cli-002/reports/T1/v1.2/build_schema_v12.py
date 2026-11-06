#!/usr/bin/env python3
"""Build the v1.2 CANDIDATE schema from the frozen v1 schema (read-only input).

    python3 -I -B v1.2/build_schema_v12.py METRICS-SCHEMA.json v1.2/METRICS-SCHEMA-v1.2.json   (from reports/T1)

Deterministic. PROPOSED, not ACCEPTED.
"""
import copy, json, sys
src, dst = sys.argv[1], sys.argv[2]
s = json.load(open(src))
n = copy.deepcopy(s)
d = n["$defs"]
n["$id"] = "knowlery-2.0/cli-002/round2/t1/metrics-schema/2"
n["title"] = "CLI-002 Round 2 evidence annotation records, v1.2 CANDIDATE (PROPOSED, not ACCEPTED)"
n["description"] = ("PROPOSED candidate for protocol v1.2 / schema cli002-r2-t1/2. Not ACCEPTED and not in use. "
    "Superset of METRICS-SCHEMA.json (cli002-r2-t1/1), which stays the schema for every v1.0/v1.1 record. "
    "Adds run.answerable, run.wcc_gold, run.wcc_vault, fact.compiled_reuse and claim.claim_position; "
    "run.wrong_current_claim becomes optional (legacy, never backfilled). Conditional rules are enforced by "
    "v1.2/aggregate_v12.py --validate and listed in V12-DECISION-TABLES.md. Same JSON Schema subset as v1.")
n["oneOf"] = [{"$ref": "#/$defs/annotation_record"}, {"$ref": "#/$defs/endpoint_summary_record"}]
d["reason_code"]["enum"] = d["reason_code"]["enum"][:-2] + [
    "REFERENCE_MISSING", "REFERENCE_INCOMPLETE", "REFERENCE_VERSION_MISMATCH",
    "GOLD_NOT_CURRENTNESS_CHECKED", "CURRENTNESS_NOT_ESTABLISHED", "EVIDENCE_PATH_NOT_OBSERVED",
    "F008_HISTORY_ENTRY_SCOPE_OPEN", "PROTOCOL_GAP", "OTHER"]
d["annotation_record"]["properties"]["schema_version"] = {"const": "cli002-r2-t1/2"}
d["annotation_record"]["properties"]["protocol_version"] = {"type": "string", "pattern": "^1\\.2$"}
del d["aggregate_record"]; del d["aggregate_field"]
# claim position (History rows)
ca = d["claim_annotation"]
ca["properties"]["claim_position"] = {
    "description": "Where the delivered claim sat on its page: current (## Current), disputed (## Current with #disputed), history_superseded (a ## History line). F-008 for history_superseded rows is unknown (F008_HISTORY_ENTRY_SCOPE_OPEN) until KF governance decides.",
    "type": "string", "enum": ["current", "disputed", "history_superseded", "unknown"]}
ca["required"] = ca["required"] + ["claim_position"]
# compiled reuse (P1 evidence path)
d["compiled_reuse"] = {
    "description": "P1 candidate: was this fact supported by reuse of a previously verified compiled claim whose verification, version and currentness are observable? value is derived (aggregate_v12.derive_compiled_reuse) and must equal the derivation. Absent on legacy records.",
    "type": "object",
    "required": ["applicable", "claim_ref", "claim_position", "temporal_scope", "verification_event", "digest_comparison", "currentness", "currentness_basis", "as_of", "value", "reason", "events"],
    "additionalProperties": False,
    "properties": {
        "applicable": {"description": "yes = the answer relies on a delivered compiled claim for this fact; no = it does not.", "type": "string", "enum": ["yes", "no", "unknown"]},
        "claim_ref": {"oneOf": [{"$ref": "#/$defs/ref"}, {"type": "null"}]},
        "claim_position": {"type": "string", "enum": ["current", "disputed", "history_superseded", "unknown", "not_applicable"]},
        "temporal_scope": {"description": "Does the question ask for the current state or an earlier state (Rule A)?", "type": "string", "enum": ["current", "historical", "unknown", "not_applicable"]},
        "verification_event": {"description": "A source-checked History event for this claim at the Source version listed in ## Sources.", "type": "string", "enum": ["present_at_listed_version", "present_other_version", "absent", "unknown", "not_applicable"]},
        "digest_comparison": {"description": "Does the trace show the agent comparing the Source's current digest with the listed version at query time?", "type": "string", "enum": ["observed_match", "observed_stale", "not_observed", "unknown", "not_applicable"]},
        "currentness": {"description": "Is it established, by the basis named in currentness_basis, that no later knowledge superseded the claim as of as_of? A digest match alone never establishes this.", "type": "string", "enum": ["established_current", "established_not_current", "not_established", "unknown", "not_applicable"]},
        "currentness_basis": {"description": "Which approved reference established currentness (OPEN: Owner decides the admissible bases).", "type": ["string", "null"]},
        "as_of": {"type": ["string", "null"], "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
        "value": {"type": ["boolean", "string"], "enum": [True, False, "unknown", "not_applicable"]},
        "reason": {"$ref": "#/$defs/reason_code"},
        "events": {"$ref": "#/$defs/events"},
        "note": {"$ref": "#/$defs/note"}}}
d["fact_annotation"]["properties"]["compiled_reuse"] = {"$ref": "#/$defs/compiled_reuse"}
d["fact_annotation"]["required"] = d["fact_annotation"]["required"] + ["compiled_reuse"]
# wcc split
def wcc(desc, allow_na):
    vals = [True, False, "unknown"] + (["not_applicable"] if allow_na else [])
    comp = ["complete", "incomplete", "absent", "version_mismatch", "unknown"] + (["not_applicable"] if allow_na else [])
    o = {"description": desc, "type": "object",
         "required": ["value", "reason", "events", "reference_id", "reference_version", "reference_completeness"],
         "additionalProperties": False,
         "properties": {
             "value": {"type": ["boolean", "string"], "enum": vals},
             "reason": {"$ref": "#/$defs/reason_code"},
             "events": {"$ref": "#/$defs/events"},
             "reference_id": {"type": ["string", "null"]},
             "reference_version": {"type": ["string", "null"]},
             "reference_completeness": {"type": "string", "enum": comp},
             "note": {"$ref": "#/$defs/note"}}}
    return o
d["wcc_gold"] = wcc("Does the answer contradict the independently adjudicated current state at the reference's as_of date? All arms.", False)
d["wcc_gold"]["properties"]["as_of"] = {"type": ["string", "null"], "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"}
d["wcc_gold"]["properties"]["gold_currentness_checked"] = {"description": "The gold reference records a supersession check against later material.", "type": ["boolean", "string"], "enum": [True, False, "unknown"]}
d["wcc_gold"]["required"] = d["wcc_gold"]["required"] + ["as_of", "gold_currentness_checked"]
d["wcc_vault"] = wcc("Does the answer present as current a claim the frozen compiled vault marks superseded or disputed? Compiled arms only; not_applicable is applied from the arm manifest, never chosen by a judge. false never means the answer is current.", True)
ra = d["run_annotation"]
ra["properties"]["answerable"] = {"type": "boolean"}
ra["properties"]["wcc_gold"] = {"$ref": "#/$defs/wcc_gold"}
ra["properties"]["wcc_vault"] = {"$ref": "#/$defs/wcc_vault"}
ra["required"] = ["answerable", "answer_mode", "proper_abstention", "wcc_gold", "wcc_vault", "graph"]
ra["properties"]["wrong_current_claim"]["description"] = "LEGACY (v1.0/v1.1 meaning). Optional in v1.2; passed through unchanged, never mapped to wcc_gold or wcc_vault."
# endpoint summary output record
cnt = {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}}
d["endpoint_summary_record"] = {
    "description": "Written by aggregate_v12.py --summarize. Counts only, no rates and no thresholds.",
    "type": "object", "required": ["schema_version", "record_kind", "arm_manifest", "per_annotator"],
    "additionalProperties": False,
    "properties": {
        "schema_version": {"const": "cli002-r2-t1/2"},
        "record_kind": {"const": "endpoint_summary"},
        "arm_manifest": {"type": "string", "enum": ["absent", "applied"]},
        "per_annotator": {"type": "object", "additionalProperties": {"type": "object"}}}}
json.dump(n, open(dst, "w"), indent=2, sort_keys=False, ensure_ascii=True)
open(dst, "a").write("\n")
