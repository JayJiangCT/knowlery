#!/usr/bin/env python3
"""Compute the Knowlery v0.3.1 change-detection digest of a file's evidence scope.

Usage:
  digest.py <file> [--scope source|record|claim] [--claim ^cN]

Scopes (CONVENTIONS.md §7):
  source  body after the frontmatter (whole file if no frontmatter)      [default]
  record  frontmatter end -> first "## Sources", "## History" or "## Related" heading
          (auto-selected when the file's frontmatter has `type: record`)
  claim   one claim line (--claim ^cN) with "(src: …)", "#disputed" and the id removed,
          whitespace collapsed

Normalization: line endings -> \\n, strip trailing whitespace per line, strip leading/trailing
blank lines, SHA-256 over UTF-8. Prints "sha256:<hex>".
"""
import hashlib, re, sys

def split_frontmatter(text):
    m = re.match(r"^---\r?\n.*?\r?\n---\r?\n?", text, re.S)
    return text[m.end():] if m else text

def normalize(s):
    lines = [l.rstrip() for l in s.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return "\n".join(lines)

def scope_source(text):
    return split_frontmatter(text)

def scope_record(text):
    body = split_frontmatter(text)
    m = re.search(r"^## (Sources|History|Related)\s*$", body, re.M)
    return body[:m.start()] if m else body

def scope_claim(text, cid):
    cid = cid if cid.startswith("^") else "^" + cid
    for line in text.splitlines():
        if line.rstrip().endswith(" " + cid):
            l = line.rstrip()[: -len(cid)]
            l = re.sub(r"\(src:[^)]*\)", "", l)
            l = l.replace("#disputed", "")
            l = re.sub(r"^\s*-\s*", "", l)
            return re.sub(r"\s+", " ", l).strip()
    sys.exit(f"claim {cid} not found")

def digest(text, scope="source", claim=None):
    if scope == "source": s = scope_source(text)
    elif scope == "record": s = scope_record(text)
    elif scope == "claim": s = scope_claim(text, claim)
    else: sys.exit("unknown scope")
    return "sha256:" + hashlib.sha256(normalize(s).encode("utf-8")).hexdigest()

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    path = args[0]; scope = "source"; claim = None
    if re.match(r"^---\n.*?^type:\s*record\s*$.*?\n---\n", open(path, encoding="utf-8").read(), re.S | re.M): scope = "record"
    if "--scope" in args: scope = args[args.index("--scope") + 1]
    if "--claim" in args: claim = args[args.index("--claim") + 1]; scope = "claim"
    print(digest(open(path, encoding="utf-8").read(), scope, claim))
