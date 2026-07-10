# F1 (1.3.0) — The One-Line Installer

- **Status:** Done — acceptance passed 2026-07-10, performed by the cloud
  agent per maintainer delegation (pty-driven interactive rounds: consent-yes
  appends once and a fresh shell resolves `knowlery`; consent-no modifies
  nothing, exits 0, install intact; no-tty defaults to untouched — one
  finding fixed at acceptance: `-r /dev/tty` is true without a controlling
  terminal, probe by opening; idempotence marker count stays 1; CI
  installer-smoke green)
- **Branch:** `cursor/13-f1-installer-92eb`
- **Depends on:** published `knowlery@^1` on npm; the docs site (hosting)

## 1. Problem statement

`npm i -g knowlery` ends with `command not found` for every user whose npm
global-prefix bin is not on PATH — and npm cannot fix that, because a package
cannot modify the shell that launched it. The only place PATH can be handled
*legitimately* is an installer the user explicitly ran. One line:

```bash
curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
```

(`knowlery.dev` is not owned; the docs-site URL is canonical for now and a
domain can 301 to it later.)

## 2. Design

### 2.1 What the script does, in order

1. **Preflight**: `node` ≥ 18 and `npm` must exist — refuse with install
   guidance otherwise (the script does not install Node; that is the user's
   runtime choice).
2. **Isolated install**: `npm install --prefix ~/.knowlery/cli knowlery@^1`
   — no `-g`, no sudo, no global-prefix involvement; upgrades are re-runs
   (same command resolves the newest `^1`).
3. **Launcher link**: `ln -sf` the installed bin into `~/.local/bin/knowlery`
   (XDG-conventional; overridable via `KNOWLERY_BIN_DIR`).
4. **Verify**: run `--version` through the link before claiming success.
5. **PATH, with consent — never silently** (the trust rule, installer
   edition): if the bin dir is already on PATH, done. Otherwise show the
   exact line to be appended, identify the right rc file by `$SHELL`
   (zsh → `~/.zshrc`; bash → `~/.bash_profile` on macOS, `~/.bashrc`
   elsewhere; fish → `fish_add_path`), and **ask via `/dev/tty`** (stdin is
   the pipe under `curl | sh`). Decline → print the manual instruction and
   exit 0 (installed, just not on PATH). `--yes` / `KNOWLERY_INSTALL_YES=1`
   for non-interactive runs (CI).
6. **Idempotent**: re-runs upgrade in place; the rc append is
   marker-guarded (grep before append — never a second line).
7. **Summary**: version, location, "open a new terminal", uninstall
   instructions (`rm -rf ~/.knowlery/cli ~/.local/bin/knowlery` + the one
   rc line).

### 2.2 Boundaries

- POSIX sh only (no bashisms) — macOS/Linux; Windows is out of scope
  (PowerShell installer is a future candidate).
- The script never edits an rc file without showing the line and getting a
  yes; never touches sudo; never writes outside `~/.knowlery/cli`,
  `$KNOWLERY_BIN_DIR`, and (with consent) one rc file.
- Hosted from `docs-site/public/` — served by GitHub Pages on docs deploy;
  release-independent (it installs whatever `^1` npm currently resolves).

## 3. Tests

1. CI `installer-smoke` job: run the script non-interactively
   (`KNOWLERY_INSTALL_YES=1`) on a runner where the bin dir is *not* on
   PATH → assert the link exists, `--version` matches the published
   package, the rc file gained exactly one marker line; run **again** →
   still exactly one line (idempotence), install upgraded in place.
2. Same job, second variant: bin dir pre-added to PATH → rc file untouched.
3. `sh -n` syntax check + shellcheck (if available) in the job.

## 4. Acceptance

1. CI green incl. the new job; docs (en+zh) and README carry the one-liner.
2. Maintainer: run the line on a real machine with a mis-prefixed npm;
   confirm the consent prompt renders, both answers behave, and a fresh
   terminal has `knowlery`.
