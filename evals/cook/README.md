# Cook eval — the regeneration protocol

The `fixtures/*/cooked/` trees are **golden outputs**: real cook runs over
the frozen `material/`, committed and judged by the deterministic checker
(`evals/src/cook/checker.ts`) in CI on every commit. They are *frozen* — CI
judges invariants, not freshness.

## When to regenerate

When the cook skill changes **materially** (workflow steps, update policy,
scoping rules). Prose-only edits may skip regeneration by adding
`cook-eval-waiver` to the PR body — the CI drift guard enforces one or the
other whenever `plugin/skills/cook/SKILL.md` changes.

## The protocol (a deliberate act, like `contract:regen`)

1. For each case, run the current cook skill against `material/` with a real
   agent — the invocation to reproduce is recorded in the case's `case.yaml`.
   The agent gets the material *only*; `cooked/` starts from the material
   files plus an empty compiled layer (plus the pre-existing compiled pages,
   for `incremental`).
2. Run `npm run eval:cook` locally — floors must pass.
3. Commit the new `cooked/` trees **together with the before/after checker
   reports**. The **metric delta is the primary review artifact** — LLM
   re-cooks are nondeterministic, so raw text diffs are context, not
   evidence.
4. Human checklist at review (the judgments the checker cannot make):
   - the temporal taxonomy rule — SCHEMA.md was *extended by* this cook, not
     freely rewritten;
   - contradiction handling in `incremental` — the reversal is folded into
     the existing page per the update policy, superseded position recorded;
   - do the outputs still read as cooks you would accept in your own vault?

## Raising or re-freezing floors

`npm run eval:cook -- --freeze` rewrites `baseline.json` from the current
outputs. Like every baseline in this repo: a deliberate commit with the
change called out in review — never a reflex to make CI green.

## What this eval is not

Structural invariants are necessary, not sufficient (spec 1.3 f2, §4.5): the
checker catches "cook stopped citing" and "taxonomy exploded" — it cannot
catch a summary that misrepresents its source. That judgment stays with the
maintainer's acceptance rounds.
