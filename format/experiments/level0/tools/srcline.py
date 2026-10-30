#!/usr/bin/env python3
"""Print the version part of a `## Sources` line for a vault file.

Usage: srcline.py <vault-root> <vault-relative-path.md> [--scope source|record]

Prints  "sha256:<digest> · blob:<40 hex>"  when the file exists and is committed in the vault's git
history (blob = git rev-parse HEAD:<path>), "sha256:<digest>" when it exists but is not committed,
or "unverified" when the file is absent from the vault.
"""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from digest import digest

root, rel = sys.argv[1], sys.argv[2]
scope = sys.argv[sys.argv.index("--scope") + 1] if "--scope" in sys.argv else "source"
path = os.path.join(root, rel)
if not os.path.exists(path):
    print("unverified"); sys.exit(0)
d = digest(open(path, encoding="utf-8").read(), scope)
try:
    blob = subprocess.check_output(["git", "-C", root, "rev-parse", f"HEAD:{rel}"], stderr=subprocess.DEVNULL, text=True).strip()
    print(f"{d} · blob:{blob}")
except subprocess.CalledProcessError:
    print(d)
