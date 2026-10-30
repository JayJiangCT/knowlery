#!/usr/bin/env python3
"""Generate the human equivalence worksheet for the Level 0 Test arm.

Usage: equivalence.py <pilot-checkout> <kit-dir> [--threshold 0.45] > review/EQUIVALENCE-WORKSHEET.md

For every page in pages.txt it compares the 1.x original with the migrated page:
  Knowledge pages: every 1.x statement (bullet, table row or sentence) is matched to the best
      Test line (claim in Current, History line, Open item or Evidence text) by token overlap,
      and every Test claim is matched back to the best 1.x statement. Items under the
      threshold are listed for the reviewer; items above it are counted as "matched".
  Records: the 1.x body and the Test Summary+Detail are compared sentence by sentence after
      normalisation (links, headings, whitespace). Only sentences missing on one side are listed.
The reviewer decides each listed item; the script never decides equivalence.
"""
import os, re, sys, collections

STOP = set("the a an and or of to in on for with by is are was were be as at from that this it its not no than then into over under any all one two per if so do does did has have had will would should may can could which who what when where why how more most".split())

def tokens(s):
    s = re.sub(r"\[\[([^\]|]+)(\|[^\]]*)?\]\]", r"\1", s)
    s = re.sub(r"\(src:[^)]*\)|\^[cq]\d+|#disputed|`|\*\*|__", " ", s)
    w = re.findall(r"[A-Za-z0-9][A-Za-z0-9._/-]*", s.lower())
    return {x for x in w if x not in STOP and len(x) > 1}

