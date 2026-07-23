# 使用 GitHub Actions 分发

GitHub Actions 适合“人工审核，自动构建与发布”：审核决定仍在 Obsidian 或 Agent
会话中完成，CI 只执行确定性的导出和 GitHub Release 创建。

## 推荐边界

- 源码仓库只提交知识页面和 `.knowlery/export-scope.json`。
- 不要提交整个 `.knowlery/`；其中可能包含活动记录、报告和其他私有状态。
- 最简单的方案是在当前仓库创建 Release。
- 私有源码仓库向另一个分发仓库发布时，默认 `GITHUB_TOKEN` 通常不够，需要只对目标
  仓库授予 `contents: write` 的 GitHub App token 或细粒度 PAT。

首次记录审核状态：

```bash
git add -f .knowlery/export-scope.json
git commit -m "Record knowledge bundle review"
git push
```

## Workflow

创建 `.github/workflows/publish-bundle.yml`：

```yaml
name: Publish knowledge bundle

on:
  workflow_dispatch:
    inputs:
      seed:
        description: Seed concept ID
        required: true
        type: string
      version:
        description: Bundle version, such as 0.1.0
        required: true
        type: string
      acknowledge_public_risks:
        description: Confirm this reviewed scope may be public
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
        with:
          node-version: 20

      - name: Show review scope
        env:
          SEED: ${{ inputs.seed }}
        run: npx --yes knowlery@1.2.6 bundle review "$SEED" --dir . --list

      - name: Export requested version
        env:
          SEED: ${{ inputs.seed }}
          VERSION: ${{ inputs.version }}
        run: |
          npx --yes knowlery@1.2.6 bundle export "$SEED" \
            --dir . --bundle-version "$VERSION"

      - name: Publish release
        env:
          GH_TOKEN: ${{ github.token }}
          SEED: ${{ inputs.seed }}
          ACK_PUBLIC: ${{ inputs.acknowledge_public_risks }}
        run: |
          visibility="$(gh repo view "$GITHUB_REPOSITORY" \
            --json visibility --jq '.visibility')"
          args=(bundle publish "$SEED" --dir . --repo "$GITHUB_REPOSITORY")

          if [[ "$visibility" == "PUBLIC" ]]; then
            [[ "$ACK_PUBLIC" == "true" ]] || {
              echo "Public publishing requires explicit acknowledgment."
              exit 1
            }
            args+=(--public --acknowledge-risks)
          fi

          npx --yes knowlery@1.2.6 "${args[@]}"
```

在 GitHub 打开 **Actions → Publish knowledge bundle → Run workflow**，输入 seed 和新
版本。公开仓库只在你主动勾选确认后发布。

::: warning Action 不是审核者
Workflow 不应包含 approve-all，也不应默认加入 `--force`。内容变化会使原批准失效，
导出步骤应当失败并要求回到 Obsidian 或 Agent 会话重新审核。
:::
