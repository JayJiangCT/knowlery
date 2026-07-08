# Agent 与 MCP

任何支持 MCP 的 agent——Claude Desktop、Claude Code、Cursor、gemini-cli——都可以
直接访问你的知识库。`knowlery mcp` 通过 stdio 运行一个 MCP 服务器：由客户端启动、
自动发现工具，你的知识库从此常驻于每一次对话，无需逐次配置。

服务器通过 **注册表名称** 定位知识库——先注册：

```bash
knowlery kb add work ~/vaults/work-kb
```

## 客户端配置

所有客户端使用同一条命令：`knowlery mcp`。如果客户端的 PATH 中没有
`knowlery`，请全局安装（`npm install -g knowlery`），或使用 `which knowlery`
给出的绝对路径。

### Claude Code

```bash
claude mcp add knowlery -- knowlery mcp
```

### Claude Desktop

在 `claude_desktop_config.json`（Settings → Developer → Edit Config）中添加：

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "knowlery",
      "args": ["mcp"]
    }
  }
}
```

### Cursor

在 `~/.cursor/mcp.json`（全局）或 `.cursor/mcp.json`（项目级）中添加：

```json
{
  "mcpServers": {
    "knowlery": {
      "command": "knowlery",
      "args": ["mcp"]
    }
  }
}
```

### gemini-cli

```bash
gemini mcp add knowlery knowlery mcp
```

或在 `~/.gemini/settings.json` 中添加同样的 `mcpServers` 配置块。

## 工具

| 工具 | 参数 | 作用 |
| --- | --- | --- |
| `list_kbs` | — | 列出所有已注册知识库及其路径与实时状态 |
| `query` | `kb`、`question`、`k?` | 确定性检索；`kb: "*"` 跨全部知识库联邦检索，逐条标注来源 |
| `stale` | `kb` | 比来源更旧的编译页面，以及从未编译的笔记 |
| `health` | `kb` | 工作区完整性检查 |
| `list_bundles` | `kb` | 已安装的知识包及其来源信息 |

每个工具都同时返回可读文本和结构化 JSON（与 CLI 自 0.7 起的 `--json` 形状一致）。

**发现即数据。** 检索弃答（`verdict: "no-confident-match"`）、不健康的 `health`
报告、很长的 `stale` 列表都是 *成功* 的结果——它们本身就是答案，合格的 agent
应如实转述，而不是重试或编造。工具错误只留给真正的故障：未知的知识库名称、
格式错误的输入、磁盘不可读。

- **弃答是一种回答。** 当"知识库中没有可信匹配"为真时，这正是你想听到的。
- **`stale` 输出是待办清单，不是警报。** 它告诉你下次维护知识库时该重新 cook 什么。

## 技能即提示词

知识工作流技能以 MCP prompt 的形式暴露，可从客户端的 prompt 选择器加载：
`ask`、`cook`、`explore`、`challenge`、`ideas`、`audit`、`organize`、
`vault-conventions`、`knowlery-cli`。每个 prompt 原样返回技能正文——与
Obsidian 插件安装的是同一份手艺，如今在任何地方都可机器加载。

## 页面即资源

知识页面可通过 `knowlery://<kb>/<path>` 读取，例如
`knowlery://work/concepts/backpressure.md`。资源列表只展示每个知识库的入口
（`KNOWLEDGE.md`）；agent 通过检索结果和 wikilink 抵达具体页面。

只有 **精选知识层** 可读：`KNOWLEDGE.md`、编译目录（`entities/`、`concepts/`、
`comparisons/`、`queries/`）以及 `Library/` 下的已安装知识包页面。自由笔记
（`Daily/`、`Projects/` 等）会被拒绝——`query` 可能展示原始笔记的标题和路径，
但其内容属于你自己，直到你用 `/cook` 将它编译进知识层。

## 故障排查

- **"Unknown knowledge base"** —— 名称未注册。用 `knowlery kb list` 查看已有
  条目，`knowlery kb add <name> <path>` 补上。
- **工具能发现但每次调用都失败** —— 查看 `list_kbs` 中的状态；`missing` 表示
  文件夹被移动，`uninitialized` 表示尚未初始化（`knowlery init`）。
- **客户端无法启动服务器** —— 客户端可能不继承你 shell 的 PATH，请在配置中
  使用 `knowlery` 的绝对路径。
