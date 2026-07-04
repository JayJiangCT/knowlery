# F4 (0.7.0) — `knowlery bundle install` / `list` / `uninstall`

- **Status:** Accepted 2026-07-04 — implemented, awaiting maintainer acceptance testing (§6)
- **Target release:** 0.7.0
- **Branch:** `cursor/07-f4-bundle-commands-92eb` (stacked on 0.7 F3)
- **Depends on:** F1 (okf install-side inverted onto VaultFs), F2 (CLI shell)

## 1. Problem statement

Knowledge bundles are the sharing story (0.5.0), but installing one currently requires
the Obsidian modal. Cloud agents and CLI-only users should be able to install, list,
and uninstall bundles — the receiving side of OKF. The exporting side (approve/flag
review gate) is UI-shaped and stays out of the CLI per the release plan.

## 2. Goals

```
knowlery bundle install <zip-or-folder> [--dir <vault>] [--force] [--skip-conformance]
knowlery bundle list      [--dir <vault>] [--json]
knowlery bundle uninstall <bundle-id> [--dir <vault>]
```

1. `install` reads a bundle from a zip file or folder (`okf/zip.ts`'s existing
   node-based `readBundleEntries`), then runs the same inverted `installBundle` the
   plugin uses — every 0.5.0 safety property intact: path-safety assertions, version
   gate (`--force` to override), conformance gate (`--skip-conformance` to acknowledge
   past a failure, mirroring the modal's explicit acknowledgement), registry update,
   `KNOWLEDGE.md` pointer block.
2. `list` renders the registry (id, version, title, installed date, conformance);
   `--json` emits it raw.
3. `uninstall` removes `Library/<id>/`, the registry entry, and (when it was the last
   bundle) the `KNOWLEDGE.md` block — same inverted core function. Unknown ids get an
   explicit error (the core's silent no-op becomes a CLI-level message).

## 3. Non-goals

- No `bundle export` (0.8; the review gate is UI-shaped).
- No remote sources (URLs, registries) — local zip/folder only, same as the modal.
- No changes to OKF semantics, conformance rules, or the plugin's install modal.

## 4. Design

- `src/cli/commands/bundle.ts`: subcommand dispatch (`install`/`list`/`uninstall`) with
  the three handlers taking `VaultFs` (+ the source path resolved against the caller's
  cwd, not `--dir`). Init gate: all three require an initialized workspace (they
  operate on the registry and `KNOWLEDGE.md`), pointing at `knowlery init` otherwise.
- `install` prints the manifest summary (id, title, version, concept count) and the
  conformance outcome; on `InstallBlockedError` it exits 1 with the core's message plus
  the flag that overrides (`--force` / `--skip-conformance`).
- `main.ts`: `bundle` command consumes the second positional as the subcommand and a
  third positional (source path / bundle id) — parser extended accordingly.
- jszip lands in the CLI bundle via `readBundleEntries` (~100KB, acceptable).
- README CLI section gains the bundle commands; purity guard covers the new module.

## 5. Acceptance criteria

1. Round trip in tests: a bundle folder (valid `knowlery-bundle.json` + pages, reusing
   the okf test fixtures' shapes) installs into a temp workspace — `Library/<id>/`
   populated, registry entry written, `KNOWLEDGE.md` block added; `list` shows it;
   `uninstall` removes all three artifacts. Zip input covered too (zip built in-test
   with jszip).
2. Gates: same-version reinstall exits 1 without `--force`; a conformance-failing
   bundle exits 1 without `--skip-conformance` and installs with it, recorded as
   `skipped` in the registry — assertions matching the existing okf-install tests.
3. Uninstalling an unknown id exits 1 with an explicit message.
4. Uninitialized workspace: all three exit 1 pointing at `knowlery init`.
5. Smoke test extends: build artifact → init → bundle install (fixture folder) →
   list → uninstall.
6. `npm test`, lint, build, eval baseline green; purity guard extended; the plugin's
   install modal untouched.

## 6. Maintainer self-test checklist (acceptance round)

1. Export a bundle from your real vault with the plugin (Share knowledge bundle), then:
   `node knowlery-cli.mjs bundle install <exported .zip> --dir /tmp/kb` (a CLI-initialized
   workspace) — check `Library/<id>/`, `bundle list`, and that
   `node knowlery-cli.mjs query --dir /tmp/kb "<topic from the bundle>"` retrieves
   bundle knowledge.
2. Install the same zip again — blocked (exit 1); `--force` succeeds.
3. `bundle uninstall <id>` — `Library/` gone, `list` empty, `KNOWLEDGE.md` block gone.
4. Open `/tmp/kb` in Obsidian — the plugin's dashboard shows/hides the installed
   bundle consistently with what the CLI did.
5. `npm test && npm run eval -- --assert-baseline` — green.
