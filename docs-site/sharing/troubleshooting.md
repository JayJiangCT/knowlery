# Troubleshooting Sharing

## "The link 404s for my teammate" — it's access, not a broken link

This is the single most common confusion, so it comes first: **publishing a bundle
does not grant anyone access to it.** If the bundle lives in a private GitHub repo,
the link answers 404 to anyone without read access — GitHub deliberately does not
distinguish "doesn't exist" from "no permission".

Fixes, in order of preference:

1. **Team setup**: host bundles in an organization-owned repo with base permission
   Read — every org member has access automatically. See
   [the org shelf](./index#the-recommended-team-setup-an-organization-shelf).
2. **Individual**: invite the person as a repository collaborator
   (repo → Settings → Collaborators), and have them retry after accepting.
3. The receiver must also be *authenticated* when downloading: `gh auth login`
   for the CLI path, or a logged-in browser for the manual path.

## "gh is not installed"

`gh` is only needed for **private** sources. Either install it
([cli.github.com](https://cli.github.com)) and run `gh auth login`, or use the
browser fallback: download the zip from the release page, then
`knowlery bundle install <local-file>`.

## "Integrity check failed"

The downloaded bytes don't match the `--verify` checksum. Possible causes: the
sharer updated the asset after posting the hash, the wrong asset was linked, or the
transfer was tampered with. Ask the sharer to re-post the current hash; nothing was
installed.

## "Download failed: HTTP 404" from a non-GitHub URL

The URL simply doesn't serve a file. Common with file-sharing services whose
"share links" open a web page instead of the file — you need a **direct download**
link that serves the zip bytes.
