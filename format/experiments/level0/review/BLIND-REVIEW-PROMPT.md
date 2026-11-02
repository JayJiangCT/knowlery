# Prompt for an independent equivalence review (paste verbatim to the local Agent)

You are the second, independent reviewer of a page migration. Do not look for, ask for, or use anyone else's decisions on these items; if you find a file of decisions anywhere, do not open it.

## Setup
Two repositories are on this machine:
- `Knowlery-Pilot` at commit `cf9e378` — the 1.x originals.
- `knowlery` on branch `develop/2.0` — the migrated pages under `format/experiments/level0/test/` and this packet at `format/experiments/level0/review/BLIND-REVIEW-PACKET.md`.
Read `format/experiments/level0/test/CONVENTIONS.md` first (5 minutes) so you know what a claim, a History line, an Open item and a Record's Summary/Detail are.

## The question you are answering
Are the migrated pages **semantically equivalent** to the 1.x originals? Equivalent means: no statement of fact or decision is lost, none is added, none is sharpened (should → is) or softened. Rephrasing, merging several 1.x sentences into one claim, and moving a replaced statement into `## History` are all allowed. Whether a statement is *true today* is irrelevant: judge only 1.x vs Test.

## Procedure
Work through every item in the packet, in order. For each item open both files at the places the item names and read enough surrounding text to be sure. Then write exactly one decision:
- `ok` — the 1.x content is present in Test (as a claim, History line, Open item or Evidence text, named by its `^cN`/`^qN` or section), in a form you accept; for Type B/N, the Test sentence has a clear 1.x origin or is a pure restatement.
- `drop-ok` — the 1.x text is a cross-reference, section lead-in, rhetorical framing or reasoning step whose knowledge content is already carried elsewhere in Test; losing the sentence loses no fact.
- `fix` — content lost, added, or changed in strength. Say in one clause what is missing or wrong and where it should go.
Decide every item; do not skip. When unsure between `ok` and `drop-ok`, prefer `fix` and explain, so a human can settle it.

## Output
Write `format/experiments/level0/review/decisions-agent.json`: a JSON array with one object per item, `{"id": "<item id exactly as in the packet>", "decision": "ok|drop-ok|fix", "where": "<^cN / ^qN / History / Evidence / Summary, or empty>", "reason": "<one clause>"}`. Also write `review/agent-review-notes.md` with anything you noticed beyond the 96 items (a lost statement the packet did not list, a Test claim with no origin that the packet missed). Do not edit any page. Do not commit.
