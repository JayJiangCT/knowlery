# Automate with GitHub Actions

Use Actions for **human review, automated build and release**. Complete review in
Obsidian or with an agent; CI should only export and create the Release.

Track the saved review contract, not all private runtime state:

```bash
git add -f .knowlery/export-scope.json
git commit -m "Record knowledge bundle review"
git push
```

Do not commit the whole `.knowlery/` directory.

## Workflow

Create `.github/workflows/publish-bundle.yml`:

```yaml
name: Publish knowledge bundle
on:
  workflow_dispatch:
    inputs:
      seed: { required: true, type: string }
      version: { required: true, type: string }
      acknowledge_public_risks:
        required: true
        default: false
        type: boolean

permissions:
  contents: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Export requested version
        env:
          SEED: ${{ inputs.seed }}
          VERSION: ${{ inputs.version }}
        run: |
          npx --yes knowlery@1.2.6 bundle review "$SEED" --dir . --list
          npx --yes knowlery@1.2.6 bundle export "$SEED" \
            --dir . --bundle-version "$VERSION"
      - name: Publish release
        env:
          GH_TOKEN: ${{ github.token }}
          SEED: ${{ inputs.seed }}
          ACK_PUBLIC: ${{ inputs.acknowledge_public_risks }}
        run: |
          visibility="$(gh repo view "$GITHUB_REPOSITORY" --json visibility --jq '.visibility')"
          args=(bundle publish "$SEED" --dir . --repo "$GITHUB_REPOSITORY")
          if [[ "$visibility" == "PUBLIC" ]]; then
            [[ "$ACK_PUBLIC" == "true" ]] || exit 1
            args+=(--public --acknowledge-risks)
          fi
          npx --yes knowlery@1.2.6 "${args[@]}"
```

Run it from **Actions → Publish knowledge bundle → Run workflow**. Cross-repo
publishing needs a narrowly scoped GitHub App token or fine-grained PAT with
`contents: write` on the target.

::: warning CI is not a reviewer
Do not add approve-all or default `--force`. Content edits invalidate approvals;
the workflow should fail and send you back to review.
:::
