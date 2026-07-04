# F3 (0.7.0) — `knowlery query` / `knowlery stale`

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.7.0
- **Branch:** `cursor/07-f3-query-commands-92eb` (stacked on 0.7 F2)
- **Depends on:** F2 (CLI shell), 0.6.0 F2/F3 (engine, staleness)

## 1. Problem statement

The CLI can create and maintain a workspace (F2) but cannot yet ask it anything. The
retrieval and staleness engines are already pure and already have two transports
(in-app `knowlery:query`/`knowlery:stale`, vault-embedded `query.mjs`); a globally
installed `knowlery` should expose them as first-class commands so a CLI-only user
never needs to know the embedded script's path.

## 2. Goals

1. `knowlery query "<question>" [--dir <path>] [--k <n>] [--json]` and
   `knowlery stale [--dir <path>] [--json]`, wrapping the existing engine and
   staleness modules directly (they are already in the CLI bundle via F2's `health`).
2. Byte-identical output with the other transports for the same vault state — via the
   shared renderers, asserted by test.
3. The vault-embedded `query.mjs` remains unchanged and continues to ship: it is the
   zero-install path for agents working in a vault whose owner never installed the CLI.

## 3. Non-goals

- No skill changes: teaching `/ask`/`/cook` about this third transport is F5's
  environment-adaptivity work.
- No init gate: like the embedded script (and unlike `sync`/`health`), `query` and
  `stale` are read-only scans that work on any markdown folder; requiring
  initialization would only reduce usefulness.
- No new engine behavior, flags, or ranking changes of any kind.

## 4. Design

- `src/cli/commands/query.ts`: `runQueryCommand(root, { question, k = 12, json, log })`
  → `scanVault(root)` → `runQuery` → `formatQueryResult`. Abstention prints the
  standard `No confident matches…` line and exits 0 (absence of knowledge is a result,
  not an error), matching the embedded script.
- `src/cli/commands/stale.ts`: `runStaleCommand(root, { json, log })` →
  `computeStaleness(scanVault(root))` → `formatStalenessReport`.
- `src/cli/main.ts` dispatch gains the two commands and `--k <n>`; usage text updated.
  `query` takes the question as the positional argument after the command.
- README CLI section gains both commands.

## 5. Acceptance criteria

1. On the eval fixture vault, `knowlery query` output is byte-identical to
   `formatQueryResult(runQuery(...))` and to the embedded script's output for the same
   question and k (transport-parity test, same pattern as 0.6 F5).
2. `knowlery stale` output is byte-identical to `formatStalenessReport(computeStaleness(...))`.
3. Abstention exits 0 with the standard message; missing question exits 2 with usage.
4. The spawn smoke test extends to `query` and `stale` in the round trip.
5. `npm test`, `npm run lint`, `npm run build`, `npm run eval -- --assert-baseline`
   green; purity guard covers the two new command modules; embedded `query.mjs`
   byte-unchanged (generated module has no diff).

## 6. Maintainer self-test checklist (acceptance round)

1. `npm run build`, then in your real vault:
   `node knowlery-cli.mjs query --dir <vault> "a question you know the answer to"` —
   compare with `node <vault>/.knowlery/bin/query.mjs "<same question>"`: identical.
2. `node knowlery-cli.mjs stale --dir <vault>` — same report as `obsidian knowlery:stale`.
3. `node knowlery-cli.mjs query --dir <vault> "something the vault cannot answer"` —
   the abstention line, exit 0.
4. `npm test && npm run eval -- --assert-baseline` — green.
