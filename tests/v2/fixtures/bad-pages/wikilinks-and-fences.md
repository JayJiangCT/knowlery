---
type: concept
title: Wikilinks and fences
description: Tests wikilink detection and code fence ignoring.
status: current
created: 2026-10-01
updated: 2026-11-18
---
# Wikilinks and fences

## Evidence
See [[a]] and ![[a.png]] and [Valid](other.md) and ![Img](pic.png) and [Ext](https://example.com).

```markdown
## Current
- Fake claim [[ignored]] and ![[ignored.png]]
```

~~~text
## History
[[also-ignored]]
~~~
