# Knowlery 0.9.0 — Release Plan

**Theme:** Knowledge that travels — the sharing loop 0.8.0 completed *mechanically*
(export ↔ install, both headless) gains its last mile: bundles move over the network,
subscribers pull updates, and publishing to the public internet is guarded in
proportion to its irreversibility. Plus one engine refinement paid from the 0.8
residual ledger.

## Features

| # | Feature | Spec | Depends on |
|---|---------|------|------------|
| F1 | Remote install: `bundle install <url>`, source recording, `gh` fallback for private repos | [f1-remote-install.md](./f1-remote-install.md) | 0.7 F4 install pipeline |
| F2 | Publish flow: `bundle publish` to GitHub Releases, incl. publisher-side configuration (per-bundle target repo, `gh` detection & guided setup, repo bootstrap); default-private posture; public-destination second gate; credential-pattern risk scan | [f2-publish-flow.md](./f2-publish-flow.md) | 0.8 F1 export |
| F3 | Update & subscription: `bundle check-updates` / `bundle update`, local-modification protection, dashboard surfacing | [f3-updates.md](./f3-updates.md) | F1 (source recording), F2 (versioned upstream) |
| F4 | Retrieval: unmatched-term specificity signal (closes the exactly-half coverage boundary) | (spec pending) | 0.8 F2 gate + seed cases |

Execution order: F1 → F2 → F3 → F4. F1/F2 are the two ends of the same pipe (receive
first — it is mechanical and unblocks self-testing of F2); F3 needs both; F4 is
independent engine work and can interleave.

## Distribution model (decided in pre-plan discussion, binding on F1–F3)

- **Hosting is borrowed, never operated.** Bundles live on GitHub Releases (or any
  static host serving the zip bytes). Knowlery runs no registry, no server, no
  central index — the same leverage call as OIDC publishing (borrow GitHub identity)
  applied to distribution (borrow GitHub hosting + permissions).
- **The trust anchor is source continuity.** An installed bundle records its source;
  updates are fetched only from that source. Trusting a bundle = trusting its GitHub
  repo, structurally the same trust as a Homebrew tap or an npm package. No content
  signing in v1 — repo permissions already guarantee "only the owner publishes".
- **Knowlery never manages auth credentials.** Public sources are fetched
  anonymously. Private repos delegate to the receiver's own authenticated `gh` CLI
  (three tiers: anonymous URL → documented two-step `gh release download` → automatic
  `gh` fallback when an unauthenticated GitHub fetch fails). No tokens stored,
  configured, or seen.
- **`gh` is an accelerator, never a prerequisite** (maintainer question at plan
  review). Every flow has a no-`gh` degradation: public install/update-check never
  need it; private install falls back to browser download (the receiver's browser
  session is the credential) + local-file install; **publish falls back to a guided
  manual web release** — Knowlery precomputes every value (zip path, target repo
  URL, tag name) and prints/renders a copy-ready checklist, so the manual path costs
  a minute and produces an artifact indistinguishable from a `gh`-published one;
  private update checks skip gracefully with a one-line note. Where `gh` is absent,
  the CLI guides installation (one command per platform); whether the plugin's setup
  wizard additionally offers confirmed installation (the existing optional-tools
  pattern) is an F2 spec decision point.
- **Pull, not push.** No daemon, no notifications. `check-updates` runs on demand
  (command, `sync` report, dashboard card); agents provide the subscription cadence.
- **Recommended team topology: an organization-owned shelf** (maintainer decision
  at plan review). For team sharing, a private repo under a GitHub organization
  (e.g. `your-org/kb-bundles`) with base permission Read gives every member access
  with zero per-user management — membership *is* the subscription permission, and
  its lifecycle follows the org (join → access, leave → revoked). Finer scoping via
  org teams stays a GitHub-side concern Knowlery never sees. Multiple owners
  publishing to one shelf makes it a team knowledge hub for free. This is a
  documented usage pattern of the credential-delegation design, not a feature:
  F2/F3 specs and docs write their examples against it. (GitHub Free orgs suffice —
  unlimited private repos and members.)

