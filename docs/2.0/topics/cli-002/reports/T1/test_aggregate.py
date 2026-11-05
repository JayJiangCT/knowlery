"""Tests for aggregate.py. Standard library only.

    python3 -I -m unittest discover -s <this folder> -p 'test_*.py' -v
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aggregate as ag  # noqa: E402


def _claim(**kw):
    c = {
        "used_in_answer": "yes", "first_vault_source": "identified",
        "first_source_read": {"value": False, "reason": None, "events": []},
        "history_source_checked": "absent", "source_digest_state": "not_computed",
        "digest_step_observed": False,
    }
    c.update(kw)
    return c


class SelfTest(unittest.TestCase):
    def test_self_test_passes_and_is_deterministic(self):
        ok1, out1 = ag.self_test()
        ok2, out2 = ag.self_test()
        self.assertTrue(ok1, out1)
        self.assertEqual(out1, out2)


class F008Derivation(unittest.TestCase):
    def test_reading_first_source_is_compliant(self):
        c = _claim(first_source_read={"value": True, "reason": None, "events": [3]})
        self.assertEqual(ag.derive_f008(c), ("compliant", None))

    def test_no_read_and_no_history_event_is_non_compliant(self):
        self.assertEqual(ag.derive_f008(_claim()), ("non_compliant", None))

    def test_event_at_listed_version_with_stale_digest_is_non_compliant(self):
        c = _claim(history_source_checked="present_at_listed_version", source_digest_state="stale")
        self.assertEqual(ag.derive_f008(c), ("non_compliant", None))

    def test_event_with_matching_digest_but_no_observed_step_is_unknown(self):
        c = _claim(history_source_checked="present_at_listed_version", source_digest_state="match")
        self.assertEqual(ag.derive_f008(c), ("unknown", "F008_DIGEST_STEP_NOT_OBSERVED"))

    def test_event_with_matching_digest_and_observed_step_is_compliant(self):
        c = _claim(history_source_checked="present_at_listed_version", source_digest_state="match",
                   digest_step_observed=True)
        self.assertEqual(ag.derive_f008(c), ("compliant", None))

    def test_ambiguous_first_source_is_unknown(self):
        self.assertEqual(ag.derive_f008(_claim(first_vault_source="ambiguous")),
                         ("unknown", "F008_FIRST_SOURCE_AMBIGUOUS"))

    def test_claim_not_used_in_answer_is_not_applicable(self):
        self.assertEqual(ag.derive_f008(_claim(used_in_answer="no")), ("not_applicable", None))


class SchemaSubset(unittest.TestCase):
    def test_boolean_is_not_an_integer(self):
        errs = ag.schema_errors(True, {"type": "integer"}, {})
        self.assertTrue(errs)

    def test_pattern_applies_only_to_strings(self):
        s = {"type": ["integer", "string"], "minimum": 0, "pattern": "^unknown$"}
        self.assertEqual(ag.schema_errors(3, s, {}), [])
        self.assertEqual(ag.schema_errors("unknown", s, {}), [])
        self.assertTrue(ag.schema_errors("three", s, {}))

    def test_unsupported_keyword_is_refused(self):
        with self.assertRaises(ValueError):
            ag.schema_errors(1, {"allOf": []}, {})

    def test_schema_file_uses_only_supported_keywords(self):
        schema = ag.load_schema()
        # Walking every definition raises ValueError on an unsupported keyword.
        for name in sorted(schema["$defs"]):
            ag.schema_errors(None, schema["$defs"][name], schema)


class TraceCheck(unittest.TestCase):
    def _lines(self, result_text, tool="Read", inp=None):
        inp = inp if inp is not None else {"file_path": "concepts/a.md"}
        return [
            json.dumps({"type": "assistant", "message": {"content": [
                {"type": "tool_use", "id": "t1", "name": tool, "input": inp}]}}),
            json.dumps({"type": "user", "message": {"content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": result_text}]}}),
            json.dumps({"type": "result"}),
        ]

    def test_basename_wikilink_is_not_a_hit(self):
        got = ag.trace_check(self._lines("see [[b]]"), "notes/b.md")
        self.assertFalse(got["gold_path_hit"])

    def test_full_path_wikilink_is_a_hit_but_not_an_open(self):
        got = ag.trace_check(self._lines("see [[notes/b]]"), "notes/b.md")
        self.assertEqual((got["gold_path_hit"], got["gold_path_opened"], got["read_extent"]),
                         (True, False, "listing_only"))

    def test_error_result_delivers_nothing(self):
        lines = self._lines("notes/b.md", tool="Read", inp={"file_path": "notes/b.md"})
        lines[1] = lines[1].replace('"tool_use_id": "t1"', '"tool_use_id": "t1", "is_error": true')
        got = ag.trace_check(lines, "notes/b.md")
        self.assertFalse(got["gold_path_hit"])

    def test_vault_placeholder_path_counts_as_the_vault_relative_path(self):
        lines = self._lines("1\tFiring at 1180 C.", inp={"file_path": "<VAULT>/notes/b.md"})
        got = ag.trace_check(lines, "notes/b.md", "Firing at 1180 C.")
        self.assertEqual((got["gold_path_opened"], got["read_extent"], got["quote_delivered"]), (True, "full", True))

    def test_offset_read_is_offset_limit(self):
        lines = self._lines("5\tx", inp={"file_path": "notes/b.md", "offset": 5, "limit": 1})
        self.assertEqual(ag.trace_check(lines, "notes/b.md")["read_extent"], "offset_limit")


if __name__ == "__main__":
    unittest.main()
