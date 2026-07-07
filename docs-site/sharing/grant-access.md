# Grant Access

**Publishing does not grant access.** A release in a private repo is invisible to
anyone without read permission — GitHub answers 404 and doesn't even confirm the
repo exists. Every publish therefore ends with an *audience statement* telling
you who can install; this page is the "how to change that" companion.

| Where the bundle lives | Who can install | How to grant access |
| --- | --- | --- |
| Private repo in your **organization** | Members with read access | Org base permission Read covers everyone; finer scoping via org teams |
| Your **personal** private repo | Only you + collaborators | Repo → Settings → Collaborators → invite (they must accept) |
| **Public** repo | Anyone with the link | Nothing to do — that's the point, and the risk |

## The org shelf (recommended for teams)

One private repo under your GitHub organization — say `your-org/kb-bundles` —
with the org's base permission set to **Read**:

- Every member installs with their own GitHub login; nothing to manage per
  person or per bundle.
- Access follows membership: joining the org grants it, leaving revokes it.
- Anyone on the team can publish to the same shelf — it becomes the team's
  knowledge hub.

GitHub's Free plan suffices (unlimited private repos and members).

## The receiver's side

Access alone isn't enough — the receiver must also be *authenticated* when
downloading: `gh auth login` for the CLI path, or a logged-in browser for the
manual path. The most common confusion is exactly this: see
["the link 404s"](./troubleshooting).
