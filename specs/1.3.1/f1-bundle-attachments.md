# F1 (1.3.1) — Bundle Attachments: Embeds Travel With the Knowledge

- **Status:** Done — maintainer acceptance passed (three rounds on real
  vaults at `d272c24`: modal attachment display + eyes line; post-approval
  image swap → gate refusal, return-to-review, `changed` marker; ambiguity
  callout + disabled Continue; second-vault install renders the image;
  1.3.0 refuses schema v2 with zero writes and still installs v1; zip
  byte-tamper refused naming the file; post-scribble update refused;
  close-modal → resume → export lands in the resumed bundle's own
  directory at its recorded version. 620 tests, lint, build, docs, all
  three evals green)
- **Target release:** 1.3.1
- **Branch:** `cursor/131-f1-bundle-attachments-92eb`
- **Depends on:** the export review gate (0.8 — extended with a third item
  kind), the Windows portability map (1.2.7 — reused for attachment names),
  `VaultFs.readBinary`/`writeBinary` (already shipped on both platforms)

## 1. Problem statement

A knowledge page that says "see the flow below" and embeds `![[flow.png]]`
ships **without the flow**. The export closure walks wikilinks to `.md`
targets only (non-md targets are explicitly dropped), compile emits text
files only, and the pipeline's content type is `string` end to end — a PNG
that somehow entered a zip would be corrupted by the UTF-8 decode + string
write on install. The consumer sees a broken embed and no recourse; the
creator has no signal anything was left behind. This lands *before* 1.4 by
design: multimodal cook intake will multiply attachment references in
compiled pages, and the sharing loop must not greet that with dead links.

## 2. Goals

1. **Discovery** (§4.1): wikilink embeds in *approved* items resolve to
   vault attachment files and join the export closure as first-class scope
   items.
2. **Review** (§4.2): every attachment passes the per-item review gate —
   images are the highest-leak-density artifacts (token-bearing terminal
   screenshots, faces, whiteboards) and no text scanner reads pixels, so
   human eyes are the only gate; the checklist says so and shows sizes.
3. **Emission** (§4.3): approved attachments land in `_attachments/`
   through the 1.2.7 portability machinery; embeds in emitted pages rewrite
   to relative paths; the manifest carries per-file byte hashes and sizes.
4. **The binary lane** (§4.4): bytes survive export → zip → download →
   install byte-identically, and participate in local-modification
   detection on update.
5. **Compatibility without silent corruption** (§4.5): attachment-free
   bundles stay `schemaVersion: 1`, byte-identical to today's output; an
   attachment-bearing bundle declares `schemaVersion: 2`, which every
   older Knowlery **refuses whole at the manifest gate before any write**
   — old versions never corrupt, at the honestly-priced cost of a
   receivers-need-≥1.3.1 boundary. The version↔attachments relationship
   is a schema-enforced invariant, not a convention.

## 3. Non-goals

- **No pixel-level risk scanning** (OCR, face detection, EXIF analysis).
  The gate is human review, stated honestly. (EXIF *stripping* is also out:
  material-untouched applies to bytes — what you approved is what ships.)
- No markdown-syntax image links (`![](path.png)`) in discovery — wikilink
  embeds are the Obsidian-native form and the dominant one; the md-link
  form is recorded as a candidate follow-up, not silently half-supported.
- No attachment support in `capture`/cook/MCP resources — this feature is
  the *sharing* lane only. MCP reads stay md-only (attachments are for
  human rendering, not agent context).
- No hard size cap — informed consent, not a block: sizes are shown per
  item and in total, with a soft warning. A hard cap would train users to
  fight the tool at exactly the moment they are being deliberate.
- No dedup/compression beyond the zip itself.

## 4. Design

### 4.1 Discovery: embeds of approved items

- **Source set**: embeds are collected from items whose review status is
  *approved* — concept pages and raw sources both. A flagged page's
  attachments never enter scope (flagging a page must flag its evidence
  trail with it).
