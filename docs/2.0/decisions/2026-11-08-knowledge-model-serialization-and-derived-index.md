# CLI-003 — Knowledge Model / Serialization Separation and Derived Structured Index

- **Status:** ACCEPTED · 2026-11-08 (Owner approved in conversation; recorded by Agent on Owner's authorization, following the same convention as the KF v1.0 acceptance record). Items in §5 "Open" remain OPEN.
- **Refines:** CLI-001 (CLI implements KF, does not define it; `.knowlery/` is rebuildable), GR-008 (layered Evidence Pack), GR-010 (three-operation Pilot), SK-001 (Level 0 remains supported without the CLI).
- **Trigger:** Owner proposal (2026-11-08) to move the compiled Wiki from Markdown to JSONL to reduce runtime parsing cost and Obsidian CLI dependence. Reviewed independently by two Cloud Agents and one double review; all three converged on the position below.

---

## 1. Decision

1. **Markdown remains the canonical serialization of compiled knowledge.** The Knowledge Format v1.0 page contract (frontmatter, fixed section order, `^cN` anchors, `## Sources` lines) is the authoritative on-disk representation. Baselines A-002 (Markdown-first) and "Obsidian is a first-class environment" are unchanged.

2. **Knowledge Model and Serialization are separate concerns in the CLI.** The CLI has one internal object model — Page, Claim, Record, Source, Relation, Status — that mirrors KF v1.0 semantics exactly. Parsers produce these objects from files; all operations (`search`, `explore`, `inspect`, `validate`, future writes) act only on objects; output and index generation serialize objects back out. The object model is an in-process structure, not a stored database.

3. **The CLI maintains a normalized, derived structured index under `.knowlery/`** (working names: `pages.jsonl`, `claims.jsonl`, `sources.jsonl`, `relations.jsonl`). It is rebuildable from Markdown at any time, is never a source of truth, and is never referenced by any page. "Normalized" means resolved objects, not a line-by-line transliteration: claim status already computed, `derived` references resolved to `page#^cN`, Source lines split into fields, wikilinks resolved to slugs or paths, section of origin (`current` / `history` / `open` / `evidence`) recorded per record.

4. **Index freshness is checked lazily on every CLI invocation, not by a resident process.** Each call compares file mtimes against the per-file manifest; on change, compares digests; re-parses only changed files before serving results. This satisfies CLI-001 ("every operation re-verifies authoritative state from persistent files") without a Core Runtime.

5. **One per-file digest manifest, two uses.** Any manifest the CLI keeps for external-change detection (F-007 Write Safety; currently prototyped by experiment task WS-001, PROPOSED) is the same manifest the index uses for invalidation. It is recorded per file, never as a single vault-wide hash, so both uses remain possible. Write-safety work does not need to implement indexing, only to not preclude it.

6. **Level 0 does not depend on the index.** An Agent without the CLI reads Markdown directly, as today. `CONVENTIONS.md` §9 "What is not enforced here" (KF v1.0 §13, item 7) ("what is lost without a Connector") gains one line: without the CLI, the structured index, automatic parsing and efficient retrieval are lost; the knowledge itself is not.

7. **The object model must not become a second specification.** Every field in the object model is either a KF v1.0 field or explicitly marked `computed`/`derived`. Adding a knowledge-level concept to the object model requires a KF revision first (CLI-001 rule, applied internally).

## 2. Why

- The problem the Owner identified is real but lives at the consumption layer, not the storage layer. At Level 1 the CLI parses Markdown and can return structured objects, so the Agent never pays Markdown-parsing cost regardless of the on-disk format. At Level 0 the Format has already been exercised: the Level 0 experiment (`format/experiments/level0/RESULTS.md`, cited in KF v1.0 §15/§18) reports 24/24 Test cells locating and updating the correct claim.
- Reduced dependence on Obsidian CLI is already achieved under Markdown: PR #95 reports Headless multi-path retrieval matching Obsidian multi-path on Recall@10 at lower latency, and SK-001 removed the Obsidian Skills dependency. A storage-format change adds nothing on this axis.
- Separating Model from Serialization gives the real benefit the Owner wanted — operations independent of file syntax — and keeps a future canonical-format change bounded to the input/output layer. It does not make such a change free (human editing path, migration, concurrency and validation would still need solving), but it means the knowledge operations would not have to be rewritten.
- Making the structured index a derived artifact aligns with KF §14 and CLI-001; making it normalized is what gives `search`/`explore`/`inspect` value over grep.

## 3. Alternatives considered

| Alternative | Decision | Reason |
|---|---|---|
| **A. Markdown canonical + derived JSONL index** | **Adopted (this record)** | Smallest change to KF v1.0; captures the consumption benefit; preserves human edit path, git diff reviewability, Obsidian navigation, cross-tool portability. |
| **B. JSONL canonical + Markdown as optional view** | **Not adopted; kept OPEN with reopen conditions (§5)** | Removes the human edit path KF §10 relies on ("a human changes their mind by editing the claim directly"); write-capable Knowledge View in the Plugin would carry write constraints and consistency guarantees, pushing toward the Core Runtime A-003 excludes; loses Markdown's transparency and ecosystem. No evidence yet that Markdown is an engineering obstacle. |
| **C. Markdown and JSONL both authoritative** | **Rejected** | Requires bidirectional sync, conflict resolution and transactions — a self-built runtime. Creates two sources of truth, which CLI-001 forbids. |
| **D. Markdown vs JSONL controlled experiment (R1 parsing tokens / R2 CLI complexity / R3 operations) before deciding** | **Not run** | R1 is not a differentiator once the CLI returns structured objects; R3 is identical on the object model; R2 is answered by implementing the parser, which Alternative A requires anyway. The measurement would not change the decision. Consistent with the CLI-002 Round 2 stop rationale. |

## 4. Consequences for in-flight work

- **CLI Pilot (GR-010):** implementation order `search → inspect → explore`; architecture is parser → object model → index → operations. The parser's real complexity is reported in the Pilot (lines, exception classes handled, behavior on non-conforming input) — this is the R2 evidence.
- **Write safety (F-007; WS-001 prototype):** any change-detection manifest must use per-file digests. No other change.
- **`CONVENTIONS.md`:** one line added to §9 (see §1.6). This is a conventions-page edit, not a KF semantic change; it still goes through the normal review path.
- **Knowledge Format v1.0:** unchanged.

## 5. Open

- **Reopen conditions for Alternative B.** Reopen the discussion (not switch) if, on the real personal vault, either (a) the Owner is observed not to read or edit compiled Wiki pages directly over a sustained period, or (b) the KF Markdown parser grows beyond what a fixed-contract parser should need *and* tightening the Format contract does not resolve it. A switch would additionally require that the benefits demonstrably outweigh the loss of the human edit path and cross-tool portability.
- **Index file layout** (single files vs. sharding by page or type) — decide in the Pilot from observed vault size; not now.
- **Parser complexity** — estimate only; measured in the Pilot.
- **Whether `tags` earns its place in the index** — observe whether `search` needs it on the real vault.

## 6. Status discipline

- §1 items are ACCEPTED as of 2026-11-08. Nothing here authorizes implementation beyond the already-approved Pilot scope (GR-010).
- Figures cited from PR #95 and the Level 0 experiment are as recorded in the repository; this record did not re-run them.
