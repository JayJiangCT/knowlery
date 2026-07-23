# 让 Agent 帮你分享

安装 Knowlery agent plugin 后，可以让 Codex、Claude Code 等 Agent 运行同一套 CLI
流程。Agent 可以收集范围、展示清单和执行你的决定，但**不能替你决定哪些内容可以发布**。

## 可直接复制的提示词

```text
请使用 Knowlery CLI 帮我分享一个知识库 bundle。

知识库：<注册名称或 vault 路径>
主题/seed：<例如 concepts/drone-delivery>
版本：0.1.0
目标仓库：owner/kb-bundles
可见性：private

请先检查知识库健康状态，再获取完整的 bundle 审核清单。
逐项展示所有文件和风险提示，不要自行批准、排除、导出或发布。
展示完清单后暂停，等待我的决定。
```

Agent 展示清单后，明确回复：

```text
批准：
- concepts/drone-delivery
- concepts/flight-safety

排除：
- sources/private-meeting

请记录这些决定并以 0.1.0 导出。发布到 owner/kb-bundles，保持 private。
发布前再次复述目标仓库和可见性，等我最终确认。
不要使用 --force。
```

## 公开发布

公开发布时，在提示词中明确写出 `public`，但不要预先授权绕过风险门：

```text
目标仓库是 public。请完整列出所有公开风险项，并说明公开内容可能被缓存或镜像永久保留。
在我看到清单并明确确认之前，不要使用 --acknowledge-risks，也不要发布。
```

## Agent 必须停下来的三个位置

1. **审核清单之后**：Approve/Flag 是你的决定。
2. **公开风险清单之后**：`--acknowledge-risks` 需要本次明确同意。
3. **发布之前**：确认仓库、实际可见性和版本。

发布完成后，要求 Agent 原样返回受众声明、Release URL、SHA-256 和安装命令。Agent
不应索要 GitHub token；私有仓库使用你本机已有的 `gh auth login`。