## Publisher-side configuration (maintainer requirement at plan review, binding on F2)

The owner's setup experience is part of the feature, not an assumed prerequisite:

1. **The bundle repo is decoupled from the vault.** Bundles publish to a separate
   GitHub repo (the "shelf"); the vault itself is never git-initialized, inspected,
   or touched — one repo can shelve many bundles (tag prefixes) or one each.
2. **Target remembered per bundle.** The publish target
   (`publish: { repo, visibility }`) lives in the bundle's existing
   `export-scope.json` entry: configured once on first `bundle publish` (flag or
   prompt), reused on every subsequent version — and, living in a vault file, shared
   identically by both shells.
3. **`gh` is detected and guided, never installed or impersonated.** Publish checks
   `gh` presence and `gh auth status` up front and emits the exact next step when
   missing (the established `cli-detect`/`node-detect` pattern); `knowlery health`
   reports publish-capability alongside its other checks.
4. **Repo bootstrap with private as the hard default.** A missing target repo offers
   `gh repo create <name> --private` (run after confirmation) — the first publish
   lands private by construction; public is a later, explicit, second-gated upgrade.
5. **Plugin parity.** The export modal's result phase gains a "Publish to GitHub"
   action reading the same per-bundle config and shelling out to the same `gh`
   (desktop-only, as with existing tool integrations); a missing `gh` renders
   guidance, not an error.
6. **Publish output names the audience** (maintainer concern at plan review:
   publishing does not grant access — a private release is invisible to anyone
   without repo read). Success output explicitly answers "who can install this":
   org shelf → "members with read access to <org>/<repo>"; personal private repo →
   "only you and collaborators" plus the invite URL; public → "anyone". The
   grant-access step stops being an implicit assumption and becomes a stated part
   of the publish flow.

Explicitly out: any `git init`/remote management/token entry UI inside Knowlery —
every GitHub-side operation is either one `gh` command or a precise instruction to
the user.

## Public-exposure safety (maintainer requirement, binding on F2)

Personal knowledge bases are the substrate; a public release is irreversible
(caches, mirrors, crawlers). The tooling's duty upgrades from "offer review" to
"make careless publishing hard while keeping careful publishing smooth":

1. Public is never the default. `bundle publish` targets a private repo unless
   `--public` is explicit, and publishing is a separate deliberate command from
   exporting.
2. A public destination triggers a **second gate**: approved items that carry risk
   hints are re-presented ("these 2 approved items contain email addresses and are
   about to become permanently public") and must be re-acknowledged. Approval
   happened in a "share with colleagues" mindset; public exposure is a different
   decision deserving its own informed consent.
3. Risk scanning grows credential patterns (API-key shapes, private IPs,
   phone/ID-number shapes) — regex-only, explainable, tuned to avoid training users
   to ignore warnings.
4. Irreversibility is stated in the confirmation interaction itself, not in docs.
5. The `knowlery-cli` skill gains publish conduct: the agent restates destination
   visibility and the risk-item list; `--public` is never passed unless the user
   said "public".
6. Honest limit, stated in docs: pattern scans cannot catch semantic sensitivity.
   The per-item human review remains the last line; the default-private posture is
   the largest single safety feature.

## Documentation as a first-class deliverable (maintainer requirement at plan review)

Remote sharing is the release's headline, and half its user experience is
*understanding the model* (publish ≠ grant access; the org topology; the
default-private posture). Docs are therefore a gated deliverable, not a follow-up:

1. The docs site gains a dedicated top-level section — **"Sharing Knowledge"** in
   the sidebar's "Use Knowlery" group (English + `zh/`, both locales as the site
   already maintains) — covering the full journey in order: export & review →
   publish (and *who can now install* — the audience concept) → grant access
   (collaborator / org / public, with the org shelf as the recommended team
   recipe) → install from URL → subscribe & update. Plus the security posture
   (default private, the public second gate, what pattern scanning can and cannot
   catch) and a troubleshooting page whose first entry is the defining confusion:
   *"the link 404s for my teammate" = they lack access, not a broken link*.
