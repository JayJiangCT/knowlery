# F2 (0.9.0) — Publish Flow: `knowlery bundle publish`

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.9.0
- **Branch:** `cursor/09-f2-publish-92eb`
- **Depends on:** 0.8 F1 (export + review gate), 0.9 F1 (remote install — the
  consumer of what this produces), 0.9 plan (publisher-side configuration,
  public-exposure safety, no-`gh` degradation, org topology — all binding)

## 1. Problem statement

F1 taught vaults to install from URLs; nothing yet helps an owner *produce* those
URLs. Today "publish" means: export with `--zip`, find the zip on disk, open
GitHub, create a release, upload, work out the asset URL, remember to tell people
whether they can actually reach it. Every step is manual, undocumented, and — for
the public case — unguarded: the export review happened in a "share with
colleagues" mindset, and no tooling distinguishes that from "expose to the
permanent public internet".

F2 makes publishing one deliberate command with proportionate guardrails, per the
four binding plan sections.

## 2. Goals

```
knowlery bundle publish <seed> [--dir <vault>] [--repo <owner/name>] [--public]
                        [--acknowledge-risks] [--force]
```

1. **One command from reviewed scope to shareable URL**: re-runs the same closure
   and review gate as `export` (unreviewed items → the same checklist, exit 1),
   compiles + zips, creates a GitHub Release via the owner's `gh`, and prints the
   asset URL **with its sha256** (pairing with F1's `--verify`) and the
   **audience statement** — who can install this, and how to grant access.
2. **Publisher-side configuration**: target repo remembered per bundle in
   `export-scope.json` (`publish: { repo, visibility }`); first publish takes
   `--repo` or prompts; missing repos offer `gh repo create --private` after
   confirmation. The vault itself is never git-touched.
3. **Default-private posture with a second gate**: without `--public`, the target
   is (created) private. `--public` triggers the second gate: every **approved
   item carrying risk hints** is re-listed and must be re-acknowledged
   (interactive confirmation, or the explicit `--acknowledge-risks` flag for
   non-TTY use — which the skill forbids agents to pass without the user's stated
   consent). The irreversibility of public publishing is stated in the
   interaction itself.
4. **Credential-pattern risk scanning**: the risk scanner (which already feeds
   both the export checklist and this second gate) learns high-cost patterns —
   API-key shapes (`ghp_`/`github_pat_`/`sk-`/`AKIA…`/`xox…`), private IPv4
   ranges, and CN mobile-number shapes. Regex-only, explainable, tuned
   conservative (a missed secret is bad; training users to ignore warnings is
   worse).
5. **No-`gh` degradation**: without a usable `gh`, publish exits 1 with the
   guided manual web release — every value precomputed (zip path, `releases/new`
   URL, suggested tag, the sha256 to post) — producing an artifact
   indistinguishable from a `gh`-published one.
6. **Plugin parity**: the export modal's result phase gains "Publish to GitHub"
   using the same per-bundle config and the same core; public destinations render
   the same second gate (risk list + explicit acknowledgment) in the modal.
7. Skill + docs: publish conduct for agents; the "Publish" and "Grant access"
   chapters of the Sharing Knowledge docs section (en + zh).

## 3. Non-goals

- No update/subscription mechanics (F3).
- No non-GitHub publish targets in v1 (any static host still works manually; the
  guided flow is GitHub-only where `gh` gives us leverage).
- No release-notes authoring — the release body is generated (bundle title,
  version, concept count, sha256, install command); owners can edit on GitHub.
- No deletion/unpublishing command — for private shelves it's a GitHub operation;
  for public, pretending deletion un-exposes content would be dishonest.
- No vault git operations, ever (plan).

## 4. Design

### 4.1 Publish pipeline

`bundle publish <seed>` resolves the bundle exactly like `export` (same seed →
bundle-id derivation, same persisted scope), then:

1. **Review gate** — identical reuse of the export closure check: any unreviewed
   item prints the checklist and exits 1. Publish never weakens the gate; it
   *extends* it for public targets.
2. **Compile + zip** — the export compile path with `--zip`, into the standard
   exports dir. Version comes from the scope's last export options
   (`--bundle-version` stays an export-time concern; publish re-uses it).
3. **Target resolution** — `publish.repo` from the bundle's scope entry, else
   `--repo`, else prompt (TTY) / instructive error (non-TTY). Persisted back with
   the visibility that ends up in effect.
4. **Preflight** — `gh` present + `gh auth status` ok, else §4.5 degradation.
   Repo exists (`gh repo view`) else offer `gh repo create <repo> --private`
   (confirmation required; `--public` does *not* flow into repo creation — a
   public *repo* is a bigger decision than a public *release* and is left to the
   owner on GitHub).
5. **Second gate** (public target only — §4.3).
6. **Release** — tag `<bundle-id>-v<version>` (multi-bundle shelves need the id
   prefix), title `"<title> v<version>"`, generated notes including the sha256
   and a copy-ready `knowlery bundle install <url> --verify sha256-…` line, the
   zip as the asset. If the tag already exists: refuse ("this version is already
   published — bump the version at export, or --force to replace the asset").
7. **Audience statement** — from `gh repo view --json visibility,owner`:
   - private + org owner → "installable by members with read access to
     `<org>/<repo>`" (org shelf recipe linked)
   - private + user owner → "only you and collaborators — invite:
     `<repo-url>/settings/access`"
   - public → "anyone with the link"
   plus the asset URL and sha256 — the message the owner forwards is complete.

### 4.2 Configuration schema

`ExportScopeFile` bundles gain an optional
`publish: { repo: string; visibility: 'private' | 'public' }`. Written on first
successful publish; `--repo` on a later run switches shelves (persisted);
visibility records what was last in effect so the modal and CLI render consistent
defaults. Schema stays `schemaVersion: 1` — the field is optional and old files
parse unchanged.

### 4.3 The second gate (public targets)

Runs after the review gate, before any `gh release` call:

1. Recompute risk hints over the approved scope (same `scanRisks`, now including
   §4.4 patterns).
2. If any **approved** item carries hints: list every such item with its hints
   verbatim, state *"a public release is permanent — caches, mirrors, and
   crawlers retain it even if deleted"*, and require confirmation: interactive
   `publish` phrase on a TTY, or the `--acknowledge-risks` flag. Without it:
   exit 1, nothing published.
3. If no approved item carries hints, the irreversibility statement still prints
   with a y/N confirmation (TTY) or proceeds with `--public` alone (non-TTY) —
   the flag itself is the deliberate act.

The gate is per-publish, not remembered: consenting once does not silence the
next version's scan (content changes; so do risks).

### 4.4 Credential patterns in `scanRisks`

New `RiskHint` kinds (enum extension — the modal and checklist render kinds
generically, so both surfaces pick these up automatically, including at *export*
review time, which is earlier and better):

- `credential`: `ghp_[A-Za-z0-9]{36,}`, `github_pat_[A-Za-z0-9_]{22,}`,
  `sk-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`, `xox[bpars]-[A-Za-z0-9-]{10,}`,
  `-----BEGIN [A-Z ]*PRIVATE KEY-----`
- `private-ip`: `10.`, `192.168.`, `172.16-31.` dotted quads (word-bounded)
- `phone-number`: CN mobile shape `1[3-9]\d{9}` (word-bounded; conservative —
  generic international patterns false-positive too aggressively; recorded as a
  known limitation rather than guessed at)

### 4.5 No-`gh` degradation

Exit 1 with the complete manual checklist: the zip's absolute path, the target's
`releases/new` URL (or `github.com/new` + "create it **private**" when the repo
is missing), the suggested tag, the sha256 to post next to the link, and the
one-line `gh` install hint. Values precomputed; the resulting release is
indistinguishable from a `gh`-published one (F1 installs it identically).

**Decision point (from the plan, for this spec's review):** should the plugin's
setup wizard also offer confirmed `gh` installation alongside its existing
optional tools? CLI-side stays detect-and-guide regardless. My recommendation:
defer — publish is new, evidence about where owners actually get stuck should
drive wizard changes.

### 4.6 Plugin parity

Export modal result phase: a "Publish to GitHub" panel — repo field (prefilled
from config), private/public choice (private preselected), the same second gate
rendered as the risk list + an explicit acknowledgment checkbox, then the
audience statement + copyable install command on success. Shells out to the same
`gh`; missing `gh` renders the §4.5 checklist with copy buttons. Core publish
logic lives in `src/core/okf/publish.ts` (pure node, injectable `gh` runner —
same pattern as `remote-source.ts`) so both shells share it verbatim.

### 4.7 Skill conduct

`knowlery-cli` skill gains publish conduct: restate the destination and its
visibility before running; present the second-gate risk list to the user
verbatim; never pass `--public` or `--acknowledge-risks` unless the user
explicitly said so; after publishing, relay the audience statement and the
install+verify line exactly.

### 4.8 Docs

Sharing Knowledge section grows "Publish a bundle" and "Grant access" chapters
(en + zh): the org-shelf recipe as the team default, personal-repo collaborator
flow, the public path with its second gate explained, the manual no-`gh` path,
and the audience table. The journey overview's placeholder for publish is
replaced with real links.

## 5. Safety properties, restated as tests

1. Unreviewed scope → publish exits 1 with the checklist; no `gh` invocation at
   all (runner spy).
2. Public target with risk-hinted approved items and no acknowledgment → exit 1
   listing those items; no release call. With `--acknowledge-risks` → proceeds
   and the acknowledgment is itemized in output.
3. Private is the default: no `--public`, no visibility config → the created repo
   is `--private`; the release call carries no public toggle.
4. Existing tag → refused without `--force`; no asset overwritten.
5. Credential patterns: each §4.4 shape is detected (fixture pages) and each
   appears in the *export* checklist too, not only at publish time.
6. No-`gh`: the checklist contains the real zip path, correct `releases/new` URL,
   suggested tag, and the zip's actual sha256; exit 1; nothing else happened.
7. Config round trip: first publish persists `publish.repo`/`visibility`; second
   run needs no `--repo`; `--repo` switch re-persists.
8. Audience statement matches visibility/owner in the `gh repo view` stub (org
   private / user private / public).

Test mechanics: injectable `gh` runner (records calls, plays scripted responses)
— the same seam the F1 tests established; no network, no real gh.

## 6. Acceptance criteria

1. §5 tests pass; export-side tests unmodified (review gate untouched).
2. Skill content assertions cover §4.7; docs chapters exist in both locales and
   `docs:build` is green.
3. `npm test`, lint, build, eval `--assert-baseline` green.
4. Manual §7 passes on real infrastructure.

## 7. Maintainer self-test checklist (acceptance round)

1. Publish a real bundle to your private test shelf: first run configures
   `--repo`, second run needs nothing. Confirm the audience statement, then
   install the printed URL + `--verify` line from a scratch vault (F1 round
   trip).
2. Re-publish the same version — must refuse; bump version at export and publish
   again — new release appears.
3. Add a fake `ghp_…` token to an approved page, re-export (it should flag at
   review), approve it deliberately, then `publish --public` — the second gate
   must list it; consent and confirm it publishes; then make the repo private
   again / delete the test release.
4. Rename `gh` away and publish — walk the manual checklist once; confirm the
   release it produces installs identically.
5. In Obsidian: publish via the modal panel, including one public run to see the
   second gate UI.
6. `npm test && npm run eval -- --assert-baseline` — green.
