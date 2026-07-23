# Sharing Knowledge

Knowlery packages an explicitly reviewed slice of knowledge into an installable,
verifiable, updateable **bundle**. It is not a vault backup: only pages and
sources you approve are included.

## Choose how you want to share

| I want to… | Start here |
| --- | --- |
| Select, preview, and publish in Obsidian | [Share in Obsidian](./obsidian) |
| Ask an agent to help | [Share with an Agent](./with-agent) |
| Review and publish from a terminal | [Publish a Bundle (CLI)](./publish) |
| Let CI create the Release after review | [Automate with GitHub Actions](./github-actions) |

Every entry point uses the same steps and saved review state:

1. **Export & review** — pick a seed topic; every page and source in scope gets an
   explicit per-item approval (nothing ships unreviewed). See the export command in
   the [Reference](/reference/).
2. **[Publish](./publish)** — `knowlery bundle publish` creates a GitHub Release
   in your configured repo and hands back the complete message to forward (URL,
   checksum, audience). Private by default; public destinations pass a second
   gate.
3. **[Grant access](./grant-access)** — publishing does **not** make the bundle
   reachable. Who can install depends on where it lives: public host (anyone),
   private repo (collaborators or org members), or a file you sent directly.
4. **Install** — [from a URL](./install-from-url) or from a local file.
5. **[Subscribe & update](./subscribe-update)** — `check-updates` asks each
   bundle's source for newer versions; `update` installs them through the same
   gates. Pull-based, with local modifications protected.

::: tip Your first share
Start with a private repository, version `0.1.0`, and a small scope. Complete one
install and update check in a test vault before widening the audience.
:::

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
