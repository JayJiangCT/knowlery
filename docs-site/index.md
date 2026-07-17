---
layout: home

hero:
  name: Knowlery
  text: The knowledge base your agents can live in.
  tagline: "One plain-markdown workspace, three shells: an MCP server and CLI for Codex, Claude, Cursor, and Antigravity — and an Obsidian plugin as its richest human interface. Obsidian maximizes it; nothing about it requires Obsidian."
  image:
    src: /knowlery-app-icon.svg
    alt: Knowlery Atlas Fold mark
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: Connect Your Agent
      link: /guides/connect-your-agent
    - theme: alt
      text: Learn the Concepts
      link: /concepts/

features:
  - title: Ambient in every conversation
    details: Nine MCP tools make your knowledge base present in Codex, Claude, Cursor, and Antigravity — create, register, capture, query, and maintain KBs by talking.
  - title: Deterministic retrieval
    details: A measured, code-guaranteed engine with citations — and an honest "no confident match" instead of noise. Quality is held by CI, not hope.
  - title: The capture → cook → ask loop
    details: "\"Remember this\" lands in the inbox; /cook compiles it into cited knowledge pages; questions get answers with sources."
  - title: Knowledge bundles
    details: Share reviewed slices of your knowledge as portable bundles — publish to GitHub Releases, install from URLs, subscribe to updates.
  - title: A review UI when you want one
    details: The Obsidian plugin adds the action-first dashboard, Knowledge health, and the bundle sharing workflow on the same workspace.
  - title: Frozen under semver
    details: The workspace format, CLI surface, and MCP contracts are 1.0-frozen and pinned by contract tests — what you build on stays built.
---

<section class="knowlery-panel">

## What Knowlery Is

Knowlery is a knowledge base solution built for the agent era. Your
free-form notes remain yours; agents get a structured, retrievable layer —
`entities/`, `concepts/`, `comparisons/`, `queries/` — compiled from your
material through a reviewed pipeline, plus the skills and conduct that make
them good collaborators.

Everything is plain markdown in a plain folder: served to agents over MCP
and the CLI, and to you in Obsidian when you want the richest view.

</section>

<section class="knowlery-grid">
  <div class="knowlery-card">
    <h3>Start with your agent</h3>
    <p>One MCP config block, then everything is conversation: "set up a knowledge base", "remember this", "what do I know about…". No Obsidian required.</p>
  </div>
  <div class="knowlery-card">
    <h3>Start in Obsidian</h3>
    <p>Install the plugin, run the wizard, and review your knowledge visually — the same workspace is automatically available to every agent by name.</p>
  </div>
</section>

## Start Reading

- New to Knowlery? Start with [Getting Started](/getting-started/) — it forks into both paths.
- Coming from an agent? [Connect Your Agent](/guides/connect-your-agent), then [talk to your knowledge base](/guides/talk-to-your-kb).
- Want the mental model first? Read [Core Concepts](/concepts/).
- Something feels broken? Go to [Troubleshooting](/troubleshooting/).
- Need exact files, commands, and promises? Use the [Reference](/reference/) and the [Stability Contract](/reference/stability).
