#!/usr/bin/env python3
"""Build the Level 0 experiment working copies.

Usage: build.py <pilot-checkout> [--out work] [--tasks T01,T04,...] [--arms control,test]

For each arm and task it creates  <out>/<arm>/<task>/  = a copy of the Pilot checkout (with its
.git history) + the arm overlay, committed as "baseline", then the task fixture committed as the
actor the fixture names. Every copy is an independent git repository; run the Agent inside it.

Requires the Pilot checkout at commit cf9e378 (checked). Python 3.8+, git. No network.
"""
import os, re, shutil, subprocess, sys, hashlib
HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from digest import digest, scope_claim

PILOT_COMMIT = "cf9e378"
TASKS = [f"T{i:02d}" for i in range(1, 13)]
DRONE = "Wonder/Wonder Fulfillment/Projects/1P Drone Delivery"
MEDIUM_BAG = f"{DRONE}/Slack Clarification - Drone MVP Medium Bag Selection - 2026-08-12.md"
SCOPED_QUERIES = [l.split("/", 1)[1] for l in open(os.path.join(KIT, "pages.txt")) if l.startswith("queries/")]

def run(cmd, cwd, env=None):
    return subprocess.run(cmd, cwd=cwd, check=True, text=True, capture_output=True, env=env).stdout

def commit(vault, msg, author="process:build <build@knowlery.local>"):
    name, email = author.split(" <"); email = email.rstrip(">")
    run(["git", "add", "-A"], vault)
    run(["git", "-c", f"user.name={name}", "-c", f"user.email={email}", "commit", "-q", "--allow-empty", "-m", msg], vault)

def copy_pilot(pilot, dest):
    if os.path.exists(dest): shutil.rmtree(dest)
    shutil.copytree(pilot, dest, symlinks=True)

# ---------------------------------------------------------------- overlays
CONTROL_HEADER = """> [!note] LEVEL 0 EXPERIMENT — CONTROL ARM
> This is a working copy for an experiment. You may create and edit compiled pages (`concepts/`, `entities/`,
> `comparisons/`, `queries/`) and `log.md` under the Agent-Maintained Pages rules below; user notes stay read-only.
> Obsidian is NOT running and no Knowlery CLI is installed: use your file tools. Do not use the network.
> Do not commit or push.

"""
# Headless 1.x: the Pilot's read-only banner is replaced (it also suspended the page-writing rules), Obsidian CLI
# rules, skills and the query engine are removed so both arms work with file tools only (PROTOCOL, Arms).
CONTROL_RETRIEVAL = """## Knowledge Retrieval

When answering questions from this vault (not general knowledge):

1. Search compiled pages and user notes with your file tools for the subject terms
   (names, terms, nouns), not the request phrasing
2. Read promising candidates — prefer `status: reviewed` over `draft`, recent `updated`,
   and any `evidence via source:` notes
3. If nothing in the vault covers the question, say so — do not answer from general knowledge
4. Synthesize a direct answer with `[[wikilink]]` citations and explicit gaps

Every claim must be backed by vault notes.

"""
OBSIDIAN_CLI_LINES = ["- Use Obsidian CLI for all operations\n", "- Use Obsidian CLI for reading: `obsidian read file=\"...\"`\n"]
# The skills are removed, so rules that send the Agent to them are rewritten for file tools.
CONTROL_MD_WRITING = """# Obsidian Markdown Writing

When creating or editing a note, write Obsidian-flavored Markdown with your file tools:

- Correct wikilink syntax (`[[note]]` or `[[folder/note]]`)
- Proper YAML frontmatter structure
- Valid callout blocks and embeds
- Consistent heading hierarchy
- Proper tag placement and formatting

"""
SKILL_REFS = [("These notes are raw material for knowledge compilation via /cook.", "These notes are raw material for knowledge compilation."),
              ("See the /cook skill specification for the complete frontmatter schema. Key required fields:", "Key required fields:")]

def strip_skill_refs(s):
    s = re.sub(r"^# Obsidian Markdown Writing\n.*?(?=^# |\Z)", CONTROL_MD_WRITING, s, flags=re.S | re.M)
    for old, new in SKILL_REFS: s = s.replace(old, new)
    for l in OBSIDIAN_CLI_LINES: s = s.replace(l, "")
    return s

