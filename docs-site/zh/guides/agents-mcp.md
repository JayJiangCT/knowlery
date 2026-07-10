# Agent 与 MCP

任何支持 MCP 的 agent——Claude Desktop、Claude Code、Codex、OpenCode、
Cursor、Antigravity 套件——都可以直接访问你的知识库。`knowlery mcp` 通过 stdio
运行一个 MCP 服务器：由客户端启动、自动发现工具，你的知识库从此常驻于
每一次对话，无需逐次配置。

服务器通过 **注册表名称** 定位知识库——用 `knowlery kb add work
~/vaults/work-kb` 注册，或在对话里用 `register_kb` 工具接入。

## 客户端配置

各客户端的具体配置（Claude Code、Claude Desktop、Codex 与 Codex CLI、
Cursor、Antigravity Desktop/CLI/IDE）见
**[接入你的 Agent](./connect-your-agent)**——每个客户端一节，含零安装的
`npx` 形式和 GUI PATH 注意事项。接入后怎么用，见
**[用对话使用知识库](./talk-to-your-kb)**。

本页是两者之下的参考层：工具契约、行为准则、可读层边界、远程访问。

## 工具

| 工具 | 参数 | 作用 |
| --- | --- | --- |
| `list_kbs` | — | 列出所有已注册知识库及其路径与实时状态 |
| `query` | `kb`、`question`、`k?` | 确定性检索；`kb: "*"` 跨全部知识库联邦检索，逐条标注来源 |
| `stale` | `kb` | 比来源更旧的编译页面，以及从未编译的笔记 |
| `health` | `kb` | 工作区完整性检查 |
| `list_bundles` | `kb` | 已安装的知识包及其来源信息 |
| `init_kb` | `name`、`path`、`platform?` | 创建并注册一个新知识库——从对话中冷启动 |
| `register_kb` | `name`、`path` | 把已初始化的知识库加入注册表（仅本地 stdio） |
| `capture` | `kb`、`content`、`title?` | 把对话内容存为知识库 `inbox/` 下的新笔记 |
| `sync` | `kb` | 把内置技能和指令文件刷新到当前安装的版本 |

每个工具都同时返回可读文本和结构化 JSON（与 CLI 自 0.7 起的 `--json` 形状一致）。

**发现即数据。** 检索弃答（`verdict: "no-confident-match"`）、不健康的 `health`
报告、很长的 `stale` 列表都是 *成功* 的结果——它们本身就是答案，合格的 agent
应如实转述，而不是重试或编造。工具错误只留给真正的故障：未知的知识库名称、
格式错误的输入、磁盘不可读。

- **弃答是一种回答。** 当"知识库中没有可信匹配"为真时，这正是你想听到的。
- **`stale` 输出是待办清单，不是警报。** 它告诉你下次维护知识库时该重新 cook 什么。

## 写路径

只有四个工具会写入，每个都有结构性边界：

- **`init_kb`** 最多创建一层新目录（父目录必须已存在）、拒绝非空目标，然后注册。
  失败的 init 会清理干净——init 之前就存在的目录永远不会被删除。
- **`register_kb`** 把*已存在且已初始化*的知识库加入注册表——只写注册表文件，
  不碰其他任何东西；重名是硬报错，不会自动改名。`mcp serve` 不提供此工具：
  注册表是机器级全局状态，编辑它只能是本地动作。诚实说明：把一个已有笔记的
  文件夹*变成*知识库仍需 CLI（`knowlery init` 支持 brownfield；MCP 的
  `init_kb` 刻意拒绝非空目录）——初始化后再从对话里注册即可。
- **`capture`** 只向 `inbox/` 追加一条新笔记——文件名由时间戳和 slug 构造，
  从不来自调用方，也从不覆盖任何已有文件。捕获的笔记会立刻出现在 `stale` 的
  *uncooked notes* 里、可被 `query` 检索；`/cook` 把 `inbox/` 视为最优先的
  编译材料。这就是"帮我记住这个"的闭环：对话里捕获，下次 cook 时编译。
- **`sync`** 写入的内容完全由本地安装的 Knowlery 版本决定——调用方不提供任何
  内容。降级守卫（工作区曾被更新版本 sync 过）以 tool error 返回，消息里带
  升级命令。

没有任何工具能写编译层（`entities/`、`concepts/`、`comparisons/`、`queries/`、
`Library/`、`KNOWLEDGE.md`）。内容进入编译层的唯一通道是 `/cook` 的评审管线——
与知识包导出评审同一套门禁哲学。

**写操作行为准则**（每个工具的描述里也写了）：写工具执行的是用户的话，不是
agent 的主动性。只捕获用户要求保存（或用户同意保存）的内容，并回显写入路径。
调用 `init_kb` 之前先在对话里复述解析后的路径——创建目录是用户的决定。sync
运行后报告文件清单。

## 技能即提示词

知识工作流技能以 MCP prompt 的形式暴露，可从客户端的 prompt 选择器加载：
`ask`、`cook`、`explore`、`challenge`、`ideas`、`audit`、`organize`、
`vault-conventions`、`knowlery-cli`、`knowlery-mcp`（前门技能：工具选择、
capture→cook 循环与行为准则——新 MCP 会话里先加载它）。每个 prompt 原样
返回技能正文——与
Obsidian 插件安装的是同一份手艺，如今在任何地方都可机器加载。

## 页面即资源

