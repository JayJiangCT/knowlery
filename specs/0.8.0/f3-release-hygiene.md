# F3 (0.8.0) — Release Engineering Hygiene

- **Status:** Draft — awaiting maintainer spec acceptance
- **Target release:** 0.8.0
- **Branch:** `cursor/08-f3-release-hygiene-92eb` (off `main` @ 0.8 F2)
- **Depends on:** — (independent of F1/F2; source of scope: 0.7.0 release findings,
  consolidated in the 0.8 README backlog ledger)

## 1. Problem statement

The 0.7.0 release surfaced four pieces of engineering debt in the publish path, all
recorded at the time:

1. **Long-lived npm token.** Publishing authenticates with an `NPM_TOKEN` secret —
   the exact mechanism that broke the 0.7.0 release (2FA rejection, token
   regeneration, secret update). npm revoked classic tokens in late 2025 and the
   ecosystem direction is clear: granular tokens expire and need rotation forever,
   while **Trusted Publishing (OIDC)** removes the credential entirely — npmjs.com
   trusts this repo's `release.yml` identity directly, with provenance attestations
   generated automatically.
2. **Non-idempotent publish.** If the release workflow re-runs on the same tag
   (exactly what happened while debugging 0.7.0), the GitHub-release step tolerates
   it but `npm publish` fails hard with a version-conflict error, painting the whole
   run red for a release that is actually fine.
3. **`bin` path warning.** `"knowlery": "./knowlery-cli.mjs"` — npm cleans the `./`
   prefix at publish time and warns about it on every release.
4. **CLI EPIPE crash.** `knowlery query ... | head -1` (or any consumer that closes
   the pipe early — pagers, `grep -m1`, agents truncating output) kills the process
   with an unhandled `EPIPE` stack trace and exit 1. For a CLI whose primary users
   are agents piping output, a closed pipe is a normal end of conversation, not an
   error.

## 2. Goals

1. `release.yml` publishes to npm via OIDC Trusted Publishing — no token secret in
   the workflow, provenance automatic. `package.json` gains the `repository` field
   the OIDC identity check matches against.
2. Re-running the release workflow on an already-published tag succeeds as a no-op
   (both the GitHub release and the npm publish steps).
3. `npm publish --dry-run` is warning-clean (bin path fixed).
4. Piping CLI output to an early-closing consumer exits 0, silently.

## 3. Non-goals

- No change to the release *process* (tag push triggers; lockstep plugin+CLI
  versioning; changelog-derived notes; attestations on plugin artifacts all stay).
- No npm scope change, no package rename, no `engines` bump for consumers (the CLI
  bundle still targets node 18; node 24 is a build-time requirement of the publish
  step only).
- No publishing of the plugin itself to npm — this is about the existing CLI package.

## 4. Design

### 4.1 Trusted Publishing migration (`release.yml`)

Per current npm docs: requires npm CLI ≥ 11.5.1 and Node ≥ 22.14 in the workflow, a
GitHub-hosted runner, `id-token: write` (already present since the attestation work),
and a one-time trusted-publisher registration on npmjs.com.

Workflow changes to the "Publish CLI to npm" step:

- Node setup for the publish step moves to Node 24 with
  `registry-url: https://registry.npmjs.org`, followed by `npm install -g npm@latest`
  (runners bundle an npm older than 11.5.1).
- `npm publish` runs with **no** `NODE_AUTH_TOKEN` — the token block and its
  skip-if-unset guard are deleted. Known interference to avoid: a leftover
  `_authToken` in `.npmrc` breaks the OIDC exchange, so nothing may write one.
- Provenance needs no flag — automatic under trusted publishing from a public repo.
- Prerelease tags keep `--tag beta`.
- **`package.json` gains a `repository` field** (maintainer finding at spec review —
  P1): the npm troubleshooting docs state that when publishing from GitHub, the
  manifest's `repository.url` must match the GitHub repo exactly; today the field is
  absent entirely. Add:

  ```json
  "repository": { "type": "git", "url": "git+https://github.com/JayJiangCT/knowlery.git" }
  ```

