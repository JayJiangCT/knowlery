#!/bin/sh
# Knowlery installer (spec 1.3 f1) — https://jayjiangct.github.io/knowlery/
#
#   curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
#
# What it does, in order:
#   1. checks node >= 18 and npm exist
#   2. installs knowlery@^1 into an isolated prefix (~/.knowlery/cli — no -g, no sudo)
#   3. links the binary into ~/.local/bin/knowlery
#   4. if that dir is not on PATH: shows the exact line and ASKS before touching
#      any rc file (decline = manual instructions, exit 0). Never silent.
#
# Re-running upgrades in place. Non-interactive: KNOWLERY_INSTALL_YES=1 (or --yes).
# Uninstall: rm -rf ~/.knowlery/cli ~/.local/bin/knowlery  (+ the one PATH line, if added)

set -eu

KNOWLERY_HOME="${KNOWLERY_HOME:-$HOME/.knowlery/cli}"
BIN_DIR="${KNOWLERY_BIN_DIR:-$HOME/.local/bin}"
PKG_SPEC="${KNOWLERY_PKG_SPEC:-knowlery@^1}"
MARKER="# added by the knowlery installer"
ASSUME_YES="${KNOWLERY_INSTALL_YES:-0}"
[ "${1:-}" = "--yes" ] && ASSUME_YES=1

say()  { printf '%s\n' "$*"; }
fail() { printf 'knowlery install: %s\n' "$*" >&2; exit 1; }

# --- 1. preflight ------------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js is required (>= 18). Install it first: https://nodejs.org (or your version manager), then re-run."
command -v npm  >/dev/null 2>&1 || fail "npm is required (it ships with Node.js). Install Node.js >= 18, then re-run."

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] 2>/dev/null || fail "Node.js >= 18 is required (found $(node -v)). Upgrade Node, then re-run."

# --- 2. isolated install (no -g, no sudo) ------------------------------------
say "Installing ${PKG_SPEC} into ${KNOWLERY_HOME} ..."
mkdir -p "$KNOWLERY_HOME"
npm install --prefix "$KNOWLERY_HOME" --silent --no-audit --no-fund --no-progress "$PKG_SPEC" \
  || fail "npm install failed — see the output above."

INSTALLED_BIN="$KNOWLERY_HOME/node_modules/.bin/knowlery"
[ -e "$INSTALLED_BIN" ] || fail "expected binary missing at $INSTALLED_BIN — install did not complete."

# --- 3. launcher link ---------------------------------------------------------
mkdir -p "$BIN_DIR"
ln -sf "$INSTALLED_BIN" "$BIN_DIR/knowlery"

# --- 4. verify before claiming success ----------------------------------------
VERSION=$("$BIN_DIR/knowlery" --version) || fail "installed binary failed to run."
say "Installed knowlery ${VERSION} -> ${BIN_DIR}/knowlery"

# --- 5. PATH: consent, never silence ------------------------------------------
case ":$PATH:" in
  *":$BIN_DIR:"*)
    say "Done. ${BIN_DIR} is already on your PATH — try: knowlery --version"
    exit 0
    ;;
esac

# Pick the rc file for the user's shell.
SHELL_NAME=$(basename "${SHELL:-sh}")
case "$SHELL_NAME" in
  zsh)  RC_FILE="$HOME/.zshrc";  APPEND_LINE="export PATH=\"$BIN_DIR:\$PATH\"" ;;
  bash) if [ "$(uname)" = "Darwin" ]; then RC_FILE="$HOME/.bash_profile"; else RC_FILE="$HOME/.bashrc"; fi
        APPEND_LINE="export PATH=\"$BIN_DIR:\$PATH\"" ;;
  fish) RC_FILE="$HOME/.config/fish/config.fish"; APPEND_LINE="fish_add_path $BIN_DIR" ;;
  *)    RC_FILE=""; APPEND_LINE="export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

say ""
say "${BIN_DIR} is not on your PATH. To use 'knowlery' directly, this line is needed:"
say ""
say "    $APPEND_LINE"
say ""

do_append() {
  # Marker-guarded: never a second line on re-runs.
  if [ -f "$RC_FILE" ] && grep -qF "$MARKER" "$RC_FILE"; then
    say "PATH line already present in $RC_FILE (marker found) — nothing to do."
  else
    printf '\n%s\n%s\n' "$MARKER" "$APPEND_LINE" >> "$RC_FILE"
    say "Added to $RC_FILE. Open a new terminal (or 'source $RC_FILE'), then: knowlery --version"
  fi
}

manual_note() {
  say "No files were modified. To finish manually, add the line above to your shell config"
  say "(e.g. $RC_FILE), or invoke via: $BIN_DIR/knowlery"
}

if [ -z "$RC_FILE" ]; then
  manual_note
  exit 0
fi

if [ "$ASSUME_YES" = "1" ]; then
  do_append
  exit 0
fi

# stdin is the pipe under `curl | sh` — prompt via the terminal when there is one.
if [ -r /dev/tty ]; then
  printf 'Append it to %s now? [y/N] ' "$RC_FILE"
  read -r ANSWER < /dev/tty || ANSWER=""
  case "$ANSWER" in
    y|Y|yes|YES) do_append ;;
    *)           manual_note ;;
  esac
else
  manual_note
fi
