# 接入你的 Agent

一个服务器，所有客户端：`knowlery mcp` 通过 stdio 说 MCP 协议，任何支持
MCP 的 agent 都能接入你的知识库。本页按客户端分节。接入之后的用法在哪都
一样——见[用对话使用知识库](./talk-to-your-kb)。

::: tip 1.1 即将到来
Knowlery **agent 插件**会把下面的步骤收敛成一次安装动作（插件 = MCP 配置 +
技能，自动供给）。在那之前，手动 MCP 配置是每个客户端一次性的两分钟工作。
:::

## 开始之前

提供服务器的两种等价方式，下面每一节都通用：

```jsonc
// A. 零安装（推荐）：npx 首次运行时自动拉取
{ "command": "npx", "args": ["-y", "knowlery@^1", "mcp"] }

// B. 全局安装：npm i -g knowlery 之后
{ "command": "knowlery", "args": ["mcp"] }
```

**GUI 客户端**（Claude Desktop、各 IDE）有个值得知道的坑：它们通常不继承
你 shell 的 PATH，如果 node 是 nvm/homebrew 装的，`npx`/`knowlery` 可能
解析不到。最稳的写法是绝对路径：`"command": "/绝对路径/node", "args":
["/绝对路径/knowlery-cli.mjs", "mcp"]`——或至少用 `which npx` 给出的
npx 绝对路径。

## 一览

| 客户端 | 配置位置 | 说明 |
| --- | --- | --- |
| Claude Code | `claude mcp add` | 完整支持 |
| Claude Desktop | `claude_desktop_config.json` | 无 shell：已有知识库靠 `register_kb` 接入 |
| Codex CLI | `~/.codex/config.toml` | 与 Codex 应用共享配置 |
| Codex（应用 / IDE 扩展） | 同一份 `config.toml`，或插件 | 有 shell：CLI 也可用 |
| Cursor | `~/.cursor/mcp.json` 或 deeplink | 也支持项目级 `.cursor/mcp.json` |
| Antigravity Desktop / CLI / IDE | `~/.gemini/config/mcp_config.json` | 一份配置服务三个表面 |

## Claude Code

```bash
claude mcp add knowlery -- npx -y knowlery@^1 mcp
```

重启会话，工具自动出现。在 Knowlery 工作区文件夹里打开时，Claude Code 还会
读取 vault 内安装的技能。

## Claude Desktop

Settings → Developer → Edit Config，在 `claude_desktop_config.json` 的
**顶层**（不是 `preferences` 里面）添加：

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

完全退出（Cmd+Q）再启动——配置只在启动时读取。Knowlery 会出现在
Connectors 里。Claude Desktop 没有 shell，而这正是 MCP 表面存在的意义：
`register_kb` 让已有知识库从对话里接入，九个工具覆盖完整的日常循环。

注意：设置里的「Managed MCP servers」页面是给组织下发的*远程*服务器用的
（要求 URL）——本地 stdio 服务器写在上面的 JSON 配置里。

## Codex CLI

在 `~/.codex/config.toml` 添加：

```toml
[mcp_servers.knowlery]
command = "npx"
args = ["-y", "knowlery@^1", "mcp"]
```

重启 `codex`。Codex 有 shell，所以 `knowlery` CLI 与 MCP 工具并存——
`knowlery-cli` 技能教它命令表面。

## Codex（应用 / IDE 扩展）

应用与 CLI 共享 `~/.codex/config.toml`——上面那段两边通用。等 Knowlery
插件发布（1.1）后，`/plugins` 浏览器将成为一键路径，技能可以用
`@knowlery` 调用。

## Cursor

在 `~/.cursor/mcp.json`（全局）或 `.cursor/mcp.json`（项目级）添加：

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

重载窗口（Cmd+Shift+P → "Reload Window"），在 Settings → MCP 里确认服务器
和工具。Cursor 的 agent 有 shell，CLI 形式同样可用。

## Antigravity 2.0（Desktop、CLI、IDE）

Antigravity 套件三个表面共享一份 MCP 配置。在
`~/.gemini/config/mcp_config.json` 添加：

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "npx",
      "args": ["-y", "knowlery@^1", "mcp"]
    }
  }
}
```

- **Desktop / IDE**：重启后工具附加到 agent 会话；
- **CLI（`agy`）**：运行 `/mcp` 确认服务器并查看工具；
- 跨套件共享的技能放在 `~/.gemini/skills/` 下——Knowlery 插件发布时会
  瞄准这个布局。

## 远程（任何客户端，另一台机器）

以上全部是本地运行服务器。要访问托管在别处的知识库，在宿主机跑
`knowlery mcp serve` 并挂隧道，客户端配 URL + bearer token——见
[远程访问](./agents-mcp#远程访问-自托管)。

## 验证接入

在任何已接入的客户端里问：

> 列出我的知识库。

应返回注册表清单（新机器上是"没有已注册的知识库"——那就说"帮我建个
知识库"，从那里开始）。如果服务器完全没出现：检查 JSON/TOML 语法、改用
绝对路径（上面的 GUI PATH 坑）、确认 Node.js ≥ 18 已安装。
