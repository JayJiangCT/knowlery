"""Tests for the v1.2 CANDIDATE module (PROPOSED, not ACCEPTED). Standard library only.

    python3 -I -B -m unittest discover -s v1.2 -p 'test_*.py' -v      (from reports/T1)

Expected values here are derived by hand from V12-DECISION-TABLES.md, not read
from the code's own output.
"""
import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
for _p in (HERE, os.path.dirname(HERE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import aggregate as v1  # noqa: E402
import aggregate_v12 as v12  # noqa: E402

T, F, U, NA = True, False, "unknown", "not_applicable"


def _load(name):
    return [o for _, o in v1.read_jsonl(os.path.join(HERE, "fixtures", name))]


def _by_id():
    return {r["packet_id"]: r for r in _load("valid-v12.jsonl")}


def _reuse(**kw):
    c = {"applicable": "yes", "claim_position": "current", "temporal_scope": "current",
         "verification_event": "present_at_listed_version", "digest_comparison": "observed_match",
         "currentness": "established_current"}
    c.update(kw)
    return c


class TriState(unittest.TestCase):
    def test_false_and_unknown_is_false(self):
        self.assertIs(v12.tri_and([F, U]), F)

    def test_true_and_unknown_is_unknown(self):
        self.assertEqual(v12.tri_and([T, U]), U)

    def test_all_true_is_true(self):
        self.assertIs(v12.tri_and([T, T]), T)

    def test_all_unknown_is_unknown(self):
        self.assertEqual(v12.tri_and([U, U, U]), U)

    def test_false_wins_regardless_of_position(self):
        self.assertIs(v12.tri_and([U, U, F]), F)

    def test_empty_conjunction_is_an_error_not_true(self):
        with self.assertRaises(ValueError):
            v12.tri_and([])

    def test_not_applicable_is_not_a_tri_state_input(self):
        with self.assertRaises(ValueError):
            v12.tri_and([T, NA])


class CompiledReuse(unittest.TestCase):
    def test_all_conditions_observed_is_true(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse()), (T, None))

    def test_digest_match_without_observed_step_is_unknown(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(digest_comparison="not_observed")),
                         (U, "F008_DIGEST_STEP_NOT_OBSERVED"))

    def test_digest_match_alone_does_not_establish_currentness(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(currentness="not_established")),
                         (U, "CURRENTNESS_NOT_ESTABLISHED"))

    def test_no_verification_event_is_false(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(verification_event="absent")), (F, None))

    def test_event_at_other_version_is_false(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(verification_event="present_other_version")), (F, None))

    def test_disputed_claim_is_false(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(claim_position="disputed")), (F, None))

    def test_rule_a_current_branch_superseded_entry_is_false(self):
        c = _reuse(claim_position="history_superseded", temporal_scope="current")
        self.assertEqual(v12.derive_compiled_reuse(c), (F, None))

    def test_rule_a_historical_branch_superseded_entry_can_be_true(self):
        c = _reuse(claim_position="history_superseded", temporal_scope="historical")
        self.assertEqual(v12.derive_compiled_reuse(c), (T, None))

    def test_false_component_beats_unknown_component(self):
        c = _reuse(digest_comparison="not_observed", currentness="established_not_current")
        self.assertEqual(v12.derive_compiled_reuse(c), (F, None))

    def test_not_applicable_when_no_compiled_claim_relied_on(self):
        self.assertEqual(v12.derive_compiled_reuse(_reuse(applicable="no")), (NA, None))


