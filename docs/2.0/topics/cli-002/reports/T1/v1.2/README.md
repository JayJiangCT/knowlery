# Metric D v1.2 candidate files (PROPOSED)

Candidate only. Not ACCEPTED, not used for any score. Updated 2026-11-06 for the O2–O7 closure (manifest-validated WCC, bound P1 path, O4/O5/O6); see `../V12-OWNER-DECISIONS-RESOLUTION.md`. Nothing here changes the v1 files one folder up.

| File | What |
|---|---|
| `METRICS-SCHEMA-v1.2.json` | Candidate schema `cli002-r2-t1/2` (superset of v1; v1 records keep the v1 schema) |
| `build_schema_v12.py` | Rebuilds the candidate schema byte-identically from `../METRICS-SCHEMA.json` |
| `ADJUDICATION-PROTOCOL-v1.2-DRAFT.md` | Protocol delta against v1.1 |
| `aggregate_v12.py` | Candidate validator and endpoint summarizer; imports `../aggregate.py` read-only |
| `test_aggregate_v12.py` | Unit tests (expected values derived by hand) |
| `fixtures/` | Invented records (apiary vault), manifest (with one invented approved currentness reference, to exercise the binding), malformed manifests, invalid cases, a legacy `answerability_unknown` record, expected summary; `generate_fixtures_v12.py` rebuilds them |

## The one documented test command (run from `reports/T1`)

```bash
python3 -I -B v1.2/aggregate_v12.py --self-test
```

Expected last line: `SELF-TEST-V12 PASS 42/42`. The output has no timings, so two runs are byte-identical.

Second check (prints a timing line, so compare only the result):

```bash
python3 -I -B -m unittest discover -s v1.2 -p 'test_*.py'
```

There is no `__init__.py` here on purpose, so the existing v1 suite (`unittest discover -s .` from `reports/T1`) does not pick these tests up.
