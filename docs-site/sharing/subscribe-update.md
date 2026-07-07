# Subscribe & Update

Installing a bundle from a GitHub release URL makes you a subscriber: the vault
remembers where the bundle came from, and can ask that source for newer versions.

```bash
knowlery bundle check-updates
```

```
jay.drone-delivery  v1.2.0 → v1.3.0 available
team.obs-pack       v2.0.0 — up to date
old.zip-install     v1.0.0 — unchecked (no version protocol for this source)

1 update(s) available — install with: knowlery bundle update <id> (or --all)
```

```bash
knowlery bundle update jay.drone-delivery   # or --all
```

Updates go through the **full install pipeline** — conformance gate, version
gate, path safety — and the replacement is staged: if anything fails, the
installed version is untouched.

In Obsidian, the dashboard's *Installed bundles* section has a **Check updates**
button with per-bundle Update buttons.

## The subscription model

- **Pull, not push.** Nothing checks in the background; you (or your agent, on
  whatever cadence you've agreed) run the check. `knowlery sync` stays offline
  by design — `check-updates` is its network-side sibling.
- **Permission is membership.** Updates come from the same source you installed
  from, with the same access rules — org members keep receiving updates as long
  as they're in the org. See [Grant access](./grant-access).
- **The status taxonomy is honest**: `unchecked` means the source carries no
  version-discovery protocol (a bare zip URL); `skipped` means a private source
  needs `gh`; neither is an error.

## Local modifications are protected

If you edited files inside `Library/<bundle-id>/`, updating would overwrite your
changes — so it refuses, naming exactly which files were edited, added, or
deleted. The convention: **installed knowledge is referenced, not edited** — put
your own insights in your own pages and link to the bundle's. If you're sure,
`--force` overwrites.

## Versioning notes

Bundle versions are stable dotted-numeric (`1.2.0`, `1.10.0` — compared
numerically, so `1.10 > 1.9`). There is no downgrade command: to roll back,
re-install the older release's URL directly.
