# F1 (0.9.0) — Remote Install: `knowlery bundle install <url>`

- **Status:** Accepted 2026-07-07 — implemented; automated acceptance passed, awaiting manual §7 (private release + Obsidian modal)
- **Target release:** 0.9.0
- **Branch:** `cursor/09-plan-92eb` (plan + spec + implementation ride one PR,
  0.8 F1 precedent)
- **Depends on:** 0.7 F4 (install pipeline), 0.9 plan (distribution model,
  no-`gh` degradation — both binding)

## 1. Problem statement

Since 0.7.0, installing a bundle requires the artifact to already be a local path —
the last mile of sharing is "get the zip onto the receiver's disk yourself" (IM
attachment, AirDrop, shared drive). For one-to-many sharing and for anything an
agent does unattended, the natural unit of exchange is a URL. Every piece of the
pipeline after the bytes arrive already exists and is gate-complete; F1 is
deliberately *only* the bytes-arrival step, done in a way that F3
(update/subscription) can build on: the registry's existing `source` field starts
carrying a re-fetchable URL instead of a dead local path.

## 2. Goals

```
knowlery bundle install <zip-or-folder-or-url> [--dir <vault>] [--verify <sha256-hex>]
                                               [--force] [--skip-conformance]
```

1. `install` accepts an `https://` (or, for LAN hosting, `http://` with a
   plaintext warning) URL to a bundle zip: download to a temp file, then run the
   **identical** local pipeline (`readBundleEntries` → preview → gates → install).
2. GitHub Release asset URLs from **private** repos work via the receiver's own
   `gh` (automatic fallback when the anonymous fetch is refused); without `gh`,
   print the browser-download + local-install guidance (plan: `gh` is an
   accelerator, never a prerequisite).
3. `--verify <sha256-hex>` checks the downloaded bytes before anything is parsed;
   a sharer can post the hash next to the link.
4. The registry entry's `source` field records the URL (today it records the local
   path) — the seam F3's `check-updates` reads. No schema change: the field exists.
5. Plugin parity: the install modal's file picker gains a URL input running the
   same core path.

## 3. Non-goals

- No update checking or re-install-from-source — that is F3, F1 only records the
  seam.
- No auth beyond `gh` delegation: no tokens, no basic-auth URLs (credentials
  embedded in URLs are refused with an explanatory error, not silently used).
- No remote *folder* sources — remote means "a zip at a URL"; folder install stays
  local-only.
- No mirror/fallback URL lists, no resume of interrupted downloads (bundles are
  small; a failed download is simply retried).
- No changes to any gate. Remote artifacts pass the exact conformance / version /
  path-safety pipeline local ones do — by construction, since the pipeline runs on
  the downloaded temp file through the same entry point.

## 4. Design

### 4.1 URL detection and download

`main.ts` currently resolves install's positional against the caller's cwd; a
`https?://` argument skips resolution and flows to the new download step:

- Fetch with node's global `fetch` (CLI targets node ≥ 18), redirects followed
  (GitHub asset URLs 302 to storage). Response bytes stream to
  `<os.tmpdir()>/knowlery-remote-<random>/bundle.zip`; the temp dir is removed in
  a `finally`, so a failed download or a refused gate leaves no partial state
  anywhere.
- `http://` (no TLS) proceeds — the plan's LAN scenario — but prints a one-line
  plaintext-transport warning. `--verify` composes well here and the warning says
  so.
- Non-2xx → a clear error naming the status; the GitHub-shaped 404 case goes to
  §4.2 instead. No size cap in v1 (bundles are text; a cap is speculative
  validation), no content-type checks (hosts mislabel).

### 4.2 Private GitHub sources: the `gh` tier

When the URL matches the GitHub release-asset shape
(`github.com/<owner>/<repo>/releases/download/<tag>/<file>`) **and** the anonymous
fetch is refused (GitHub answers 404 for unauthorized private assets — it does not
reveal 401/403), the CLI:

1. If `gh` is on PATH: runs
   `gh release download <tag> --repo <owner>/<repo> --pattern <file> --dir <tmp>`
   and continues with the downloaded file. One informational line states the
   fallback was used ("anonymous fetch refused — retrieved via your gh login").
2. If `gh` is absent or itself fails: exits 1 with the no-`gh` degradation
   guidance — open the URL in the browser (the session is the credential),
   download, then `knowlery bundle install <local-zip>`; plus the one-line `gh`
   install hint for next time.