class Endpoints(unittest.TestCase):
    def setUp(self):
        self.r = _by_id()

    def test_p0_run_values(self):
        got = {pid: v12.run_endpoint(r, v12.fact_p0) for pid, r in self.r.items()}
        self.assertEqual(got, {"SYN01": T, "SYN02": U, "SYN03": T, "SYN04": F, "SYN05": F,
                               "SYN06": F, "SYN07": F, "SYN08": None, "SYN09": F})

    def test_p1_run_values(self):
        got = {pid: v12.run_endpoint(r, v12.fact_p1) for pid, r in self.r.items()}
        self.assertEqual(got, {"SYN01": T, "SYN02": U, "SYN03": T, "SYN04": F, "SYN05": T,
                               "SYN06": U, "SYN07": F, "SYN08": None, "SYN09": F})

    def test_f008_compliant_alone_does_not_make_p1_true(self):
        rec = self.r["SYN06"]
        self.assertEqual(rec["compiled_claims"][0]["f008"]["value"], "compliant")
        self.assertNotEqual(v12.run_endpoint(rec, v12.fact_p1), T)

    def test_p1_never_below_p0_on_fixtures(self):
        order = {F: 0, U: 1, T: 2}
        for r in self.r.values():
            for f in r["facts"]:
                self.assertGreaterEqual(order[v12.fact_p1(f)], order[v12.fact_p0(f)])

    def test_zero_required_facts_on_answerable_run_is_an_error(self):
        rec = copy.deepcopy(self.r["SYN01"])
        rec["facts"] = []
        with self.assertRaises(ValueError):
            v12.run_endpoint(rec, v12.fact_p0)

    def test_unanswerable_run_is_excluded(self):
        self.assertIsNone(v12.run_endpoint(self.r["SYN08"], v12.fact_p0))


class Legacy(unittest.TestCase):
    def setUp(self):
        self.recs = []
        for n in ("annotator-1.jsonl", "annotator-2.jsonl"):
            self.recs += [o for _, o in v1.read_jsonl(os.path.join(HERE, "..", "fixtures", "annotations", n))]

    def test_v1_records_validate_unchanged(self):
        self.assertEqual(v12.validate_any([("x", r) for r in self.recs]), [])

    def test_v1_compiled_support_gives_p1_unknown_not_true(self):
        for r in self.recs:
            for f in r["facts"]:
                if f["fact_verified"]["support_kind"] in ("compiled_claim", "both") and \
                        f["valid_source_reached"]["value"] is not T and f["fact_verified"]["value"] is T:
                    self.assertEqual(v12.fact_p1(f), U)

    def test_v1_source_only_support_gives_p1_equal_p0(self):
        for r in self.recs:
            for f in r["facts"]:
                if f["fact_verified"]["support_kind"] in ("source", "none"):
                    self.assertEqual(v12.fact_p1(f), v12.fact_p0(f))

    def test_wrong_current_claim_passed_through_and_never_mapped(self):
        s, _ = v12.summarize(self.recs)
        for a, block in s["per_annotator"].items():
            want = {}
            for r in self.recs:
                if r["annotator_id"] == a:
                    k = v1._s(r["run"]["wrong_current_claim"]["value"])
                    want[k] = want.get(k, 0) + 1
            self.assertEqual(block["legacy_wrong_current_claim"], want)
            self.assertEqual(block["wcc_gold"], {})
            self.assertEqual(block["wcc_vault"], {})

    def test_v1_answerability_derived_from_proper_abstention(self):
        for r in self.recs:
            pa = r["run"]["proper_abstention"]["value"]
            self.assertEqual(v12.record_answerable(r), T if pa == NA else (F if pa in (T, F) else U))


