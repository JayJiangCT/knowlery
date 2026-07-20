# 接入你的 Agent

一个服务器，所有客户端：`knowlery mcp` 通过 stdio 说 MCP 协议，任何支持
MCP 的 agent 都能接入你的知识库。本页按客户端分节。接入之后的用法在哪都
一样——见[用对话使用知识库](./talk-to-your-kb)。

::: tip 最快路径：安装插件
Knowlery **agent 插件**把 MCP 服务器（npx 自动供给）和全部十五个技能打包
在一起，通过两条命令安装：

- **Claude Code**：`/plugin marketplace add JayJiangCT/knowlery` →
  `/plugin install knowlery`
- **Codex**：`codex plugin marketplace add JayJiangCT/knowlery` →
  `codex plugin add knowlery@knowlery`
- **Cursor**：从 checkout 的 `plugin/` 目录或 release zip 安装（marketplace
  上架之前）

详见[作为插件安装](./agents-mcp#作为插件安装)。下面的手动 MCP 配置仍完整
支持——想只要服务器不要技能、或客户端没有插件体系时用它。
:::

## 开始之前

提供服务器的两种等价方式，下面每一节都通用：

```jsonc
// A. 零安装（推荐）：npx 首次运行时自动拉取
{ "command": "npx", "args": ["-y", "knowlery@^1", "mcp"] }

// B. 已安装的 CLI：一行命令，PATH 在征询后处理
//    curl -fsSL https://jayjiangct.github.io/knowlery/install.sh | sh
{ "command": "knowlery", "args": ["mcp"] }
```

安装脚本把 CLI 装进隔离前缀（`~/.knowlery/cli`，无 sudo、不碰全局 npm），
链接到 `~/.local/bin`，并且——仅当该目录不在你的 PATH 上时——展示确切的
配置行并**征询同意**后才碰任何 shell 配置。重复运行即原地升级。
（`npm i -g knowlery` 也可以，但有常见的全局前缀 PATH 问题。）

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
| Codex CLI | 插件或 `~/.codex/config.toml` | `/plugins` 打开插件浏览器；配置与桌面应用共享 |
| Codex Desktop | 插件或共享的 `config.toml` | 支持插件；安装后新建任务 |
| Codex IDE 扩展 | `~/.codex/config.toml` | 支持 MCP 配置；不支持插件 |
| OpenCode | `~/.config/opencode/opencode.json` | Knowlery 一等平台——见配置归属提示 |
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

要安装包含全部技能的插件，运行：

```bash
codex plugin marketplace add JayJiangCT/knowlery
codex plugin add knowlery@knowlery
```

安装后新建 Codex 会话。在交互式 CLI 中运行 `/plugins` 可以检查或启用插件。
如果只需要 MCP 服务器、不需要插件附带的技能，则改为在
`~/.codex/config.toml` 添加：

```toml
[mcp_servers.knowlery]
command = "npx"
args = ["-y", "knowlery@^1", "mcp"]
```

修改配置后重启 `codex`。Codex 有 shell，所以 `knowlery` CLI 与 MCP 工具
并存——`knowlery-cli` 技能教它命令表面。

## Codex Desktop

上面的 marketplace 安装结果与 Codex Desktop 共享。重新启动应用，打开
**Plugins → Installed**，确认 Knowlery 已启用，然后新建任务。在输入框键入
`@`，可以明确选择 Knowlery 或其中的技能。

应用也与 CLI 共享 `~/.codex/config.toml`，所以上面的纯 MCP 配置两边通用。

## Codex IDE 扩展

IDE 扩展不支持插件。请使用上面的 `~/.codex/config.toml` 纯 MCP 配置，重启
扩展后新建会话。

## OpenCode

OpenCode 的配置形状与 Claude 系不同——顶层键是 `mcp`（不是 `mcpServers`）、
每个条目声明 `"type": "local"`、`command` 是**单个数组**（可执行文件和参数
放在一起，没有独立的 `args` 字段）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "knowlery": {
      "type": "local",
      "command": ["npx", "-y", "knowlery@^1", "mcp"],
      "enabled": true
    }
  }
}
```

加到**全局**配置 `~/.config/opencode/opencode.json`（或用交互式的
`opencode mcp add`）。用 `opencode mcp list` 验证连接状态。

::: warning MCP 配置放全局，不要放 vault 里的那份
OpenCode 是 Knowlery 的一等平台：`knowlery init --platform opencode` 会生成
工作区自己的 `opencode.json`（以及 `.agents/rules/` 下的规则），且 Knowlery
在"重新生成 agent 配置"和平台切换时会**重写这个文件**。加在 vault 级
`opencode.json` 里的 MCP 配置会被覆盖——全局配置才是持久的家，而且一份
配置服务所有项目。
:::

OpenCode 的 agent 有 shell，所以 `knowlery` CLI 与 MCP 工具并存；vault 里
由 `init`/`sync` 安装的 `.agents/rules/` 和技能已经在教检索行为准则。

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
