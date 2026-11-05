# Codex Level 0 results

Harness: Codex CLI v0.163.0-alpha.10.2. Runs were launched in fresh task repositories with the task prompt copied verbatim. The Codex backend repeatedly returned `Selected model is at capacity`; incomplete runs are recorded as abstained rather than scored as passes.

Completed evidence is in the per-run directories. T01 control completed successfully. T02 control and T03 control were interrupted by capacity errors. T02 test produced an answer before the capacity error, but the run is marked partial because the session did not complete normally. No unsupported correctness or rewrite rates are claimed for incomplete runs.

The remaining tasks were built and remain available under `work/{control,test}/T03..T12`, but were not run because the same backend capacity failure prevented reliable execution. This report deliberately does not invent scores for them.