class Wcc(unittest.TestCase):
    def setUp(self):
        self.r = _by_id()
        with open(os.path.join(HERE, "fixtures", "manifest.json"), encoding="utf-8") as fh:
            self.m = json.load(fh)

    def _errs(self, rec):
        return v12.validate_any([("x", rec)])

    def test_complete_empty_compiled_reference_can_be_false(self):
        w = self.r["SYN02"]["run"]["wcc_vault"]
        self.assertEqual((w["value"], w["reference_completeness"]), (F, "complete"))
        self.assertEqual(self._errs(self.r["SYN02"]), [])

    def test_incomplete_reference_is_unknown_not_false(self):
        rec = copy.deepcopy(self.r["SYN04"])
        rec["run"]["wcc_vault"]["value"] = F
        rec["run"]["wcc_vault"]["reason"] = None
        self.assertTrue(any("W2-" in e for e in self._errs(rec)))

    def test_true_needs_complete_versioned_reference(self):
        rec = copy.deepcopy(self.r["SYN03"])
        rec["run"]["wcc_vault"]["reference_version"] = None
        self.assertTrue(any("W2-" in e for e in self._errs(rec)))

    def test_baseline_packet_with_judged_wcc_vault_is_a_manifest_error(self):
        rec = copy.deepcopy(self.r["SYN01"])
        rec["run"]["wcc_vault"] = copy.deepcopy(self.r["SYN03"]["run"]["wcc_vault"])
        recs = [rec] + [r for pid, r in self.r.items() if pid != "SYN01"]
        _, errs = v12.summarize(recs, self.m)
        self.assertTrue(any("baseline-arm" in e for e in errs))

    def test_compiled_packet_with_not_applicable_is_a_manifest_error(self):
        rec = copy.deepcopy(self.r["SYN03"])
        rec["run"]["wcc_vault"] = copy.deepcopy(self.r["SYN01"]["run"]["wcc_vault"])
        recs = [rec] + [r for pid, r in self.r.items() if pid != "SYN03"]
        _, errs = v12.summarize(recs, self.m)
        self.assertTrue(any("compiled-arm" in e for e in errs))

    def test_reference_version_differing_from_manifest_is_an_error(self):
        rec = copy.deepcopy(self.r["SYN03"])
        rec["run"]["wcc_vault"]["reference_version"] = "v-fake-9999"
        recs = [rec] + [r for pid, r in self.r.items() if pid != "SYN03"]
        _, errs = v12.summarize(recs, self.m)
        self.assertTrue(any("reference differs" in e for e in errs))

    def test_annotator_placeholder_before_judging_passes_validates(self):
        rec = copy.deepcopy(self.r["SYN03"])
        ph = {"value": U, "reason": "REFERENCE_MISSING", "events": [], "reference_id": None,
              "reference_version": None, "reference_completeness": "absent"}
        rec["run"]["wcc_vault"] = dict(ph)
        rec["run"]["wcc_gold"] = dict(ph, as_of=None, gold_currentness_checked=U)
        self.assertEqual(self._errs(rec), [])

    def test_gold_without_currentness_check_is_unknown(self):
        w = self.r["SYN02"]["run"]["wcc_gold"]
        self.assertEqual((w["value"], w["reason"]), (U, "GOLD_NOT_CURRENTNESS_CHECKED"))


class SummaryCounts(unittest.TestCase):
    """Hand-derived from the nine SYN records (see generate_fixtures_v12.py comments)."""

    def setUp(self):
        with open(os.path.join(HERE, "fixtures", "manifest.json"), encoding="utf-8") as fh:
            m = json.load(fh)
        s, errs = v12.summarize(_load("valid-v12.jsonl"), m)
        self.assertEqual(errs, [])
        self.a = s["per_annotator"]["annotator-1"]

    def test_p0_counts_and_both_denominators(self):
        p = self.a["P0"]
        self.assertEqual((p["true"], p["false"], p["unknown"]), (2, 5, 1))
        self.assertEqual((p["denominator_answerable_total"], p["denominator_determinate_only"]), (8, 7))

    def test_p1_counts_and_both_denominators(self):
        p = self.a["P1"]
        self.assertEqual((p["true"], p["false"], p["unknown"]), (3, 3, 2))
        self.assertEqual((p["denominator_answerable_total"], p["denominator_determinate_only"]), (8, 6))

    def test_unanswerable_reported_separately(self):
        self.assertEqual(self.a["unanswerable_excluded"], 1)

    def test_wcc_counts(self):
        self.assertEqual(self.a["wcc_gold"], {"false": 7, "unknown": 2})
        self.assertEqual(self.a["wcc_vault"], {"false": 3, "not_applicable": 3, "true": 2, "unknown": 1})

    def test_expected_file_matches(self):
        with open(os.path.join(HERE, "fixtures", "expected-summary.json"), encoding="utf-8") as fh:
            exp = json.load(fh)
        self.assertEqual(exp["per_annotator"]["annotator-1"], self.a)


class SchemaCompatibility(unittest.TestCase):
    def test_v12_schema_keeps_every_unchanged_v1_definition(self):
        s1, s2 = v1.load_schema()["$defs"], v12.load_schema_v12()["$defs"]
        changed = {"reason_code", "annotation_record", "claim_annotation", "fact_annotation", "run_annotation"}
        dropped = {"aggregate_record", "aggregate_field"}
        for k, v in s1.items():
            if k not in changed | dropped:
                self.assertEqual(s2[k], v, k)

    def test_v12_reason_codes_are_a_superset(self):
        old = set(v1.load_schema()["$defs"]["reason_code"]["enum"])
        new = set(v12.load_schema_v12()["$defs"]["reason_code"]["enum"])
        self.assertTrue(old <= new)


if __name__ == "__main__":
    unittest.main()
