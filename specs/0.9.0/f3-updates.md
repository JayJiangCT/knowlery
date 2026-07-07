# F3 (0.9.0) — Update & Subscription: `check-updates` / `update`

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.9.0
- **Branch:** `cursor/09-f3-updates-92eb`
- **Depends on:** F1 (source seam: registry records re-fetchable URLs; download
  pipeline), F2 (versioned upstream: `<bundle-id>-v<version>` tags, release
  assets), 0.9 plan (pull-not-push, upstream protocol, `gh` tiering — binding)

## 1. Problem statement

The two ends of the pipe exist: owners publish versioned releases (F2), receivers
install from URLs and the registry remembers where each bundle came from (F1).
What's missing is the loop: when the owner publishes v1.3, subscribers with v1.2
have no way to learn about it short of being told. F3 adds the App-Store-shaped
subscription — deliberately **pull-based** (no daemon, no notifications; the
check runs on demand and agents provide the cadence).

## 2. Goals

```
knowlery bundle check-updates [--dir <vault>] [--json]
knowlery bundle update <bundle-id> | --all  [--dir <vault>] [--force] [--json]
```

1. **`check-updates`** reads the registry, asks each bundle's *upstream* for its
   latest version, and reports: update available / up to date / unchecked (with
   the reason). Strictly read-only.
2. **`update`** downloads the newer release through the F1 pipeline — same
   gates, same `gh` tiering — and replaces the installed bundle; the registry's
   source moves to the new asset URL.
3. **Local-modification protection**: installed bundles carry
   `installedContentHash`; if the Library copy was edited since install, update
   refuses without `--force`, naming the changed files. (This also reinforces
   the convention: installed knowledge is referenced, not edited.)
4. **The upstream protocol** (plan, binding): an abstract "latest version for
   this source" interface with **GitHub Releases as its only v1
   implementation** — subscription mechanics never hardwire GitHub API shapes,
   keeping the seam a future hosted platform slots into.
5. **Dashboard surfacing**: the plugin's installed-bundles section gains a
   "Check updates" action and per-bundle "Update to vX.Y.Z" buttons on the same
   core.
6. Skill + docs: subscription conduct; the "Subscribe & update" chapter closes
   the Sharing Knowledge journey (en + zh).

## 3. Non-goals

- No background checking, no notifications, no scheduler — pull only (plan).
- No cross-source migration (`update` follows the recorded source; switching
  shelves is a re-install).
- No downgrade command: an older upstream reports "up to date" (the version
  gate would refuse the install anyway); rolling back is a manual re-install of
  the older URL.
- No update checking for non-GitHub URLs in v1 — a bare https zip URL carries
  no version-discovery protocol. Reported honestly as `unchecked (no
  version protocol for this source)`, never as an error.
- `knowlery sync` stays offline: it is the *workspace-format* sync and must
  keep working air-gapped. The docs teach `check-updates` as its network-side
  sibling; agents run both.

## 4. Design

### 4.1 The upstream protocol

```ts
interface Upstream {
  /** Latest published version of this bundle at its source, with the asset URL to fetch it. */
  latest(): Promise<{ version: string; url: string } | 'unreachable' | 'needs-auth'>;
}
```

`upstreamFor(bundleId, sourceUrl)` resolves the recorded source to an
implementation: F1's GitHub release-asset shape
(`github.com/<owner>/<repo>/releases/download/<tag>/<file>`) →
`GithubReleasesUpstream`; anything else → null (unchecked). The GitHub
implementation:

- Lists the repo's releases (anonymous `api.github.com` via the shell-supplied
  transport; on refusal, `gh api` — the exact F1 tiering, so public shelves
  never need `gh` and private shelves use the receiver's own login).
- Filters tags by the bundle's own prefix `<bundle-id>-v` (a multi-bundle shelf
  contains other bundles' tags; they are not this bundle's versions) and picks
  the highest by numeric dotted-segment comparison. Prerelease suffixes compare
  lexically after numerics — recorded simplification, not a promise of full
  semver.
- Returns the release's zip asset URL — which is precisely what F2 published
  and F1 installs.

### 4.2 `check-updates`

