# Usage: python3 -I pilot-stats.py <path-to-Knowlery-Pilot-checkout>
# Input for the committed snapshot: JayJiangCT/Knowlery-Pilot @ cf9e378
# Classification of `sources` entries: wikilink = starts with "[["; url = starts with "http";
# path = contains "/"; other = everything else (free-text attestations, BigQuery table ids, bare names).
# Dangling targets are counted as unique link targets not matching any .md basename in the checkout.
import sys, os, re, collections, json
import yaml

root = sys.argv[1]
dirs = ["entities", "concepts", "comparisons", "queries"]
pages = []
for d in dirs:
    for f in sorted(os.listdir(os.path.join(root, d))):
        if not f.endswith(".md"): continue
        p = os.path.join(root, d, f)
        txt = open(p, encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", txt, re.S)
        fm, body = ({}, txt)
        if m:
            try: fm = yaml.safe_load(m.group(1)) or {}
            except Exception as e: fm = {"__yaml_error__": str(e)}
            body = m.group(2)
        pages.append((d, f, fm, body))

print("pages:", len(pages), collections.Counter(d for d,_,_,_ in pages))
fields = collections.Counter()
for d,f,fm,b in pages:
    for k in fm: fields[k]+=1
print("\nFIELD COVERAGE (field: count):")
for k,v in fields.most_common(): print(f"  {k}: {v}")

def vals(key):
    c = collections.Counter()
    for d,f,fm,b in pages:
        v = fm.get(key)
        if isinstance(v, list): c["<list len %d>" % len(v)] += 1
        else: c[str(v)] += 1
    return c
for key in ["type","status","freshness_status","retrieval_priority","domain","confidence"]:
    print(f"\n{key}:", dict(vals(key).most_common(12)))

# sources
src_counts = collections.Counter(); src_forms = collections.Counter(); nosrc=0
for d,f,fm,b in pages:
    s = fm.get("sources")
    if not s: nosrc+=1; continue
    if isinstance(s,str): s=[s]
    src_counts[len(s)]+=1
    for x in s:
        x=str(x)
        if x.startswith("[["): src_forms["wikilink"]+=1
        elif x.startswith("http"): src_forms["url"]+=1
        elif "/" in x: src_forms["path"]+=1
        else: src_forms["other"]+=1
print("\nsources count dist:", dict(sorted(src_counts.items())), "no sources:", nosrc)
print("sources forms:", dict(src_forms))

# body stats
wl = re.compile(r"\[\[([^\]|#]+)")
hdrs = collections.Counter(); sizes=[]; links=[]; emb=0
for d,f,fm,b in pages:
    sizes.append((len(b.splitlines()), d, f))
    links.append(len(set(wl.findall(b))))
    for h in re.findall(r"^#{1,3}\s+(.+)$", b, re.M): hdrs[(d,h.strip())]+=1
import statistics
print("\nbody lines: median", statistics.median(s for s,_,_ in sizes), "max", max(sizes)[:1], "min", min(sizes)[:1])
print("outbound wikilinks/page: median", statistics.median(links), "zero-link pages", sum(1 for l in links if l==0))
print("\nTOP HEADERS by type:")
for d in dirs:
    top=[(h,c) for (dd,h),c in hdrs.items() if dd==d]
    top.sort(key=lambda x:-x[1])
    print(" ",d, top[:14])

# dangling links
names = {os.path.splitext(f)[0] for _,f,_,_ in pages}
allmd = set()
for dp,_,fs in os.walk(root):
    if "/.git" in dp: continue
    for f in fs:
        if f.endswith(".md"): allmd.add(os.path.splitext(f)[0])
dang=collections.Counter()
for d,f,fm,b in pages:
    for t in set(wl.findall(b)):
        t=t.strip().split("/")[-1]
        if t not in allmd: dang[t]+=1
print("\ndangling link targets:", len(dang), "top:", dang.most_common(10))

# supersession fields
for key in ["superseded_by","supersedes","related","freshness_sidecar","freshness_reviewed","aliases"]:
    n=sum(1 for _,_,fm,_ in pages if fm.get(key))
    print(f"{key} present(non-empty): {n}")
