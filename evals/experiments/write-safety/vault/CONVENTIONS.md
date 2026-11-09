# Conventions (WS-001 synthetic test vault)

This is a disposable, synthetic vault for the WS-001 write-safety experiment. All content is invented.
It follows Knowledge Format v1.0 (`format/KNOWLEDGE-FORMAT-v1.0.md` in the Knowlery repo); that file governs.

- Layout: `concepts/`, `entities/`, `comparisons/` hold Knowledge pages; `records/` holds Records; `sources/` holds Sources; `log.md` is the operation log; `.knowlery/` is derived data.
- Claims are list items in `## Current` ending in a block id `^cN`. `## Sources` and `## History` are append-only; `## History` is newest first.
- `protected: ["^cN"]` lists claims a human has decided. Never change a protected claim's text or move it out of `## Current`.
- Every write operation adds one line to `log.md`.
- Digest procedure: take the scope, normalize line endings to `\n`, strip trailing whitespace on each line, strip leading/trailing blank lines, SHA-256 the UTF-8 bytes.