def jaccard(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0

def split_fm(t):
    m = re.match(r"^---\n.*?\n---\n", t, re.S)
    return t[m.end():] if m else t

def sections(body):
    out = collections.OrderedDict(); cur = "_pre"; out[cur] = []
    for line in body.splitlines():
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m: cur = m.group(2).strip(); out.setdefault(cur, []); continue
        out[cur].append(line)
    return out

NAV = re.compile(r"^(See |Also see |For .{0,40}see |\[!\w+\]|Source: |Sources: |Diagram: |Key additions:|Key details:)|^[A-Z][^.]{0,60}:$")
def navigational(s):
    """Cross-references, callout titles, section lead-ins and link lists carry no knowledge of their own."""
    if NAV.match(s): return True
    stripped = re.sub(r"\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)", "", s)
    return len(tokens(stripped)) < 4

def statements_1x(body):
    """1.x statements: bullets, table rows (not header/separator), and prose sentences."""
    items = []
    for sec, lines in sections(body).items():
        if sec in ("Related",): continue
        buf = []
        for l in lines:
            s = l.strip()
            if not s:
                if buf: items += [(sec, x) for x in sentences(" ".join(buf))]; buf = []
                continue
            if s.startswith(("- ", "* ", "> ")) or re.match(r"^\d+\.\s", s):
                if buf: items += [(sec, x) for x in sentences(" ".join(buf))]; buf = []
                s = re.sub(r"^(- |\* |> |\d+\.\s|\[!\w+\]\s*)", "", s).strip()
                if len(tokens(s)) >= 4 and not navigational(s): items.append((sec, s))
            elif s.startswith("|"):
                if re.match(r"^\|[\s\-:|]+\|$", s): continue
                cells = [c.strip() for c in s.strip("|").split("|")]
                row = " · ".join(c for c in cells if c)
                if len(tokens(row)) >= 4: items.append((sec, row))
            elif s.startswith("```") or s.startswith("![["):
                continue
            else:
                buf.append(s)
        if buf: items += [(sec, x) for x in sentences(" ".join(buf))]
    return items

def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z`\[(])", text)
    return [p.strip() for p in parts if len(tokens(p)) >= 4 and not navigational(p.strip())]

def test_lines(body):
    """Test lines with their kind."""
    out = []
    for sec, lines in sections(body).items():
        for l in lines:
            s = l.strip()
            if not s or s.startswith("|") and re.match(r"^\|[\s\-:|]+\|$", s): continue
            if sec == "Sources" or sec == "Related": continue
            if sec == "Current" and re.search(r"\^c\d+$", s):
                out.append(("claim " + re.search(r"(\^c\d+)$", s).group(1), s))
            elif sec == "History" and re.search(r"\^c\d+$", s):
                out.append(("history " + re.search(r"(\^c\d+)$", s).group(1), s))
            elif sec == "Open" and re.search(r"\^q\d+$", s):
                out.append(("open " + re.search(r"(\^q\d+)$", s).group(1), s))
            elif sec in ("Evidence", "Current") and len(tokens(s)) >= 4:
                out.append(("evidence", s))
            elif sec == "History" and len(tokens(s)) >= 4:
                out.append(("history-event", s))
    return out

def best(item_tokens, cands):
    b, bs = None, 0.0
    for kind, text, tk in cands:
        j = jaccard(item_tokens, tk)
        if j > bs: b, bs = (kind, text), j
    return b, bs

def short(s, n=110):
    s = re.sub(r"\s+", " ", s)
    return s if len(s) <= n else s[:n] + "…"

def knowledge_page(orig, test, thr):
    ob = split_fm(orig); tb = split_fm(test)
    items = statements_1x(ob)
    tl = [(k, t, tokens(t)) for k, t in test_lines(tb)]
    fwd_low = []; matched = 0
    for sec, s in items:
        b, sc = best(tokens(s), tl)
        if sc >= thr: matched += 1
        else: fwd_low.append((sec, s, b, sc))
    claims = [(k, t, tk) for k, t, tk in tl if k.startswith("claim")]
    ol = [(sec, s, tokens(s)) for sec, s in items]
    back_low = []; bmatched = 0
    for k, t, tk in claims:
        b, sc = best(tk, [(sec, s, x) for sec, s, x in ol])
        if sc >= thr: bmatched += 1
        else: back_low.append((k, t, b, sc))
    return items, claims, matched, fwd_low, bmatched, back_low

def norm_sent(s):
    s = re.sub(r"\[\[([^\]|]+)(\|[^\]]*)?\]\]", r"\1", s)
    s = re.sub(r"queries/|concepts/|entities/|comparisons/|\.md", "", s)
    s = re.sub(r"[`*_>#|]", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()

def record_page(orig, test):
    ob = split_fm(orig); tb = split_fm(test)
    def sents(body, skip):
        out = []
        for sec, lines in sections(body).items():
            if sec in skip: continue
            text = " ".join(l.strip() for l in lines if l.strip() and not l.strip().startswith("```"))
            out += [norm_sent(x) for x in sentences(text)]
        return [x for x in out if len(tokens(x)) >= 5]
    o = sents(ob, {"Related"})
    t = sents(tb, {"Related", "Sources", "History"})
    oset, tset = set(o), set(t)
    missing = [x for x in o if x not in tset]
    added = [x for x in t if x not in oset and not x.startswith(("summary", "detail"))]
    # fuzzy rescue: sentence present with small edits
    tt = [(x, tokens(x)) for x in t]
    miss2 = []
    for x in missing:
        b, sc = best(tokens(x), [("t", y, tk) for y, tk in tt])
        if sc < 0.8: miss2.append((x, sc))
    oo = [(x, tokens(x)) for x in o]
    add2 = []
    for x in added:
        b, sc = best(tokens(x), [("o", y, tk) for y, tk in oo])
        if sc < 0.8: add2.append((x, sc))
    return len(o), len(t), miss2, add2

def main():
    pilot, kit = sys.argv[1], sys.argv[2]
    thr = float(sys.argv[sys.argv.index("--threshold") + 1]) if "--threshold" in sys.argv else 0.25
    pages = [l.strip() for l in open(os.path.join(kit, "pages.txt")) if l.strip() and not l.startswith("#")]
    P = []
    P.append("# Human equivalence worksheet — Level 0 Test arm\n")
    P.append(f"Generated by `tools/equivalence.py` (threshold {thr}). The script matches text; **it does not decide equivalence**. For each listed item, write one of: `ok` (the content is there in a form you accept), `fix` (content lost or changed; edit the Test page and log it), `drop-ok` (1.x text that was reasoning/duplication and need not survive). Items not listed had a match at or above the threshold; spot-check a few.\n")
    P.append("## How to fill the sign-off table in PROTOCOL.md\n\nA page passes when every listed item below for it is `ok` or `drop-ok`. A page with any `fix` is reworked, validated with `tools/validate.py`, logged in `migration-log.md`, and re-checked. Record `pass` / `pass-with-notes` / `fix needed` per page.\n")
    for rel in pages:
        o = open(os.path.join(pilot, rel), encoding="utf-8").read()
        trel = rel.replace("queries/", "records/")
        t = open(os.path.join(kit, "test", trel), encoding="utf-8").read()
        P.append(f"\n---\n\n## `{rel}` → `test/{trel}`\n")
        if rel.startswith("queries/"):
            no, nt, miss, add = record_page(o, t)
            P.append(f"Record. 1.x body sentences: {no}; Test Summary+Detail sentences: {nt}. Sentences with no close counterpart (fuzzy < 0.8): **{len(miss)} missing from Test, {len(add)} new in Test**.\n")
            if miss:
                P.append("\n**In 1.x but not found in Test** — each must be `ok` (really there, matcher missed it) or `fix`:\n\n| # | 1.x sentence | best overlap | decision |\n|---|---|---|---|")
                for i, (x, sc) in enumerate(miss, 1): P.append(f"| {i} | {short(x, 160)} | {sc:.2f} | |")
            if add:
                P.append("\n**In Test but not in 1.x** — must be `ok` only if it is the Summary restating the page, otherwise `fix` (no new facts allowed):\n\n| # | Test sentence | best overlap | decision |\n|---|---|---|---|")
                for i, (x, sc) in enumerate(add, 1): P.append(f"| {i} | {short(x, 160)} | {sc:.2f} | |")
            if not miss and not add: P.append("\nNothing to review: all sentences have a close counterpart on the other side.")
        else:
            items, claims, matched, fwd_low, bmatched, back_low = knowledge_page(o, t, thr)
            P.append(f"Knowledge page. 1.x statements: {len(items)} ({matched} matched automatically); Test claims: {len(claims)} ({bmatched} matched back automatically).\n")
            P.append(f"\n**A. 1.x statements with no clear landing place in Test ({len(fwd_low)})** — decide `ok` / `fix` / `drop-ok`:\n\n| # | 1.x section | 1.x statement | best Test match | overlap | decision |\n|---|---|---|---|---|---|")
            for i, (sec, s, b, sc) in enumerate(fwd_low, 1):
                bt = f"{b[0]}: {short(b[1], 70)}" if b else "—"
                P.append(f"| {i} | {short(sec, 30)} | {short(s, 140)} | {bt} | {sc:.2f} | |")
            P.append(f"\n**B. Test claims with no clear 1.x origin ({len(back_low)})** — `ok` only if you can point to the 1.x sentence yourself; otherwise `fix` (a claim without an origin is invented or sharpened):\n\n| # | claim | text | best 1.x match | overlap | decision |\n|---|---|---|---|---|---|")
            for i, (k, tx, b, sc) in enumerate(back_low, 1):
                bt = f"{short(b[0], 25)}: {short(b[1], 70)}" if b else "—"
                P.append(f"| {i} | {k} | {short(tx, 140)} | {bt} | {sc:.2f} | |")
            P.append("\n**C. Modality check (manual, 2 minutes):** scan the Test `## Current` for *is / will / must* where 1.x said *should / proposed / expected / strongly supported*. Each such sharpening is a `fix` unless 1.x elsewhere states it flatly.")
    print("\n".join(P))

if __name__ == "__main__":
    main()