def headless_instructions(s):
    assert s.startswith("> [!warning] PILOT"), "Pilot banner not found"
    s = s.split("\n\n", 1)[1]
    s, n = re.subn(r"^### Obsidian CLI Only\n.*?(?=^### Writing Conventions)", "", s, flags=re.S | re.M)
    assert n == 1, "Obsidian CLI section not found"
    s, n = re.subn(r"^## Knowledge Retrieval\n.*?(?=^## Available Skills)", CONTROL_RETRIEVAL, s, flags=re.S | re.M)
    assert n == 1, "Knowledge Retrieval section not found"
    s, n = re.subn(r"^## Available Skills\n.*?(?=^# |^@)", "", s, flags=re.S | re.M)
    assert n == 1, "Available Skills section not found"
    return CONTROL_HEADER + strip_skill_refs(s)
CONTROL_DERIVED_NOTE = """

## Custody and fallback note (2026-10-30)

Once a Zipline job's Delivery Intent has reached `IN_PROGRESS` the drone has custody, so a Ground job that appears after it is a post-custody recovery rather than a reallocation of the same delivery. See [[concepts/drone-delivery-integration-strategy|Drone Delivery Integration Strategy]] (Partner-Confirmed MVP Integration Contract) and DELI-4660.
"""

def remove_runtime(vault):
    q = os.path.join(vault, ".knowlery", "bin")
    if os.path.isdir(q): shutil.rmtree(q)

def overlay_control(vault):
    for rel in ["AGENTS.md", os.path.join(".claude", "CLAUDE.md")]:
        p = os.path.join(vault, rel); s = open(p, encoding="utf-8").read()
        open(p, "w", encoding="utf-8").write(headless_instructions(s))
    rules = [os.path.join(".agents", "rules", f) for f in os.listdir(os.path.join(vault, ".agents", "rules"))]
    for rel in rules + ["SCHEMA.md"]:
        p = os.path.join(vault, rel); s = strip_skill_refs(open(p, encoding="utf-8").read())
        assert not re.search(r"`obsidian-markdown` skill|/cook|vault-conventions", s), f"skill reference left in {rel}"
        open(p, "w", encoding="utf-8").write(s)
    for d in [os.path.join(".claude", "skills"), os.path.join(".agents", "skills")]:
        q = os.path.join(vault, d)
        if os.path.isdir(q): shutil.rmtree(q)
    remove_runtime(vault)
    open(os.path.join(vault, ".knowlery", "activity-disabled"), "w").close()  # Activity Ledger off, as in Test
    p = os.path.join(vault, "concepts", "zipline-drone-deliveries-in-dispatch-portal.md")
    open(p, "a", encoding="utf-8").write(CONTROL_DERIVED_NOTE)

