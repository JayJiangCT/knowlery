# 快速开始

Knowlery 是为 agent 构建的知识库——一种工作区格式，三个壳层服务：**MCP
服务器**和 **CLI** 面向任何 agent，**Obsidian 插件**在其上提供最丰富的人类
界面。Obsidian 让 Knowlery 的能力最大化，但不是它的边界。

所以起步有两条路，终点相同——一个纯 markdown 的知识库，每个表面都能服务它。

## 路径 A：从你的 agent 开始

*约 5 分钟，不需要 Obsidian。适合常驻 Codex、Claude、Cursor 或 Antigravity
的用户。*

1. **接入**——安装插件（Claude Code / Codex 上一次动作：
   `/plugin marketplace add JayJiangCT/knowlery` →
   `/plugin install knowlery`），或往任意客户端加一段 MCP 配置
   （[各客户端指南](../guides/connect-your-agent)）：

```json
{ "command": "npx", "args": ["-y", "knowlery@^1", "mcp"] }
```

2. **建库或注册——在对话里：**

> "在 ~/kb/main 建一个叫 main 的知识库。"
> ——或者，如果你已有笔记："把 ~/vaults/my-notes 注册为 main。"
> （已有笔记的文件夹需要先跑一条 CLI 命令：
> `npx -y knowlery@^1 init --dir ~/vaults/my-notes --platform claude-code --name "My KB"`——
> 它在你的笔记*旁边*搭脚手架，一个字不动。）

3. **使用——也在对话里：**"记住这个"、"我知道些什么关于……"、"给我的
   知识库做个体检"。完整的自然语言工作流见
   [用对话使用知识库](../guides/talk-to-your-kb)，偏好终端的话见
   [CLI 工作流](../guides/cli-workflows)。

这条路建的知识库，之后随时可以用 Obsidian 零迁移打开——想要评审 dashboard
时装插件即可。

## 路径 B：从 Obsidian 开始

*适合已有 vault、或想从第一天就用可视化评审界面的用户。*

从 Community plugins 安装插件、跑设置向导，即可获得行动优先的 dashboard、
Knowledge health、Freshness Review 和知识包分享 UI——完整演练见
[从 Obsidian 开始](./obsidian)。

这条路建的 vault 也自动对 agent 可用：插件会把它注册进 KB 注册表，MCP 工具
和 CLI 在任何地方都能按名字访问它。

## 无论哪条路，接下来读

- [核心概念](../concepts/)——双层模型（你的笔记 vs 编译知识）、检索、技能；
- [最佳实践](../guides/best-practices)——让知识库在数月尺度保持健康的
  capture → cook → ask 节奏。
