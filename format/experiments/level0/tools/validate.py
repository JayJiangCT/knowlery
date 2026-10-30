#!/usr/bin/env python3
"""Validate v0.3.1 Knowledge pages and Records (CONVENTIONS.md §4–§7).

Usage: validate.py <file.md> [more files...]      exit 1 on any error
Checks: flat frontmatter; required keys; section order; block ids unique and last token;
(src: …) ids resolve to ## Sources; [[#^cN]] / [[#^qN]] intra-page links resolve;
Current contains no superseded line; History lines with an id carry 'superseded';
Sources line shape; Records have date/kind.
"""
import re, sys, yaml

K_ORDER = ["Current", "Evidence", "Open", "Sources", "History", "Related"]
R_ORDER = ["Summary", "Detail", "Sources", "History", "Related"]
STATUS = {"draft", "current", "disputed", "superseded", "archived"}
KINDS = {"source", "record", "attestation", "derived"}

def check(path):
    errs = []
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m: return [f"{path}: no frontmatter"]
    try: fm = yaml.safe_load(m.group(1)) or {}
    except Exception as e: return [f"{path}: yaml error {e}"]
    body = m.group(2)
    for k, v in fm.items():
        if isinstance(v, dict) or (isinstance(v, list) and any(isinstance(x, (dict, list)) for x in v)):
            errs.append(f"nested frontmatter key {k}")
    for k in ["type", "title", "description", "tags", "status", "updated", "updated_by"]:
        if k not in fm: errs.append(f"missing {k}")
    if fm.get("status") not in STATUS: errs.append(f"bad status {fm.get('status')}")
    is_record = fm.get("type") == "record"
    if is_record:
        for k in ["date", "kind"]:
            if k not in fm: errs.append(f"record missing {k}")
    heads = re.findall(r"^## (.+?)\s*$", body, re.M)
    order = R_ORDER if is_record else K_ORDER
    seq = [h for h in heads if h in order]
    if seq != sorted(seq, key=order.index): errs.append(f"section order {seq}")
    unknown = [h for h in heads if h not in order]
    if unknown: errs.append(f"unknown sections {unknown}")
    # sections
    sec = {}
    parts = re.split(r"^## (.+?)\s*$", body, flags=re.M)
    for i in range(1, len(parts), 2): sec[parts[i]] = parts[i + 1]
    # block ids
    ids = re.findall(r"\s(\^[cq]\d+)\s*$", body, re.M)
    dup = {i for i in ids if ids.count(i) > 1}
    if dup: errs.append(f"duplicate ids {sorted(dup)}")
    stray = re.findall(r"(\^[cq]\d+)(?!\]\])(?=\S)", body)
    for s_ in set(stray):
        if s_ not in ids: errs.append(f"id {s_} not at end of a line")
    # sources
    src_ids = set()
    for line in sec.get("Sources", "").splitlines():
        if not line.startswith("- "): continue
        f = [x.strip() for x in line[2:].split(" · ")]
        if len(f) < 4: errs.append(f"short Sources line: {line[:60]}"); continue
        src_ids.add(f[0])
        if f[3] not in KINDS: errs.append(f"bad kind in {f[0]}: {f[3]}")
        if not re.match(r"^(sha256:[0-9a-f]{64}|fetched:\d{4}-\d{2}-\d{2}|stated:\d{4}-\d{2}-\d{2}|unverified|@pin)$", f[2]):
            errs.append(f"bad version in {f[0]}: {f[2]}")
        if f[3] == "attestation" and len(f) < 5: errs.append(f"attestation {f[0]} has no note")
        if f[3] == "source" and f[1].startswith("http") and "no-snapshot" not in line and "blob:" not in line:
            errs.append(f"URL source {f[0]} lacks no-snapshot")
    for ref in re.findall(r"\(src:([^)]*)\)", body):
        for i in [x.strip() for x in ref.split(",")]:
            if i not in src_ids: errs.append(f"(src: {i}) not in Sources")
    # intra-page links
    for l in re.findall(r"\[\[#(\^[cq]\d+)\]\]", body):
        if l not in ids: errs.append(f"link [[#{l}]] has no anchor")
    # current/history consistency
    cur = sec.get("Current", "")
    if "superseded" in cur and not is_record: errs.append("'superseded' text inside Current")
    for line in sec.get("History", "").splitlines():
        if re.search(r"\s\^c\d+\s*$", line) and "superseded" not in line and "revised" not in line:
            errs.append(f"History line with id lacks 'superseded': {line[:50]}")
    for line in cur.splitlines():
        if line.startswith("- ") and not re.search(r"\s\^c\d+\s*$", line):
            errs.append(f"Current item without claim id: {line[:50]}")
        if line.startswith("- ") and "(src:" not in line:
            errs.append(f"claim without (src:): {line[:50]}")
    return [f"{path}: {e}" for e in errs]

if __name__ == "__main__":
    bad = 0
    for p in sys.argv[1:]:
        for e in check(p): print(e); bad += 1
    print("OK" if not bad else f"{bad} problem(s)")
    sys.exit(1 if bad else 0)