def overlay_test(vault):
    # remove 1.x agent config and the 1.x versions of scoped pages; install v0.3.1 pages
    for f in ["AGENTS.md", "KNOWLEDGE.md", "SCHEMA.md", "INDEX.base"]:
        q = os.path.join(vault, f)
        if os.path.exists(q): os.remove(q)
    for d in [".claude", ".agents"]:
        q = os.path.join(vault, d)
        if os.path.isdir(q): shutil.rmtree(q)
    remove_runtime(vault)
    for q in SCOPED_QUERIES:
        os.remove(os.path.join(vault, "queries", q.strip()))
    src = os.path.join(KIT, "test")
    for root, _, files in os.walk(src):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), src)
            dst = os.path.join(vault, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(os.path.join(root, f), dst)
    os.makedirs(os.path.join(vault, "tools"), exist_ok=True)
    shutil.copy2(os.path.join(HERE, "digest.py"), os.path.join(vault, "tools", "digest.py"))
    open(os.path.join(vault, "log.md"), "w", encoding="utf-8").write("# log\n\n## 2026-10-30\n- 00:00 · process:build · vault · Level 0 Test-arm baseline built from Pilot cf9e378 + v0.3.1 overlay\n")
    # CLAUDE.md / AGENTS.md pointers so harnesses load the conventions
    open(os.path.join(vault, "AGENTS.md"), "w", encoding="utf-8").write("Read `CONVENTIONS.md` first; it is the whole contract for this vault. Obsidian is not running; use file tools. Do not use the network. Do not commit or push.\n")
    os.makedirs(os.path.join(vault, ".claude"), exist_ok=True)
    open(os.path.join(vault, ".claude", "CLAUDE.md"), "w", encoding="utf-8").write("@../CONVENTIONS.md\n\nObsidian is not running; use file tools. Do not use the network. Do not commit or push.\n")

# ---------------------------------------------------------------- pin resolution (test arm)
PAGE_DIRS = ["concepts", "entities", "comparisons", "records", "queries"]

def resolve_resource(vault, res):
    """res is the inside of [[...]] possibly with #^cN. Returns (path, claim_id)."""
    target, _, anchor = res.partition("#")
    target = target.split("|")[0]
    if "/" in target:
        path = target + ".md"
    else:
        path = None
        for d in PAGE_DIRS:
            cand = os.path.join(d, target + ".md")
            if os.path.exists(os.path.join(vault, cand)): path = cand; break
    return path, (anchor if anchor.startswith("^") else None)

def pin(vault):
    changed = []
    for d in ["concepts", "entities", "comparisons", "records"]:
        dd = os.path.join(vault, d)
        if not os.path.isdir(dd): continue
        for f in sorted(os.listdir(dd)):
            p = os.path.join(dd, f); s = open(p, encoding="utf-8").read()
            if "@pin" not in s: continue
            out = []
            for line in s.splitlines():
                m = re.match(r"^- (s\d+) · \[\[([^\]]+)\]\] · @pin · (source|record|derived)(.*)$", line)
                if not m: out.append(line); continue
                sid, res, kind, rest = m.groups()
                path, claim = resolve_resource(vault, res)
                if path is None or not os.path.exists(os.path.join(vault, path)):
                    out.append(f"- {sid} · [[{res}]] · unverified · {kind}{rest} · missing from vault at build"); continue
                text = open(os.path.join(vault, path), encoding="utf-8").read()
                if kind == "derived" and claim:
                    ver = digest(text, "claim", claim); out.append(f"- {sid} · [[{res}]] · {ver} · derived{rest}"); continue
                scope = "record" if (kind == "record" and path.startswith("records/")) else "source"
                ver = digest(text, scope)
                try: blob = run(["git", "rev-parse", f"HEAD:{path}"], vault).strip()
                except subprocess.CalledProcessError: blob = None
                out.append(f"- {sid} · [[{res}]] · {ver} · {kind}" + (f" · blob:{blob}" if blob else "") + rest)
            new = "\n".join(out) + ("\n" if s.endswith("\n") else "")
            if new != s: open(p, "w", encoding="utf-8").write(new); changed.append(p)
    return changed

# ---------------------------------------------------------------- fixtures
def edit(vault, rel, old, new, count=1):
    p = os.path.join(vault, rel); s = open(p, encoding="utf-8").read()
    assert old in s, f"fixture anchor not found in {rel}: {old[:50]}"
    open(p, "w", encoding="utf-8").write(s.replace(old, new, count))

def append(vault, rel, text):
    open(os.path.join(vault, rel), "a", encoding="utf-8").write(text)

def add_frontmatter_key(vault, rel, line):
    p = os.path.join(vault, rel); s = open(p, encoding="utf-8").read()
    assert s.startswith("---\n")
    open(p, "w", encoding="utf-8").write(s.replace("\n---\n", f"\n{line}\n---\n", 1))

HUMAN = "Jay Jiang <human@knowlery.local>"
COOK = "process:cook <cook@knowlery.local>"

MEDIUM_BAG_ADDENDUM = """

## Update (2026-10-28)

Jay relayed Rob's follow-up: IKC Ops completed the sample testing. The mailed samples (the new August 2026 Medium bag, the PRD v26 default, and the guest packaging) fit the production Pod; the new Medium is confirmed as the MVP outer package and no further bag testing is planned before launch.
"""

def fixture(arm, task, vault):
    T = arm == "test"
    strategy = "concepts/drone-delivery-integration-strategy.md"
    contract = "records/zipline-mvp-partner-confirmed-contract-2026-07-30.md" if T else "queries/zipline-mvp-partner-confirmed-contract-2026-07-30.md"
    if task in ("T04", "T09"):
        append(vault, MEDIUM_BAG, MEDIUM_BAG_ADDENDUM)
        commit(vault, "Medium bag note: sample testing completed (2026-10-28)", HUMAN)
    elif task == "T06":
        old = "A fulfillment-capable direct-order Quote requires valid mass before Delivery Intent creation"
        new = "A fulfillment-capable direct-order Quote requires valid mass and outer dimensions before Delivery Intent creation"
        edit(vault, contract, old, new)
        commit(vault, "Partner contract: dimensions also required (owner edit)", HUMAN)
    elif task == "T08":
        add_frontmatter_key(vault, MEDIUM_BAG, "aliases:\n  - Medium bag decision\n  - MVP outer bag")
        commit(vault, "Medium bag note: add aliases", HUMAN)
    elif task == "T10":
        if T:
            edit(vault, strategy, "- The Robotic Arm is out of MVP scope; manual scale capture is the active measurement path (src: s13) ^c14",
                 "- The Robotic Arm is out of MVP scope; manual scale capture on a calibrated kitchen scale is the active measurement path (src: s13) ^c14")
        else:
            edit(vault, strategy, "The Robotic Arm is out of MVP scope; manual scale capture is the active measurement path.",
                 "The Robotic Arm is out of MVP scope; manual scale capture on a calibrated kitchen scale is the active measurement path.")
        commit(vault, "Strategy: clarify measurement path wording", COOK)
    elif task == "T11":
        if T:
            edit(vault, strategy, "never returns to Wonder (src: s10, s19, s20) ^c19", "never returns to Wonder (src: s10, s19, s20) #disputed ^c19")
            edit(vault, strategy, "## Open\n", "## Open\n- A Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP`, not `DELIVERY_INTENT_STATUS_IN_PROGRESS`, marks custody; unconfirmed, see [[#^c19]] ^q8\n")
            edit(vault, strategy, "status: disputed", "status: disputed")
            edit(vault, strategy, "## History\n", "## History\n- 2026-10-29 · [[#^c19]] marked disputed; [[#^q8]] opened · by process:cook\n")
        else:
            edit(vault, strategy, "freshness_status: active", "freshness_status: disputed")
            edit(vault, strategy, "- `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative irreversible custody boundary;",
                 "- `DELIVERY_INTENT_STATUS_IN_PROGRESS` is the authoritative irreversible custody boundary; **DISPUTED 2026-10-29**: a Zipline engineer reportedly said on 2026-10-27 that `DELIVERY_STATUS_PICKED_UP` marks custody instead; unconfirmed;")
        commit(vault, "Strategy: custody signal disputed", COOK)
    elif task == "T12":
        add_frontmatter_key(vault, MEDIUM_BAG, "decision_status: withdrawn")
        commit(vault, "Medium bag note: decision withdrawn (frontmatter)", HUMAN)
    # T01, T02, T03, T05, T07: no fixture

# ---------------------------------------------------------------- main
def main():
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    pilot = os.path.abspath(args[0])
    out = os.path.abspath(args[args.index("--out") + 1]) if "--out" in args else os.path.join(os.getcwd(), "work")
    tasks = args[args.index("--tasks") + 1].split(",") if "--tasks" in args else TASKS
    arms = args[args.index("--arms") + 1].split(",") if "--arms" in args else ["control", "test"]
    head = run(["git", "rev-parse", "--short", "HEAD"], pilot).strip()
    if not head.startswith(PILOT_COMMIT): sys.exit(f"Pilot checkout is at {head}, expected {PILOT_COMMIT}")
    for arm in arms:
        for task in tasks:
            vault = os.path.join(out, arm, task)
            copy_pilot(pilot, vault)
            run(["git", "checkout", "-q", "-B", f"level0-{arm}-{task}"], vault)
            if arm == "control": overlay_control(vault)
            else: overlay_test(vault)
            commit(vault, f"baseline: Level 0 {arm} arm")
            if arm == "test":
                changed = pin(vault)
                commit(vault, f"pin source versions ({len(changed)} pages)")
            fixture(arm, task, vault)
            print(f"built {vault}")
    print("done")

if __name__ == "__main__":
    main()