For every registry entry: no recognizable upstream → `unchecked`; upstream
`needs-auth` and no `gh` → `skipped (private source — gh needed)`; reachable →
compare `latest.version` with the installed version. Output one line per bundle
plus a summary; `--json` structured. Exit 0 regardless of findings (absence of
updates — or of checkability — is a result, not an error); network failures on
individual bundles degrade to `unreachable` lines, never abort the run.

### 4.3 `update`

1. Resolve the entry (or iterate all with `--all`), get `latest()`.
2. Not newer than installed → "already up to date", done (exit 0).
3. **Modification check**: recompute the installed-content hash over the
   Library copy (same recipe as install: sorted `path\ncontent` of `.md`
   entries) and compare with the registry's `installedContentHash`. Mismatch →
   list the differing files, refuse without `--force`.
4. Newer → the F1 remote-install path on `latest.url` with force semantics
   (the version gate sees a newer version and passes; the Library subtree is
   replaced wholesale, as install already does). Registry entry updates:
   version, source (the new URL), hashes, conformance, installedAt.
5. Failure at any gate leaves the installed version untouched (the install
   pipeline stages to temp and replaces only on success — existing behavior,
   restated as a test).

### 4.4 Dashboard surfacing

`InstalledBundlesSection`: a "Check updates" button runs the same core
(plugin transport: `requestUrl`; `gh` via child_process as in F2's panel) and
annotates each bundle — `v1.2.0 → v1.3.0 available` with an Update button, `up
to date`, or the unchecked/skipped reason. No automatic checking on dashboard
load (pull means pull).

### 4.5 Skill + docs

- Skill: `check-updates`/`update` rows; conduct — report findings verbatim,
  never auto-update without the user asking; suggest `check-updates` when the
  user wonders whether shared knowledge is current.
- Docs: "Subscribe & update" chapter (en + zh) — the subscription model
  (membership is the permission, pull is the cadence), local-modification
  protection and the reference-don't-edit convention, the unchecked/skipped
  taxonomy. Journey overview step 5 goes live.

## 5. Safety properties, restated as tests

1. `check-updates` performs zero writes (VaultFs spy) and exits 0 across all
   outcome kinds (available / current / unchecked / skipped / unreachable).
2. Tag filtering: a shelf carrying `other.bundle-v9.9.9` never counts as an
   update for `jay.pack`; `jay.pack-v1.3.0` does.
3. Local edits refuse `update` without `--force`, naming the edited file; the
   Library copy is untouched afterward.
4. `update` on an up-to-date bundle installs nothing (runner/transport spies).
5. A successful update rewrites version, source URL, and hashes in the
   registry; the old content is gone, the new present.
6. Private upstream without `gh`: `check-updates` reports skipped (exit 0);
   `update` fails with the browser-path guidance (F1's), Library untouched.
7. A failing download or gate mid-update leaves the installed version intact.
8. Version comparison: `1.10.0 > 1.9.0` (numeric segments, not lexical).

Mechanics: scripted transport + `gh` runner (the F1/F2 seams); loopback HTTP for
the actual asset download in the update round trip.

## 6. Acceptance criteria

1. §5 tests pass; F1/F2 tests unmodified.
2. Round trip on real infrastructure (§7): publish v2 from the test shelf,
   `check-updates` sees it, `update` installs it, query answers from the new
   content.
3. Skill assertions + docs chapters (both locales) + `docs:build` green.
4. `npm test`, lint, build, eval `--assert-baseline` green.

## 7. Maintainer self-test checklist (acceptance round)

1. In the Test Vault (has v1 installed from the private shelf): bump the bundle
   version at export, publish v2; `knowlery bundle check-updates` shows
   `v1 → v2 available`; `knowlery bundle update <id>` installs it; `knowlery
   query` reflects the new content.
2. Edit one file inside `Library/<id>/`, run `update` again after publishing
   v3 — must refuse naming the file; `--force` proceeds.
3. `gh auth logout` (or rename `gh`): `check-updates` reports the private
   source as skipped, exit 0.
4. Obsidian: dashboard "Check updates" shows the available update; the Update
   button installs it.
5. `npm test && npm run eval -- --assert-baseline` — green.