The fallback never runs for non-GitHub URLs (their 404 is just a 404), and never
runs when the anonymous fetch succeeded — public repos stay `gh`-free end to end.

### 4.3 `--verify`

Accepts `sha256-<64 hex>` or bare hex; compares against the SHA-256 of the
downloaded file bytes **before** `readBundleEntries` touches them; mismatch aborts
with both hashes printed. Works for local files too (free, and useful for
forwarded zips). Registry keeps recording `installedContentHash` as today —
`--verify` is transport integrity, not a replacement for the content hash.

### 4.4 Source recording

`installBundle` already persists `source`; the CLI passes the original URL (not
the temp path) so the registry reads e.g.

```json
"jay.drone-delivery": { "source": "https://github.com/jay/kb-bundles/releases/download/v1.2.0/...zip", ... }
```

F3 will treat any `https?://` source as re-fetchable and everything else as
file-installed. `bundle list` prints the source domain for URL installs (full URL
in `--json`).

### 4.5 Plugin parity

The install modal gains a URL text input beside the existing file picker; entering
a URL calls the same download helper (plugin is desktop-only; node's fetch/fs are
available) and feeds the staged file through the modal's existing preview/confirm
flow. `gh` fallback and guidance render in the modal (reusing the detect-and-guide
pattern). Kept deliberately thin — one input, same core.

### 4.6 Skill update

`knowlery-cli` skill: install row of the command table gains the URL form,
`--verify` conduct (if the user provided a hash, pass it; never fabricate one),
and the private-source degradation path.

### 4.7 Docs chapter (plan: documentation is a gated deliverable)

This PR opens the docs site's **"Sharing Knowledge"** section (sidebar entry under
"Use Knowlery", English + `zh/`) with its receiving-side chapters: *Install from a
URL* (public / private / `--verify`, the no-`gh` browser path) and the
troubleshooting page seeded with the defining confusion — *"the link 404s" = no
access, not a broken link*. Publish/subscribe chapters land with F2/F3.

## 5. Safety properties, restated as tests

1. **Same gates, remote or local**: a zip with a path-safety violation (or failing
   conformance) served over HTTP is refused with the same error as the identical
   local zip; nothing lands in `Library/`.
2. **Verify-before-parse**: with a wrong `--verify`, the zip is never unzipped and
   no vault write occurs; error names both hashes.
3. **No partial state**: after a mid-download failure (server closes early) and
   after any refused gate, the temp dir is gone and the vault untouched.
4. **Plaintext warning**: `http://` prints the warning; `https://` does not.
5. **`gh` scoping**: fallback triggers only for GitHub-shaped URLs after a refused
   anonymous fetch; a non-GitHub 404 errors plainly; a public-repo install works
   with `gh` absent from PATH entirely.
6. **Source seam**: after a URL install the registry `source` is the original URL;
   after a local install it remains the local path (unchanged behavior).

Test mechanics: a loopback `http.createServer` serving fixture zips (success,
wrong bytes for verify-mismatch, connection-drop) — no network in CI; the `gh`
path is covered by a stub `gh` executable prepended to PATH in the test, plus the
absent-`gh` guidance text asserted. Smoke test extends with a served-zip install
on the built artifact.

## 6. Acceptance criteria

1. §5 tests all pass; existing install tests unmodified (local path behavior
   byte-identical).
2. `bundle list` shows source provenance; `--json` carries the full source.
3. Skill content assertions updated (URL form, verify conduct, degradation path).
4. Docs: "Sharing Knowledge" section exists in both locales with the
   install-from-URL chapter and the seeded troubleshooting page (§4.7);
   `npm run docs:build` green.
5. `npm test`, lint, build, eval `--assert-baseline` green.
6. Plugin modal URL input works against the same core (maintainer-verified, §7).

## 7. Maintainer self-test checklist (acceptance round)

1. Export a real bundle (0.8 flow), upload the zip as a GitHub Release asset in a
   **private** repo; `knowlery bundle install <asset-url>` on a second machine or
   scratch vault — watch the `gh` fallback line; then temporarily `gh auth logout`
   (or rename `gh`) and re-run to see the browser-download guidance.
2. Make the repo public; re-install with `gh` renamed away — anonymous path works.
3. `--verify` with the correct hash, then with one hex digit changed — the latter
   must refuse before unzipping.
4. In Obsidian: install the same URL through the modal's new URL input.
5. `npm test && npm run eval -- --assert-baseline` — green.
