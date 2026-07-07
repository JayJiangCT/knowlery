# Install from a URL

```bash
knowlery bundle install https://github.com/team/kb-bundles/releases/download/v1.2.0/pack.zip
```

The bytes are downloaded to a temporary file and then go through **exactly** the
same pipeline as a local install — the same preview, the same conformance and
version gates, the same path-safety checks. A remote bundle can do nothing a local
one couldn't.

In Obsidian, the install dialog (Dashboard → Install bundle) accepts the same URLs
in its URL field.

## Public sources

Any `https://` URL that serves the zip works: GitHub Release assets on public
repos, static file hosts, object storage. Nothing to configure, no GitHub account
needed.

For hosting on a trusted LAN, plain `http://` works too — Knowlery prints a
reminder that the transfer is unencrypted; pair it with `--verify` when in doubt.

## Private GitHub sources

If the URL points to a **private** repo's release, the anonymous download is
refused (GitHub reports 404 — it never reveals whether a private repo exists).
Knowlery then automatically retries through your own `gh` CLI login and tells you
it did:

```
Anonymous fetch was refused — retrieved via your gh login instead.
```

Requirements: you have read access to the repo (a collaborator invite, or org
membership), and `gh` is installed and logged in (`gh auth login`).

**Without `gh`**, use your browser — your logged-in session is the credential:

1. Open the release page and download the zip.
2. `knowlery bundle install ~/Downloads/pack.zip`

## Verifying downloads

If the sharer posted a SHA-256 checksum next to the link:

```bash
knowlery bundle install <url> --verify sha256-3f7a…
```

The check runs on the raw downloaded bytes **before anything is unpacked**; a
mismatch aborts with both hashes printed and nothing installed. `--verify` also
works with local files — useful for zips forwarded through chat.

## See also

- [Troubleshooting sharing](./troubleshooting) — starting with "the link 404s for
  my teammate".