**Maintainer one-time actions (§6):** on npmjs.com → package `knowlery` → Settings →
Trusted Publisher: GitHub Actions, owner `JayJiangCT`, repo `knowlery`, workflow
filename `release.yml` (exact, case-sensitive, `.yml` included), and under **Allowed
actions** select at least `npm publish` (maintainer finding at spec review — the
current config UI requires choosing permitted actions; without it the publish is
rejected even with matching identity fields). Then delete the `NPM_TOKEN` GitHub
secret and revoke the token on npmjs.com. Failure mode if misconfigured: `ENEEDAUTH`
at publish — the fix is always "make the identity fields match exactly and check the
allowed actions".

### 4.2 Idempotent publish

Before `npm publish`, the step checks the registry:

```bash
if npm view "knowlery@${VERSION}" version >/dev/null 2>&1; then
  echo "knowlery@${VERSION} already on the registry — skipping publish (idempotent re-run)."
  exit 0
fi
```

`VERSION` comes from `manifest.json` (already validated to match the tag). The
GitHub-release step (`softprops/action-gh-release`) is already idempotent — it
updates the existing release for the tag — so the npm step was the only red-on-rerun.

### 4.3 `bin` path fix

`package.json`: `"knowlery": "./knowlery-cli.mjs"` → `"knowlery": "knowlery-cli.mjs"`.
Verified by `npm publish --dry-run` emitting no `was cleaned` warning; the §6
checklist includes the dry-run so the fix is observed rather than assumed.

### 4.4 CLI EPIPE handling

`src/cli/main.ts` installs, before anything writes: an `error` listener on
`process.stdout`/`process.stderr` that treats `EPIPE` as an orderly exit
(`process.exit(0)`) and re-throws anything else. This is the one idiomatic place to
handle it — every command writes through the shared `log` closure, and stream errors
arrive asynchronously, so per-call handling would be both scattered and racy.

Tested at the smoke level on the built artifact, over a query with multi-line output —
the exact agent-pipes-to-head shape from the 0.7.0 finding. **Test-validity note
(maintainer finding at spec review — P1):** a plain `bash -c '… | head -1'` reports
`head`'s exit status and would be falsely green even while node dies of EPIPE, so the
assertion must observe the *node* side of the pipe:

```bash
bash -o pipefail -c 'node knowlery-cli.mjs query ... | head -1'
```

(or equivalently check `${PIPESTATUS[0]}`), plus asserting stderr carries no stack
trace.

## 5. Acceptance criteria

1. `release.yml` publish step is token-free — no `NPM_TOKEN` reference remains in
   workflows or runtime source (historical spec/changelog documentation exempt —
   maintainer wording fix at spec review) — ensures npm ≥ 11.5.1, and is guarded by
   the §4.2 registry check.
2. `package.json` bin entry has no `./` prefix and the `repository` field matches
   this GitHub repo; `npm publish --dry-run` runs warning-clean (§6 verification).
3. Smoke test: piping built-CLI query output into `head -1` exits 0 **as observed
   with `pipefail`/`PIPESTATUS[0]` on the node side**, prints the first line only,
   and writes no stack trace — asserted in `tests/cli/smoke.test.ts`.
4. `npm test`, lint, build, eval `--assert-baseline` green.
5. **Deferred-to-release verification (recorded, not CI-checkable):** the first tag
   push after this merges (0.8.0 itself) is the end-to-end proof of the OIDC path —
   publish succeeds with no token, npmjs.com shows provenance, and a manual re-run of
   the workflow on that tag comes back green as a no-op.

## 6. Maintainer self-test checklist (acceptance round)

1. On npmjs.com, register the trusted publisher for `knowlery` (fields **and allowed
   actions** per §4.1); then delete the `NPM_TOKEN` GitHub secret and revoke the npm
   token.
2. Locally: `npm run build && npm publish --dry-run` — confirm the file list is
   `knowlery-cli.mjs` + `README.md` + `LICENSE` and there is no bin-cleaning warning.
3. Locally: `knowlery query "<anything>" | head -1` in an initialized vault — first
   line, exit 0, no stack.
4. `npm test && npm run eval -- --assert-baseline` — green.
5. At 0.8.0 release time: confirm §5.5 (publish over OIDC, provenance visible,
   re-run green).
