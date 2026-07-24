# F1 (1.3.1) — Bundle Attachments: Embeds Travel With the Knowledge

- **Status:** Draft — awaiting maintainer spec acceptance
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
5. **Backward/forward compatibility** (§4.5): attachment-free bundles are
   byte-identical to today's output; old Knowlery versions install
   attachment-bearing bundles without corruption (they skip what they don't
   know); the bundle-format change is additive under the 1.0 contract.

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
  state (`.knowlery/export-scope.json`) stores it like any item: status,
  reviewedAt, and **`contentHashAtReview` computed over the bytes** — a
  re-exported screenshot that changed invalidates its approval exactly like
  an edited page.
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
- **Embed rewriting**: the wikilink converter already rewrites approved
  targets to relative markdown links preserving the embed `!`; it gains
  the attachment map, so `![[flow.png]]` in an emitted page becomes
  `![flow](_attachments/flow.png)` (relative from the page's own
  directory) — Obsidian renders relative image links natively. Unapproved
  attachment embeds degrade exactly like unapproved page links today:
  original wikilink text + an `unresolved` note.
- **Manifest** (`knowlery-bundle.json`) gains one **optional** field:
  `attachments: [{ path, bytes, sha256 }]`. The existing `contentHash`
  computation is **untouched** (md-only, backward compatible); attachment
  integrity rides the per-file hashes. Absent field ≡ no attachments —
  today's bundles parse unchanged.

### 4.4 The binary lane

The FS layer already has it (`VaultFs.readBinary`/`writeBinary`, both
platforms); the gaps are the pipeline types:

- `BundleFile`/`BundleSourceEntry` gain an optional `bytes?: Uint8Array`;
  `content: string` remains the md lane. Exactly one of the two is set.
- **Zip**: write path already streams Buffers; the read path
  (`readBundleEntries`) decides by extension — `.md` and the known text
  files decode as UTF-8, everything else stays bytes. Directory sources
  read the same way.
- **Compile** writes attachment entries via `writeBinary`.
- **Install** writes byte entries via `writeBinary` (same
  `assertSafeInstallPath` on every entry — the containment argument is
  path-based and already covers them); conformance, the instruction-like
  risk scan, and the query scanner remain md-only by construction.
- **Registry**: `fileHashes` gains attachment entries (same
  `record<string,string>` shape, more keys — no schema change), so `bundle
  update`'s local-modification detection covers attachments: a consumer
  who annotated a shipped diagram gets the same protective refusal as an
  edited page.

### 4.5 Compatibility, stated as promises

1. A bundle exported with zero attachments is **byte-identical** to
   today's output (no empty `_attachments/`, no manifest field).
2. Old Knowlery versions installing an attachment-bearing bundle: the
   manifest's unknown field is ignored by the schema (verify: current
   parse must not `.strict()` the manifest — checked at implementation;
   if it does, this is the compatibility note in the release notes),
   attachments decode as garbage strings **but** the md knowledge
   installs correctly. Not corrupted silently: recorded as a known
   limitation ("update Knowlery to render shipped attachments").
3. New Knowlery installing old bundles: nothing changes.
4. The format change is additive → **minor version (1.3.1)** under the
   stability contract; the format-contract test extends, no golden
   changes.

## 5. Safety properties, restated as tests

1. **Discovery**: embed with `|300` size suffix resolves; ambiguous
   basename refuses with candidates; missing target → `unresolved` on the
   owner; non-allowlisted extension skipped with a note; attachments of a
   *flagged* page never enter scope.
2. **Review**: attachment approval records a byte hash; changing the file
   invalidates it (`<- changed` like pages); checklist JSON carries kind
   and bytes; the 20 MB soft warning fires on a synthetic large set.
3. **Byte integrity**: export → zip → readBundleEntries → install
   round-trips a PNG-shaped byte pattern (incl. bytes invalid as UTF-8)
   **hash-identical**; the installed file's sha256 equals the manifest
   entry.
4. **Portability**: an attachment named with a Windows-reserved character
   sanitizes; the embed in the emitted page points at the sanitized name;
   collision between two sanitized names gets the deterministic suffix.
5. **Containment**: a hostile entry `_attachments/../../evil.png` refuses
   before any write (existing assertion, now exercised with a bytes
   entry).
6. **Compatibility**: attachment-free export byte-identical to pre-change
   output (fixture diff); manifest without the field parses; installed
   registry entry for an attachment-free bundle is unchanged.
7. **Update path**: locally-modified attachment blocks `bundle update`
   with the file listed; unmodified updates flow through.
8. **Contract**: format-contract test extended for the optional manifest
   field; CLI/MCP goldens untouched.

## 6. Acceptance criteria

1. §5 green; `npm test`, lint, build, docs:build, all three evals green.
2. A real vault page embedding a real image exports, publishes, installs
   in a second vault, and **renders** in Obsidian reading mode.
3. Maintainer §7 passes.

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
   knowledge pages install and work; note what happens to the attachment
   files (the recorded limitation).
5. `bundle update` after scribbling on an installed attachment — the
   protective refusal names the file.
6. Full suites green.