- **Syntax**: wikilink embeds `![[target]]` and `![[target|alias-or-size]]`
  where the target's extension is in the attachment allowlist:
  `png jpg jpeg gif webp svg bmp pdf mp3 wav m4a mp4 webm mov`. The
  `|`-suffix (Obsidian's display size/alias) is stripped before
  resolution. Non-allowlisted embed targets (e.g. `.exe`) are skipped and
  surfaced as a checklist note, never silently included.
- **Resolution**, Obsidian-faithful and headless: exact vault path first,
  then unique-basename match against a non-md file index (built once per
  export from the vault listing). An **ambiguous basename refuses the
  export item with the candidate list** — deterministic, like every other
  refusal in this codebase; the fix-it message says to embed the fuller
  path.
- **Unresolvable embeds** (target doesn't exist) are recorded on the owning
  item as `unresolved` — the existing concept for broken links, extended to
  embeds.

### 4.2 Review: the third item kind

- `ScopeItem` gains `kind: 'attachment'` alongside `concept | raw`. Scope
  state (`.knowlery/export-scope.json`) stores exactly the fields it
  stores for every item today — `status` and **`contentHashAtReview`,
  here computed over the bytes** — a re-exported screenshot that changed
  invalidates its approval exactly like an edited page. No new scope
  fields, no migration.
- **Checklist presentation** (CLI `review --list [--json]` and the Obsidian
  modal): attachments show `[attachment]`, the vault path, the byte size
  (human units), and which approved item(s) embed them. A fixed line
  carries the honest limitation: *"binary content — no scanner reads
  pixels; review with your eyes."* The JSON shape adds items with the new
  kind and a `bytes` field (additive keys — minor under the contract).
- **Approval discipline unchanged**: per-item approve/flag, no approve-all
  flag, agent conduct (present the full list verbatim) inherits — the
  knowlery-cli skill's review-conduct section gains one line naming
  attachments.
- **Size line**: the checklist footer prints total attachment bytes;
  a soft warning above **20 MB** total ("large bundle — consider flagging
  heavyweight media"). No block.

### 4.3 Emission: `_attachments/` through the portability machinery

- Approved attachments are emitted flat under `_attachments/`, names
  passed through the 1.2.7 sanitizer (`sanitizePortableSegment` — reserved
  characters, device names, trailing dots/spaces) with the same
  deterministic hash-suffix collision handling
  (`buildPortableSourcePathMap` generalized to a second root). Flat + a
  collision map is simpler and more portable than mirroring vault
  directory trees.
- **Embed rewriting, depth-aware**: the wikilink converter already
  computes relative hrefs from the embedding file's own directory
  (`relativeLinkPath`); attachments ride the same computation. A page at
  `concepts/foo.md` embedding `flow.png` emits
  `![flow](../_attachments/flow.png)`; a nested source copy at
  `_sources/Idea/note.md` emits `../../_attachments/flow.png` — **never**
  a bare `_attachments/...`, which would only resolve from the bundle
  root. Obsidian renders relative image links natively. Unapproved
  attachment embeds degrade exactly like unapproved page links today:
  original wikilink text + an `unresolved` note.
- **Raw-source copies get an embed-rewrite pass** — a gap the current
  pipeline would otherwise ship: `convertWikilinks` covers knowledge
  pages only, and `_sources/` copies are emitted verbatim, so their
  `![[flow.png]]` would arrive broken in every consumer vault. Approved
  raw copies now pass through an attachment-embed rewriter (attachment
  embeds only — page wikilinks in raw copies keep today's behavior,
  unchanged scope). This is consistent with material-untouched: the
  vault's originals are never edited; `_sources/` copies are already
  transformed artifacts (1.2.7 renames them for portability), and a copy
  that ships broken embeds serves nobody.
- **Manifest** (`knowlery-bundle.json`): the version↔attachments
  relationship is a **schema-enforced discriminated invariant**, not an
  optional field that happens to correlate:

  ```ts
  z.discriminatedUnion('schemaVersion', [
    z.object({
      schemaVersion: z.literal(1),
      // z.object() strips unknown keys silently — without this line a
      // v1 manifest carrying attachments would parse and drop the field
      // (review probe confirmed). Explicit never > .strict(): it forbids
      // exactly this key while keeping tolerance for unrelated future keys.
      attachments: z.never().optional(),
      /* today's fields */
    }),
    z.object({ schemaVersion: z.literal(2), attachments: z.array(AttachmentRecord).nonempty(), /* + today's fields */ }),
  ])
  ```

  Version 1 with an `attachments` key **fails to parse** (enforced by the
  `z.never().optional()` line — not by default `z.object()` behavior,
  which strips unknown keys); version 2 without a non-empty one **fails
  to parse** — a merely-optional field on an accepted 1–2 range could
  quietly recreate the very corruption path §4.5 closes. The §5.8
  negative pair must exercise the real shipped `BundleManifestSchema`,
  not a test-local re-declaration. `AttachmentRecord = { path, bytes,
  sha256 }`. The existing `contentHash` computation is **untouched**
  (md-only); attachment integrity rides the per-file hashes.

### 4.4 The binary lane

The FS layer already has it (`VaultFs.readBinary`/`writeBinary`, both
platforms); the gaps are the pipeline types:

- `BundleFile`/`BundleSourceEntry` become a **discriminated union that
  makes "exactly one payload" unrepresentable rather than aspirational**:
  `{ content: string; bytes?: never } | { bytes: Uint8Array;
  content?: never }` — an optional `bytes` beside a required `content`
  cannot express a binary-only entry, and a both-set entry must not
  typecheck. Text entries are the md lane; byte entries are the
  attachment lane.
- **Zip**: write path already streams Buffers; the read path
  (`readBundleEntries`) decides by extension — `.md` and the known text
  files decode as UTF-8, everything else stays bytes. Directory sources
  read the same way.
- **Compile** writes attachment entries via `writeBinary`.
- **Install verifies before it writes** — emitted hashes that nobody
  checks are decoration. Before any write, every byte entry must match a
  manifest `attachments` record on all three of path, size, and sha256,
  **and** every manifest record must have its entry present. Any
  mismatch, any unlisted binary in the archive (no smuggling entries the
  reviewer never saw), any listed-but-missing file → refusal with a new
  `InstallBlockedError` reason `attachment-integrity`, naming the file
  and which check failed, workspace untouched. This sits beside the
  version and conformance gates and is not skippable —
  `--skip-conformance` and `--acknowledge-risks` consent to *known*
  defects and *reviewed* content; a hash mismatch is tampering or
  corruption, and there is no informed consent to that.
- Byte entries are written via `writeBinary` (same
  `assertSafeInstallPath` on every entry — the containment argument is
  path-based and already covers them); conformance, the instruction-like
  risk scan, and the query scanner remain md-only by construction.
- **Registry**: `fileHashes` gains attachment entries (same
  `record<string,string>` shape, more keys — no schema change), so `bundle
  update`'s local-modification detection covers attachments: a consumer
  who annotated a shipped diagram gets the same protective refusal as an
  edited page.

### 4.5 Compatibility: a conditional schema bump, not a false promise

The first draft promised old versions would "skip what they don't know" —
**that promise was false**: pre-1.3.1 install decodes every entry as
UTF-8 and writes it as a string, so an attachment-bearing bundle would
install with **silently corrupted** binaries and no warning. Silent
corruption is the one outcome this codebase never accepts, so the fix is
refusal, priced honestly:

1. **Attachment-bearing bundles declare `schemaVersion: 2`.** Pre-1.3.1
   manifest parsing pins `schemaVersion: z.literal(1)`, so every older
   version **refuses the whole bundle at the manifest gate, before any
   write** — with its generic "Not a valid knowledge bundle" message. We
   cannot retro-improve old versions' wording; we can guarantee they
   corrupt nothing. The 1.3.1 release notes carry the consumer-facing
   sentence ("sharing bundles with attachments requires receivers on
   ≥ 1.3.1").
2. **Attachment-free bundles keep `schemaVersion: 1`** and are
   **byte-identical** to today's output (no `_attachments/`, no manifest
   field, same schema line) — the overwhelmingly common case loses
   nothing, and the bump prices exactly the bundles that need it.
3. New Knowlery accepts both versions; installing old bundles changes
   nothing.
4. Under the stability contract this is additive for readers (1.3.1
   accepts a superset) and a **deliberate, documented compatibility
   boundary for old readers of new attachment-bearing bundles** — the
   honest cost of preventing silent corruption; minor version, format
   contract test extended.

## 5. Safety properties, restated as tests

1. **Discovery**: embed with `|300` size suffix resolves; ambiguous
   basename refuses with candidates; missing target → `unresolved` on the
   owner; non-allowlisted extension skipped with a note; attachments of a
   *flagged* page never enter scope.
2. **Review**: attachment approval records a byte hash; changing the file
   invalidates it (`<- changed` like pages); checklist JSON carries kind
   and bytes; the 20 MB soft warning fires on a synthetic large set.
3. **Byte integrity, positive and negative**: export → zip →
   readBundleEntries → install round-trips a PNG-shaped byte pattern
   (incl. bytes invalid as UTF-8) **hash-identical**; the installed
   file's sha256 equals the manifest entry. Then the tampering suite —
   one flipped byte in an attachment, a size mismatch, an archive binary
   absent from the manifest list, a manifest record with no matching
   entry — **each refuses with reason `attachment-integrity` naming the
   file, before any write** (workspace byte-identical after refusal),
   and neither `--skip-conformance` nor `--acknowledge-risks` unlocks
   it.
4. **Link depth**: the emitted embed from `concepts/foo.md` reads
   `../_attachments/…`; from a nested `_sources/Idea/note.md` it reads
   `../../_attachments/…`; both resolve when the bundle tree is walked
   from the file's own directory (asserted by path resolution, not
   string-matching alone).
5. **Raw-source rewrite**: an approved source note embedding an approved
   attachment ships with its embed rewritten; its page-wikilinks are
   byte-unchanged from today's copy output.
6. **Portability**: an attachment named with a Windows-reserved character
   sanitizes; the embed in the emitted page points at the sanitized name;
   collision between two sanitized names gets the deterministic suffix.
7. **Containment**: a hostile entry `_attachments/../../evil.png` refuses
   before any write (existing assertion, now exercised with a bytes
   entry).
8. **Compatibility both ways, invariant enforced**: attachment-free
   export byte-identical to pre-change output including
   `schemaVersion: 1` (fixture diff); attachment-bearing manifest
   carries `schemaVersion: 2` and **fails the pre-1.3.1 schema**
   (asserted by parsing it with `z.literal(1)` — the exact refusal old
   versions execute); new code parses both valid forms; installed
   registry entry for an attachment-free bundle is unchanged. **Negative
   pair for the discriminated invariant**: a version-1 manifest carrying
   an `attachments` key fails to parse, and a version-2 manifest with a
   missing or empty `attachments` array fails to parse — the invariant
   is the schema's, not a convention's.
9. **Update path**: locally-modified attachment blocks `bundle update`
   with the file listed; unmodified updates flow through.
10. **Contract**: format-contract test extended for the schemaVersion
    rules and the discriminated `attachments` invariant (forbidden in
    version 1, required non-empty in version 2); CLI/MCP goldens
    untouched.

## 6. Acceptance criteria

1. §5 green; `npm test`, lint, build, docs:build, all three evals green.
2. A real vault page embedding a real image exports, publishes, installs
   in a second vault, and **renders** in Obsidian reading mode.
3. Maintainer §7 passes.

## Implementation findings

1. **The binary lane was a typing job, as predicted**: `VaultFs.readBinary`
   / `writeBinary` already existed on both platforms; every change was in
   the pipeline's types and the zip/compile/install seams. The OKF test
   mock's `writeBinary` is a lossy string-decode, so the attachment suite
   runs on real temp-dir vaults — with invalid-UTF-8 canary bytes that a
   lossy round trip cannot reproduce.
2. **Attachment resolution is index-based on both shells** — deliberately
   not Obsidian's `metadataCache`, so export behavior is byte-identical
   cross-shell and ambiguity is a deterministic refusal (candidate list +
   embed-the-fuller-path fix-it) rather than a shell-dependent guess.
3. **`|300` display suffixes become the markdown label** (`![300](…)`):
   Obsidian's display-size syntax has no md-link equivalent, so the size
   hint is lost while the image renders correctly — expected degradation,
   same class as heading-fragment links.
4. **All 595 pre-existing tests passed unchanged** before the 18 new ones
   were added — the §4.5 compatibility promises (v1 byte-identical,
   goldens untouched) held without edits to any existing test.
5. **Gate ordering under a listed-and-hashed hostile path**: an entry at
   `_attachments/../../evil.png` whose manifest record is *correct* passes
   the integrity gate and is then refused by the containment assertion —
   tested (§5.7's extension), so the two gates compose rather than mask
   each other.
6. **Ambiguity refuses at export, not at review**: the checklist stays
   viewable (the fix is editing the embed, not reviewing), and
   `bundle export` refuses with the candidate list before the unreviewed
   gate.
7. **Acceptance round found the modal compiling from stale React state** —
   the exact hole the byte-hash invalidation exists to close: approve, let
   the file change while the modal sits open, and compile would ship
   unreviewed bytes with matching manifest hashes. Fixed with a **shared
   pre-export gate** (`evaluateExportGate`, pure, in core): both shells
   flush review state, rebuild the closure fresh (recomputed hashes revert
   changed approvals), and compile **from the gate's approved sets, never
   from UI state**. The same gate carries ambiguity blocking to the modal
   (it only lived in the CLI), and the modal now renders
   missing/unsupported embed notes. Also from the round: the
   `attachment-integrity` refusal no longer falls through to the
   `--skip-conformance` hint (it says the gate cannot be skipped), and the
   knowlery-cli skill's review conduct names attachments, byte sizes, and
   the eyes-only limitation (content-asserted; plugin tree regenerated).

8. **Acceptance round 2 moved the gate into `compileScope` itself**: the
   publish path checked unreviewed items but skipped the ambiguity refusal
   — a reviewed scope with an ambiguous embed could be zipped and
   released. The gate is now enforced at the compile choke point (every
   caller — export, publish, future ones — inherits the refusal; callers
   with richer UX refuse earlier with better output), with a regression
   test proving `gh` is never invoked. Also from the round: a failed
   modal gate returns to the review phase (`setPhase('scope')`) with the
   fresh `changed` markers visible, and the modal's copy/button now match
   the stricter gate — every item needs a decision before export;
   Continue disables on unreviewed items or ambiguous embeds.

9. **Acceptance round 3 caught the resume flow writing into the wrong
   directory**: `resumeBundle()` restored only id/title, leaving
   version/targetDir derived from the *default* bundle id — a resumed
   `creator.acceptance.f1` exported into
   `creator.my.knowledge.base-0.1.0`, and `overwrite: true` could clobber
   that bundle's export. Fixed with shared derivations in core
   (`exportTargetDir`, `resumeExportDefaults`): resume restores version
   from the saved `lastVersion` and the target dir from the resumed id;
   the CLI's `compileScope` uses the same derivation; editing the Bundle
   id in the confirm form now re-derives the target too (same staleness
   class). Regression pinned at the derivation: export at 0.3.0 → read
   the scope back ("close the modal") → resume defaults equal the
   recorded target dir, never the default bundle's.

## 7. Maintainer self-test checklist (acceptance round)

1. In a real vault: embed an image in a knowledge page, export — the
   attachment appears in the checklist with its size and the
   review-with-your-eyes line; approve; the zip contains `_attachments/`;
   install into a second vault; the page renders the image in Obsidian.
2. Flag the image instead — the bundle ships without it and the page shows
   the degraded embed text.
3. Edit the image after approval (re-screenshot) — export refuses with
   `<- changed`.
4. Install the same bundle with the previous Knowlery release (1.3.0) —
   it must **refuse at the manifest gate** (generic "not a valid
   knowledge bundle" message) with nothing written; then install an
   attachment-free bundle with 1.3.0 — works exactly as before.
5. Tamper with one byte of an attachment inside the zip — install
   refuses naming the file; nothing written.
6. `bundle update` after scribbling on an installed attachment — the
   protective refusal names the file.
7. Full suites green.