2. **Each of F1–F3 ships its docs chapter in the same PR as the feature** —
   acceptance criteria in every spec include the docs pages, so the section grows
   feature by feature and is complete when F3 lands, never trailing the code.
3. Agent-side training mirrors it: the `knowlery-cli` skill updates (already in
   each feature's scope) are the machine-readable counterpart of the guide, and
   the guide links agents' conduct rules so human and agent readers see one
   consistent model.
4. The 0.9.0 announcement/changelog leads with the sharing story and links the
   guide as the canonical entry point.

## Non-goals for 0.9.0

- No central registry, hosting, discovery, or search of published bundles.
- No token/credential management inside Knowlery (private access = `gh` delegation).
- No auto-update daemon or push notifications; updates are user- or agent-initiated.
- No bundle content signing (v1 — source continuity + repo permissions are the trust
  model; revisit if distribution outgrows GitHub).
- No weakening of any existing gate: export review, conformance, version, and
  path-safety gates apply to remote artifacts exactly as to local ones, plus hash
  verification of downloaded bytes (`--verify sha256-...`).

## Carried policies

- Lockstep versioning (manifest / package / package-lock / versions.json / bundle
  `knowleryVersion` stamp — the 0.8.0 release-prep checklist).
- SDD process unchanged: spec → maintainer acceptance → implementation → maintainer
  self-test, per feature, branches `cursor/09-f<N>-<name>-92eb` cut from `main`
  after the previous feature merges.

## Beyond 0.9 — the hosted-platform trajectory (recorded, not scheduled)

Maintainer direction at F2 spec review: with sufficient adoption, a hosted KB
platform becomes viable — owners pay a small service fee to publish to the cloud,
subscribers subscribe to owners, owners choose free or paid, paid content earning
through the platform. It also closes the known boundary of the GitHub-based flow
(the education barrier for non-engineering users). What 0.9 does *today* to keep
that door open, at zero extra cost:

- **The bundle format and every gate are already host-agnostic** — a platform
  hosts the same sealed artifact GitHub does, and F1 installs from any https URL.
- **F2 isolates GitHub behind a "publish target"** (§4.6 boundary discipline);
  the platform is a second target, not a redesign.
- **F3 must define an abstract "upstream" protocol** ("latest version for this
  source") with GitHub Releases as its first implementation — subscription
  mechanics never hardwire GitHub API shapes.
- **The credential line stays honest by layering**: the OSS tool remains
  credential-free toward GitHub (delegation to `gh`); a future platform is an
  *optional, explicitly authenticated* target/source whose auth lives in a
  platform client layer, never in the core. Recorded now so the principle isn't
  quietly violated later.
- Far-future operational load (moderation, DMCA, payments, tax) is acknowledged
  and deliberately unaddressed until the platform is real.

## Backlog ledger (recorded, schedulable opportunistically in 0.9)

- Settings fallback deletion + `minAppVersion` bump — **blocked on Obsidian 1.13
  reaching public release**; two-line change when it does (0.8 F4 amendment).
- `/explore` / `/ideas` adopting the retrieval ladder wholesale (0.7 F5 leftover).
- `no-explicit-any` tightening (0.8 F4 recorded).
- Ranking misses q-016 (unrecorded synonym) and q-020 (English question → Chinese
  note) — engine work beyond F4's scope; q-016 may be unsolvable inside the
  no-synonym-dictionary design line.
- F4 seed cases requiring fixture shapes: 斑马/莫言/胚胎筛查/鼠疫 real-vault probes
  from the 0.8 F2 acceptance round (recorded in `specs/0.8.0/f2` §7).
