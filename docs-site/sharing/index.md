# Sharing Knowledge

Knowlery packages reviewed knowledge into **bundles** — sealed, versioned artifacts
another vault can install. Sharing is a journey with distinct steps, and the most
important thing to understand is that they are separate:

1. **Export & review** — pick a seed topic; every page and source in scope gets an
   explicit per-item approval (nothing ships unreviewed). See the export command in
   the [Reference](/reference/).
2. **Publish** — put the bundle zip somewhere others can reach: a GitHub Release, a
   static file host, or simply a message attachment. *(A guided `bundle publish`
   flow arrives later in the 0.9 series.)*
3. **Grant access** — publishing does **not** make the bundle reachable.
   Who can install depends on where it lives:
   - **Public release / public host** — anyone with the link.
   - **Private GitHub repo** — only people with read access: invited collaborators,
     or (recommended for teams) members of the organization that owns the repo.
   - **A file you sent directly** — whoever received it.
4. **Install** — [from a URL](./install-from-url) or from a local file.
5. **Subscribe & update** — *(arrives later in the 0.9 series.)*

## The recommended team setup: an organization shelf

For a team, create one private repo under your GitHub organization — for example
`your-org/kb-bundles` — and set the organization's base permission to **Read**.

- Every member can install from its release URLs, using their own GitHub login.
- Access follows membership: joining the org grants it, leaving revokes it. No
  per-person, per-bundle management.
- Anyone on the team can publish their bundles to the same shelf — it becomes the
  team's knowledge hub.

GitHub's Free plan is sufficient (unlimited private repos and members). Finer
scoping, if you need it, is a GitHub teams configuration — Knowlery never manages
permissions itself.

## Security posture

- Bundles contain **only what you approved item by item** — never the vault
  wholesale.
- Knowlery **never stores or asks for tokens**. Private sources are reached through
  your own `gh` CLI login or your browser session.
- If a sharer gives you a checksum next to a link, verify the download:
  `knowlery bundle install <url> --verify <sha256>`.
