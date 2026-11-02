# Decision record — CLI-first design and MCP Connector boundary

**Date:** 2026-11-02  
**Owner:** Knowlery 2.0 Owner  
**Status:** ACCEPTED — 2026-11-02 (recorded by Agent at Owner's explicit request)  
**Decides:** I-001 (component naming and boundaries), I-002 (CLI-first design priority), P-001 (decision recording discipline)  
**Branch:** `develop/2.0`

## Confirmed decisions

### I-001 — MCP Connector is a specific integration component

- **Knowlery CLI**: a standalone command-line interface for deterministic knowledge-base operations. Its v2 command surface and implementation have **not** been approved.
- **Agent Skills**: define intelligent Agent workflows for consuming, compiling, challenging and evolving knowledge.
- **Knowlery MCP Connector**: the **MCP integration component** exposing appropriate Knowlery capabilities to MCP-compatible Agent environments. The term `Connector` does **not** denote a new umbrella runtime housing the CLI, MCP and Adapters.
- **Knowlery Agent Plugin**: the distribution/integration package for target Agent platforms, potentially bundling Skills, registration/configuration and MCP integration. Its platform-specific contents remain to be designed.
- **Obsidian Plugin**: the optional user-facing Obsidian integration/UI, not a prerequisite to the portable Knowledge Format.

This terminology clarifies and refines the A-004 Architecture Baseline; it does **not** rename or approve a package layout. In particular, **whether the MCP Connector invokes the CLI as a subprocess or uses a shared deterministic operations library remains OPEN**. MCP transport, local/remote hosting, permissions, and Agent Plugin installation behavior are also open.

### I-002 — Start the next 2.0 design discussion with Knowlery CLI

The agreed **design discussion priority** is:

1. Knowlery CLI and its deterministic knowledge operation requirements, informed by the accepted Knowledge Format v1.0.
2. Agent Skills: intelligent workflows built upon available operations.
3. MCP Connector: exposing relevant operations to MCP clients.
4. Agent Plugin: integration, installation and distribution for Agent platforms.

This is **not** an approved engineering dependency graph or a mandate to implement all four in a strictly serial release sequence.

For CLI design, give explicit attention to the Level 1 obligations still recorded as **PARTIAL**: **F-005** (governance state persistence and conflict semantics) and **F-007** (deterministic safe writes). Their concrete algorithms and acceptance criteria are OPEN.

### P-001 — Record confirmed decisions in the 2.0 decision files

Owner explicitly requests that subsequent **jointly confirmed** Knowlery 2.0 design decisions be committed to the `develop/2.0` decision documentation, so they can drive eventual planning and development.

- Maintain an indexed entry in `docs/2.0/DECISIONS.md`.
- For substantive decisions, create or update the corresponding record under `docs/2.0/decisions/`, with evidence, alternatives, risks, validation needs and authorization basis.
- Distinguish **ACCEPTED**, **PROPOSED / OPEN**, and **PARTIAL**; Agent design suggestions alone are not Owner approval.
- Recheck the latest repository state before editing; avoid overwriting other agents' work.
- Record the actual commit or link after a successful GitHub write. Do not claim code has been implemented merely because a decision is documented.

## Evidence and authorization

- Owner clarified explicitly in the discussion that `Connector` refers to **MCP Connector**, not the proposed umbrella `Knowlery Connector` abstraction.
- Owner agreed to begin with CLI and requested ongoing commits of confirmed decisions to the existing 2.0 decision files.
- Existing `docs/2.0/ARCHITECTURE.md` already assigns deterministic operations to CLI/Adapters, intelligent behavior to Skills and optional protocol integration to MCP.
- Existing `docs/2.0/DECISIONS.md` shows F-005 and F-007 as PARTIAL following Knowledge Format v1.0 acceptance.

## Alternatives and boundary conditions

| Alternative | Disposition |
| --- | --- |
| Treat `Connector` as the umbrella for CLI, MCP and Adapters | Rejected as inconsistent with Owner's intended term |
| Treat `MCP Connector` as synonymous with Agent Plugin | Rejected: protocol integration and platform distribution are different responsibilities |
| Freeze CLI commands, backend selection and package topology now | Deferred: these are design proposals requiring review and tests |
| Immediately modify implementation files or publish a new package | Out of scope: this records agreements, not implementation authorization |

## Risks / next design questions

1. Identify existing 1.x CLI/MCP operations to KEEP, ADAPT, REPLACE or RETIRE, without assuming `src/core/` is the 2.0 core.
2. Define the minimal CLI operation contract against Knowledge Format v1.0 (read, trace, validate, impact, guarded write) before finalizing command names.
3. Specify what must be identical in Obsidian and Headless operation, and what may vary (e.g., search ranking).
4. Design and test F-005/F-007 guarantees; Level 0 file-only success is not proof of atomicity, concurrency protection or authorization enforcement.
5. Preserve the existing `main` 1.x release path; this decision record does not modify runtime code or user Vaults.

**Change policy:** If evidence or a future Owner decision supersedes any accepted item above, add a new traceable decision; do not silently rewrite this historical acceptance.