知识页面可通过 `knowlery://<kb>/<path>` 读取，例如
`knowlery://work/concepts/backpressure.md`。资源列表展示每个知识库的两个
条目：`KNOWLEDGE.md` 和**定位地图**（`knowlery://<kb>/index`）——知识库
内容的实时视图（编译页按目录分组、已安装知识包、未编译计数），每次读取
现算、永不存储。先浏览，后搜索。agent 通过地图、检索结果和 wikilink 抵达
具体页面。

只有 **精选知识层** 可读：`KNOWLEDGE.md`、编译目录（`entities/`、`concepts/`、
`comparisons/`、`queries/`）以及 `Library/` 下的已安装知识包页面。自由笔记
（`Daily/`、`Projects/` 等）会被拒绝——`query` 可能展示原始笔记的标题和路径，
但其内容属于你自己，直到你用 `/cook` 将它编译进知识层。

## 作为插件安装

仓库自带 agent 插件（`plugin/`——与其他一切同源生成）：MCP 服务器配置
（通过 `npx -y knowlery@^1 mcp` 自动供给，无需单独安装）、全部十五个技能，
以及 Claude Code 上把 `knowlery` 放进 agent PATH 的 `bin/` shim。一次安装
替代上面的手动 MCP 配置。

各平台的如实安装路径：

- **Claude Code**（一行命令——仓库本身就是 marketplace）：
  `/plugin marketplace add JayJiangCT/knowlery` →
  `/plugin install knowlery`。技能以插件命名空间出现（具体斜杠形式因
  客户端而异）。
- **Codex**：把仓库加为 marketplace 源
  （`codex plugin marketplace add <source>`），然后
  `codex plugin add knowlery@<marketplace>`；技能用 `@knowlery` 调用。
- **Cursor**：在 marketplace 上架之前，从 checkout 的 `plugin/` 目录
  （或 release zip）安装——两种方式下 MCP 工具和技能都会对 agent 注册。

每个 release 还附带 `knowlery-plugin-<version>.zip`，插件树内容就在压缩包
根部——解压到任何位置即可被 plugin-dir 方式安装指向。插件**不执行任何
安装脚本**——MCP 供给就是配置 + npx，安装时刻没有代码运行。

**插件技能 vs vault 技能**：插件技能是会话级全局、带命名空间的
（具体斜杠形式因客户端而异）；Knowlery 工作区也带自己的副本（`/ask`）。两者从同一
来源同一版本生成——agent 加载哪份，内容都一样，同时看到两份在构造上就是
无害的。

## 远程访问（自托管）

`knowlery mcp serve` 用 Streamable HTTP 运行同一个服务器——用于从另一台机器
访问你的知识库：托管知识库的家庭服务器、在外的笔记本、拿到隧道 URL 的云端 agent。

```bash
# 1. 生成 token（Knowlery 从不为你生成或保存它）
openssl rand -hex 32 > ~/.knowlery-mcp-token

# 2. 启动服务器——只读，绑定回环地址
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token
```

token 也可以来自环境变量 `KNOWLERY_MCP_TOKEN`（只能用一个来源——两个都设是
错误；永远不接受裸命令行参数）。少于 16 字节的 token 会被拒绝。每个请求必须
携带 `Authorization: Bearer <token>`；失败返回不泄露任何信息的 `401`。

**写操作默认全关。** 每个写工具有自己的开关——不打包：

```bash
knowlery mcp serve --port 8787 --token-file ~/.knowlery-mcp-token \
  --allow-capture --allow-sync \
  --allow-init --kb-root ~/kbs
```

没打开的写工具完全不存在——不出现在 `tools/list` 里，也无法调用。
`--allow-init` 必须搭配 `--kb-root`：远程发起的知识库只能创建在该目录之下。

**绑定保持 `127.0.0.1`，前面放隧道**——服务器不做 TLS，线路加密由隧道负责：

```bash
cloudflared tunnel --url http://127.0.0.1:8787   # 快速隧道
tailscale serve 8787                             # 仅 tailnet 可达
ssh -L 8787:127.0.0.1:8787 my-server             # 普通 SSH
```

远程服务器的客户端配置（以 Cursor 为例；Claude Code 用
`claude mcp add --transport http knowlery <url> --header "Authorization: Bearer <token>"`）：

```json
{
  "mcpServers": {
    "knowlery-remote": {
      "url": "https://your-tunnel-host/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### 各类 agent 的真实答案

| Agent 类型 | 1.0 的答案 |
| --- | --- |
| 本地 MCP 客户端（Claude Desktop/Code、Codex、OpenCode、Cursor、Antigravity） | `knowlery mcp` stdio——完整支持，全部九个工具 |
| 有 shell 的云端 agent（Cursor Cloud Agent、Codex 类） | 已被服务：CLI + 知识包分发 |
| 纯网页云端 agent（ChatGPT connectors、Gemini web、Claude web） | 1.0 范围之外——有决心的用户可用自托管远程 + 隧道；零配置的答案是托管平台，那是记录在案的方向，不是 1.0 的交付物 |

## 故障排查

- **"Unknown knowledge base"** —— 名称未注册。用 `knowlery kb list` 查看已有
  条目，`knowlery kb add <name> <path>` 补上。
- **工具能发现但每次调用都失败** —— 查看 `list_kbs` 中的状态；`missing` 表示
  文件夹被移动，`uninitialized` 表示尚未初始化（`knowlery init`）。
- **客户端无法启动服务器** —— 客户端可能不继承你 shell 的 PATH，请在配置中
  使用 `knowlery` 的绝对路径。
