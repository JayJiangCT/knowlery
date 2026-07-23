# Share with an Agent

An agent can collect the scope and execute your decisions, but it must not decide
what is safe to publish.

```text
Use the Knowlery CLI to help me share a knowledge bundle.

Knowledge base: <registered name or vault path>
Topic/seed: <for example concepts/drone-delivery>
Version: 0.1.0
Target repository: owner/kb-bundles
Visibility: private

Check health, then show the complete bundle review checklist, including every
item and risk hint. Do not approve, flag, export, or publish anything yourself.
Stop after the checklist and wait for my decisions.
```

Reply with explicit Approved and Flagged IDs. Require the agent to restate the
repository, visibility, and version before publishing, and tell it not to use
`--force`.

For public publishing, require a complete public-risk list and fresh consent
before `--acknowledge-risks`. After publishing, the agent should return the
audience statement, URL, SHA-256, and install command exactly as printed. It
should use your existing `gh` login and never ask for a token.
