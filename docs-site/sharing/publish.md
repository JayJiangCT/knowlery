# Publish a Bundle

```bash
knowlery bundle publish drone-delivery
```

One deliberate command from reviewed scope to a shareable URL:

1. **The review gate runs first** — the same one as `bundle export`. Anything
   unreviewed prints the checklist and nothing is published.
2. The bundle is compiled and zipped (re-using the version of your last export).
3. A GitHub Release is created in your configured repo via your own `gh` login,
   with the zip as its asset.
4. You get back the complete message to forward: the asset URL, its SHA-256, and
   **who can install it** — see [Grant access](./grant-access).

```
Published jay.drone-delivery v0.1.0 to your-org/kb-bundles (private).
  Who can install: members with read access to your-org/kb-bundles (private).
  Grant access: your-org members with base Read permission already have it;
                invite others at https://github.com/your-org/kb-bundles/settings/access
  Share:  knowlery bundle install https://github.com/.../pack.zip --verify sha256-3f7a…
```

## First-time setup

The first publish needs a target repo — pass `--repo owner/name` (or answer the
prompt). It is remembered per bundle; later publishes need nothing. If the repo
doesn't exist, Knowlery offers to create it **private** — making a repo public is
a bigger decision than publishing a release, and is left to you on GitHub.

In Obsidian, the export dialog's result screen has the same "Publish to GitHub"
panel, sharing the same remembered configuration.

## Publishing publicly: the second gate

Private is always the default. `--public` states an extra fact and asks an extra
question:

> A public release is permanent: caches, mirrors, and crawlers retain it even if
> deleted.

If any **approved** item carries risk hints (emails, credentials, private IPs,
person pages…), those items are re-listed and must be re-acknowledged — you
approved them thinking of colleagues; the public internet is a different
decision. Interactively you type `publish` to confirm; scripts and agents must
pass `--acknowledge-risks`, which agents are instructed to use only after showing
you the list.

The gate runs on **every** public publish — consenting to v1.2 does not silence
v1.3's scan, because content changes and so do risks.

::: warning Honest limit
Pattern scanning catches shapes (API keys, IPs, phone numbers), not meaning. It
cannot know that a sentence is commercially sensitive. The per-item review — a
human reading each page — remains the real gate.
:::

## Re-publishing

The same version refuses to publish twice (`--force` replaces the asset if you
must). The normal flow for changes: re-export with a bumped `--bundle-version`,
then publish again — subscribers see the new version.

## Without `gh`

Publishing works best with GitHub's CLI (one command to install:
[cli.github.com](https://cli.github.com), then `gh auth login`). Without it,
`publish` prints the complete manual path — your zip's location, the exact
`releases/new` URL, the tag to use, and the SHA-256 to post — about a minute of
drag-and-drop, and the result installs identically.
